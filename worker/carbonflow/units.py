"""Unit-safe conversion with exact decimal arithmetic (pint, Decimal backend).

Only listed unit spellings are accepted. Anything else (including case variants such as "mwh",
which could mean milli-watt-hours) is rejected so a person decides.
"""

from __future__ import annotations

from decimal import Decimal

import pint

_ureg = pint.UnitRegistry(non_int_type=Decimal)
_ureg.define("kgCO2 = [co2_mass] = kgCO2e")
_ureg.define("tCO2 = 1000 * kgCO2 = tCO2e")

# Spelling in documents -> expression pint understands.
_ALLOWED: dict[str, str] = {
    "Wh": "Wh", "kWh": "kWh", "MWh": "MWh", "GWh": "GWh",
    "W": "W", "kW": "kW", "MW": "MW", "GW": "GW",
    "J": "J", "MJ": "MJ", "GJ": "GJ", "TJ": "TJ",
    "kg": "kg", "t": "tonne",
    "kgCO2": "kgCO2", "kgCO2e": "kgCO2", "tCO2": "tCO2", "tCO2e": "tCO2",
    "tCO2/MWh": "tCO2/MWh", "tCO2e/MWh": "tCO2/MWh",
    "kgCO2/MWh": "kgCO2/MWh", "kgCO2e/MWh": "kgCO2/MWh",
    "tCO2/kWh": "tCO2/kWh", "kgCO2/kWh": "kgCO2/kWh",
    "MWh/MW": "MWh/MW",
}


class UnknownUnit(ValueError):
    pass


class IncompatibleUnits(ValueError):
    pass


def _unit(text: str):
    key = (text or "").strip()
    if key not in _ALLOWED:
        raise UnknownUnit(f"unit '{key}' is not recognised")
    return _ureg.Unit(_ALLOWED[key])


def is_known(text: str) -> bool:
    return (text or "").strip() in _ALLOWED


def compatible(a: str, b: str) -> bool:
    try:
        return _unit(a).dimensionality == _unit(b).dimensionality
    except UnknownUnit:
        return False


def convert(value: Decimal, from_unit: str, to_unit: str) -> Decimal:
    """Exact conversion; raises IncompatibleUnits if the dimensions differ (e.g. MWh to MW)."""
    src, dst = _unit(from_unit), _unit(to_unit)
    if src.dimensionality != dst.dimensionality:
        raise IncompatibleUnits(f"cannot convert {from_unit} to {to_unit}")
    q = _ureg.Quantity(Decimal(value), src).to(dst)
    return Decimal(q.magnitude)
