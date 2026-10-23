import pytest

from carbonflow import limits
from carbonflow.errors import IntegrityError, LimitExceeded, NotFound, UnsupportedFile
from carbonflow.hashing import sha256_hex
from carbonflow.ingest import clean_filename, finalize_upload
from carbonflow.pipeline import process_job
from carbonflow.worker import run

from .conftest import make_scanned_pdf
from .fakes import MemoryRepo, MemoryStore

ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
PROJECT = "11111111-1111-1111-1111-111111111111"
USER = "22222222-2222-2222-2222-222222222222"


def upload(repo, store, data: bytes, *, org=ORG_A, name="Report.pdf", declared="application/pdf", staging=None):
    staging = staging or f"{org}/staging/abc123"
    store.objects[staging] = data
    return finalize_upload(
        repo=repo, store=store, org_id=org, project_id=PROJECT, monitoring_period_id=None,
        staging_path=staging, filename=name, declared_media_type=declared, uploaded_by=USER,
    )


def test_upload_hashes_stores_and_queues_a_parse_job(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    r = upload(repo, store, report_pdf)
    assert r.sha256 == sha256_hex(report_pdf)
    assert r.storage_path == f"{ORG_A}/sha256/{r.sha256}"
    assert store.objects[r.storage_path] == report_pdf
    assert f"{ORG_A}/staging/abc123" not in store.objects  # staging cleaned
    assert repo.docs[r.document_id].row.processing_status == "uploaded"
    assert [j["kind"] for j in repo.jobs.values()] == ["parse_document"]


def test_same_bytes_share_one_object_but_get_separate_records(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    first = upload(repo, store, report_pdf)
    second = upload(repo, store, report_pdf, name="again.pdf", staging=f"{ORG_A}/staging/def456")
    assert first.object_created is True and second.object_created is False
    assert second.document_id != first.document_id
    assert second.duplicate_of_id == first.document_id
    assert len([k for k in store.objects if "/sha256/" in k]) == 1


def test_same_bytes_in_another_org_are_not_linked_or_shared(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    a = upload(repo, store, report_pdf, org=ORG_A)
    b = upload(repo, store, report_pdf, org=ORG_B)
    assert b.duplicate_of_id is None
    assert a.storage_path != b.storage_path


def test_staging_path_from_another_org_is_treated_as_not_found(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    store.objects[f"{ORG_B}/staging/x"] = report_pdf
    with pytest.raises(NotFound):
        finalize_upload(repo=repo, store=store, org_id=ORG_A, project_id=PROJECT, monitoring_period_id=None,
                        staging_path=f"{ORG_B}/staging/x", filename="a.pdf", declared_media_type="application/pdf", uploaded_by=USER)
    with pytest.raises(NotFound):  # path tricks
        finalize_upload(repo=repo, store=store, org_id=ORG_A, project_id=PROJECT, monitoring_period_id=None,
                        staging_path=f"{ORG_A}/staging/../{ORG_B}/staging/x", filename="a.pdf", declared_media_type="application/pdf", uploaded_by=USER)
    assert not repo.docs


def test_bad_uploads_are_rejected_before_anything_is_stored(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    with pytest.raises(UnsupportedFile):
        upload(repo, store, report_pdf, declared="text/csv", name="data.csv")  # PDF pretending to be CSV
    with pytest.raises(UnsupportedFile):
        upload(repo, store, b"MZ\x90\x00\x03", declared="application/pdf")
    with pytest.raises(UnsupportedFile):
        upload(repo, store, b"", declared="application/pdf")
    with pytest.raises(LimitExceeded):
        upload(repo, store, b"a" * (limits.MAX_FILE_BYTES + 1), declared="text/csv")
    assert not repo.docs
    assert not [k for k in store.objects if "/sha256/" in k]


def test_filenames_are_sanitized():
    assert clean_filename("..\\..\\evil\\report.pdf") == "report.pdf"
    assert clean_filename("a/b/c.pdf") == "c.pdf"
    assert clean_filename("bad\x00name\n.pdf") == "badname.pdf"
    assert clean_filename("") == "document"
    assert len(clean_filename("x" * 400)) == 255


# --------------------------------------------------------------- pipeline


def test_full_flow_parses_and_marks_processed(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    r = upload(repo, store, report_pdf)
    assert run(repo, store, "w1", max_jobs=1) == 1
    doc = repo.docs[r.document_id]
    assert doc.row.processing_status == "processed"
    assert {k[1] for k in doc.units} == {"1", "2"}
    assert next(iter(repo.jobs.values()))["status"] == "succeeded"


def test_object_that_does_not_match_its_hash_is_never_parsed(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    r = upload(repo, store, report_pdf)
    store.objects[r.storage_path] = report_pdf + b"tampered"
    run(repo, store, "w1", max_jobs=1)
    doc = repo.docs[r.document_id]
    assert doc.row.processing_status == "failed"
    assert "hash" in doc.error
    assert not doc.units
    assert next(iter(repo.jobs.values()))["status"] == "dead"  # integrity errors are not retried


def test_scanned_pdf_ends_as_needs_ocr_not_failure():
    repo, store = MemoryRepo(), MemoryStore()
    r = upload(repo, store, make_scanned_pdf())
    run(repo, store, "w1", max_jobs=1)
    assert repo.docs[r.document_id].row.processing_status == "needs_ocr"
    assert next(iter(repo.jobs.values()))["status"] == "succeeded"


def test_corrupted_file_fails_without_retry():
    repo, store = MemoryRepo(), MemoryStore()
    r = upload(repo, store, b"%PDF-1.7\nnot a real pdf")
    run(repo, store, "w1", max_jobs=1)
    assert repo.docs[r.document_id].row.processing_status == "failed"
    assert next(iter(repo.jobs.values()))["status"] == "dead"


def test_storage_hiccup_is_retried_and_then_succeeds(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    r = upload(repo, store, report_pdf)
    store.fail_get = 1
    run(repo, store, "w1", max_jobs=1)
    job = next(iter(repo.jobs.values()))
    assert job["status"] == "queued" and "hiccup" in job["last_error"]
    assert repo.docs[r.document_id].row.processing_status == "failed"
    run(repo, store, "w1", max_jobs=1)
    assert job["status"] == "succeeded"
    assert repo.docs[r.document_id].row.processing_status == "processed"


def test_reprocessing_is_idempotent(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    r = upload(repo, store, report_pdf)
    run(repo, store, "w1", max_jobs=1)
    units_before = dict(repo.docs[r.document_id].units)
    # a duplicate job for already-processed work must not redo or alter anything
    job_id = repo._id()
    repo.jobs[job_id] = {"id": job_id, "org_id": ORG_A, "document_id": r.document_id, "kind": "parse_document",
                         "status": "queued", "attempts": 0, "max_attempts": 5, "locked_by": None, "last_error": None}
    run(repo, store, "w2", max_jobs=1)
    assert repo.jobs[job_id]["status"] == "succeeded"
    assert repo.docs[r.document_id].units == units_before


def test_a_job_cannot_reach_another_tenants_document(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    r = upload(repo, store, report_pdf, org=ORG_A)
    job_id = repo._id()
    repo.jobs[job_id] = {"id": job_id, "org_id": ORG_B, "document_id": r.document_id, "kind": "parse_document",
                         "status": "queued", "attempts": 0, "max_attempts": 5, "locked_by": None, "last_error": None}
    job = repo.claim_job("w1", ["parse_document"])
    # first queued job is org A's own; take the forged one explicitly
    while job and job.id != job_id:
        job = repo.claim_job("w1", ["parse_document"])
    assert process_job(repo, store, job, "w1") == "dead"
    assert repo.docs[r.document_id].row.processing_status == "uploaded"  # untouched
    assert not repo.docs[r.document_id].units


def test_unknown_job_kind_is_not_retried(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    upload(repo, store, report_pdf)
    job = repo.claim_job("w1", ["parse_document"])
    forged = type(job)(job.id, job.org_id, job.document_id, "run_rules", job.attempts, job.max_attempts)
    assert process_job(repo, store, forged, "w1") == "dead"


def test_unexpected_errors_are_retried_without_leaking_details(report_pdf):
    repo, store = MemoryRepo(), MemoryStore()
    upload(repo, store, report_pdf)

    class Boom(MemoryStore):
        def get(self, *a, **k):
            raise RuntimeError("secret connection string postgres://user:pass@host")

    run(repo, Boom(), "w1", max_jobs=1)
    job = next(iter(repo.jobs.values()))
    assert job["status"] == "queued"
    assert "pass" not in job["last_error"] and "RuntimeError" in job["last_error"]
