from __future__ import annotations

import csv
import io

from .. import limits
from ..errors import LimitExceeded, UnsupportedFile
from .base import ParsedUnit, ParseResult, Span

PARSER_NAME = "csv-cells"
PARSER_VERSION = "stdlib-csv-1"


def decode(data: bytes) -> tuple[str, list[str]]:
    if b"\x00" in data[:8192]:
        raise UnsupportedFile("file looks binary, not CSV text")
    try:
        return data.decode("utf-8-sig"), []
    except UnicodeDecodeError:
        try:
            return data.decode("cp1252"), ["decoded as Windows-1252; check special characters"]
        except UnicodeDecodeError as e:
            raise UnsupportedFile("text encoding not recognised") from e


def parse_csv(data: bytes, *, max_rows: int = limits.MAX_CSV_ROWS) -> ParseResult:
    text, warnings = decode(data)
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    parts: list[str] = []
    spans: list[Span] = []
    pos = 0
    widths: set[int] = set()
    rows = 0
    reader = csv.reader(io.StringIO(text, newline=""), dialect)
    try:
        for r, row in enumerate(reader, start=1):
            rows = r
            if r > max_rows:
                raise LimitExceeded(f"CSV has more than {max_rows} rows")
            if not any(c.strip() for c in row):
                continue
            widths.add(len(row))
            if parts:
                parts.append("\n")
                pos += 1
            first = True
            for c, value in enumerate(row, start=1):
                value = value.strip()
                if not value:
                    continue
                if not first:
                    parts.append("\t")
                    pos += 1
                first = False
                c0 = pos
                parts.append(value)
                pos += len(value)
                spans.append(Span(value, c0, pos, {"type": "csv_cell", "row": r, "col": c}))
    except csv.Error as e:
        raise UnsupportedFile("CSV could not be parsed") from e

    if len(widths) > 1:
        warnings.append(f"rows have different column counts: {sorted(widths)}")
    unit = ParsedUnit("csv", "data", "".join(parts), spans, {"delimiter": dialect.delimiter, "rows": rows})
    return ParseResult([unit], warnings, PARSER_NAME, PARSER_VERSION)
