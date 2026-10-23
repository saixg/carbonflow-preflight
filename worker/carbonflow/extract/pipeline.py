"""Turn parsed document text into candidate parameter values, with evidence and a review status.

The model proposes; the document and deterministic code dispose. Every value ends up either
confirmed by agreement plus an independent check (only if auto-accept is switched on), or in front of
a person. Nothing here decides compliance.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..parsers.base import ParsedUnit
from . import prompts
from .provider import ExtractionProvider, ProviderError
from .schema import SCHEMA_VERSION, Accepted, FieldSpec, Rejected
from .validate import validate_candidate


@dataclass
class ExtractedValue:
    document_id: str
    accepted: Accepted
    review_status: str  # needs_review | auto_accepted | conflicting
    notes: list[str]
    extractor: dict


@dataclass
class ExtractionReport:
    values: list[ExtractedValue] = field(default_factory=list)
    rejections: list[Rejected] = field(default_factory=list)
    pass_errors: int = 0
    passes: int = 0


def _sig(a: Accepted):
    return (a.number, a.day, a.unit, a.issue)


def extract_units(
    *,
    document_id: str,
    units: list[ParsedUnit],
    fields: list[FieldSpec],
    provider: ExtractionProvider,
    passes: int = 3,
    auto_accept: bool = False,
) -> ExtractionReport:
    """Run several independent passes per document part, validate, cross-check and grade each value.

    auto_accept stays False until extraction precision has been measured against labelled documents;
    until then every value waits for a person.
    """
    specs = {f.code: f for f in fields}
    report = ExtractionReport(passes=passes)

    for unit in units:
        if not unit.text.strip():
            continue
        per_pass: list[dict[tuple, Accepted]] = []
        info: dict = {}
        for i in range(passes):
            try:
                res = provider.extract(fields, unit.text, unit.unit_ref, i)
            except ProviderError:
                report.pass_errors += 1
                continue
            info = res.info or info
            seen: dict[tuple, Accepted] = {}
            for raw in res.candidates:
                out = validate_candidate(raw, specs, unit)
                if isinstance(out, Rejected):
                    report.rejections.append(out)
                    continue
                key = (out.parameter, out.original, out.number, out.day, out.unit, out.issue)
                seen.setdefault(key, out)
            per_pass.append(seen)

        keys = sorted({k for p in per_pass for k in p}, key=lambda k: (k[0], k[1]))
        for key in keys:
            versions = [p[key] for p in per_pass if key in p]
            first = versions[0]
            spec = specs[first.parameter]
            notes: list[str] = []
            in_all = len(versions) == passes
            if not in_all:
                notes.append(f"found in {len(versions)} of {passes} passes")
            if first.issue:
                notes.append(first.issue)

            verified = False
            if in_all and first.issue is None:
                try:
                    verified = provider.verify(spec, first.source_text, first.value_text, first.unit_text)
                except ProviderError:
                    notes.append("independent check could not run")
                else:
                    if not verified:
                        notes.append("independent check did not confirm")

            status = "auto_accepted" if (auto_accept and in_all and verified and first.issue is None) else "needs_review"
            report.values.append(
                ExtractedValue(
                    document_id, first, status, notes,
                    {
                        "method": "llm_extraction", "schema_version": SCHEMA_VERSION,
                        "provider": info.get("provider"), "model": info.get("model"),
                        "prompt_hash": info.get("prompt_hash") or prompts.prompt_hash(),
                        "passes_requested": passes, "passes_seen": len(versions), "verified": verified,
                    },
                )
            )

    _flag_conflicts(report, specs)
    return report


def _flag_conflicts(report: ExtractionReport, specs: dict[str, FieldSpec]) -> None:
    """A field that should have one value must not silently get two. Neither is chosen."""
    by_param: dict[str, list[ExtractedValue]] = {}
    for v in report.values:
        if v.accepted.issue is None:
            by_param.setdefault(v.accepted.parameter, []).append(v)
    for code, vals in by_param.items():
        if specs[code].multiple:
            continue
        if len({(v.accepted.number, v.accepted.day, v.accepted.unit) for v in vals}) > 1:
            for v in vals:
                v.review_status = "conflicting"
                v.notes.append("the document gives different values for this field")
