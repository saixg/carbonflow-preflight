"""Execute a rulepack against a frozen snapshot. No clock, no randomness, no network, no model calls."""

from __future__ import annotations

from dataclasses import dataclass

from .canon import canonical_hash
from .model import ENGINE_VERSION, Snapshot
from .ops import FAILED, NOT_APPLICABLE, OPS, PASSED, UNDECIDED, Result
from .rulepack import Rule, Rulepack

_SEV_RANK = {"critical": 0, "material": 1, "minor": 2}


@dataclass(frozen=True)
class Finding:
    rule_code: str
    rule_version: str
    finding_type: str
    severity: str
    title: str
    explanation: str
    remediation: str
    observed: dict
    expected: dict
    value_ids: tuple[str, ...]
    evidence_ref_ids: tuple[str, ...]
    subject: str

    def to_canonical(self) -> dict:
        return {
            "rule": self.rule_code, "version": self.rule_version, "type": self.finding_type,
            "severity": self.severity, "title": self.title, "explanation": self.explanation,
            "remediation": self.remediation, "observed": self.observed, "expected": self.expected,
            "values": sorted(self.value_ids), "evidence": sorted(self.evidence_ref_ids), "subject": self.subject,
        }


@dataclass(frozen=True)
class Check:
    rule_code: str
    status: str  # passed | failed | cannot_evaluate | not_applicable
    category: str


@dataclass(frozen=True)
class RunResult:
    snapshot_hash: str
    rulepack_id: str
    rulepack_version: str
    rulepack_hash: str
    engine_version: str
    checks: tuple[Check, ...]
    findings: tuple[Finding, ...]
    result_hash: str

    @property
    def applicable(self) -> int:
        return sum(1 for c in self.checks if c.status != NOT_APPLICABLE)

    @property
    def passed(self) -> int:
        return sum(1 for c in self.checks if c.status == PASSED)


def _fmt(template: str, result: Result) -> str:
    """Fill a message with observed/expected values. Only these named fields are available."""

    class _Safe(dict):
        def __missing__(self, key):
            return "{" + key + "}"

    return template.format_map(_Safe(detail=result.detail, observed=_pretty(result.observed),
                                     expected=_pretty(result.expected), subject=result.subject))


def _pretty(d: dict) -> str:
    from .canon import canonical_json

    return canonical_json(d) if d else "none"


def _finding(rule: Rule, pack: Rulepack, r: Result, snap: Snapshot) -> Finding:
    ev: set[str] = set()
    by_id = {v.id: v for v in snap.values}
    for vid in r.value_ids:
        if vid in by_id:
            ev.update(by_id[vid].evidence_ref_ids)
    ftype = "incomplete_input" if r.status == UNDECIDED else rule.finding_type
    title = rule.title if r.status == FAILED else f"Cannot check: {rule.title}"
    explanation = _fmt(rule.message, r) if r.status == FAILED else f"This check could not run. {r.detail}"
    return Finding(
        rule.code, pack.version, ftype, rule.severity, title, explanation, rule.remediation,
        dict(r.observed), dict(r.expected), tuple(sorted(r.value_ids)), tuple(sorted(ev)), r.subject,
    )


def run_rulepack(pack: Rulepack, snap: Snapshot) -> RunResult:
    if (pack.methodology_code, pack.methodology_version) != (snap.methodology_code, snap.methodology_version):
        raise ValueError("rulepack was written for a different methodology version")
    checks: list[Check] = []
    findings: list[Finding] = []
    for rule in pack.rules:
        results = OPS[rule.op].fn(snap, rule.params)
        statuses = {r.status for r in results}
        if FAILED in statuses:
            status = FAILED
        elif UNDECIDED in statuses:
            status = UNDECIDED
        elif statuses == {NOT_APPLICABLE} or not statuses:
            status = NOT_APPLICABLE
        else:
            status = PASSED
        checks.append(Check(rule.code, status, rule.category))
        findings.extend(_finding(rule, pack, r, snap) for r in results if r.status in (FAILED, UNDECIDED))

    findings.sort(key=lambda f: (_SEV_RANK[f.severity], f.rule_code, f.subject))
    snap_hash = snap.hash()
    body = {
        "snapshot": snap_hash, "rulepack": [pack.id, pack.version, pack.content_hash], "engine": ENGINE_VERSION,
        "checks": [[c.rule_code, c.status] for c in checks],
        "findings": [f.to_canonical() for f in findings],
    }
    return RunResult(snap_hash, pack.id, pack.version, pack.content_hash, ENGINE_VERSION,
                     tuple(checks), tuple(findings), canonical_hash(body))
