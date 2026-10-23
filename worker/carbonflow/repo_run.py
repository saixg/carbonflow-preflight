"""Postgres implementation of the extraction and run operations."""

from __future__ import annotations

import json
from decimal import Decimal

from psycopg.types.json import Jsonb

from . import sql
from .engine import ParamDef, Rulepack, RunResult, Snapshot, Val
from .engine.canon import canonical_json
from .extract.pipeline import ExtractionReport
from .extract.schema import FieldSpec
from .hashing import text_hash
from .parsers.base import ParsedUnit, Span
from .repo import PsycopgRepo
from .runflow import RunRow


def _plain(obj) -> dict:
    """Round-trip through canonical JSON so Decimals and dates become plain JSON values."""
    return json.loads(canonical_json(obj))


class PsycopgRunRepo(PsycopgRepo):
    def _all(self, query, params):
        with self.conn.transaction():
            return self.conn.execute(query, params).fetchall()

    def _one(self, query, params):
        with self.conn.transaction():
            return self.conn.execute(query, params).fetchone()

    # ------------------------------------------------------------ extraction

    def load_units(self, doc_id, org_id):
        rows = self._run(lambda: self._all(sql.LOAD_UNITS, (doc_id, org_id, doc_id, org_id)))
        units = [
            ParsedUnit(
                r["unit_type"], r["unit_ref"], r["text"],
                [Span(s["t"], s["c0"], s["c1"], s["locator"]) for s in r["spans"]], r["meta"],
            )
            for r in rows
        ]
        units.sort(key=lambda u: (u.unit_type, int(u.unit_ref) if u.unit_ref.isdigit() else 0, u.unit_ref))
        return units

    def document_scope(self, doc_id, org_id):
        r = self._run(lambda: self._one(sql.DOCUMENT_SCOPE, (doc_id, org_id)))
        if not r:
            return None
        return str(r["project_id"]), (str(r["monitoring_period_id"]) if r["monitoring_period_id"] else None)

    def field_specs(self, project_id, org_id):
        rows = self._run(lambda: self._all(sql.FIELD_SPECS, (project_id, org_id)))
        return [FieldSpec(r["parameter_code"], r["data_type"], r["canonical_unit"], r["description"] or r["parameter_code"], r["multiple_values"]) for r in rows]

    def save_extraction(self, doc_id, org_id, project_id, period_id, report: ExtractionReport) -> int:
        def go():
            stored = 0
            with self.conn.transaction():
                defs = {
                    r["parameter_code"]: r["def_id"]
                    for r in self.conn.execute(sql.FIELD_SPECS, (project_id, org_id)).fetchall()
                }
                for ev in report.values:
                    a = ev.accepted
                    def_id = defs.get(a.parameter)
                    if def_id is None:
                        continue
                    locator = Jsonb(a.locator)
                    digest = text_hash(a.source_text)
                    if self.conn.execute(sql.EVIDENCE_EXISTS, (org_id, doc_id, digest, locator, def_id, a.original)).fetchone():
                        continue  # re-running extraction must not duplicate values
                    ev_id = self.conn.execute(
                        sql.INSERT_EVIDENCE, (org_id, doc_id, a.page_number, a.source_text, locator, digest)
                    ).fetchone()["id"]
                    self.conn.execute(
                        sql.INSERT_EXTRACTED_VALUE,
                        (org_id, project_id, period_id, def_id, a.original, a.number, a.day, a.unit, ev_id,
                         Jsonb({**ev.extractor, "notes": ev.notes}), ev.review_status),
                    )
                    stored += 1
            return stored

        return self._run(go)

    def enqueue_job(self, org_id, kind, document_id=None, payload=None):
        def go():
            with self.conn.transaction():
                self.conn.execute(sql.ENQUEUE_JOB, (org_id, document_id, kind, Jsonb(payload or {})))

        self._run(go)

    # ------------------------------------------------------------------ runs

    def load_run(self, run_id, org_id):
        r = self._run(lambda: self._one(sql.LOAD_RUN, (run_id, org_id)))
        if not r:
            return None
        return RunRow(str(r["id"]), str(r["org_id"]), str(r["project_id"]), str(r["monitoring_period_id"]),
                      r["status"], r["methodology_code"], r["methodology_version"])

    def start_run(self, run_id, org_id):
        return self._run(lambda: self._one(sql.START_RUN, (run_id, org_id))) is not None

    def load_snapshot(self, run: RunRow) -> Snapshot:
        def go():
            with self.conn.transaction():
                period = self.conn.execute(sql.SNAPSHOT_PERIOD, (run.period_id, run.org_id)).fetchone()
                params = self.conn.execute(sql.SNAPSHOT_PARAMS, (run.methodology_code, run.methodology_version)).fetchall()
                values = self.conn.execute(sql.SNAPSHOT_VALUES, (run.period_id, run.org_id)).fetchall()
            return period, params, values

        period, params, values = self._run(go)
        return Snapshot(
            org_id=run.org_id, project_id=run.project_id, period_id=run.period_id,
            period_start=period["start_date"], period_end=period["end_date"],
            methodology_code=run.methodology_code, methodology_version=run.methodology_version,
            params=tuple(ParamDef(p["parameter_code"], p["data_type"], p["canonical_unit"]) for p in params),
            values=tuple(
                Val(
                    id=str(v["id"]), parameter=v["parameter_code"], original=v["original_value"],
                    review_status=v["review_status"],
                    number=Decimal(v["normalized_value"]) if v["normalized_value"] is not None else None,
                    day=v["normalized_date"], unit=v["unit"],
                    document_id=str(v["document_id"]) if v["document_id"] else None,
                    evidence_ref_ids=(str(v["evidence_ref_id"]),) if v["evidence_ref_id"] else (),
                    source_type=v["source_type"],
                )
                for v in values
            ),
        )

    def register_rulepack(self, pack: Rulepack) -> str:
        def go():
            with self.conn.transaction():
                row = self.conn.execute(
                    sql.REGISTER_RULEPACK,
                    (pack.id, pack.version, pack.label, pack.test_only, pack.methodology_code,
                     pack.methodology_version, pack.content_hash, Jsonb(pack.doc)),
                ).fetchone()
                if row is None:
                    row = self.conn.execute(sql.RULEPACK_BY_HASH, (pack.content_hash,)).fetchone()
            return str(row["id"])

        return self._run(go)

    def finish_run(self, run: RunRow, snapshot: Snapshot, pack_row_id: str, result: RunResult) -> None:
        def go():
            with self.conn.transaction():
                for f in result.findings:
                    fid = self.conn.execute(
                        sql.INSERT_FINDING,
                        (run.org_id, run.id, f.rule_code, f.rule_version, f.finding_type, f.severity, f.title,
                         f.explanation, f.remediation, Jsonb(_plain(f.observed)), Jsonb(_plain(f.expected)), f.subject),
                    ).fetchone()["id"]
                    for ev in f.evidence_ref_ids:
                        self.conn.execute(sql.LINK_FINDING_EVIDENCE, (fid, ev, run.org_id))
                    for vid in f.value_ids:
                        self.conn.execute(sql.LINK_FINDING_VALUE, (fid, vid, run.org_id))
                self.conn.execute(
                    sql.COMPLETE_RUN,
                    (pack_row_id, result.rulepack_hash, result.engine_version,
                     Jsonb(_plain(snapshot.to_canonical())), result.snapshot_hash, result.result_hash,
                     Jsonb([{"rule": c.rule_code, "status": c.status, "category": c.category} for c in result.checks]),
                     result.applicable, result.passed, run.id, run.org_id),
                )

        self._run(go)

    def fail_run(self, run_id, org_id, message):
        def go():
            with self.conn.transaction():
                self.conn.execute(sql.FAIL_RUN, (message, run_id, org_id))

        self._run(go)
