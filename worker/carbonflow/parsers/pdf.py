from __future__ import annotations

import time

import pymupdf

from .. import limits
from ..errors import LimitExceeded, NeedsOcr, ParseFailed
from .base import ParsedUnit, ParseResult, Span

PARSER_NAME = "pymupdf-words"


def parse_pdf(
    data: bytes,
    *,
    max_pages: int = limits.MAX_PDF_PAGES,
    budget_seconds: float = limits.PARSE_BUDGET_SECONDS,
) -> ParseResult:
    started = time.monotonic()
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as e:  # PyMuPDF raises several types for damaged files
        raise ParseFailed("PDF is corrupted or unreadable") from e

    with doc:
        if doc.needs_pass:
            raise ParseFailed("PDF is password protected")
        if doc.page_count == 0:
            raise ParseFailed("PDF has no pages")
        if doc.page_count > max_pages:
            raise LimitExceeded(f"PDF has {doc.page_count} pages; the limit is {max_pages}")

        units: list[ParsedUnit] = []
        warnings: list[str] = []
        image_only: list[int] = []

        for index in range(doc.page_count):
            if time.monotonic() - started > budget_seconds:
                raise LimitExceeded("PDF took too long to read")
            number = index + 1
            try:
                page = doc[index]
                words = page.get_text("words")
                has_images = bool(page.get_images())
                width, height = page.rect.width, page.rect.height
            except Exception as e:
                raise ParseFailed(f"could not read page {number}") from e

            text, spans = _build_page(number, words)
            if not text.strip() and has_images:
                image_only.append(number)
            units.append(
                ParsedUnit(
                    unit_type="page",
                    unit_ref=str(number),
                    text=text,
                    spans=spans,
                    meta={"width": round(width, 2), "height": round(height, 2), "has_images": has_images},
                )
            )

    if image_only:
        if len(image_only) == len(units):
            raise NeedsOcr("PDF has no extractable text; it looks scanned")
        warnings.append(f"pages without extractable text (need OCR): {image_only}")
        for u in units:
            if int(u.unit_ref) in image_only:
                u.meta["needs_ocr"] = True
    if all(not u.text.strip() for u in units):
        warnings.append("PDF contains no extractable text")
    return ParseResult(units, warnings, PARSER_NAME, _version())


def _build_page(number: int, words: list) -> tuple[str, list[Span]]:
    # words: (x0, y0, x1, y1, word, block_no, line_no, word_no)
    ordered = sorted(words, key=lambda w: (w[5], w[6], w[7]))
    parts: list[str] = []
    spans: list[Span] = []
    pos = 0
    last_line: tuple[int, int] | None = None
    for x0, y0, x1, y1, word, block, line, _ in ordered:
        if not word.strip():
            continue
        line_key = (block, line)
        if last_line is not None:
            sep = "\n" if line_key != last_line else " "
            parts.append(sep)
            pos += len(sep)
        last_line = line_key
        c0 = pos
        parts.append(word)
        pos += len(word)
        spans.append(
            Span(
                text=word,
                c0=c0,
                c1=pos,
                locator={
                    "type": "pdf_span",
                    "page": number,
                    "bbox": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
                    "char_start": c0,
                    "char_end": pos,
                },
            )
        )
    return "".join(parts), spans


def _version() -> str:
    return f"pymupdf-{pymupdf.VersionBind}"
