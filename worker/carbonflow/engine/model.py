from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from .canon import canonical_hash

ENGINE_VERSION = "engine-0.1.0"

# Only values in these states may feed a calculation.
ALLOWED_REVIEW_STATES = frozenset({"auto_accepted", "human_confirmed", "human_corrected"})


class EngineInputError(ValueError):
    """The snapshot breaks a rule the engine relies on (e.g. an unreviewed value was supplied)."""


@dataclass(frozen=True)
class ParamDef:
    code: str
    data_type: str  # number | date | text | boolean
    canonical_unit: str | None = None


@dataclass(frozen=True)
class Val:
    """A reviewed value. `number` is already in the parameter's canonical unit."""

    id: str
    parameter: str
    original: str
    review_status: str
    number: Decimal | None = None
    day: date | None = None
    unit: str | None = None
    document_id: str | None = None
    evidence_ref_ids: tuple[str, ...] = ()
    source_type: str = "extracted"


@dataclass(frozen=True)
class Snapshot:
    """Everything a run reads, frozen. Its hash identifies the inputs."""

    org_id: str
    project_id: str
    period_id: str
    period_start: date
    period_end: date
    methodology_code: str
    methodology_version: str
    params: tuple[ParamDef, ...]
    values: tuple[Val, ...]

    def __post_init__(self):
        for v in self.values:
            if v.review_status not in ALLOWED_REVIEW_STATES:
                raise EngineInputError(f"value {v.id} is '{v.review_status}' and cannot feed a calculation")
            if v.parameter not in {p.code for p in self.params}:
                raise EngineInputError(f"value {v.id} has unknown parameter '{v.parameter}'")
            if not v.evidence_ref_ids and v.source_type != "asserted":
                raise EngineInputError(f"value {v.id} has no evidence")

    def param(self, code: str) -> ParamDef | None:
        return next((p for p in self.params if p.code == code), None)

    def of(self, code: str) -> list[Val]:
        return sorted((v for v in self.values if v.parameter == code), key=lambda v: v.id)

    def to_canonical(self) -> dict:
        return {
            "org_id": self.org_id,
            "project_id": self.project_id,
            "period_id": self.period_id,
            "period": [self.period_start, self.period_end],
            "methodology": [self.methodology_code, self.methodology_version],
            "params": sorted(
                ({"code": p.code, "type": p.data_type, "unit": p.canonical_unit} for p in self.params),
                key=lambda p: p["code"],
            ),
            "values": sorted(
                (
                    {
                        "id": v.id, "parameter": v.parameter, "original": v.original, "number": v.number,
                        "day": v.day, "unit": v.unit, "document_id": v.document_id,
                        "evidence": sorted(v.evidence_ref_ids), "review_status": v.review_status,
                        "source_type": v.source_type,
                    }
                    for v in self.values
                ),
                key=lambda v: (v["parameter"], v["id"]),
            ),
        }

    def hash(self) -> str:
        return canonical_hash(self.to_canonical())
