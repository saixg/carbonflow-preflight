"""Run one queued job from claim to outcome: parse a document, extract its values, or run the checks."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from . import limits
from .engine import Rulepack
from .errors import IntegrityError, NeedsOcr, NotFound, WorkerError
from .extract import ExtractionProvider
from .hashing import sha256_hex
from .parsers import parse_document
from .repo import Job, Repo
from .runflow import process_extract, process_run
from .storage import ObjectStore

log = logging.getLogger("carbonflow.pipeline")


@dataclass
class Services:
    """Optional capabilities. Without a provider, uploads still parse and everything can be entered by hand."""

    provider: ExtractionProvider | None = None
    rulepacks: list[Rulepack] = field(default_factory=list)
    auto_accept: bool = False


def process_job(repo: Repo, store: ObjectStore, job: Job, worker: str, services: Services | None = None) -> str:
    """Handle a claimed job and report the outcome to the queue.

    Logs identifiers and timings only, never file contents.
    """
    services = services or Services()
    org = job.org_id
    try:
        if job.kind == "parse_document" and job.document_id:
            outcome = _parse(repo, store, job, worker, services)
        elif job.kind == "extract_document" and job.document_id:
            outcome = _extract(repo, job, worker, services)
        elif job.kind == "run_preflight":
            outcome = _run(repo, job, worker, services)
        else:
            raise WorkerError(f"unsupported job kind {job.kind}")
        return outcome
    except WorkerError as e:
        return _fail(repo, job, worker, str(e) or e.__class__.__name__, e.retryable)
    except Exception as e:  # unknown failure: retry, but say what class it was without leaking content
        return _fail(repo, job, worker, f"unexpected {e.__class__.__name__}", True)


def _parse(repo, store, job, worker, services) -> str:
    org = job.org_id
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
    if services.provider is not None:
        repo.enqueue_job(org, "extract_document", doc.id)
    repo.complete_job(job.id, worker)
    log.info("document %s parsed: %d units, %d new, %d warnings", doc.id, len(result.units), saved, len(result.warnings))
    return "succeeded"


def _extract(repo, job, worker, services) -> str:
    if services.provider is None:
        raise WorkerError("no extraction provider is configured")
    stored = process_extract(repo, services.provider, job.document_id, job.org_id, auto_accept=services.auto_accept)
    repo.complete_job(job.id, worker)
    log.info("document %s extraction stored %d value(s)", job.document_id, stored)
    return "succeeded"


def _run(repo, job, worker, services) -> str:
    run_id = (job.payload or {}).get("run_id")
    if not isinstance(run_id, str):
        raise WorkerError("run job has no run id")
    result = process_run(repo, services.rulepacks, run_id, job.org_id)
    repo.complete_job(job.id, worker)
    log.info("run %s finished: %d findings, %d/%d checks passed", run_id, len(result.findings), result.passed, result.applicable)
    return "succeeded"


def _fail(repo: Repo, job: Job, worker: str, message: str, retryable: bool) -> str:
    if job.kind == "parse_document" and job.document_id:
        try:
            repo.set_status(job.document_id, job.org_id, "failed", message[:1900])
        except Exception:
            log.exception("could not mark document %s failed", job.document_id)
    outcome = repo.fail_job(job.id, worker, message, retryable)
    log.warning("job %s failed (%s): %s", job.id, outcome, message)
    return outcome or "failed"
