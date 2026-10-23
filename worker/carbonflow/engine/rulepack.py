"""Versioned rulepacks. Pure data, validated on load, content-hashed so a run can name the exact rules."""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path

from .canon import canonical_hash
from .ops import CALCS, OPS

SEVERITIES = ("critical", "material", "minor")
FINDING_TYPES = ("data_quality", "incomplete_input", "inconsistency", "calculation_mismatch", "documentation")
BASES = ("directly_sourced", "derived", "internal_heuristic")


class InvalidRulepack(ValueError):
    pass


@dataclass(frozen=True)
class Rule:
    code: str
    category: str
    severity: str
    finding_type: str
    title: str
    op: str
    params: dict
    message: str
    remediation: str
    basis: str  # where the requirement comes from; test rules are always internal_heuristic
    clause_ref: str | None = None


@dataclass(frozen=True)
class Rulepack:
    id: str
    version: str
    label: str
    test_only: bool
    methodology_code: str
    methodology_version: str
    rules: tuple[Rule, ...]
    content_hash: str
    doc: dict  # the validated source document, stored with the run so the exact rules can be re-read


def _check_decimal(rule: str, key: str, value) -> None:
    try:
        Decimal(str(value))
    except InvalidOperation as e:
        raise InvalidRulepack(f"{rule}: '{key}' must be a number string") from e


def parse_rulepack(doc: dict) -> Rulepack:
    try:
        meta = doc["rulepack"]
        raw_rules = doc["rules"]
        rules: list[Rule] = []
        seen: set[str] = set()
        for r in raw_rules:
            code = r["code"]
            if code in seen:
                raise InvalidRulepack(f"duplicate rule code {code}")
            seen.add(code)
            spec = OPS.get(r["op"])
            if spec is None:
                raise InvalidRulepack(f"{code}: unknown operation '{r['op']}'")
            params = r.get("params", {})
            keys = set(params)
            if not spec.required <= keys:
                raise InvalidRulepack(f"{code}: missing parameters {sorted(spec.required - keys)}")
            if keys - spec.required - spec.optional:
                raise InvalidRulepack(f"{code}: unexpected parameters {sorted(keys - spec.required - spec.optional)}")
            for k in ("min", "max", "rel_tol", "abs_tol"):
                if k in params:
                    _check_decimal(code, k, params[k])
            if r["op"] == "recompute_matches":
                if params["calc"] not in CALCS:
                    raise InvalidRulepack(f"{code}: unknown calculation '{params['calc']}'")
                if not isinstance(params["inputs"], dict) or not params["inputs"]:
                    raise InvalidRulepack(f"{code}: inputs must be a non-empty object")
            if r["severity"] not in SEVERITIES:
                raise InvalidRulepack(f"{code}: severity must be one of {SEVERITIES}")
            if r["finding_type"] not in FINDING_TYPES:
                raise InvalidRulepack(f"{code}: finding_type must be one of {FINDING_TYPES}")
            if r["basis"] not in BASES:
                raise InvalidRulepack(f"{code}: basis must be one of {BASES}")
            if meta.get("test_only") and r["basis"] != "internal_heuristic":
                raise InvalidRulepack(f"{code}: a TEST ONLY rulepack may not claim a sourced requirement")
            rules.append(
                Rule(code, r["category"], r["severity"], r["finding_type"], r["title"], r["op"], dict(params),
                     r["message"], r["remediation"], r["basis"], r.get("clause_ref"))
            )
        if not rules:
            raise InvalidRulepack("rulepack has no rules")
        return Rulepack(
            id=meta["id"], version=meta["version"], label=meta["label"], test_only=bool(meta.get("test_only", False)),
            methodology_code=meta["methodology"]["code"], methodology_version=meta["methodology"]["version"],
            rules=tuple(sorted(rules, key=lambda x: x.code)),
            content_hash=canonical_hash(doc),
            doc=doc,
        )
    except KeyError as e:
        raise InvalidRulepack(f"missing field {e}") from e


def load_rulepack(path: str | Path) -> Rulepack:
    return parse_rulepack(json.loads(Path(path).read_text(encoding="utf-8")))
