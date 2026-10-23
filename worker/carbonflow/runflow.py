"""Extraction and preflight-run jobs. Glue between the repo, the extractor and the rule engine."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .engine import Rulepack, RunResult, Snapshot, load_rulepack, run_rulepack
from .errors import NotFound, TransientError, WorkerError
from .extract import ExtractionProvider, extract_units
from .extract.pipeline import ExtractionReport
from .extract.schema import FieldSpec
from .parsers.base import ParsedUnit

log = logging.getLogger("carbonflow.runflow")


class RunRepo(Protocol):
    def load_units(self, doc_id: str, org_id: str) -> list[ParsedUnit]: ...
    def document_scope(self, doc_id: str, org_id: str) -> tuple[str, str | None] | None: ...
    def field_specs(self, project_id: str, org_id: str) -> list[FieldSpec]: ...
    def save_extraction(self, doc_id: str, org_id: str, project_id: str, period_id: str, report: ExtractionReport) -> int: ...
    def enqueue_job(self, org_id: str, kind: str, document_id: str | None = None, payload: dict | None = None) -> None: ...

    def load_run(self, run_id: str, org_id: str) -> "RunRow | None": ...
    def start_run(self, run_id: str, org_id: str) -> bool: ...
    def load_snapshot(self, run: "RunRow") -> Snapshot: ...
    def register_rulepack(self, pack: Rulepack) -> str: ...
    def finish_run(self, run: "RunRow", snapshot: Snapshot, pack_row_id: str, result: RunResult) -> None: ...
    def fail_run(self, run_id: str, org_id: str, message: str) -> None: ...


@dataclass(frozen=True)
class RunRow:
    id: str
    org_id: str
    project_id: str
    period_id: str
    status: str
    methodology_code: str
    methodology_version: str


def process_extract(repo: RunRepo, provider: ExtractionProvider, doc_id: str, org_id: str, *, auto_accept: bool = False, passes: int = 3) -> int:
    """Extract candidate values from a parsed document. Returns how many rows were stored."""
    scope = repo.document_scope(doc_id, org_id)
    if scope is None:
        raise NotFound("document not found for this organization")
    project_id, period_id = scope
    if period_id is None:
        log.info("document %s has no monitoring period; nothing to extract into", doc_id)
        return 0
    fields = repo.field_specs(project_id, org_id)
    if not fields:
        return 0
    units = repo.load_units(doc_id, org_id)
    report = extract_units(document_id=doc_id, units=units, fields=fields, provider=provider, passes=passes, auto_accept=auto_accept)
    if report.pass_errors and not report.values:
        raise TransientError("the extraction model was unavailable; will retry")
    return repo.save_extraction(doc_id, org_id, project_id, period_id, report)


def pick_rulepack(rulepacks: list[Rulepack], code: str, version: str) -> Rulepack | None:
    """Newest rulepack for this exact methodology and version. Test-only packs are used only when nothing else exists."""
    fits = [p for p in rulepacks if (p.methodology_code, p.methodology_version) == (code, version)]
    if not fits:
        return None
    fits.sort(key=lambda p: (not p.test_only, p.version))
    return fits[-1]


def load_rulepacks(directory: str | Path) -> list[Rulepack]:
    return [load_rulepack(p) for p in sorted(Path(directory).glob("*.json"))]


def process_run(repo: RunRepo, rulepacks: list[Rulepack], run_id: str, org_id: str) -> RunResult:
    """Freeze inputs, run the rules, store findings. Any failure marks the run failed; it is never half-written."""
    run = repo.load_run(run_id, org_id)
    if run is None:
        raise NotFound("run not found for this organization")
    if not repo.start_run(run_id, org_id):
        raise WorkerError("run is not queued")
    try:
        pack = pick_rulepack(rulepacks, run.methodology_code, run.methodology_version)
        if pack is None:
            raise WorkerError(f"no rulepack for {run.methodology_code} {run.methodology_version}")
        snapshot = repo.load_snapshot(run)
        result = run_rulepack(pack, snapshot)
        pack_row = repo.register_rulepack(pack)
        repo.finish_run(run, snapshot, pack_row, result)
        return result
    except Exception as e:
        repo.fail_run(run_id, org_id, str(e)[:1900] if isinstance(e, WorkerError) else f"unexpected {e.__class__.__name__}")
        raise
