from __future__ import annotations

import io
import logging
import time
from typing import Any

from .. import limits
from ..errors import LimitExceeded, ParseFailed
from .base import ParsedUnit, ParseResult, Span

log = logging.getLogger("carbonflow.parsers.docling")
PARSER_NAME = "docling-layout"
_VERSION = "0.1.0"

_converter = None


def get_converter():
    global _converter
    if _converter is None:
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption

        opts = PdfPipelineOptions()
        opts.do_ocr = False
        opts.do_table_structure = True

        _converter = DocumentConverter(
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
        )
    return _converter


def parse_pdf_docling(
    data: bytes,
    *,
    max_pages: int = limits.MAX_PDF_PAGES,
    budget_seconds: float = limits.PARSE_BUDGET_SECONDS,
) -> ParseResult:
    """Parse PDF using Docling layout and table reconstruction model."""
    started = time.monotonic()
    if not data:
        raise ParseFailed("PDF is empty")

    from docling.datamodel.base_models import DocumentStream

    converter = get_converter()
    stream = DocumentStream(name="document.pdf", stream=io.BytesIO(data))

    try:
        conv_res = converter.convert(stream)
    except Exception as e:
        raise ParseFailed(f"Docling conversion failed: {e}") from e

    if time.monotonic() - started > budget_seconds:
        raise LimitExceeded("Docling parse took too long")

    d = conv_res.document
    page_count = len(d.pages)
    if page_count > max_pages:
        raise LimitExceeded(f"PDF has {page_count} pages; the limit is {max_pages}")

    # Build page-level units
    page_units: dict[int, dict[str, Any]] = {}
    for p_no in range(1, page_count + 1):
        p_info = d.pages.get(p_no)
        p_w = p_info.size.width if p_info else 612.0
        p_h = p_info.size.height if p_info else 792.0
        page_units[p_no] = {
            "parts": [],
            "spans": [],
            "pos": 0,
            "width": p_w,
            "height": p_h,
        }

    for item, _level in d.iterate_items():
        text = getattr(item, "text", "") or ""
        text = text.strip()
        if not text:
            continue

        prov_list = getattr(item, "prov", []) or []
        for prov in prov_list:
            page_no = prov.page_no
            if page_no not in page_units:
                continue

            pu = page_units[page_no]
            p_h = pu["height"]

            # Convert bbox to standard top-left origin [x0, y0, x1, y1]
            b = prov.bbox
            if hasattr(b, "coord_origin") and "BOTTOM" in str(b.coord_origin):
                x0 = min(b.l, b.r)
                y0 = min(p_h - b.t, p_h - b.b)
                x1 = max(b.l, b.r)
                y1 = max(p_h - b.t, p_h - b.b)
            else:
                x0, y0, x1, y1 = b.l, b.t, b.r, b.b

            # Break item text into words with proportional bounding boxes
            words = text.split()
            if not words:
                continue

            if pu["parts"]:
                pu["parts"].append("\n")
                pu["pos"] += 1

            line_len = max(len(text), 1)
            search_start = 0
            for w in words:
                w_idx = text.find(w, search_start)
                if w_idx < 0:
                    w_idx = search_start
                w_end = w_idx + len(w)
                search_start = w_end

                wx0 = x0 + (x1 - x0) * (w_idx / line_len)
                wx1 = x0 + (x1 - x0) * (w_end / line_len)

                if pu["parts"] and not pu["parts"][-1].endswith("\n"):
                    pu["parts"].append(" ")
                    pu["pos"] += 1

                c0 = pu["pos"]
                pu["parts"].append(w)
                pu["pos"] += len(w)

                pu["spans"].append(
                    Span(
                        text=w,
                        c0=c0,
                        c1=pu["pos"],
                        locator={
                            "type": "pdf_span",
                            "page": page_no,
                            "bbox": [round(wx0, 2), round(y0, 2), round(wx1, 2), round(y1, 2)],
                            "char_start": c0,
                            "char_end": pu["pos"],
                            "parser": PARSER_NAME,
                        },
                    )
                )

    units: list[ParsedUnit] = []
    warnings: list[str] = []

    for p_no in sorted(page_units.keys()):
        pu = page_units[p_no]
        full_text = "".join(pu["parts"])
        units.append(
            ParsedUnit(
                unit_type="page",
                unit_ref=str(p_no),
                text=full_text,
                spans=pu["spans"],
                meta={
                    "width": round(pu["width"], 2),
                    "height": round(pu["height"], 2),
                    "docling_parsed": True,
                },
            )
        )

    if all(not u.text.strip() for u in units):
        warnings.append("Docling found no extractable text")

    return ParseResult(units, warnings, PARSER_NAME, _VERSION)
