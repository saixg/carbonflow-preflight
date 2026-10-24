from __future__ import annotations

import pytest

from carbonflow.parsers import parse_document
from carbonflow.parsers.base import find_span
from carbonflow.parsers.docling_parser import parse_pdf_docling
from .conftest import make_pdf


def test_docling_parser_basic():
    pdf = make_pdf([
        [
            "Annual Monitoring Report 2023",
            "Project ID: IN-SOLAR-042",
            "Total net electricity exported was 152,345 MWh.",
            "Grid emission factor: 0.82 tCO2/MWh",
        ]
    ])

    res = parse_pdf_docling(pdf)
    assert len(res.units) == 1
    unit = res.units[0]
    assert unit.meta.get("docling_parsed") is True
    assert "152,345" in unit.text
    assert "0.82" in unit.text
    assert len(unit.spans) > 0

    hit = find_span(unit, "152,345 MWh")
    assert hit is not None
    assert hit.locator["type"] == "pdf_span"
    assert hit.locator["page"] == 1


def test_parse_document_dispatch_docling():
    pdf = make_pdf([["Installed capacity is 100 MW"]])
    res = parse_document(pdf, "application/pdf", pdf_parser="docling")
    assert len(res.units) == 1
    assert "100 MW" in res.units[0].text
