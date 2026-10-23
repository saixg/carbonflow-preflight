"""Database access for the worker.

The worker connects with a privileged role that bypasses row-level security, so EVERY query here is
scoped by org_id taken from the job or document row, never from user input. Tests prove a job for
one tenant cannot read or write another tenant's rows.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .errors import TransientError
from .parsers.base import ParseResult


@dataclass(frozen=True)
class NewDocument:
    org_id: str
    project_id: str
    monitoring_period_id: str | None
    storage_path: str
    sha256: str
    filename: str
    media_type: str
    size_bytes: int
    uploaded_by: str
    duplicate_of_id: str | None = None
    supersedes_id: str | None = None


@dataclass(frozen=True)
class DocumentRow:
    id: str
    org_id: str
    project_id: str
    storage_path: str
    sha256: str
    filename: str
    media_type: str
    processing_status: str


@dataclass(frozen=True)
class Job:
    id: str
    org_id: str
    document_id: str | None
    kind: str
    attempts: int
    max_attempts: int
    payload: dict = field(default_factory=dict)


class Repo(Protocol):
    def find_duplicate(self, org_id: str, sha256: str) -> str | None: ...
    def register_document(self, doc: NewDocument) -> str: ...
    def get_document(self, doc_id: str, org_id: str) -> DocumentRow | None: ...
    def set_status(self, doc_id: str, org_id: str, status: str, error: str | None = None) -> None: ...
    def save_parsed_units(self, doc_id: str, org_id: str, result: ParseResult) -> int: ...
    def claim_job(self, worker: str, kinds: list[str]) -> Job | None: ...
    def complete_job(self, job_id: str, worker: str) -> bool: ...
    def fail_job(self, job_id: str, worker: str, error: str, retryable: bool) -> str | None: ...
    def requeue_stale(self) -> int: ...


class PsycopgRepo:
    def __init__(self, conn: psycopg.Connection):
        conn.row_factory = dict_row
        self.conn = conn

    def _run(self, fn):
        try:
            return fn()
        except psycopg.OperationalError as e:
            raise TransientError("database unavailable") from e

    def find_duplicate(self, org_id, sha256):
        def go():
            with self.conn.transaction():
                row = self.conn.execute(
                    "select id from public.documents where org_id = %s and sha256 = %s order by created_at limit 1",
                    (org_id, sha256),
                ).fetchone()
            return str(row["id"]) if row else None

        return self._run(go)

    def register_document(self, d: NewDocument) -> str:
        def go():
            with self.conn.transaction():
                row = self.conn.execute(
                    """insert into public.documents
                       (org_id, project_id, monitoring_period_id, storage_path, sha256, filename, media_type,
                        size_bytes, uploaded_by, duplicate_of_id, supersedes_id)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) returning id""",
                    (d.org_id, d.project_id, d.monitoring_period_id, d.storage_path, d.sha256, d.filename,
                     d.media_type, d.size_bytes, d.uploaded_by, d.duplicate_of_id, d.supersedes_id),
                ).fetchone()
                doc_id = str(row["id"])
                self.conn.execute(
                    "insert into public.jobs (org_id, document_id, kind) values (%s, %s, 'parse_document')",
                    (d.org_id, doc_id),
                )
            return doc_id

        return self._run(go)

    def get_document(self, doc_id, org_id):
        def go():
            with self.conn.transaction():
                r = self.conn.execute(
                    """select id, org_id, project_id, storage_path, sha256, filename, media_type, processing_status
                       from public.documents where id = %s and org_id = %s""",
                    (doc_id, org_id),
                ).fetchone()
            if not r:
                return None
            return DocumentRow(**{k: (str(v) if k.endswith("id") else v) for k, v in r.items()})

        return self._run(go)

    def set_status(self, doc_id, org_id, status, error=None):
        def go():
            with self.conn.transaction():
                self.conn.execute(
                    """update public.documents
                       set processing_status = %s::public.doc_status,
                           error_summary = %s,
                           processed_at = case when %s = 'processed' then now() else processed_at end
                       where id = %s and org_id = %s and processing_status <> %s::public.doc_status""",
                    (status, error, status, doc_id, org_id, status),
                )

        self._run(go)

    def save_parsed_units(self, doc_id, org_id, result):
        def go():
            n = 0
            with self.conn.transaction():
                for u in result.units:
                    cur = self.conn.execute(
                        """insert into public.parsed_units
                           (org_id, document_id, unit_type, unit_ref, text, spans, meta, parser_name, parser_version)
                           values (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                           on conflict (document_id, unit_type, unit_ref, parser_version) do nothing""",
                        (org_id, doc_id, u.unit_type, u.unit_ref, u.text,
                         Jsonb([s.to_json() for s in u.spans]), Jsonb(u.meta),
                         result.parser_name, result.parser_version),
                    )
                    n += cur.rowcount
            return n

        return self._run(go)

    def claim_job(self, worker, kinds):
        def go():
            with self.conn.transaction():
                r = self.conn.execute("select * from public.claim_job(%s, %s)", (worker, kinds)).fetchone()
            # A SQL function returning a row yields an all-null row when nothing is queued.
            if not r or r["id"] is None:
                return None
            return Job(str(r["id"]), str(r["org_id"]),
                       str(r["document_id"]) if r["document_id"] else None,
                       r["kind"], r["attempts"], r["max_attempts"], r["payload"] or {})

        return self._run(go)

    def complete_job(self, job_id, worker):
        def go():
            with self.conn.transaction():
                return bool(self.conn.execute("select public.complete_job(%s, %s) as ok", (job_id, worker)).fetchone()["ok"])

        return self._run(go)

    def fail_job(self, job_id, worker, error, retryable):
        def go():
            with self.conn.transaction():
                r = self.conn.execute("select public.fail_job(%s, %s, %s, %s) as s", (job_id, worker, error, retryable)).fetchone()
            return r["s"]

        return self._run(go)

    def requeue_stale(self):
        def go():
            with self.conn.transaction():
                return self.conn.execute("select public.requeue_stale_jobs() as n").fetchone()["n"]

        return self._run(go)
