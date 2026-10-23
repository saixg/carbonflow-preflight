"""Check a model's proposal against the document itself. Nothing is believed until it is found in the text."""

from __future__ import annotations

from .. import units as units_mod
from ..parse import AmbiguousValue, UnparseableValue, parse_date, parse_number
from ..parsers.base import ParsedUnit, find_span
from .schema import Accepted, FieldSpec, Rejected

_KEYS = {"parameter", "quote", "value_text", "unit_text"}
_MAX = 500


def _squash(s: str) -> str:
    return " ".join(s.split())


def validate_candidate(raw: object, fields: dict[str, FieldSpec], unit: ParsedUnit) -> Accepted | Rejected:
    if not isinstance(raw, dict) or set(raw) != _KEYS:
        return Rejected(None, "malformed candidate")
    parameter, quote, value_text, unit_text = (raw[k] for k in ("parameter", "quote", "value_text", "unit_text"))
    if not all(isinstance(x, str) for x in (parameter, quote, value_text)) or not (unit_text is None or isinstance(unit_text, str)):
        return Rejected(None, "malformed candidate")
    if max(len(quote), len(value_text), len(unit_text or "")) > _MAX:
        return Rejected(parameter, "field too long")
    spec = fields.get(parameter)
    if spec is None:
        return Rejected(parameter, "unknown parameter")

    found = find_span(unit, quote)
    if found is None:
        return Rejected(parameter, "quote not found in the document")
    passage = _squash(found.text)
    if not value_text.strip() or _squash(value_text) not in passage:
        return Rejected(parameter, "value is not inside the quoted passage")
    if unit_text and _squash(unit_text) not in passage:
        return Rejected(parameter, "unit is not inside the quoted passage")

    base = dict(
        parameter=parameter, unit_ref=unit.unit_ref, quote=quote, c0=found.c0, c1=found.c1, locator=found.locator,
        page_number=found.page_number, source_text=found.text,
        original=_squash(f"{value_text} {unit_text or ''}"),
        value_text=_squash(value_text), unit_text=_squash(unit_text) if unit_text and unit_text.strip() else None,
    )

    if spec.data_type == "date":
        try:
            return Accepted(**base, number=None, day=parse_date(value_text), unit=None)
        except (AmbiguousValue, UnparseableValue) as e:
            return Accepted(**base, number=None, day=None, unit=None, issue=f"date needs a person: {e}")

    try:
        number = parse_number(value_text)
    except (AmbiguousValue, UnparseableValue) as e:
        return Accepted(**base, number=None, day=None, unit=None, issue=f"number needs a person: {e}")

    if spec.canonical_unit is None:
        return Accepted(**base, number=number, day=None, unit=None)
    if not unit_text:
        return Accepted(**base, number=None, day=None, unit=None, issue="no unit stated; a person must confirm it")
    try:
        converted = units_mod.convert(number, unit_text.strip(), spec.canonical_unit)
    except units_mod.UnknownUnit:
        return Accepted(**base, number=None, day=None, unit=None, issue=f"unit '{unit_text}' is not recognised")
    except units_mod.IncompatibleUnits:
        return Accepted(**base, number=None, day=None, unit=None, issue=f"unit '{unit_text}' does not fit {spec.canonical_unit}")
    return Accepted(**base, number=converted, day=None, unit=spec.canonical_unit)
