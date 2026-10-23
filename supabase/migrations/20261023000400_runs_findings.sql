-- Phase B: dates as values, rulepacks, runs, findings, and the audited user actions that review
-- values and request runs. Additive. Not applied anywhere until reviewed.

-- ------------------------------------------------------- values: dates

alter table public.parameter_values add column normalized_date date;
alter table public.parameter_values add constraint pv_one_normalized_chk
  check (normalized_value is null or normalized_date is null);

drop trigger pv_immutable on public.parameter_values;
create trigger pv_immutable before update on public.parameter_values
  for each row execute function private.forbid_column_change(
    'id', 'org_id', 'project_id', 'monitoring_period_id', 'parameter_def_id', 'original_value',
    'normalized_value', 'normalized_date', 'unit', 'source_type', 'evidence_ref_id', 'extractor',
    'asserted_by', 'supersedes_id', 'created_at');

-- Same definition as before; the new column is appended, so existing grants stay in place.
create or replace view public.authoritative_values with (security_invoker = true) as
select v.*
from public.parameter_values v
where v.review_status in ('auto_accepted', 'human_confirmed', 'human_corrected')
  and not exists (select 1 from public.parameter_values s where s.supersedes_id = v.id);

-- Fields where several different values are normal (e.g. one figure per month).
alter table public.parameter_defs add column multiple_values boolean not null default false;

-- More job kinds.
alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('parse_document', 'extract_document', 'run_preflight'));

-- --------------------------------------------------------- rulepacks

create table public.rulepacks (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null,
  version text not null,
  label text not null,
  test_only boolean not null,
  methodology_code text not null,
  methodology_version text not null,
  content_hash text not null unique check (content_hash ~ '^[0-9a-f]{64}$'),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (pack_id, version)
);
create trigger rulepacks_append_only before update or delete on public.rulepacks
  for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------- runs

create type public.run_status as enum ('queued', 'running', 'completed', 'failed');
create type public.finding_status as enum ('open', 'acknowledged', 'resolved', 'dismissed');

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  monitoring_period_id uuid not null,
  status public.run_status not null default 'queued',
  requested_by uuid not null references auth.users (id),
  methodology_code text not null,
  methodology_version text not null,
  rulepack_row_id uuid references public.rulepacks (id),
  rulepack_hash text,
  engine_version text,
  input_snapshot jsonb,
  input_snapshot_hash text,
  result_hash text,
  checks jsonb,
  checks_applicable integer,
  checks_passed integer,
  error_summary text check (error_summary is null or char_length(error_summary) <= 2000),
  previous_run_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (id, org_id),
  constraint runs_project_fk foreign key (project_id, org_id) references public.projects (id, org_id),
  constraint runs_period_fk foreign key (monitoring_period_id, project_id)
    references public.monitoring_periods (id, project_id),
  constraint runs_previous_fk foreign key (previous_run_id, org_id) references public.runs (id, org_id),
  constraint runs_counts_chk check (
    checks_passed is null or (checks_applicable is not null and checks_passed between 0 and checks_applicable))
);
create index runs_period_idx on public.runs (monitoring_period_id, created_at desc);

create function private.runs_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status in ('completed', 'failed') then
    raise exception 'a finished run cannot be changed' using errcode = '23514';
  end if;
  if new.status is distinct from old.status and not (
       (old.status = 'queued' and new.status in ('running', 'failed'))
       or (old.status = 'running' and new.status in ('completed', 'failed'))) then
    raise exception 'invalid run status change % to %', old.status, new.status using errcode = '23514';
  end if;
  if new.status = 'completed' and (
       new.input_snapshot is null or new.input_snapshot_hash is null or new.result_hash is null
       or new.rulepack_hash is null or new.engine_version is null or new.checks is null) then
    raise exception 'a completed run must record its inputs, rulepack, engine and result' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger runs_guard before update on public.runs
  for each row execute function private.runs_guard();
create trigger runs_immutable before update on public.runs
  for each row execute function private.forbid_column_change(
    'id', 'org_id', 'project_id', 'monitoring_period_id', 'requested_by', 'methodology_code',
    'methodology_version', 'previous_run_id', 'created_at');
create trigger runs_no_delete before delete on public.runs
  for each row execute function private.forbid_mutation();
create trigger runs_audit after insert or update on public.runs
  for each row execute function private.audit_row_change('run');

-- ------------------------------------------------------------ findings

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  run_id uuid not null,
  rule_code text not null,
  rule_version text not null,
  finding_type text not null check (
    finding_type in ('data_quality', 'incomplete_input', 'inconsistency', 'calculation_mismatch', 'documentation')),
  severity text not null check (severity in ('critical', 'material', 'minor')),
  status public.finding_status not null default 'open',
  title text not null,
  explanation text not null,
  remediation text not null,
  observed jsonb not null default '{}'::jsonb,
  expected jsonb not null default '{}'::jsonb,
  subject text not null default '',
  created_at timestamptz not null default now(),
  unique (id, org_id),
  constraint findings_run_fk foreign key (run_id, org_id) references public.runs (id, org_id)
);
create index findings_run_idx on public.findings (run_id);

create table public.finding_evidence (
  finding_id uuid not null,
  evidence_ref_id uuid not null,
  org_id uuid not null,
  primary key (finding_id, evidence_ref_id),
  constraint fe_finding_fk foreign key (finding_id, org_id) references public.findings (id, org_id),
  constraint fe_evidence_fk foreign key (evidence_ref_id, org_id) references public.evidence_refs (id, org_id)
);

create table public.finding_values (
  finding_id uuid not null,
  parameter_value_id uuid not null,
  org_id uuid not null,
  primary key (finding_id, parameter_value_id),
  constraint fv_finding_fk foreign key (finding_id, org_id) references public.findings (id, org_id),
  constraint fv_value_fk foreign key (parameter_value_id, org_id) references public.parameter_values (id, org_id)
);

-- Findings are written only while their run is running; afterwards they are fixed (status changes
-- arrive with the review workflow in a later migration).
create function private.finding_needs_running_run()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_run uuid;
begin
  if tg_table_name = 'findings' then
    v_run := new.run_id;
  else
    select f.run_id into v_run from public.findings f where f.id = new.finding_id;
  end if;
  if not exists (select 1 from public.runs r where r.id = v_run and r.status = 'running') then
    raise exception 'findings can only be added to a running run' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger findings_insert_guard before insert on public.findings
  for each row execute function private.finding_needs_running_run();
create trigger finding_evidence_insert_guard before insert on public.finding_evidence
  for each row execute function private.finding_needs_running_run();
create trigger finding_values_insert_guard before insert on public.finding_values
  for each row execute function private.finding_needs_running_run();
create trigger findings_immutable before update on public.findings
  for each row execute function private.forbid_column_change(
    'id', 'org_id', 'run_id', 'rule_code', 'rule_version', 'finding_type', 'severity', 'title',
    'explanation', 'remediation', 'observed', 'expected', 'subject', 'created_at');
create trigger findings_no_delete before delete on public.findings
  for each row execute function private.forbid_mutation();
create trigger finding_evidence_append_only before update or delete on public.finding_evidence
  for each row execute function private.forbid_mutation();
create trigger finding_values_append_only before update or delete on public.finding_values
  for each row execute function private.forbid_mutation();

-- -------------------------------------------- user actions (audited RPC)
-- These run with elevated rights, so each one checks the caller's role in the row's own organization.

create function private.caller_can_write(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role(p_org, array['owner', 'admin', 'member']::public.org_role[])
$$;
revoke all on function private.caller_can_write(uuid) from public;
grant execute on function private.caller_can_write(uuid) to authenticated;

-- Enter a value by hand. With evidence it is a normal reviewed value; without, it is an explicit
-- assertion that stays flagged for review.
create function public.enter_manual_value(
  p_period_id uuid, p_parameter_code text, p_original text,
  p_number numeric default null, p_date date default null, p_unit text default null,
  p_evidence_ref_id uuid default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_period public.monitoring_periods;
  v_project public.projects;
  v_param uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select * into v_period from public.monitoring_periods where id = p_period_id;
  if not found or not private.caller_can_write(v_period.org_id) then
    raise exception 'not found' using errcode = '42501';
  end if;
  select * into v_project from public.projects where id = v_period.project_id;
  select d.id into v_param
  from public.parameter_defs d join public.methodologies m on m.id = d.methodology_id
  where m.code = v_project.methodology_id and m.version = v_project.methodology_version
    and d.parameter_code = p_parameter_code;
  if v_param is null then
    raise exception 'unknown parameter for this project''s methodology' using errcode = '23514';
  end if;
  if p_number is not null and p_date is not null then
    raise exception 'give a number or a date, not both' using errcode = '23514';
  end if;
  insert into public.parameter_values
    (org_id, project_id, monitoring_period_id, parameter_def_id, original_value, normalized_value,
     normalized_date, unit, source_type, evidence_ref_id, asserted_by, review_status)
  values
    (v_period.org_id, v_period.project_id, v_period.id, v_param, p_original, p_number, p_date, p_unit,
     case when p_evidence_ref_id is null then 'asserted'::public.value_source else 'manual_evidenced'::public.value_source end,
     p_evidence_ref_id,
     case when p_evidence_ref_id is null then v_uid end,
     'needs_review')
  returning id into v_id;
  return v_id;
end $$;

-- confirm, reject or correct a value that is waiting for review. Rejecting and correcting need a comment.
create function public.review_value(
  p_value_id uuid, p_action text, p_comment text default null,
  p_number numeric default null, p_date date default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.parameter_values;
  v_new uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select * into v from public.parameter_values where id = p_value_id;
  if not found or not private.caller_can_write(v.org_id) then
    raise exception 'not found' using errcode = '42501';
  end if;
  if v.review_status not in ('needs_review', 'conflicting') then
    raise exception 'this value is not waiting for review' using errcode = '23514';
  end if;
  if p_action in ('reject', 'correct') and coalesce(btrim(p_comment), '') = '' then
    raise exception 'a comment is required' using errcode = '23514';
  end if;

  if p_action = 'confirm' then
    update public.parameter_values
    set review_status = 'human_confirmed', reviewed_by = v_uid, reviewed_at = now()
    where id = v.id;
    return v.id;
  elsif p_action = 'reject' then
    update public.parameter_values
    set review_status = 'rejected', reviewed_by = v_uid, reviewed_at = now()
    where id = v.id;
    return v.id;
  elsif p_action = 'correct' then
    if v.evidence_ref_id is null then
      raise exception 'only a value with evidence can be corrected; reject it and enter a new one' using errcode = '23514';
    end if;
    if (p_number is null) = (p_date is null) then
      raise exception 'give the corrected number or date' using errcode = '23514';
    end if;
    insert into public.parameter_values
      (org_id, project_id, monitoring_period_id, parameter_def_id, original_value, normalized_value,
       normalized_date, unit, source_type, evidence_ref_id, review_status, reviewed_by, reviewed_at, supersedes_id)
    values
      (v.org_id, v.project_id, v.monitoring_period_id, v.parameter_def_id,
       coalesce(p_number::text, p_date::text), p_number, p_date, v.unit, 'manual_evidenced', v.evidence_ref_id,
       'human_corrected', v_uid, now(), v.id)
    returning id into v_new;
    update public.parameter_values
    set review_status = 'rejected', reviewed_by = v_uid, reviewed_at = now()
    where id = v.id;
    return v_new;
  end if;
  raise exception 'unknown action' using errcode = '22023';
end $$;

-- Ask for a preflight run on a monitoring period. The worker takes it from there.
create function public.request_run(p_period_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_period public.monitoring_periods;
  v_project public.projects;
  v_prev uuid;
  v_run uuid;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select * into v_period from public.monitoring_periods where id = p_period_id;
  if not found or not private.caller_can_write(v_period.org_id) then
    raise exception 'not found' using errcode = '42501';
  end if;
  select * into v_project from public.projects where id = v_period.project_id;
  if v_project.methodology_id is null then
    raise exception 'set a methodology on the project before running checks' using errcode = '23514';
  end if;
  if exists (select 1 from public.runs where monitoring_period_id = p_period_id and status in ('queued', 'running')) then
    raise exception 'a run is already in progress for this period' using errcode = '23514';
  end if;
  select id into v_prev from public.runs
  where monitoring_period_id = p_period_id and status = 'completed' order by created_at desc limit 1;

  insert into public.runs (org_id, project_id, monitoring_period_id, requested_by, methodology_code, methodology_version, previous_run_id)
  values (v_period.org_id, v_period.project_id, v_period.id, v_uid, v_project.methodology_id, v_project.methodology_version, v_prev)
  returning id into v_run;
  insert into public.jobs (org_id, kind, payload)
  values (v_period.org_id, 'run_preflight', jsonb_build_object('run_id', v_run));
  return v_run;
end $$;

revoke all on function public.enter_manual_value(uuid, text, text, numeric, date, text, uuid) from public, anon;
revoke all on function public.review_value(uuid, text, text, numeric, date) from public, anon;
revoke all on function public.request_run(uuid) from public, anon;
grant execute on function public.enter_manual_value(uuid, text, text, numeric, date, text, uuid) to authenticated;
grant execute on function public.review_value(uuid, text, text, numeric, date) to authenticated;
grant execute on function public.request_run(uuid) to authenticated;

-- ------------------------------------------------------ privileges, RLS

revoke all on public.rulepacks, public.runs, public.findings, public.finding_evidence, public.finding_values
  from anon, authenticated;
grant select on public.rulepacks, public.runs, public.findings, public.finding_evidence, public.finding_values
  to authenticated;

alter table public.rulepacks enable row level security;
alter table public.runs enable row level security;
alter table public.findings enable row level security;
alter table public.finding_evidence enable row level security;
alter table public.finding_values enable row level security;

create policy rulepacks_select on public.rulepacks for select to authenticated using (true);
create policy runs_select on public.runs for select to authenticated using (private.is_member(org_id));
create policy findings_select on public.findings for select to authenticated using (private.is_member(org_id));
create policy finding_evidence_select on public.finding_evidence for select to authenticated using (private.is_member(org_id));
create policy finding_values_select on public.finding_values for select to authenticated using (private.is_member(org_id));
