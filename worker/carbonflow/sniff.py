"""Decide what a file really is from its bytes. The declared media type is never trusted on its own."""

import io
import zipfile

from . import limits
from .errors import LimitExceeded, UnsupportedFile


def inspect_zip(data: bytes) -> zipfile.ZipFile:
    """Open a zip defensively: bounded entry count and total uncompressed size (zip bombs)."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
        infos = zf.infolist()
    except (zipfile.BadZipFile, ValueError, OSError) as e:
        raise UnsupportedFile("not a valid zip container") from e
    if len(infos) > limits.MAX_ZIP_ENTRIES:
        raise LimitExceeded("too many entries in the file container")
    if sum(i.file_size for i in infos) > limits.MAX_ZIP_UNCOMPRESSED_BYTES:
        raise LimitExceeded("file expands beyond the allowed size")
    return zf


def sniff_media_type(data: bytes) -> str | None:
    if data[:1024].lstrip(b"\x00\r\n\t ").startswith(b"%PDF-"):
        return limits.PDF
    if data[:4] == b"PK\x03\x04":
        zf = inspect_zip(data)
        names = set(zf.namelist())
        if "[Content_Types].xml" in names and "xl/workbook.xml" in names:
            return limits.XLSX
        return None
    head = data[:8192]
    if head and b"\x00" not in head:
        try:
            head.decode("utf-8")
        except UnicodeDecodeError:
            try:
                head.decode("cp1252")
            except UnicodeDecodeError:
                return None
        return limits.CSV
    return None


def check_declared(declared: str, sniffed: str | None) -> str:
    """Return the verified media type, or raise if bytes and declaration disagree."""
    declared = (declared or "").split(";")[0].strip().lower()
    if sniffed is None or sniffed not in limits.ALLOWED_MEDIA_TYPES:
        raise UnsupportedFile("unsupported file type; use PDF, XLSX or CSV")
    ok = declared == sniffed or (sniffed == limits.CSV and declared in limits.CSV_ALIASES)
    if not ok:
        raise UnsupportedFile("file contents do not match the declared type")
    return sniffed
