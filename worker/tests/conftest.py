"""Fixtures are generated in code so they are small, deterministic and need no binary files."""

from __future__ import annotations

import io
import zipfile

import openpyxl
import pymupdf
import pytest


def make_pdf(pages: list[list[str]]) -> bytes:
    doc = pymupdf.open()
    for lines in pages:
        page = doc.new_page()
        y = 72
        for line in lines:
            page.insert_text((72, y), line, fontsize=11)
            y += 18
    out = doc.tobytes()
    doc.close()
    return out


def make_scanned_pdf() -> bytes:
    """A page that is only an image: no extractable text."""
    doc = pymupdf.open()
    page = doc.new_page()
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 120, 60), False)
    pix.set_rect(pix.irect, (200, 200, 200))
    page.insert_image(pymupdf.Rect(72, 72, 300, 200), pixmap=pix)
    out = doc.tobytes()
    doc.close()
    return out


def make_encrypted_pdf() -> bytes:
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "secret")
    out = doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="user")
    doc.close()
    return out


def make_xlsx(build) -> bytes:
    wb = openpyxl.Workbook()
    build(wb)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def make_zip(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in entries.items():
            z.writestr(name, content)
    return buf.getvalue()


@pytest.fixture
def report_pdf() -> bytes:
    return make_pdf(
        [
            ["Annual Monitoring Report 2023", "The monitoring period runs from 01 January 2023 to 31 December 2023."],
            ["2.4 Electricity generation", "The total net electricity exported to the grid was 152,345 MWh.", "Installed capacity: 100 MW"],
        ]
    )
