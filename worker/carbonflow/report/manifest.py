from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from ..engine.canon import canonical_json
from ..hashing import sha256_hex

PREFLIGHT_DISCLAIMER = (
    "CarbonFlow Preflight is a pre-verification preparedness quality-control tool, "
    "not a certification body, registry authority, or guarantee of credit issuance. "
    "Third-party independent verifiers remain exclusively responsible for verification decisions."
)


@dataclass(frozen=True)
class DocumentManifestEntry:
    document_id: str
    filename: str
    sha256: str
    media_type: str
    size_bytes: int


@dataclass(frozen=True)
class ValueManifestEntry:
    parameter_code: str
    value: str
    unit: str | None
    document_id: str
    page_or_unit: str
    locator: dict
    source_type: str
    review_status: str


@dataclass(frozen=True)
class FindingManifestEntry:
    id: str
    rule_code: str
    severity: str
    status: str
    title: str
    explanation: str
    remediation: str
    evidence_quotes: list[str]


@dataclass
class EvidenceManifest:
    manifest_version: str
    generated_at: str
    run_id: str
    org_id: str
    project_id: str
    monitoring_period_id: str
    engine_version: str
    rulepack: dict[str, Any]
    input_snapshot_hash: str
    result_hash: str
    checks_total: int
    checks_passed: int
    readiness_status: str  # READY_FOR_VERIFICATION | ACTION_REQUIRED | BLOCKED
    disclaimer: str
    documents: list[dict[str, Any]]
    values: list[dict[str, Any]]
    findings: list[dict[str, Any]]
    content_hash: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("content_hash", None)
        return d

    def compute_hash(self) -> str:
        canonical_bytes = canonical_json(self.to_dict()).encode("utf-8")
        return sha256_hex(canonical_bytes)


def build_evidence_manifest(
    *,
    run_id: str,
    org_id: str,
    project_id: str,
    monitoring_period_id: str,
    engine_version: str,
    rulepack: dict[str, Any],
    input_snapshot_hash: str,
    result_hash: str,
    checks_total: int,
    checks_passed: int,
    documents: list[dict[str, Any]],
    values: list[dict[str, Any]],
    findings: list[dict[str, Any]],
) -> EvidenceManifest:
    # Determine readiness status based on findings severity
    critical_count = sum(1 for f in findings if f.get("severity") == "critical" and f.get("status") != "resolved")
    material_count = sum(1 for f in findings if f.get("severity") == "material" and f.get("status") != "resolved")

    if critical_count > 0:
        readiness_status = "BLOCKED"
    elif material_count > 0 or checks_passed < checks_total:
        readiness_status = "ACTION_REQUIRED"
    else:
        readiness_status = "READY_FOR_VERIFICATION"

    now_iso = datetime.now(timezone.utc).isoformat()

    manifest = EvidenceManifest(
        manifest_version="1.0.0",
        generated_at=now_iso,
        run_id=run_id,
        org_id=org_id,
        project_id=project_id,
        monitoring_period_id=monitoring_period_id,
        engine_version=engine_version,
        rulepack=rulepack,
        input_snapshot_hash=input_snapshot_hash,
        result_hash=result_hash,
        checks_total=checks_total,
        checks_passed=checks_passed,
        readiness_status=readiness_status,
        disclaimer=PREFLIGHT_DISCLAIMER,
        documents=documents,
        values=values,
        findings=findings,
    )
    manifest.content_hash = manifest.compute_hash()
    return manifest
