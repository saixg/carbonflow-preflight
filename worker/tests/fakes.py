"""In-memory stand-ins for storage and the database, with the same behaviour the real ones promise."""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field

from carbonflow.errors import LimitExceeded, NotFound, TransientError
from carbonflow.repo import DocumentRow, Job, NewDocument
from carbonflow.parsers.base import ParseResult


class MemoryStore:
    def __init__(self):
        self.objects: dict[str, bytes] = {}
        self.fail_get = 0  # raise TransientError this many times

    def get(self, path, max_bytes):
        if self.fail_get > 0:
            self.fail_get -= 1
            raise TransientError("storage hiccup")
        if path not in self.objects:
            raise NotFound("object not found")
        data = self.objects[path]
        if len(data) > max_bytes:
            raise LimitExceeded("file is larger than the allowed size")
        return data

    def put_if_absent(self, path, data, content_type):
        if path in self.objects:
            return False
        self.objects[path] = data
        return True

    def delete(self, path):
        self.objects.pop(path, None)


@dataclass
class _Doc:
    row: DocumentRow
    error: str | None = None
    units: dict = field(default_factory=dict)


class MemoryRepo:
    def __init__(self):
        self.docs: dict[str, _Doc] = {}
        self.jobs: dict[str, dict] = {}
        self._ids = itertools.count(1)
        self.statuses: list[tuple[str, str]] = []

    def _id(self) -> str:
        return f"00000000-0000-0000-0000-{next(self._ids):012d}"

    def find_duplicate(self, org_id, sha256):
        for d in self.docs.values():
            if d.row.org_id == org_id and d.row.sha256 == sha256:
                return d.row.id
        return None

    def register_document(self, d: NewDocument) -> str:
        doc_id = self._id()
        self.docs[doc_id] = _Doc(
            DocumentRow(doc_id, d.org_id, d.project_id, d.storage_path, d.sha256, d.filename, d.media_type, "uploaded")
        )
        job_id = self._id()
        self.jobs[job_id] = {"id": job_id, "org_id": d.org_id, "document_id": doc_id, "kind": "parse_document",
                             "status": "queued", "attempts": 0, "max_attempts": 5, "locked_by": None, "last_error": None}
        return doc_id

    def get_document(self, doc_id, org_id):
        d = self.docs.get(doc_id)
        return d.row if d and d.row.org_id == org_id else None

    def set_status(self, doc_id, org_id, status, error=None):
        d = self.docs.get(doc_id)
        if not d or d.row.org_id != org_id:
            return
        if d.row.processing_status != status:
            d.row = DocumentRow(**{**d.row.__dict__, "processing_status": status})
            self.statuses.append((doc_id, status))
        d.error = error

    def save_parsed_units(self, doc_id, org_id, result: ParseResult):
        d = self.docs[doc_id]
        assert d.row.org_id == org_id
        new = 0
        for u in result.units:
            key = (u.unit_type, u.unit_ref, result.parser_version)
            if key not in d.units:
                d.units[key] = u
                new += 1
        return new

    def claim_job(self, worker, kinds):
        for j in self.jobs.values():
            if j["status"] == "queued" and j["kind"] in kinds:
                j.update(status="running", locked_by=worker, attempts=j["attempts"] + 1)
                return Job(j["id"], j["org_id"], j["document_id"], j["kind"], j["attempts"], j["max_attempts"])
        return None

    def complete_job(self, job_id, worker):
        j = self.jobs[job_id]
        if j["locked_by"] != worker or j["status"] != "running":
            return False
        j.update(status="succeeded", locked_by=None)
        return True

    def fail_job(self, job_id, worker, error, retryable):
        j = self.jobs[job_id]
        if j["locked_by"] != worker or j["status"] != "running":
            return None
        dead = (not retryable) or j["attempts"] >= j["max_attempts"]
        j.update(status="dead" if dead else "queued", locked_by=None, last_error=error)
        return j["status"]

    def requeue_stale(self):
        return 0
