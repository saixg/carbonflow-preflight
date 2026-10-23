import hashlib
from collections.abc import Iterable


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_chunks(chunks: Iterable[bytes]) -> str:
    h = hashlib.sha256()
    for c in chunks:
        h.update(c)
    return h.hexdigest()


def text_hash(text: str) -> str:
    """Hash of a source passage. Must equal the database's sha256(convert_to(text, 'UTF8'))."""
    return sha256_hex(text.encode("utf-8"))
