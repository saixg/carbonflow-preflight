-- Phase 1 foundation: orgs, members, projects, monitoring_periods, audit_log.
-- Additive only. Not applied to any remote project without explicit approval.

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.project_status as enum ('draft', 'active', 'archived');
create type public.period_status as enum ('draft', 'open', 'closed');

-- ---------------------------------------------------------------- tables

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index members_user_id_idx on public.members (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  project_type text,
  -- Methodology is a free reference until the methodology decision gate is passed.
  methodology_id text,
  methodology_version text,
  status public.project_status not null default 'draft',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  check ((methodology_id is null) = (methodology_version is null))
);
create index projects_org_id_idx on public.projects (org_id);

create table public.monitoring_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  start_date date not null,
  end_date date not null,
  status public.period_status not null default 'draft',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  constraint monitoring_periods_dates_chk check (end_date >= start_date),
  -- Composite FK makes it structurally impossible to attach a period to another tenant's project.
  constraint monitoring_periods_project_fk
    foreign key (project_id, org_id) references public.projects (id, org_id) on delete restrict,
  -- Periods of one project may not overlap (inclusive date ranges).
  constraint monitoring_periods_no_overlap
    exclude using gist (project_id with =, daterange(start_date, end_date, '[]') with &&)
);
create index monitoring_periods_org_id_idx on public.monitoring_periods (org_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs (id) on delete restrict,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_id_idx on public.audit_log (org_id, created_at desc);

-- ------------------------------------------------------ private helpers

create function private.current_role_in(p_org uuid)
returns public.org_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.members m
  where m.org_id = p_org and m.user_id = (select auth.uid())
  limit 1
$$;

create function private.is_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.current_role_in(p_org) is not null
$$;

create function private.has_role(p_org uuid, p_roles public.org_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.current_role_in(p_org) = any (p_roles), false)
$$;

revoke all on function private.current_role_in(uuid) from public;
revoke all on function private.is_member(uuid) from public;
revoke all on function private.has_role(uuid, public.org_role[]) from public;
grant execute on function private.current_role_in(uuid) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.org_role[]) to authenticated;

-- ------------------------------------------------------------- triggers

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Columns named in tg_argv are immutable after insert.
create function private.forbid_column_change()
returns trigger language plpgsql set search_path = ''
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if to_jsonb(new) -> col is distinct from to_jsonb(old) -> col then
      raise exception 'column % is immutable on %', col, tg_table_name using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

create function private.forbid_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;

create function private.protect_last_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.members m
       where m.org_id = old.org_id and m.role = 'owner' and m.id <> old.id
     ) then
    raise exception 'an organization must keep at least one owner' using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;

-- tg_argv[0] = entity type. Stores only changed columns on update, never full rows.
create function private.audit_row_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_row jsonb := case when tg_op = 'DELETE' then v_old else v_new end;
  v_org uuid;
  v_meta jsonb := '{}'::jsonb;
begin
  v_org := case when tg_table_name = 'orgs' then (v_row ->> 'id')::uuid
                else (v_row ->> 'org_id')::uuid end;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(k.key, jsonb_build_object('old', v_old -> k.key, 'new', v_new -> k.key)), '{}'::jsonb)
      into v_meta
      from jsonb_object_keys(v_new) as k(key)
      where k.key <> 'updated_at' and v_old -> k.key is distinct from v_new -> k.key;
  end if;
  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_org, auth.uid(), tg_argv[0] || '.' || lower(tg_op), tg_argv[0], (v_row ->> 'id')::uuid, v_meta);
  return null;
end $$;

create trigger projects_touch before update on public.projects
  for each row execute function private.touch_updated_at();
create trigger projects_immutable before update on public.projects
  for each row execute function private.forbid_column_change('id', 'org_id', 'created_by', 'created_at');
create trigger periods_immutable before update on public.monitoring_periods
  for each row execute function private.forbid_column_change('id', 'org_id', 'project_id', 'created_by', 'created_at');
create trigger members_immutable before update on public.members
  for each row execute function private.forbid_column_change('id', 'org_id', 'user_id', 'created_at');
create trigger members_last_owner before update or delete on public.members
  for each row execute function private.protect_last_owner();
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function private.forbid_mutation();

create trigger orgs_audit after insert or update on public.orgs
  for each row execute function private.audit_row_change('org');
create trigger members_audit after insert or update or delete on public.members
  for each row execute function private.audit_row_change('member');
create trigger projects_audit after insert or update on public.projects
  for each row execute function private.audit_row_change('project');
create trigger periods_audit after insert or update on public.monitoring_periods
  for each row execute function private.audit_row_change('monitoring_period');

-- ----------------------------------------------------------------- RPC

-- The only way to create an organization; the caller becomes its owner.
create function public.create_org(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  insert into public.orgs (name) values (p_name) returning id into v_org;
  insert into public.members (org_id, user_id, role) values (v_org, v_uid, 'owner');
  return v_org;
end $$;
revoke all on function public.create_org(text) from public, anon;
grant execute on function public.create_org(text) to authenticated;

-- ------------------------------------------------------------ privileges

revoke all on public.orgs, public.members, public.projects,
  public.monitoring_periods, public.audit_log from anon, authenticated;
grant select, update on public.orgs to authenticated;
grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, insert, update on public.monitoring_periods to authenticated;
grant select on public.audit_log to authenticated;

-- ------------------------------------------------------------------ RLS

alter table public.orgs enable row level security;
alter table public.members enable row level security;
alter table public.projects enable row level security;
alter table public.monitoring_periods enable row level security;
alter table public.audit_log enable row level security;

create policy orgs_select on public.orgs for select to authenticated
  using (private.is_member(id));
create policy orgs_update on public.orgs for update to authenticated
  using (private.has_role(id, array['owner', 'admin']::public.org_role[]))
  with check (private.has_role(id, array['owner', 'admin']::public.org_role[]));

create policy members_select on public.members for select to authenticated
  using (private.is_member(org_id));
create policy members_insert on public.members for insert to authenticated
  with check (private.has_role(org_id, array['owner']::public.org_role[]));
create policy members_update on public.members for update to authenticated
  using (private.has_role(org_id, array['owner']::public.org_role[]))
  with check (private.has_role(org_id, array['owner']::public.org_role[]));
create policy members_delete on public.members for delete to authenticated
  using (private.has_role(org_id, array['owner']::public.org_role[]));

create policy projects_select on public.projects for select to authenticated
  using (private.is_member(org_id));
create policy projects_insert on public.projects for insert to authenticated
  with check (
    private.has_role(org_id, array['owner', 'admin', 'member']::public.org_role[])
    and created_by = (select auth.uid())
  );
create policy projects_update on public.projects for update to authenticated
  using (private.has_role(org_id, array['owner', 'admin', 'member']::public.org_role[]))
  with check (private.has_role(org_id, array['owner', 'admin', 'member']::public.org_role[]));

create policy periods_select on public.monitoring_periods for select to authenticated
  using (private.is_member(org_id));
create policy periods_insert on public.monitoring_periods for insert to authenticated
  with check (
    private.has_role(org_id, array['owner', 'admin', 'member']::public.org_role[])
    and created_by = (select auth.uid())
  );
create policy periods_update on public.monitoring_periods for update to authenticated
  using (private.has_role(org_id, array['owner', 'admin', 'member']::public.org_role[]))
  with check (private.has_role(org_id, array['owner', 'admin', 'member']::public.org_role[]));

create policy audit_select on public.audit_log for select to authenticated
  using (private.has_role(org_id, array['owner', 'admin']::public.org_role[]));
