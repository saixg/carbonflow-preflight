"""In-memory run repo mirroring the rules the database enforces (authoritative values only, runs finish once)."""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from decimal import Decimal

from carbonflow.engine import ParamDef, Rulepack, RunResult, Snapshot, Val
from carbonflow.extract.schema import FieldSpec
from carbonflow.hashing import text_hash
from carbonflow.runflow import RunRow

from .fakes import MemoryRepo

AUTHORITATIVE = {"auto_accepted", "human_confirmed", "human_corrected"}


@dataclass
class Row:
    id: str
    parameter: str
    original: str
    number: Decimal | None
    day: object
    unit: str | None
    status: str
    evidence_id: str
    document_id: str
    org_id: str
    period_id: str
    extractor: dict = field(default_factory=dict)


class MemoryRunRepo(MemoryRepo):
    def __init__(self, fields: list[FieldSpec], project="p1", period="per1", period_dates=None):
        super().__init__()
        self.fields, self.project, self.period = fields, project, period
        self.period_dates = period_dates
        self.units: dict[str, list] = {}
        self.values: list[Row] = []
        self.evidence: dict[str, dict] = {}
        self.runs: dict[str, dict] = {}
        self.findings: list[dict] = []
        self.rulepacks: dict[str, Rulepack] = {}
        self._seq = itertools.count(1)

    # extraction
    def save_parsed_units(self, doc_id, org_id, result):
        self.units[doc_id] = list(result.units)
        return super().save_parsed_units(doc_id, org_id, result)

    def load_units(self, doc_id, org_id):
        return self.units[doc_id] if self.docs[doc_id].row.org_id == org_id else []

    def document_scope(self, doc_id, org_id):
        d = self.docs.get(doc_id)
        return (self.project, self.period) if d and d.row.org_id == org_id else None

    def field_specs(self, project_id, org_id):
        return self.fields

    def save_extraction(self, doc_id, org_id, project_id, period_id, report):
        n = 0
        for ev in report.values:
            a = ev.accepted
            digest = text_hash(a.source_text)
            if any(r.document_id == doc_id and r.parameter == a.parameter and r.original == a.original
                   and self.evidence[r.evidence_id]["hash"] == digest and self.evidence[r.evidence_id]["locator"] == a.locator
                   for r in self.values):
                continue
            eid = f"e{next(self._seq):03d}"
            self.evidence[eid] = {"hash": digest, "locator": a.locator, "text": a.source_text, "page": a.page_number}
            self.values.append(Row(f"v{next(self._seq):03d}", a.parameter, a.original, a.number, a.day, a.unit,
                                   ev.review_status, eid, doc_id, org_id, period_id, {**ev.extractor, "notes": ev.notes}))
            n += 1
        return n

    def enqueue_job(self, org_id, kind, document_id=None, payload=None):
        jid = self._id()
        self.jobs[jid] = {"id": jid, "org_id": org_id, "document_id": document_id, "kind": kind, "status": "queued",
                          "attempts": 0, "max_attempts": 5, "locked_by": None, "last_error": None, "payload": payload or {}}

    # runs
    def new_run(self, org_id, code="TEST-ONLY", version="0.1"):
        rid = self._id()
        self.runs[rid] = {"id": rid, "org_id": org_id, "status": "queued", "code": code, "version": version}
        self.enqueue_job(org_id, "run_preflight", payload={"run_id": rid})
        return rid

    def load_run(self, run_id, org_id):
        r = self.runs.get(run_id)
        if not r or r["org_id"] != org_id:
            return None
        return RunRow(run_id, org_id, self.project, self.period, r["status"], r["code"], r["version"])

    def start_run(self, run_id, org_id):
        r = self.runs[run_id]
        if r["org_id"] != org_id or r["status"] != "queued":
            return False
        r["status"] = "running"
        return True

    def load_snapshot(self, run):
        start, end = self.period_dates
        vals = tuple(
            Val(v.id, v.parameter, v.original, v.status, v.number, v.day, v.unit, v.document_id, (v.evidence_id,))
            for v in self.values
            if v.status in AUTHORITATIVE and v.org_id == run.org_id and v.period_id == run.period_id
        )
        params = tuple(ParamDef(f.code, f.data_type, f.canonical_unit) for f in self.fields)
        return Snapshot(run.org_id, run.project_id, run.period_id, start, end, run.methodology_code, run.methodology_version, params, vals)

    def register_rulepack(self, pack):
        self.rulepacks[pack.content_hash] = pack
        return pack.content_hash

    def finish_run(self, run, snapshot, pack_row_id, result: RunResult):
        r = self.runs[run.id]
        assert r["status"] == "running"
        r.update(status="completed", result=result, snapshot=snapshot, pack=pack_row_id)
        self.findings += [{"run": run.id, "finding": f} for f in result.findings]

    def fail_run(self, run_id, org_id, message):
        r = self.runs[run_id]
        if r["status"] in ("queued", "running"):
            r.update(status="failed", error=message)

    def claim_job(self, worker, kinds):
        job = super().claim_job(worker, kinds)
        if job:
            from carbonflow.repo import Job

            return Job(job.id, job.org_id, job.document_id, job.kind, job.attempts, job.max_attempts, self.jobs[job.id].get("payload", {}))
        return job
