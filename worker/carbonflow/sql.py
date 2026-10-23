"""Every statement the run and extraction jobs send to Postgres, in one place.

Keeping them here lets the same text be executed against a real database in tests (and by hand),
instead of living only inside Python methods. %s are psycopg placeholders.
"""

LOAD_UNITS = """
select unit_type, unit_ref, text, spans, meta
from public.parsed_units
where document_id = %s and org_id = %s
  and parser_version = (
    select parser_version from public.parsed_units
    where document_id = %s and org_id = %s order by created_at desc limit 1)
"""

DOCUMENT_SCOPE = "select project_id, monitoring_period_id from public.documents where id = %s and org_id = %s"

FIELD_SPECS = """
select pd.id as def_id, pd.parameter_code, pd.data_type, pd.canonical_unit, pd.description, pd.multiple_values
from public.projects p
join public.methodologies m on m.code = p.methodology_id and m.version = p.methodology_version
join public.parameter_defs pd on pd.methodology_id = m.id
where p.id = %s and p.org_id = %s and pd.data_type in ('number', 'date')
order by pd.parameter_code
"""

EVIDENCE_EXISTS = """
select 1
from public.evidence_refs e
join public.parameter_values v on v.evidence_ref_id = e.id and v.org_id = e.org_id
where e.org_id = %s and e.document_id = %s and e.source_hash = %s and e.locator = %s
  and v.parameter_def_id = %s and v.original_value = %s
limit 1
"""

INSERT_EVIDENCE = """
insert into public.evidence_refs (org_id, document_id, page_number, source_text, locator, source_hash)
values (%s, %s, %s, %s, %s, %s) returning id
"""

INSERT_EXTRACTED_VALUE = """
insert into public.parameter_values
  (org_id, project_id, monitoring_period_id, parameter_def_id, original_value, normalized_value, normalized_date,
   unit, source_type, evidence_ref_id, extractor, review_status)
values (%s, %s, %s, %s, %s, %s, %s, %s, 'extracted', %s, %s, %s::public.review_status)
"""

ENQUEUE_JOB = "insert into public.jobs (org_id, document_id, kind, payload) values (%s, %s, %s, %s)"

LOAD_RUN = """
select id, org_id, project_id, monitoring_period_id, status, methodology_code, methodology_version
from public.runs where id = %s and org_id = %s
"""

START_RUN = """
update public.runs set status = 'running', started_at = now()
where id = %s and org_id = %s and status = 'queued' returning id
"""

SNAPSHOT_PERIOD = "select start_date, end_date from public.monitoring_periods where id = %s and org_id = %s"

SNAPSHOT_PARAMS = """
select pd.parameter_code, pd.data_type, pd.canonical_unit
from public.methodologies m
join public.parameter_defs pd on pd.methodology_id = m.id
where m.code = %s and m.version = %s
"""

SNAPSHOT_VALUES = """
select v.id, pd.parameter_code, v.original_value, v.review_status, v.normalized_value, v.normalized_date,
       v.unit, v.source_type, v.evidence_ref_id, e.document_id
from public.authoritative_values v
join public.parameter_defs pd on pd.id = v.parameter_def_id
left join public.evidence_refs e on e.id = v.evidence_ref_id and e.org_id = v.org_id
where v.monitoring_period_id = %s and v.org_id = %s
"""

REGISTER_RULEPACK = """
insert into public.rulepacks (pack_id, version, label, test_only, methodology_code, methodology_version, content_hash, content)
values (%s, %s, %s, %s, %s, %s, %s, %s)
on conflict (content_hash) do nothing returning id
"""

RULEPACK_BY_HASH = "select id from public.rulepacks where content_hash = %s"

INSERT_FINDING = """
insert into public.findings
  (org_id, run_id, rule_code, rule_version, finding_type, severity, title, explanation, remediation, observed, expected, subject)
values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id
"""

LINK_FINDING_EVIDENCE = """
insert into public.finding_evidence (finding_id, evidence_ref_id, org_id) values (%s, %s, %s) on conflict do nothing
"""

LINK_FINDING_VALUE = """
insert into public.finding_values (finding_id, parameter_value_id, org_id) values (%s, %s, %s) on conflict do nothing
"""

COMPLETE_RUN = """
update public.runs
set status = 'completed', completed_at = now(), rulepack_row_id = %s, rulepack_hash = %s, engine_version = %s,
    input_snapshot = %s, input_snapshot_hash = %s, result_hash = %s, checks = %s,
    checks_applicable = %s, checks_passed = %s
where id = %s and org_id = %s and status = 'running'
"""

FAIL_RUN = """
update public.runs set status = 'failed', error_summary = %s, completed_at = now()
where id = %s and org_id = %s and status in ('queued', 'running')
"""
