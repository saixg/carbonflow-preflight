from __future__ import annotations

import pymupdf
import pytest

from carbonflow.parsers.base import find_span
from carbonflow.parsers.ocr import ocr_page, parse_pdf_hybrid
from .conftest import make_pdf


def make_rasterized_text_pdf(text: str = "Net export: 152,345 MWh") -> bytes:
    """Create a PDF where the text is strictly rasterized as an image.

    Native get_text('words') will return empty, simulating a scanned document.
    """
    temp_doc = pymupdf.open()
    temp_page = temp_doc.new_page(width=500, height=300)
    temp_page.insert_text((50, 100), text, fontsize=18)
    pix = temp_page.get_pixmap(dpi=150)
    temp_doc.close()

    doc = pymupdf.open()
    page = doc.new_page(width=500, height=300)
    page.insert_image(pymupdf.Rect(0, 0, 500, 300), pixmap=pix)
    out = doc.tobytes()
    doc.close()
    return out


def test_ocr_recovers_rasterized_text():
    pdf_bytes = make_rasterized_text_pdf("Total net export: 152,345 MWh")
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]

    # Native words must be empty
    assert len(page.get_text("words")) == 0

    text, spans, score = ocr_page(page, 1)
    doc.close()

    assert "152,345" in text
    assert "MWh" in text
    assert len(spans) > 0
    assert score > 0.5
    for s in spans:
        assert s.locator["type"] == "pdf_span"
        assert s.locator["ocr"] is True
        assert len(s.locator["bbox"]) == 4


def test_parse_pdf_hybrid_on_scanned():
    pdf_bytes = make_rasterized_text_pdf("Installed capacity: 100 MW")
    res = parse_pdf_hybrid(pdf_bytes)

    assert len(res.units) == 1
    unit = res.units[0]
    assert unit.meta.get("ocr_applied") is True
    assert "100" in unit.text
    assert "MW" in unit.text.upper()

    hit = find_span(unit, "Installed capacity")
    assert hit is not None
    assert hit.locator["type"] == "pdf_span"
    assert hit.locator["page"] == 1


def test_parse_pdf_hybrid_on_digital_text():
    pdf_bytes = make_pdf([["Clean vector text: 50,000 tCO2"]])
    res = parse_pdf_hybrid(pdf_bytes)

    assert len(res.units) == 1
    unit = res.units[0]
    # Digital text does not need OCR
    assert unit.meta.get("ocr_applied") is not True
    assert "50,000 tCO2" in unit.text

    hit = find_span(unit, "50,000 tCO2")
    assert hit is not None
