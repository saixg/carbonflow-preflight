from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Span:
    """A piece of unit text with where it came from. c0..c1 index into the unit's text."""

    text: str
    c0: int
    c1: int
    locator: dict

    def to_json(self) -> dict:
        return {"t": self.text, "c0": self.c0, "c1": self.c1, "locator": self.locator}


@dataclass
class ParsedUnit:
    unit_type: str  # page | sheet | csv
    unit_ref: str
    text: str
    spans: list[Span]
    meta: dict = field(default_factory=dict)


@dataclass
class ParseResult:
    units: list[ParsedUnit]
    warnings: list[str]
    parser_name: str
    parser_version: str


@dataclass(frozen=True)
class FoundSpan:
    """Where a quoted passage sits in a unit. Becomes an evidence_refs row."""

    text: str
    c0: int
    c1: int
    locator: dict
    page_number: int | None


def _normalize(text: str) -> tuple[str, list[int]]:
    """Collapse whitespace runs to one space; return normalized text and a map to original indexes."""
    out: list[str] = []
    idx: list[int] = []
    prev_space = False
    for i, ch in enumerate(text):
        if ch.isspace():
            if not prev_space:
                out.append(" ")
                idx.append(i)
            prev_space = True
        else:
            out.append(ch)
            idx.append(i)
            prev_space = False
    return "".join(out), idx


def find_span(unit: ParsedUnit, needle: str) -> FoundSpan | None:
    """Find a verbatim passage (whitespace-insensitive) and return its evidence locator.

    Returns None if the passage is absent. Later stages require every extracted number to be
    found this way, so a value the model invented cannot be traced and cannot be stored.
    """
    needle_n = " ".join(needle.split())
    if not needle_n:
        return None
    hay, idx = _normalize(unit.text)
    pos = hay.find(needle_n)
    if pos < 0:
        return None
    c0 = idx[pos]
    c1 = idx[pos + len(needle_n) - 1] + 1
    hit = [s for s in unit.spans if s.c0 < c1 and s.c1 > c0]
    if not hit:
        return None
    text = unit.text[c0:c1]
    kinds = {s.locator["type"] for s in hit}
    if kinds == {"pdf_span"}:
        page = hit[0].locator["page"]
        boxes = [s.locator["bbox"] for s in hit]
        bbox = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]
        return FoundSpan(text, c0, c1, {"type": "pdf_span", "page": page, "bbox": bbox, "char_start": c0, "char_end": c1}, page)
    if len(hit) == 1:
        return FoundSpan(text, c0, c1, hit[0].locator, None)
    return None  # a passage spanning several cells is not a single traceable cell
