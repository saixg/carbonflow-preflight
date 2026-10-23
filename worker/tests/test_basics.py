import pytest

from carbonflow import limits
from carbonflow.errors import LimitExceeded, UnsupportedFile
from carbonflow.hashing import sha256_chunks, sha256_hex, text_hash
from carbonflow.parsers import parse_document
from carbonflow.sniff import check_declared, sniff_media_type

from .conftest import make_pdf, make_xlsx, make_zip


def test_sha256_known_values():
    assert sha256_hex(b"") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    assert sha256_chunks([b"ab", b"c"]) == sha256_hex(b"abc")
    assert text_hash("152,345 MWh") == sha256_hex("152,345 MWh".encode())


def test_sniff_recognises_each_allowed_type(report_pdf):
    assert sniff_media_type(report_pdf) == limits.PDF
    assert sniff_media_type(make_xlsx(lambda wb: wb.active.append([1]))) == limits.XLSX
    assert sniff_media_type(b"a,b\n1,2\n") == limits.CSV


def test_sniff_rejects_other_things():
    assert sniff_media_type(b"\x00\x01\x02binary") is None
    assert sniff_media_type(make_zip({"readme.txt": b"hi"})) is None  # a zip that is not a workbook
    assert sniff_media_type(b"") is None


def test_declared_type_must_match_bytes(report_pdf):
    assert check_declared("application/pdf", sniff_media_type(report_pdf)) == limits.PDF
    assert check_declared("text/plain", limits.CSV) == limits.CSV  # browsers label CSV loosely
    with pytest.raises(UnsupportedFile):
        check_declared("text/csv", limits.PDF)  # a PDF pretending to be CSV
    with pytest.raises(UnsupportedFile):
        check_declared("application/pdf", None)


def test_empty_and_oversized_files_are_rejected():
    with pytest.raises(UnsupportedFile):
        parse_document(b"", "application/pdf")
    with pytest.raises(LimitExceeded):
        parse_document(b"x" * (limits.MAX_FILE_BYTES + 1), "text/csv")


def test_executable_is_not_parsed():
    with pytest.raises(UnsupportedFile):
        parse_document(b"MZ\x90\x00\x03\x00\x00\x00", "application/pdf")
