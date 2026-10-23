"""Object storage access. The worker is the only writer of final, content-addressed objects."""

from __future__ import annotations

from typing import Protocol
from urllib.parse import quote

import httpx

from .errors import LimitExceeded, NotFound, TransientError, WorkerError


class ObjectStore(Protocol):
    def get(self, path: str, max_bytes: int) -> bytes: ...

    def put_if_absent(self, path: str, data: bytes, content_type: str) -> bool:
        """Store without ever overwriting. True if created, False if it already existed."""

    def delete(self, path: str) -> None: ...


class SupabaseStorage:
    """Supabase Storage over HTTP with the service-role key (server side only).

    Not yet exercised against a live stack; covered by the integration pass once Docker is available.
    """

    def __init__(self, base_url: str, service_key: str, bucket: str = "documents", client: httpx.Client | None = None):
        self.root = f"{base_url.rstrip('/')}/storage/v1/object"
        self.bucket = bucket
        self.headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}
        self.http = client or httpx.Client(timeout=httpx.Timeout(30.0, connect=10.0))

    def _url(self, path: str) -> str:
        return f"{self.root}/{self.bucket}/{quote(path, safe='/')}"

    def get(self, path: str, max_bytes: int) -> bytes:
        try:
            with self.http.stream("GET", self._url(path), headers=self.headers) as r:
                if r.status_code == 404 or r.status_code == 400:
                    raise NotFound("object not found")
                if r.status_code >= 500:
                    raise TransientError(f"storage returned {r.status_code}")
                r.raise_for_status()
                buf = bytearray()
                for chunk in r.iter_bytes():
                    buf += chunk
                    if len(buf) > max_bytes:
                        raise LimitExceeded("file is larger than the allowed size")
                return bytes(buf)
        except httpx.TransportError as e:
            raise TransientError("storage unreachable") from e

    def put_if_absent(self, path: str, data: bytes, content_type: str) -> bool:
        try:
            r = self.http.post(
                self._url(path),
                content=data,
                headers={**self.headers, "Content-Type": content_type, "x-upsert": "false"},
            )
        except httpx.TransportError as e:
            raise TransientError("storage unreachable") from e
        if r.status_code in (200, 201):
            return True
        if r.status_code == 409 or "Duplicate" in r.text or "already exists" in r.text:
            return False
        if r.status_code >= 500:
            raise TransientError(f"storage returned {r.status_code}")
        raise WorkerError(f"storage rejected the upload ({r.status_code})")

    def delete(self, path: str) -> None:
        try:
            r = self.http.delete(self._url(path), headers=self.headers)
        except httpx.TransportError as e:
            raise TransientError("storage unreachable") from e
        if r.status_code >= 500:
            raise TransientError(f"storage returned {r.status_code}")
