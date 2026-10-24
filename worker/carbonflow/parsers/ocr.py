from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

import pymupdf

from .. import limits
from ..errors import LimitExceeded, ParseFailed
from .base import ParsedUnit, ParseResult, Span

if TYPE_CHECKING:
    from rapidocr_onnxruntime import RapidOCR

log = logging.getLogger("carbonflow.parsers.ocr")
PARSER_NAME = "pymupdf-rapidocr-hybrid"
_VERSION = "0.1.0"

_engine: RapidOCR | None = None


def get_ocr_engine() -> RapidOCR:
    global _engine
    if _engine is None:
        from rapidocr_onnxruntime import RapidOCR

        _engine = RapidOCR()
    return _engine


def ocr_page(
    page: pymupdf.Page,
    page_number: int,
    *,
    dpi: int = 150,
) -> tuple[str, list[Span], float]:
    """Run OCR on a rasterized PDF page using RapidOCR (PaddleOCR models).

    Returns (page_text, spans, avg_confidence).
    Coordinates are scaled back to PDF point dimensions (72 points/inch)
    so locators align with vector-text spans.
    """
    engine = get_ocr_engine()
    pix = page.get_pixmap(dpi=dpi)
    img_bytes = pix.tobytes("png")

    scale_x = page.rect.width / pix.width if pix.width else 1.0
    scale_y = page.rect.height / pix.height if pix.height else 1.0

    raw_results, _ = engine(img_bytes)
    if not raw_results:
        return "", [], 0.0

    parts: list[str] = []
    spans: list[Span] = []
    pos = 0
    scores: list[float] = []

    for box, line_text, score in raw_results:
        text = str(line_text).strip()
        if not text:
            continue
        try:
            scores.append(float(score))
        except (ValueError, TypeError):
            pass

        # box: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
        pts_x = [p[0] * scale_x for p in box]
        pts_y = [p[1] * scale_y for p in box]
        bx0, by0 = min(pts_x), min(pts_y)
        bx1, by1 = max(pts_x), max(pts_y)

        # Break line into words with proportional bounding boxes
        words = text.split()
        if not words:
            continue

        if parts:
            parts.append("\n")
            pos += 1

        line_len = max(len(text), 1)
        search_start = 0

        for w in words:
            w_idx = text.find(w, search_start)
            if w_idx < 0:
                w_idx = search_start
            w_end = w_idx + len(w)
            search_start = w_end

            # Proportional horizontal span across line bounding box
            wx0 = bx0 + (bx1 - bx0) * (w_idx / line_len)
            wx1 = bx0 + (bx1 - bx0) * (w_end / line_len)

            if parts and not parts[-1].endswith("\n"):
                parts.append(" ")
                pos += 1

            c0 = pos
            parts.append(w)
            pos += len(w)

            spans.append(
                Span(
                    text=w,
                    c0=c0,
                    c1=pos,
                    locator={
                        "type": "pdf_span",
                        "page": page_number,
                        "bbox": [round(wx0, 2), round(by0, 2), round(wx1, 2), round(by1, 2)],
                        "char_start": c0,
                        "char_end": pos,
                        "ocr": True,
                    },
                )
            )

    full_text = "".join(parts)
    avg_score = round(sum(scores) / len(scores), 3) if scores else 0.0
    return full_text, spans, avg_score


def parse_pdf_hybrid(
    data: bytes,
    *,
    max_pages: int = limits.MAX_PDF_PAGES,
    budget_seconds: float = limits.PARSE_BUDGET_SECONDS,
    force_ocr: bool = False,
) -> ParseResult:
    """Hybrid PDF parser: uses native PyMuPDF text for digital pages,

    and falls back to RapidOCR (PaddleOCR) for scanned or image-only pages.
    """
    started = time.monotonic()
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as e:
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
        ocr_pages: list[int] = []

        from .pdf import _build_page

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

            # If force_ocr or the page has no extractable text, use RapidOCR
            needs_ocr = force_ocr or (not words and has_images)
            if needs_ocr:
                try:
                    text, spans, avg_conf = ocr_page(page, number)
                    ocr_pages.append(number)
                    units.append(
                        ParsedUnit(
                            unit_type="page",
                            unit_ref=str(number),
                            text=text,
                            spans=spans,
                            meta={
                                "width": round(width, 2),
                                "height": round(height, 2),
                                "has_images": has_images,
                                "ocr_applied": True,
                                "ocr_confidence": avg_conf,
                            },
                        )
                    )
                except Exception as e:
                    log.warning("OCR failed on page %d: %s", number, e)
                    warnings.append(f"OCR failed on page {number}: {e}")
                    units.append(
                        ParsedUnit(
                            unit_type="page",
                            unit_ref=str(number),
                            text="",
                            spans=[],
                            meta={"width": round(width, 2), "height": round(height, 2), "ocr_failed": True},
                        )
                    )
            else:
                text, spans = _build_page(number, words)
                units.append(
                    ParsedUnit(
                        unit_type="page",
                        unit_ref=str(number),
                        text=text,
                        spans=spans,
                        meta={"width": round(width, 2), "height": round(height, 2), "has_images": has_images},
                    )
                )

    if ocr_pages:
        warnings.append(f"pages processed with RapidOCR: {ocr_pages}")
    if all(not u.text.strip() for u in units):
        warnings.append("PDF contains no extractable text even after OCR")

    return ParseResult(units, warnings, PARSER_NAME, _VERSION)
