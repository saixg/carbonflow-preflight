import pymupdf
import pytest

from carbonflow.errors import LimitExceeded, NeedsOcr, ParseFailed
from carbonflow.parsers import find_span, parse_document
from carbonflow.parsers.pdf import parse_pdf

from .conftest import make_encrypted_pdf, make_pdf, make_scanned_pdf


def test_pages_text_and_word_boxes(report_pdf):
    r = parse_document(report_pdf, "application/pdf")
    assert [u.unit_ref for u in r.units] == ["1", "2"]
    p2 = r.units[1]
    assert "152,345 MWh" in p2.text
    assert p2.unit_type == "page"
    # every word has a locator with a page and a box, and offsets index into the text
    for s in p2.spans:
        assert s.locator["type"] == "pdf_span" and s.locator["page"] == 2
        assert p2.text[s.c0 : s.c1] == s.text
        x0, y0, x1, y1 = s.locator["bbox"]
        assert x1 > x0 and y1 > y0


def test_find_span_returns_traceable_evidence(report_pdf):
    unit = parse_document(report_pdf, "application/pdf").units[1]
    found = find_span(unit, "152,345 MWh")
    assert found is not None
    assert found.text == "152,345 MWh"
    assert found.page_number == 2
    assert unit.text[found.c0 : found.c1] == "152,345 MWh"
    x0, y0, x1, y1 = found.locator["bbox"]
    page = pymupdf.open(stream=report_pdf, filetype="pdf")[1]
    assert 0 <= x0 < x1 <= page.rect.width and 0 <= y0 < y1 <= page.rect.height


def test_find_span_ignores_line_wrapping_but_not_missing_text():
    pdf = make_pdf([["The total was 152,345", "MWh for the period."]])
    unit = parse_document(pdf, "application/pdf").units[0]
    assert find_span(unit, "152,345 MWh") is not None  # wrapped onto the next line
    assert find_span(unit, "152,346 MWh") is None  # a number that is not in the document cannot be traced
    assert find_span(unit, "") is None


def test_scanned_pdf_needs_ocr_instead_of_guessing():
    with pytest.raises(NeedsOcr):
        parse_document(make_scanned_pdf(), "application/pdf")


def test_mixed_pdf_flags_scanned_pages():
    doc = pymupdf.open(stream=make_pdf([["Readable page with enough words to count"]]), filetype="pdf")
    scan = pymupdf.open(stream=make_scanned_pdf(), filetype="pdf")
    doc.insert_pdf(scan)
    r = parse_pdf(doc.tobytes())
    assert r.units[1].meta.get("needs_ocr") is True
    assert any("OCR" in w for w in r.warnings)
    assert not r.units[0].meta.get("needs_ocr")


def test_corrupted_and_truncated_pdfs_fail_cleanly(report_pdf):
    with pytest.raises(ParseFailed):
        parse_pdf(b"%PDF-1.7\nthis is not really a pdf at all")
    with pytest.raises(ParseFailed):
        parse_pdf(report_pdf[: len(report_pdf) // 3])


def test_password_protected_pdf_is_rejected():
    with pytest.raises(ParseFailed, match="password"):
        parse_pdf(make_encrypted_pdf())


def test_page_limit(report_pdf):
    with pytest.raises(LimitExceeded):
        parse_pdf(report_pdf, max_pages=1)


def test_time_budget(report_pdf):
    with pytest.raises(LimitExceeded):
        parse_pdf(report_pdf, budget_seconds=-1)


def test_reports_parser_identity(report_pdf):
    r = parse_pdf(report_pdf)
    assert r.parser_name == "pymupdf-words"
    assert r.parser_version.startswith("pymupdf-")
