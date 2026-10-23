"""Strict parsing of numbers and dates found in documents.

Anything ambiguous raises. A number or date that could mean two things is sent to a person
instead of being guessed, because a wrong reading would flow into calculations.
"""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation


class AmbiguousValue(ValueError):
    """The text could reasonably mean more than one thing."""


class UnparseableValue(ValueError):
    """The text is not a number or date in a supported format."""


_PLAIN = re.compile(r"^[0-9]+(\.[0-9]+)?$")
_WESTERN = re.compile(r"^[0-9]{1,3}(,[0-9]{3})+(\.[0-9]+)?$")
_INDIAN = re.compile(r"^[0-9]{1,2}(,[0-9]{2})*,[0-9]{3}(\.[0-9]+)?$")


def parse_number(text: str) -> Decimal:
    """Parse 152,345 / 1,52,345 / 0.82 / -3.5. Commas are thousands separators, never decimals."""
    s = (text or "").strip().replace("−", "-")
    sign = 1
    if s.startswith("-"):
        sign, s = -1, s[1:]
    elif s.startswith("+"):
        s = s[1:]
    if not s:
        raise UnparseableValue("empty number")
    if "," in s and "." in s and s.rfind(",") > s.rfind("."):
        raise AmbiguousValue("looks like a decimal comma (1.234,5); needs a person to confirm")
    if not (_PLAIN.match(s) or _WESTERN.match(s) or _INDIAN.match(s)):
        raise UnparseableValue("not a recognised number format")
    try:
        return sign * Decimal(s.replace(",", ""))
    except InvalidOperation as e:  # pragma: no cover - the patterns already guarantee validity
        raise UnparseableValue("not a number") from e


_MONTHS = {
    m: i
    for i, names in enumerate(
        [
            ("january", "jan"), ("february", "feb"), ("march", "mar"), ("april", "apr"),
            ("may",), ("june", "jun"), ("july", "jul"), ("august", "aug"),
            ("september", "sep", "sept"), ("october", "oct"), ("november", "nov"), ("december", "dec"),
        ],
        start=1,
    )
    for m in names
}
_ISO = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})$")
_TEXTUAL = re.compile(r"^([0-9]{1,2})(?:st|nd|rd|th)?[ \-]([A-Za-z]+)[ \-,]+([0-9]{4})$")
_NUMERIC = re.compile(r"^([0-9]{1,2})[/.\-]([0-9]{1,2})[/.\-]([0-9]{4})$")


def parse_date(text: str) -> date:
    """Parse 2023-12-31, 31 December 2023, 31/12/2023. Day/month order must be unambiguous."""
    s = (text or "").strip()
    try:
        if m := _ISO.match(s):
            return date(int(m[1]), int(m[2]), int(m[3]))
        if m := _TEXTUAL.match(s):
            month = _MONTHS.get(m[2].lower())
            if month is None:
                raise UnparseableValue("unknown month name")
            return date(int(m[3]), month, int(m[1]))
        if m := _NUMERIC.match(s):
            a, b, year = int(m[1]), int(m[2]), int(m[3])
            if a > 12 and b <= 12:
                return date(year, b, a)  # day first
            if b > 12 and a <= 12:
                return date(year, a, b)  # month first
            if a == b:
                return date(year, a, b)
            if a <= 12 and b <= 12:
                raise AmbiguousValue("day and month order is ambiguous (e.g. 03/04/2023)")
    except ValueError as e:
        if isinstance(e, (AmbiguousValue, UnparseableValue)):
            raise
        raise UnparseableValue("not a real calendar date") from e
    raise UnparseableValue("not a recognised date format")
