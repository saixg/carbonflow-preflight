"""Run one parse job: verify integrity, parse, store text with locators, update status."""

from __future__ import annotations

import logging

from . import limits
from .errors import IntegrityError, NeedsOcr, NotFound, WorkerError
from .hashing import sha256_hex
from .parsers import parse_document
from .repo import Job, Repo
from .storage import ObjectStore

log = logging.getLogger("carbonflow.pipeline")


def process_job(repo: Repo, store: ObjectStore, job: Job, worker: str) -> str:
    """Handle a claimed job and report the outcome to the queue. Returns the final job outcome.

    Logs identifiers and timings only, never file contents.
    """
    org = job.org_id
    try:
        if job.kind != "parse_document" or not job.document_id:
            raise WorkerError(f"unsupported job kind {job.kind}")
        doc = repo.get_document(job.document_id, org)
        if doc is None:
            raise NotFound("document not found for this organization")
        if doc.processing_status == "processed":
            repo.complete_job(job.id, worker)  # a duplicate job for finished work is a no-op
            return "succeeded"

        repo.set_status(doc.id, org, "processing")
        data = store.get(doc.storage_path, limits.MAX_FILE_BYTES)
        if sha256_hex(data) != doc.sha256:
            raise IntegrityError("stored object does not match the recorded hash")

        try:
            result = parse_document(data, doc.media_type)
        except NeedsOcr as e:
            repo.set_status(doc.id, org, "needs_ocr", str(e))
            repo.complete_job(job.id, worker)
            log.info("document %s needs OCR", doc.id)
            return "needs_ocr"

        saved = repo.save_parsed_units(doc.id, org, result)
        note = "; ".join(result.warnings)[:1900] or None
        repo.set_status(doc.id, org, "processed", note)
        repo.complete_job(job.id, worker)
        log.info("document %s parsed: %d units, %d new, %d warnings", doc.id, len(result.units), saved, len(result.warnings))
        return "succeeded"

    except WorkerError as e:
        return _fail(repo, job, worker, str(e) or e.__class__.__name__, e.retryable)
    except Exception as e:  # unknown failure: retry, but say what class it was without leaking content
        return _fail(repo, job, worker, f"unexpected {e.__class__.__name__}", True)


def _fail(repo: Repo, job: Job, worker: str, message: str, retryable: bool) -> str:
    if job.document_id:
        try:
            repo.set_status(job.document_id, job.org_id, "failed", message[:1900])
        except Exception:
            log.exception("could not mark document %s failed", job.document_id)
    outcome = repo.fail_job(job.id, worker, message, retryable)
    log.warning("job %s failed (%s): %s", job.id, outcome, message)
    return outcome or "failed"
