from __future__ import annotations

from .. import limits
from ..errors import LimitExceeded, UnsupportedFile
from ..sniff import check_declared, sniff_media_type
from .base import FoundSpan, ParsedUnit, ParseResult, Span, find_span
from .csv_parser import parse_csv
from .docling_parser import parse_pdf_docling
from .ocr import parse_pdf_hybrid
from .pdf import parse_pdf
from .xlsx import parse_xlsx

__all__ = [
    "parse_document",
    "find_span",
    "FoundSpan",
    "ParsedUnit",
    "ParseResult",
    "Span",
    "parse_pdf",
    "parse_pdf_hybrid",
    "parse_pdf_docling",
]


def parse_document(
    data: bytes,
    declared_media_type: str,
    *,
    pdf_parser: str = "pymupdf",
    enable_ocr: bool = False,
) -> ParseResult:
    """Verify the bytes are what they claim to be, then parse.

    pdf_parser options:
      - 'pymupdf' (default): Native vector text parser. Raises NeedsOcr if document is scanned.
      - 'hybrid': Native vector text + RapidOCR (PaddleOCR) fallback for scanned/image pages.
      - 'docling': Docling layout, section and table reconstruction model.

    If enable_ocr=True is set, hybrid OCR fallback is enabled.
    """
    if not data:
        raise UnsupportedFile("file is empty")
    if len(data) > limits.MAX_FILE_BYTES:
        raise LimitExceeded("file is larger than 50 MB")
    media = check_declared(declared_media_type, sniff_media_type(data))
    if media == limits.PDF:
        if pdf_parser == "docling":
            return parse_pdf_docling(data)
        if pdf_parser == "hybrid" or enable_ocr:
            return parse_pdf_hybrid(data)
        return parse_pdf(data)
    if media == limits.XLSX:
        return parse_xlsx(data)
    return parse_csv(data)
