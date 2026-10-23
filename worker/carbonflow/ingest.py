"""Turn a staged upload into an immutable, content-addressed document and queue its parsing."""

from __future__ import annotations

import re
from dataclasses import dataclass

from . import limits
from .errors import LimitExceeded, NotFound, UnsupportedFile
from .hashing import sha256_hex
from .repo import NewDocument, Repo
from .sniff import check_declared, sniff_media_type
from .storage import ObjectStore

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


@dataclass(frozen=True)
class IngestResult:
    document_id: str
    sha256: str
    storage_path: str
    duplicate_of_id: str | None
    object_created: bool


def clean_filename(name: str) -> str:
    base = re.split(r"[\\/]", name or "")[-1]
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()
    return (base or "document")[:255]


def finalize_upload(
    *,
    repo: Repo,
    store: ObjectStore,
    org_id: str,
    project_id: str,
    monitoring_period_id: str | None,
    staging_path: str,
    filename: str,
    declared_media_type: str,
    uploaded_by: str,
    supersedes_id: str | None = None,
) -> IngestResult:
    """Verify, hash, store and register an uploaded file.

    Raises WorkerError subclasses. Never trusts the declared type, the client's hash, or a path that
    points outside the caller's organization.
    """
    if not _UUID.match(org_id):
        raise UnsupportedFile("invalid organization")
    if not staging_path.startswith(f"{org_id}/staging/") or ".." in staging_path.split("/"):
        raise NotFound("upload not found")  # same answer whether it is missing or belongs to someone else

    data = store.get(staging_path, limits.MAX_FILE_BYTES)
    if not data:
        raise UnsupportedFile("file is empty")
    if len(data) > limits.MAX_FILE_BYTES:
        raise LimitExceeded("file is larger than 50 MB")
    media_type = check_declared(declared_media_type, sniff_media_type(data))

    digest = sha256_hex(data)
    final_path = f"{org_id}/sha256/{digest}"
    created = store.put_if_absent(final_path, data, media_type)
    duplicate_of = repo.find_duplicate(org_id, digest)

    doc_id = repo.register_document(
        NewDocument(
            org_id=org_id,
            project_id=project_id,
            monitoring_period_id=monitoring_period_id,
            storage_path=final_path,
            sha256=digest,
            filename=clean_filename(filename),
            media_type=media_type,
            size_bytes=len(data),
            uploaded_by=uploaded_by,
            duplicate_of_id=duplicate_of,
            supersedes_id=supersedes_id,
        )
    )
    try:
        store.delete(staging_path)
    except Exception:
        pass  # staging leftovers are harmless and swept later; the document is already registered
    return IngestResult(doc_id, digest, final_path, duplicate_of, created)
