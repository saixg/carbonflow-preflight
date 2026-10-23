from datetime import date
from pathlib import Path

import pytest

from carbonflow.engine import load_rulepack
from carbonflow.extract import FieldSpec, ProviderError, RawResult
from carbonflow.pipeline import Services
from carbonflow.runflow import pick_rulepack
from carbonflow.worker import run

from .conftest import make_pdf
from .fakes import MemoryStore
from .fakes_run import MemoryRunRepo
from .test_ingest_pipeline import ORG_A, ORG_B, upload

PACK = load_rulepack(Path(__file__).resolve().parents[2] / "rulepacks" / "test-only-0.1.0.json")
FIELDS = [
    FieldSpec("net_export_mwh", "number", "MWh", "Net electricity exported"),
    FieldSpec("period_start", "date", None, "Monitoring period start"),
    FieldSpec("period_end", "date", None, "Monitoring period end"),
    FieldSpec("installed_capacity_mw", "number", "MW", "Installed capacity"),
    FieldSpec("grid_emission_factor", "number", "tCO2/MWh", "Emission factor"),
    FieldSpec("claimed_emission_reductions_tco2", "number", "tCO2", "Claimed reductions"),
]

LINES = [
    "The monitoring period starts on 01 January 2023 and ends on 31 December 2023.",
    "The total net electricity exported to the grid was 152,345 MWh.",
    "Installed capacity: 100 MW",
    "The grid emission factor is 0.82 tCO2/MWh.",
    "Claimed emission reductions: 135,000 tCO2",
]


def c(parameter, quote, value, unit):
    return {"parameter": parameter, "quote": quote, "value_text": value, "unit_text": unit}


CANDS = [
    c("period_start", "starts on 01 January 2023", "01 January 2023", None),
    c("period_end", "ends on 31 December 2023", "31 December 2023", None),
    c("net_export_mwh", "exported to the grid was 152,345 MWh", "152,345", "MWh"),
    c("installed_capacity_mw", "Installed capacity: 100 MW", "100", "MW"),
    c("grid_emission_factor", "emission factor is 0.82 tCO2/MWh", "0.82", "tCO2/MWh"),
    c("claimed_emission_reductions_tco2", "Claimed emission reductions: 135,000 tCO2", "135,000", "tCO2"),
]


class Model:
    name = "scripted"

    def __init__(self, candidates=CANDS, down=False):
        self.candidates, self.down = candidates, down

    def extract(self, fields, text, unit_ref, variant):
        if self.down:
            raise ProviderError("down")
        return RawResult(list(self.candidates), {"provider": "scripted", "model": "fake", "prompt_hash": "ph"})

    def verify(self, spec, passage, value_text, unit_text):
        return True


def setup(provider=None, auto_accept=False):
    repo = MemoryRunRepo(FIELDS, period_dates=(date(2023, 1, 1), date(2023, 12, 31)))
    store = MemoryStore()
    services = Services(provider=provider, rulepacks=[PACK], auto_accept=auto_accept)
    return repo, store, services


def process_all(repo, store, services, max_jobs=20):
    return run(repo, store, "w1", services=services, max_jobs=max_jobs)


def upload_report(repo, store):
    return upload(repo, store, make_pdf([LINES]))


def confirm_all(repo):
    for v in repo.values:
        v.status = "human_confirmed"


def test_upload_to_findings_end_to_end():
    repo, store, services = setup(Model())
    doc = upload_report(repo, store)
    process_all(repo, store, services)  # parse, then extract
    assert repo.docs[doc.document_id].row.processing_status == "processed"
    assert len(repo.values) == 6 and {v.status for v in repo.values} == {"needs_review"}
    assert all(v.evidence_id in repo.evidence and repo.evidence[v.evidence_id]["locator"]["type"] == "pdf_span" for v in repo.values)
    assert all(v.extractor["model"] == "fake" for v in repo.values)

    # nothing is confirmed, so a run sees nothing and says so
    rid = repo.new_run(ORG_A)
    process_all(repo, store, services)
    first = repo.runs[rid]["result"]
    assert repo.runs[rid]["status"] == "completed"
    assert {f.rule_code for f in first.findings if f.finding_type == "incomplete_input"}  # cannot evaluate, not "passed"
    assert any(f.rule_code == "T-PRES-001" for f in first.findings)

    # a person confirms the values; the claimed figure is inflated so the recomputation check fires
    confirm_all(repo)
    rid2 = repo.new_run(ORG_A)
    process_all(repo, store, services)
    second = repo.runs[rid2]["result"]
    real = [f for f in second.findings if f.finding_type != "incomplete_input"]
    assert {f.rule_code for f in real} == {"T-CALC-002"}  # the monthly figures were never supplied, so that check says so
    assert any(f.rule_code == "T-CALC-001" and f.finding_type == "incomplete_input" for f in second.findings)
    f = real[0]
    assert f.evidence_ref_ids  # traceable to the passages the values came from
    assert second.snapshot_hash != first.snapshot_hash
    # the original run is untouched
    assert repo.runs[rid]["result"] is first


def test_same_inputs_give_the_same_result_hash_across_runs():
    repo, store, services = setup(Model())
    upload_report(repo, store)
    process_all(repo, store, services)
    confirm_all(repo)
    a, b = repo.new_run(ORG_A), repo.new_run(ORG_A)
    process_all(repo, store, services)
    assert repo.runs[a]["result"].result_hash == repo.runs[b]["result"].result_hash
    assert repo.runs[a]["result"].snapshot_hash == repo.runs[b]["result"].snapshot_hash


def test_extraction_is_idempotent():
    repo, store, services = setup(Model())
    doc = upload_report(repo, store)
    process_all(repo, store, services)
    repo.enqueue_job(ORG_A, "extract_document", doc.document_id)
    process_all(repo, store, services)
    assert len(repo.values) == 6


def test_without_a_provider_documents_still_parse_and_nothing_is_invented():
    repo, store, services = setup(provider=None)
    doc = upload_report(repo, store)
    process_all(repo, store, services)
    assert repo.docs[doc.document_id].row.processing_status == "processed"
    assert repo.values == []
    assert [j["kind"] for j in repo.jobs.values()] == ["parse_document"]  # no extraction job was queued


def test_model_outage_retries_extraction_instead_of_storing_nothing_silently():
    repo, store, services = setup(Model(down=True))
    upload_report(repo, store)
    process_all(repo, store, services, max_jobs=2)  # the parse job, then one attempt at extraction
    extract = next(j for j in repo.jobs.values() if j["kind"] == "extract_document")
    assert extract["status"] == "queued" and "unavailable" in extract["last_error"]
    assert repo.values == []


def test_auto_accept_stays_off_until_enabled():
    repo, store, services = setup(Model(), auto_accept=True)
    upload_report(repo, store)
    process_all(repo, store, services)
    assert {v.status for v in repo.values} == {"auto_accepted"}  # agreement in all passes plus the independent check


def test_run_without_a_matching_rulepack_fails_cleanly():
    repo, store, services = setup(Model())
    rid = repo.new_run(ORG_A, version="9.9")
    process_all(repo, store, services)
    assert repo.runs[rid]["status"] == "failed" and "no rulepack" in repo.runs[rid]["error"]
    job = next(j for j in repo.jobs.values() if j["kind"] == "run_preflight")
    assert job["status"] == "dead"  # a missing rulepack will not fix itself, so it is not retried


def test_run_for_another_tenant_cannot_load():
    repo, store, services = setup(Model())
    rid = repo.new_run(ORG_B)
    job = next(j for j in repo.jobs.values() if j["kind"] == "run_preflight")
    job["org_id"] = ORG_A  # a forged job pointing at someone else's run
    process_all(repo, store, services)
    assert repo.runs[rid]["status"] == "queued"  # never touched
    assert job["status"] == "dead"


def test_rulepack_choice_prefers_exact_methodology_and_never_guesses():
    assert pick_rulepack([PACK], "TEST-ONLY", "0.1") is PACK
    assert pick_rulepack([PACK], "TEST-ONLY", "0.2") is None
    assert pick_rulepack([PACK], "OTHER", "0.1") is None
