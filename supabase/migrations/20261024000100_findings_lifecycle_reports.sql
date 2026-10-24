-- Phase C: Findings lifecycle, reviews audit trail, and preflight reports.
-- Additive only.

-- -------------------------------------------------- finding reviews
-- Append-only audit history of human review actions on findings.

create table public.finding_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete restrict,
  finding_id uuid not null,
  action text not null check (action in ('acknowledge', 'resolve', 'dismiss', 'reopen')),
  comment text,
  reviewer_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint fr_finding_fk foreign key (finding_id, org_id)
    references public.findings (id, org_id) on delete restrict,
  constraint fr_comment_required_chk check (
    action not in ('resolve', 'dismiss') or (comment is not null and char_length(btrim(comment)) >= 3)
  )
);
create index fr_finding_idx on public.finding_reviews (finding_id, created_at desc);
create index fr_org_idx on public.finding_reviews (org_id, created_at desc);

create trigger fr_append_only before update or delete on public.finding_reviews
  for each row execute function private.forbid_mutation();
create trigger fr_audit after insert on public.finding_reviews
  for each row execute function private.audit_row_change('finding_review');

-- ----------------------------------------------------------- reports
-- Immutable generated preflight reports and evidence manifests tied to exact runs.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete restrict,
  project_id uuid not null,
  monitoring_period_id uuid not null,
  run_id uuid not null,
  report_format text not null check (report_format in ('json', 'markdown', 'csv', 'zip')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  title text not null check (char_length(btrim(title)) between 1 and 255),
  manifest jsonb not null,
  storage_path text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  constraint reports_project_fk foreign key (project_id, org_id)
    references public.projects (id, org_id),
  constraint reports_period_fk foreign key (monitoring_period_id, project_id)
    references public.monitoring_periods (id, project_id),
  constraint reports_run_fk foreign key (run_id, org_id)
    references public.runs (id, org_id)
);
create index reports_run_idx on public.reports (run_id, created_at desc);
create index reports_org_idx on public.reports (org_id, created_at desc);

create trigger reports_append_only before update or delete on public.reports
  for each row execute function private.forbid_mutation();
create trigger reports_audit after insert on public.reports
  for each row execute function private.audit_row_change('report');

-- ---------------------------------------- user action: review finding

create function public.review_finding(
  p_finding_id uuid,
  p_action text,
  p_comment text default null
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_finding public.findings;
  v_new_status public.finding_status;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select * into v_finding from public.findings where id = p_finding_id;
  if not found or not private.caller_can_write(v_finding.org_id) then
    raise exception 'not found' using errcode = '42501';
  end if;

  if p_action not in ('acknowledge', 'resolve', 'dismiss', 'reopen') then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;

  if p_action in ('resolve', 'dismiss') and (p_comment is null or char_length(btrim(p_comment)) < 3) then
    raise exception 'resolving or dismissing a finding requires a comment with at least 3 characters' using errcode = '23514';
  end if;

  if p_action = 'acknowledge' then
    if v_finding.status not in ('open') then
      raise exception 'cannot acknowledge a finding with status %', v_finding.status using errcode = '23514';
    end if;
    v_new_status := 'acknowledged';
  elsif p_action = 'resolve' then
    if v_finding.status not in ('open', 'acknowledged') then
      raise exception 'cannot resolve a finding with status %', v_finding.status using errcode = '23514';
    end if;
    v_new_status := 'resolved';
  elsif p_action = 'dismiss' then
    if v_finding.status not in ('open', 'acknowledged') then
      raise exception 'cannot dismiss a finding with status %', v_finding.status using errcode = '23514';
    end if;
    v_new_status := 'dismissed';
  elsif p_action = 'reopen' then
    if v_finding.status not in ('resolved', 'dismissed', 'acknowledged') then
      raise exception 'cannot reopen an open finding' using errcode = '23514';
    end if;
    v_new_status := 'open';
  end if;

  insert into public.finding_reviews (org_id, finding_id, action, comment, reviewer_id)
  values (v_finding.org_id, v_finding.id, p_action, btrim(p_comment), v_uid);

  update public.findings
  set status = v_new_status
  where id = v_finding.id;

  return v_new_status::text;
end $$;

-- ------------------------------------------------------ privileges, RLS

revoke all on public.finding_reviews, public.reports from anon, authenticated;
grant select on public.finding_reviews, public.reports to authenticated;

alter table public.finding_reviews enable row level security;
alter table public.reports enable row level security;

create policy fr_select on public.finding_reviews for select to authenticated
  using (private.is_member(org_id));
create policy reports_select on public.reports for select to authenticated
  using (private.is_member(org_id));

revoke all on function public.review_finding(uuid, text, text) from public, anon;
grant execute on function public.review_finding(uuid, text, text) to authenticated;
