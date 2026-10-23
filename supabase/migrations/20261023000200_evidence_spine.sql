-- Phase A evidence spine: documents, parsed text, evidence refs, parameter values, job queue.
-- Additive only. Not applied to any remote project without explicit approval.
-- Writers: the processing worker (service role). Users get read-only access here;
-- user-facing writes arrive later as audited RPC functions.

-- Needed so child tables can use composite foreign keys that keep rows in one tenant and one project.
alter table public.monitoring_periods
  add constraint monitoring_periods_id_org_uk unique (id, org_id),
  add constraint monitoring_periods_id_project_uk unique (id, project_id);

create type public.doc_status as enum ('uploaded', 'processing', 'processed', 'needs_ocr', 'failed');
create type public.value_source as enum ('extracted', 'manual_evidenced', 'asserted', 'calculated');
create type public.review_status as enum
  ('needs_review', 'auto_accepted', 'human_confirmed', 'human_corrected', 'rejected', 'conflicting');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'dead');
create type public.methodology_status as enum ('draft', 'candidate', 'approved', 'retired');

-- ------------------------------------------------- methodologies (global)

create table public.methodologies (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  version text not null,
  source_url text,
  source_hash text check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  effective_date date,
  status public.methodology_status not null default 'draft',
  created_at timestamptz not null default now(),
  unique (code, version)
);

create table public.parameter_defs (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references public.methodologies (id) on delete restrict,
  parameter_code text not null,
  name text not null,
  data_type text not null check (data_type in ('number', 'date', 'text', 'boolean')),
  canonical_unit text,
  description text,
  unique (methodology_id, parameter_code)
);

-- ------------------------------------------------------------ documents

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete restrict,
  project_id uuid not null,
  monitoring_period_id uuid,
  -- Content addressed per tenant: <org_id>/sha256/<hash>. Enforced below.
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  filename text not null check (char_length(filename) between 1 and 255),
  media_type text not null check (media_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  processing_status public.doc_status not null default 'uploaded',
  error_summary text check (error_summary is null or char_length(error_summary) <= 2000),
  -- Same bytes uploaded earlier in this org: the stored object is shared, the record is not.
  duplicate_of_id uuid,
  -- A replacement is a new record pointing at the one it replaces; the original is kept.
  supersedes_id uuid,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (id, org_id),
  unique (id, project_id),
  constraint documents_path_chk check (storage_path = org_id::text || '/sha256/' || sha256),
  constraint documents_project_fk foreign key (project_id, org_id) references public.projects (id, org_id),
  constraint documents_period_fk foreign key (monitoring_period_id, project_id)
    references public.monitoring_periods (id, project_id),
  constraint documents_duplicate_fk foreign key (duplicate_of_id, org_id) references public.documents (id, org_id),
  constraint documents_supersedes_fk foreign key (supersedes_id, org_id) references public.documents (id, org_id),
  constraint documents_not_self_chk check (duplicate_of_id <> id and supersedes_id <> id)
);
create index documents_project_idx on public.documents (project_id, created_at desc);
create index documents_org_sha_idx on public.documents (org_id, sha256);

create table public.parsed_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  document_id uuid not null,
  unit_type text not null check (unit_type in ('page', 'sheet', 'csv')),
  unit_ref text not null,
  text text not null,
  -- [{ "t": "...", "c0": 0, "c1": 5, "locator": {...} }]; offsets index into text.
  spans jsonb not null default '[]'::jsonb check (jsonb_typeof(spans) = 'array'),
  meta jsonb not null default '{}'::jsonb,
  parser_name text not null,
  parser_version text not null,
  created_at timestamptz not null default now(),
  constraint parsed_units_document_fk foreign key (document_id, org_id) references public.documents (id, org_id),
  unique (document_id, unit_type, unit_ref, parser_version)
);
create index parsed_units_document_idx on public.parsed_units (document_id);

create table public.evidence_refs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  document_id uuid not null,
  page_number integer check (page_number is null or page_number >= 1),
  source_text text not null check (char_length(source_text) between 1 and 5000),
  locator jsonb not null check (
    jsonb_typeof(locator) = 'object'
    and coalesce(locator ->> 'type' in ('pdf_span', 'sheet_cell', 'csv_cell', 'text_span'), false)),
  source_hash text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  constraint evidence_refs_document_fk foreign key (document_id, org_id) references public.documents (id, org_id),
  constraint evidence_refs_hash_chk check (
    source_hash = encode(sha256(convert_to(source_text, 'UTF8')), 'hex'))
);
create index evidence_refs_document_idx on public.evidence_refs (document_id);

-- ------------------------------------------------------ parameter values

create table public.parameter_values (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  monitoring_period_id uuid not null,
  parameter_def_id uuid not null references public.parameter_defs (id),
  original_value text not null check (char_length(original_value) between 1 and 1000),
  normalized_value numeric,
  unit text,
  source_type public.value_source not null,
  evidence_ref_id uuid,
  -- { "method": "...", "model": "...", "version": "...", "prompt_hash": "..." }
  extractor jsonb,
  asserted_by uuid references auth.users (id),
  review_status public.review_status not null default 'needs_review',
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  -- A correction is a new row pointing at the one it replaces; history stays.
  supersedes_id uuid,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  constraint pv_project_fk foreign key (project_id, org_id) references public.projects (id, org_id),
  constraint pv_period_fk foreign key (monitoring_period_id, project_id)
    references public.monitoring_periods (id, project_id),
  constraint pv_evidence_fk foreign key (evidence_ref_id, org_id) references public.evidence_refs (id, org_id),
  constraint pv_supersedes_fk foreign key (supersedes_id, org_id) references public.parameter_values (id, org_id),
  -- No orphan numbers: evidence, or an explicit assertion (or a later calculation with its own inputs).
  constraint pv_evidence_required_chk check (evidence_ref_id is not null or source_type in ('asserted', 'calculated')),
  constraint pv_extracted_needs_extractor_chk check (source_type <> 'extracted' or extractor is not null),
  constraint pv_asserted_needs_author_chk check (source_type <> 'asserted' or asserted_by is not null),
  constraint pv_auto_accept_chk check (review_status <> 'auto_accepted' or source_type = 'extracted'),
  constraint pv_human_review_chk check (
    review_status not in ('human_confirmed', 'human_corrected', 'rejected') or reviewed_by is not null)
);
create unique index pv_one_correction_uk on public.parameter_values (supersedes_id) where supersedes_id is not null;
create index pv_period_idx on public.parameter_values (monitoring_period_id, parameter_def_id);

-- Values that may feed an authoritative calculation: reviewed or auto-accepted, and not replaced.
create view public.authoritative_values with (security_invoker = true) as
select v.*
from public.parameter_values v
where v.review_status in ('auto_accepted', 'human_confirmed', 'human_corrected')
  and not exists (select 1 from public.parameter_values s where s.supersedes_id = v.id);

-- ----------------------------------------------------------------- jobs

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete restrict,
  document_id uuid,
  kind text not null check (kind in ('parse_document')),
  payload jsonb not null default '{}'::jsonb,
  status public.job_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts >= 1),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_document_fk foreign key (document_id, org_id) references public.documents (id, org_id)
);
create index jobs_claim_idx on public.jobs (run_after, created_at) where status = 'queued';

-- ------------------------------------------------------------- triggers

create function private.documents_check_transition()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.processing_status is distinct from old.processing_status
     and not (
       (old.processing_status = 'uploaded' and new.processing_status = 'processing')
       or (old.processing_status = 'processing' and new.processing_status in ('processed', 'needs_ocr', 'failed'))
       or (old.processing_status in ('failed', 'needs_ocr') and new.processing_status = 'processing')
     ) then
    raise exception 'invalid document status change % to %', old.processing_status, new.processing_status
      using errcode = '23514';
  end if;
  return new;
end $$;

create function private.value_evidence_consistent()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.evidence_ref_id is not null and not exists (
    select 1
    from public.evidence_refs e
    join public.documents d on d.id = e.document_id and d.org_id = e.org_id
    where e.id = new.evidence_ref_id
      and d.project_id = new.project_id
      and (d.monitoring_period_id is null or d.monitoring_period_id = new.monitoring_period_id)
  ) then
    raise exception 'evidence belongs to a different project or monitoring period' using errcode = '23514';
  end if;
  if new.source_type = 'asserted' and new.review_status <> 'needs_review' then
    raise exception 'an asserted value must start as needs_review' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger documents_immutable before update on public.documents
  for each row execute function private.forbid_column_change(
    'id', 'org_id', 'project_id', 'monitoring_period_id', 'storage_path', 'sha256', 'filename',
    'media_type', 'size_bytes', 'duplicate_of_id', 'supersedes_id', 'uploaded_by', 'created_at');
create trigger documents_transition before update on public.documents
  for each row execute function private.documents_check_transition();
create trigger documents_no_delete before delete on public.documents
  for each row execute function private.forbid_mutation();

create trigger parsed_units_append_only before update or delete on public.parsed_units
  for each row execute function private.forbid_mutation();
create trigger evidence_refs_append_only before update or delete on public.evidence_refs
  for each row execute function private.forbid_mutation();

create trigger pv_check_insert before insert on public.parameter_values
  for each row execute function private.value_evidence_consistent();
create trigger pv_immutable before update on public.parameter_values
  for each row execute function private.forbid_column_change(
    'id', 'org_id', 'project_id', 'monitoring_period_id', 'parameter_def_id', 'original_value',
    'normalized_value', 'unit', 'source_type', 'evidence_ref_id', 'extractor', 'asserted_by',
    'supersedes_id', 'created_at');
create trigger pv_no_delete before delete on public.parameter_values
  for each row execute function private.forbid_mutation();

create trigger jobs_touch before update on public.jobs
  for each row execute function private.touch_updated_at();

create trigger documents_audit after insert or update on public.documents
  for each row execute function private.audit_row_change('document');
create trigger pv_audit after insert or update on public.parameter_values
  for each row execute function private.audit_row_change('parameter_value');

-- -------------------------------------------------- job queue functions
-- Service role only. SKIP LOCKED lets several workers claim without blocking each other.

create function public.claim_job(p_worker text, p_kinds text[])
returns public.jobs
language sql security invoker set search_path = ''
as $$
  update public.jobs j
  set status = 'running', attempts = j.attempts + 1, locked_at = now(), locked_by = p_worker
  where j.id = (
    select q.id from public.jobs q
    where q.status = 'queued' and q.run_after <= now() and q.kind = any (p_kinds)
    order by q.run_after, q.created_at
    for update skip locked
    limit 1
  )
  returning j.*
$$;

create function public.complete_job(p_id uuid, p_worker text)
returns boolean
language sql security invoker set search_path = ''
as $$
  with u as (
    update public.jobs
    set status = 'succeeded', locked_at = null, locked_by = null, last_error = null
    where id = p_id and locked_by = p_worker and status = 'running'
    returning 1
  )
  select exists (select 1 from u)
$$;

-- Retry with exponential backoff (30s, 60s, 120s ... capped at 1h); dead after max_attempts
-- or when the failure is not retryable.
create function public.fail_job(p_id uuid, p_worker text, p_error text, p_retryable boolean default true)
returns public.job_status
language sql security invoker set search_path = ''
as $$
  update public.jobs
  set status = case when not p_retryable or attempts >= max_attempts then 'dead'::public.job_status
                    else 'queued'::public.job_status end,
      run_after = now() + make_interval(secs => least(3600, 30 * power(2, attempts - 1))),
      locked_at = null, locked_by = null, last_error = left(p_error, 2000)
  where id = p_id and locked_by = p_worker and status = 'running'
  returning status
$$;

create function public.requeue_stale_jobs(p_stale interval default interval '15 minutes')
returns integer
language sql security invoker set search_path = ''
as $$
  with u as (
    update public.jobs
    set status = case when attempts >= max_attempts then 'dead'::public.job_status
                      else 'queued'::public.job_status end,
        locked_at = null, locked_by = null, last_error = 'worker lock expired'
    where status = 'running' and locked_at < now() - p_stale
    returning 1
  )
  select count(*)::integer from u
$$;

revoke all on function public.claim_job(text, text[]) from public, anon, authenticated;
revoke all on function public.complete_job(uuid, text) from public, anon, authenticated;
revoke all on function public.fail_job(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.requeue_stale_jobs(interval) from public, anon, authenticated;
grant execute on function public.claim_job(text, text[]) to service_role;
grant execute on function public.complete_job(uuid, text) to service_role;
grant execute on function public.fail_job(uuid, text, text, boolean) to service_role;
grant execute on function public.requeue_stale_jobs(interval) to service_role;

-- ------------------------------------------------------ privileges, RLS

revoke all on public.methodologies, public.parameter_defs, public.documents, public.parsed_units,
  public.evidence_refs, public.parameter_values, public.jobs, public.authoritative_values
  from anon, authenticated;
grant select on public.methodologies, public.parameter_defs, public.documents, public.parsed_units,
  public.evidence_refs, public.parameter_values, public.authoritative_values to authenticated;

alter table public.methodologies enable row level security;
alter table public.parameter_defs enable row level security;
alter table public.documents enable row level security;
alter table public.parsed_units enable row level security;
alter table public.evidence_refs enable row level security;
alter table public.parameter_values enable row level security;
alter table public.jobs enable row level security; -- no policies: worker only

create policy methodologies_select on public.methodologies for select to authenticated using (true);
create policy parameter_defs_select on public.parameter_defs for select to authenticated using (true);
create policy documents_select on public.documents for select to authenticated using (private.is_member(org_id));
create policy parsed_units_select on public.parsed_units for select to authenticated using (private.is_member(org_id));
create policy evidence_refs_select on public.evidence_refs for select to authenticated using (private.is_member(org_id));
create policy pv_select on public.parameter_values for select to authenticated using (private.is_member(org_id));
