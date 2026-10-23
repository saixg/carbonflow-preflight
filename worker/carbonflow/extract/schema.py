from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

SCHEMA_VERSION = "extract-schema-1"


@dataclass(frozen=True)
class FieldSpec:
    code: str
    data_type: str  # number | date
    canonical_unit: str | None
    description: str
    multiple: bool = False  # True when several different values are normal (e.g. monthly figures)


@dataclass(frozen=True)
class RawCandidate:
    """What a model proposes. Untrusted until validated against the document."""

    parameter: str
    quote: str
    value_text: str
    unit_text: str | None


@dataclass(frozen=True)
class Accepted:
    parameter: str
    unit_ref: str
    quote: str
    c0: int
    c1: int
    locator: dict
    page_number: int | None
    source_text: str
    original: str
    value_text: str
    unit_text: str | None
    number: Decimal | None
    day: date | None
    unit: str | None  # canonical unit the number is expressed in
    issue: str | None = None  # set when the value could not be normalised safely; a person must decide


@dataclass(frozen=True)
class Rejected:
    parameter: str | None
    reason: str
