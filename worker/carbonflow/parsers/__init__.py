from __future__ import annotations

from .. import limits
from ..errors import LimitExceeded, UnsupportedFile
from ..sniff import check_declared, sniff_media_type
from .base import FoundSpan, ParsedUnit, ParseResult, Span, find_span
from .csv_parser import parse_csv
from .pdf import parse_pdf
from .xlsx import parse_xlsx

__all__ = ["parse_document", "find_span", "FoundSpan", "ParsedUnit", "ParseResult", "Span"]


def parse_document(data: bytes, declared_media_type: str) -> ParseResult:
    """Verify the bytes are what they claim to be, then parse. Raises WorkerError subclasses."""
    if not data:
        raise UnsupportedFile("file is empty")
    if len(data) > limits.MAX_FILE_BYTES:
        raise LimitExceeded("file is larger than 50 MB")
    media = check_declared(declared_media_type, sniff_media_type(data))
    if media == limits.PDF:
        return parse_pdf(data)
    if media == limits.XLSX:
        return parse_xlsx(data)
    return parse_csv(data)
