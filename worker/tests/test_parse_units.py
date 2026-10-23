from datetime import date
from decimal import Decimal

import pytest

from carbonflow.parse import AmbiguousValue, UnparseableValue, parse_date, parse_number
from carbonflow.units import IncompatibleUnits, UnknownUnit, compatible, convert


@pytest.mark.parametrize(
    "text,expected",
    [
        ("152345", "152345"), ("152,345", "152345"), ("1,52,345", "152345"),  # western and Indian grouping
        ("12,34,567.5", "1234567.5"), ("0.82", "0.82"), ("-3.5", "-3.5"), ("−3", "-3"), (" 100 ", "100"),
        ("1,234", "1234"),
    ],
)
def test_numbers_parse_exactly(text, expected):
    assert parse_number(text) == Decimal(expected)


@pytest.mark.parametrize("text", ["1.234,5"])
def test_decimal_comma_is_ambiguous(text):
    with pytest.raises(AmbiguousValue):
        parse_number(text)


@pytest.mark.parametrize("text", ["", "abc", "1,5", "123,45,678", "1e5", "NaN", "12%", "1 234", "١٢٣", "1,23,45", "--2"])
def test_other_formats_are_rejected(text):
    with pytest.raises(UnparseableValue):
        parse_number(text)


def test_dates():
    assert parse_date("2023-12-31") == date(2023, 12, 31)
    assert parse_date("31 December 2023") == date(2023, 12, 31)
    assert parse_date("1st Jan 2023") == date(2023, 1, 1)
    assert parse_date("31/12/2023") == date(2023, 12, 31)  # day must be the first part here
    assert parse_date("12/31/2023") == date(2023, 12, 31)
    assert parse_date("05/05/2023") == date(2023, 5, 5)


def test_ambiguous_and_impossible_dates_are_not_guessed():
    with pytest.raises(AmbiguousValue):
        parse_date("03/04/2023")
    for bad in ["2023-02-30", "31 Foo 2023", "yesterday", "", "32/13/2023"]:
        with pytest.raises(UnparseableValue):
            parse_date(bad)


def test_unit_conversion_is_exact():
    assert convert(Decimal("152345000"), "kWh", "MWh") == Decimal("152345")
    assert convert(Decimal("820"), "kgCO2/MWh", "tCO2/MWh") == Decimal("0.82")
    assert convert(Decimal("1"), "GWh", "MWh") == Decimal("1000")
    assert convert(Decimal("3.6"), "GJ", "MWh") == Decimal("1")
    assert convert(Decimal("0.1"), "MWh", "MWh") == Decimal("0.1")  # no float drift


def test_unit_safety():
    with pytest.raises(IncompatibleUnits):
        convert(Decimal("100"), "MW", "MWh")  # power is not energy
    with pytest.raises(UnknownUnit):
        convert(Decimal("1"), "mwh", "MWh")  # could be milli-watt-hours: refused, not guessed
    with pytest.raises(UnknownUnit):
        convert(Decimal("1"), "banana", "MWh")
    assert compatible("kWh", "GJ") and not compatible("MW", "MWh") and not compatible("nope", "MWh")
