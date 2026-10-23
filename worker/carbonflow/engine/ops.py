"""The only operations a rule may use. A fixed, typed set: no expressions, no code from data.

Every operation is a pure function of the snapshot and its parameters. When it cannot decide
(missing or conflicting inputs) it says so; it never passes silently.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Callable

from .. import units
from .model import Snapshot, Val

PASSED, FAILED, UNDECIDED, NOT_APPLICABLE = "passed", "failed", "cannot_evaluate", "not_applicable"


@dataclass(frozen=True)
class Result:
    status: str
    detail: str = ""
    observed: dict = field(default_factory=dict)
    expected: dict = field(default_factory=dict)
    value_ids: tuple[str, ...] = ()
    subject: str = ""  # distinguishes several findings from one rule


def _dec(text: str) -> Decimal:
    try:
        return Decimal(text)
    except InvalidOperation as e:
        raise ValueError(f"'{text}' is not a number") from e


def _single(snap: Snapshot, code: str) -> tuple[Val | None, str]:
    """One reviewed value for a parameter. Several that disagree are a conflict, not a choice."""
    found = snap.of(code)
    if not found:
        return None, "missing"
    first = found[0]
    if any((v.number, v.day) != (first.number, first.day) for v in found[1:]):
        return None, "conflict"
    return first, "ok"


def _undecided(code: str, why: str, ids=()) -> Result:
    return Result(UNDECIDED, f"{code}: {why}", subject=code, value_ids=tuple(ids))


def _within(a: Decimal, b: Decimal, rel: Decimal, absolute: Decimal) -> bool:
    return abs(a - b) <= max(absolute, rel * max(abs(a), abs(b)))


def _tols(p: dict) -> tuple[Decimal, Decimal]:
    return _dec(p.get("rel_tol", "0")), _dec(p.get("abs_tol", "0"))


# --------------------------------------------------------------------- operations


def op_present(snap: Snapshot, p: dict) -> list[Result]:
    code = p["parameter"]
    found = snap.of(code)
    if found:
        return [Result(PASSED, subject=code, value_ids=tuple(v.id for v in found))]
    return [Result(FAILED, f"no reviewed value for {code}", {"count": 0}, {"count": ">=1"}, subject=code)]


def op_date_order(snap: Snapshot, p: dict) -> list[Result]:
    a, sa = _single(snap, p["first"])
    b, sb = _single(snap, p["second"])
    if sa != "ok" or sb != "ok":
        return [_undecided(p["first"] + "/" + p["second"], f"{p['first']} is {sa}, {p['second']} is {sb}")]
    if a.day is None or b.day is None:
        return [_undecided(p["first"], "not date values")]
    ids = (a.id, b.id)
    if a.day < b.day:
        return [Result(PASSED, value_ids=ids, subject=p["first"])]
    return [Result(FAILED, "dates are out of order", {p["first"]: a.day, p["second"]: b.day},
                   {"order": f"{p['first']} before {p['second']}"}, ids, p["first"])]


def op_period_matches(snap: Snapshot, p: dict) -> list[Result]:
    out: list[Result] = []
    for key, expected in (("start_parameter", snap.period_start), ("end_parameter", snap.period_end)):
        code = p[key]
        v, s = _single(snap, code)
        if s != "ok":
            out.append(_undecided(code, s))
        elif v.day != expected:
            out.append(Result(FAILED, f"{code} differs from the monitoring period", {code: v.day},
                              {code: expected}, (v.id,), code))
        else:
            out.append(Result(PASSED, value_ids=(v.id,), subject=code))
    return out


def op_in_range(snap: Snapshot, p: dict) -> list[Result]:
    code = p["parameter"]
    lo = _dec(p["min"]) if "min" in p else None
    hi = _dec(p["max"]) if "max" in p else None
    found = snap.of(code)
    if not found:
        return [_undecided(code, "missing")]
    out = []
    for v in found:
        if v.number is None:
            out.append(_undecided(code, "not a numeric value", (v.id,)))
        elif (lo is not None and v.number < lo) or (hi is not None and v.number > hi):
            out.append(Result(FAILED, f"{code} is outside the allowed range", {code: v.number},
                              {"min": lo, "max": hi}, (v.id,), f"{code}:{v.id}"))
        else:
            out.append(Result(PASSED, value_ids=(v.id,), subject=f"{code}:{v.id}"))
    return out


def op_unit_compatible(snap: Snapshot, p: dict) -> list[Result]:
    code = p["parameter"]
    pd = snap.param(code)
    found = snap.of(code)
    if not found:
        return [_undecided(code, "missing")]
    if pd is None or not pd.canonical_unit:
        return [Result(NOT_APPLICABLE, "parameter has no canonical unit", subject=code)]
    out = []
    for v in found:
        if not v.unit:
            out.append(Result(FAILED, f"{code} has no unit", {"unit": None}, {"unit": pd.canonical_unit}, (v.id,), f"{code}:{v.id}"))
        elif not units.compatible(v.unit, pd.canonical_unit):
            out.append(Result(FAILED, f"{code} unit does not match the expected dimension", {"unit": v.unit},
                              {"unit": pd.canonical_unit}, (v.id,), f"{code}:{v.id}"))
        else:
            out.append(Result(PASSED, value_ids=(v.id,), subject=f"{code}:{v.id}"))
    return out


def op_agree_within(snap: Snapshot, p: dict) -> list[Result]:
    """Several reviewed values for the same parameter (e.g. from different documents) must agree."""
    code = p["parameter"]
    found = [v for v in snap.of(code) if v.number is not None]
    if len(found) < 2:
        return [Result(NOT_APPLICABLE, "fewer than two values to compare", subject=code)]
    rel, ab = _tols(p)
    lo, hi = min(found, key=lambda v: v.number), max(found, key=lambda v: v.number)
    ids = tuple(v.id for v in found)
    if _within(lo.number, hi.number, rel, ab):
        return [Result(PASSED, value_ids=ids, subject=code)]
    return [Result(FAILED, f"values for {code} disagree", {"lowest": lo.number, "highest": hi.number},
                   {"rel_tol": rel, "abs_tol": ab}, ids, code)]


def op_equals_within_tolerance(snap: Snapshot, p: dict) -> list[Result]:
    a, sa = _single(snap, p["left"])
    b, sb = _single(snap, p["right"])
    if sa != "ok" or sb != "ok" or a.number is None or b.number is None:
        return [_undecided(p["left"] + "/" + p["right"], f"{p['left']} is {sa}, {p['right']} is {sb}")]
    rel, ab = _tols(p)
    ids = (a.id, b.id)
    if _within(a.number, b.number, rel, ab):
        return [Result(PASSED, value_ids=ids, subject=p["left"])]
    return [Result(FAILED, "values differ by more than the tolerance", {p["left"]: a.number, p["right"]: b.number},
                   {"rel_tol": rel, "abs_tol": ab}, ids, p["left"])]


def op_sums_to(snap: Snapshot, p: dict) -> list[Result]:
    parts = [v for v in snap.of(p["parts"]) if v.number is not None]
    total, st = _single(snap, p["total"])
    if not parts or st != "ok" or total.number is None:
        return [_undecided(p["total"], f"parts={len(parts)}, total is {st}")]
    rel, ab = _tols(p)
    s = sum((v.number for v in parts), Decimal(0))
    ids = tuple(v.id for v in parts) + (total.id,)
    if _within(s, total.number, rel, ab):
        return [Result(PASSED, value_ids=ids, subject=p["total"])]
    return [Result(FAILED, f"{p['parts']} values do not add up to {p['total']}",
                   {"sum_of_parts": s, "total": total.number, "difference": total.number - s},
                   {"rel_tol": rel, "abs_tol": ab}, ids, p["total"])]


CALCS: dict[str, Callable[[dict[str, Decimal]], Decimal]] = {
    "product": lambda x: x["a"] * x["b"],
    "difference": lambda x: x["a"] - x["b"],
    "ratio": lambda x: x["a"] / x["b"],
}


def op_recompute_matches(snap: Snapshot, p: dict) -> list[Result]:
    """Recompute a claimed figure from its inputs with a named, fixed calculation."""
    fn = CALCS[p["calc"]]
    inputs: dict[str, Decimal] = {}
    ids: list[str] = []
    for name, code in sorted(p["inputs"].items()):
        v, s = _single(snap, code)
        if s != "ok" or v.number is None:
            return [_undecided(p["claimed"], f"input {code} is {s}")]
        inputs[name] = v.number
        ids.append(v.id)
    claimed, sc = _single(snap, p["claimed"])
    if sc != "ok" or claimed.number is None:
        return [_undecided(p["claimed"], f"claimed value is {sc}")]
    if p["calc"] == "ratio" and inputs["b"] == 0:
        return [_undecided(p["claimed"], "division by zero")]
    expected = fn(inputs)
    rel, ab = _tols(p)
    ids.append(claimed.id)
    if _within(expected, claimed.number, rel, ab):
        return [Result(PASSED, value_ids=tuple(ids), subject=p["claimed"])]
    return [Result(FAILED, f"{p['claimed']} does not match its recomputation",
                   {"claimed": claimed.number}, {"recomputed": expected, "rel_tol": rel, "abs_tol": ab},
                   tuple(ids), p["claimed"])]


@dataclass(frozen=True)
class OpSpec:
    fn: Callable[[Snapshot, dict], list[Result]]
    required: frozenset[str]
    optional: frozenset[str] = frozenset()


OPS: dict[str, OpSpec] = {
    "present": OpSpec(op_present, frozenset({"parameter"})),
    "date_order": OpSpec(op_date_order, frozenset({"first", "second"})),
    "period_matches": OpSpec(op_period_matches, frozenset({"start_parameter", "end_parameter"})),
    "in_range": OpSpec(op_in_range, frozenset({"parameter"}), frozenset({"min", "max"})),
    "unit_compatible": OpSpec(op_unit_compatible, frozenset({"parameter"})),
    "agree_within": OpSpec(op_agree_within, frozenset({"parameter"}), frozenset({"rel_tol", "abs_tol"})),
    "equals_within_tolerance": OpSpec(op_equals_within_tolerance, frozenset({"left", "right"}), frozenset({"rel_tol", "abs_tol"})),
    "sums_to": OpSpec(op_sums_to, frozenset({"parts", "total"}), frozenset({"rel_tol", "abs_tol"})),
    "recompute_matches": OpSpec(op_recompute_matches, frozenset({"calc", "inputs", "claimed"}), frozenset({"rel_tol", "abs_tol"})),
}
