import datetime as dt

import pytest

from carbonflow.errors import LimitExceeded, ParseFailed, UnsupportedFile
from carbonflow.parsers import find_span, parse_document
from carbonflow.parsers.csv_parser import parse_csv
from carbonflow.parsers.xlsx import parse_xlsx

from .conftest import make_xlsx, make_zip

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_cells_keep_exact_values_and_coordinates():
    def build(wb):
        ws = wb.active
        ws.title = "Meter"
        ws.append(["Month", "Exported (MWh)"])
        ws.append(["January", 11820])
        ws.append(["February", 0.82])
        ws.append(["Start", dt.date(2023, 1, 1)])

    r = parse_xlsx(make_xlsx(build))
    unit = r.units[0]
    assert unit.unit_type == "sheet" and unit.unit_ref == "Meter"
    by_cell = {s.locator["cell"]: s.text for s in unit.spans}
    assert by_cell["B2"] == "11820"
    assert by_cell["B3"] == "0.82"  # not rounded or reformatted
    assert by_cell["B4"] == "2023-01-01"
    assert {s.locator["sheet"] for s in unit.spans} == {"Meter"}
    for s in unit.spans:
        assert unit.text[s.c0 : s.c1] == s.text


def test_find_span_in_a_sheet_points_at_one_cell():
    def build(wb):
        wb.active.append(["Net exported", "152,345 MWh"])

    unit = parse_xlsx(make_xlsx(build)).units[0]
    found = find_span(unit, "152,345 MWh")
    assert found.locator == {"type": "sheet_cell", "sheet": "Sheet", "cell": "B1"}
    assert find_span(unit, "exported 152,345") is None  # spans two cells, so it is not one traceable cell


def test_hidden_sheets_and_merged_cells_are_reported():
    def build(wb):
        ws = wb.active
        ws.append(["Title"])
        ws.merge_cells("A1:C1")
        hidden = wb.create_sheet("Calc")
        hidden.append([1])
        hidden.sheet_state = "hidden"

    r = parse_xlsx(make_xlsx(build))
    assert r.units[0].meta["merged"] == ["A1:C1"]
    assert r.units[1].meta["state"] == "hidden"
    assert any("hidden" in w for w in r.warnings)


def test_formulas_without_saved_values_are_flagged():
    def build(wb):
        ws = wb.active
        ws["A1"] = 5
        ws["A2"] = "=A1*2"  # openpyxl writes no cached result

    r = parse_xlsx(make_xlsx(build))
    assert r.units[0].meta["formulas_without_value"] == ["A2"]
    assert any("formula" in w for w in r.warnings)
    assert "A2" not in {s.locator["cell"] for s in r.units[0].spans}  # no invented value


def test_macro_workbooks_and_zip_bombs_are_refused():
    from carbonflow import limits

    with pytest.raises(UnsupportedFile):
        parse_xlsx(make_zip({"[Content_Types].xml": b"x", "xl/workbook.xml": b"x", "xl/vbaProject.bin": b"x"}))
    bomb = make_zip({"[Content_Types].xml": b"x", "xl/workbook.xml": b"x", "xl/big.bin": b"0" * (limits.MAX_ZIP_UNCOMPRESSED_BYTES + 1)})
    with pytest.raises(LimitExceeded):
        parse_xlsx(bomb)


def test_corrupted_workbook_fails_cleanly():
    broken = make_zip({"[Content_Types].xml": b"not xml", "xl/workbook.xml": b"not xml"})
    with pytest.raises(ParseFailed):
        parse_xlsx(broken)


def test_cell_and_sheet_limits():
    def build(wb):
        for i in range(3):
            wb.create_sheet(f"S{i}").append([1, 2, 3])

    data = make_xlsx(build)
    with pytest.raises(LimitExceeded):
        parse_xlsx(data, max_sheets=2)
    with pytest.raises(LimitExceeded):
        parse_xlsx(data, max_cells=5)


def test_xlsx_routed_through_parse_document():
    data = make_xlsx(lambda wb: wb.active.append(["a", 1]))
    assert parse_document(data, XLSX).parser_name == "openpyxl-cells"


# ------------------------------------------------------------------ CSV


def test_csv_locators_and_delimiter_detection():
    r = parse_csv("Month;Exported\nJanuary;11820\nFebruary;12410\n".encode())
    unit = r.units[0]
    assert unit.meta["delimiter"] == ";"
    cells = {(s.locator["row"], s.locator["col"]): s.text for s in unit.spans}
    assert cells[(2, 2)] == "11820"
    assert cells[(3, 1)] == "February"
    found = find_span(unit, "12410")
    assert found.locator == {"type": "csv_cell", "row": 3, "col": 2}


def test_csv_encodings_and_binary_rejection():
    assert parse_csv(b"\xef\xbb\xbfa,b\n1,2\n").units[0].text.startswith("a")  # BOM stripped
    r = parse_csv("name,value\nCafé,1\n".encode("cp1252"))
    assert any("Windows-1252" in w for w in r.warnings)
    with pytest.raises(UnsupportedFile):
        parse_csv(b"a,b\n\x00\x01\x02")


def test_csv_warns_about_ragged_rows_and_limits_rows():
    assert any("column counts" in w for w in parse_csv(b"a,b,c\n1,2\n").warnings)
    with pytest.raises(LimitExceeded):
        parse_csv(b"a,b\n" * 10, max_rows=5)
