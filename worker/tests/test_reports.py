from __future__ import annotations

import io
import json
import zipfile
import pytest

from carbonflow.hashing import sha256_hex
from carbonflow.report import (
    PREFLIGHT_DISCLAIMER,
    build_evidence_manifest,
    create_evidence_package_zip,
    generate_csv_findings_workbook,
    generate_markdown_report,
)


@pytest.fixture
def sample_manifest_data():
    return {
        "run_id": "00000000-0000-0000-0000-000000000001",
        "org_id": "00000000-0000-0000-0000-000000000002",
        "project_id": "00000000-0000-0000-0000-000000000003",
        "monitoring_period_id": "00000000-0000-0000-0000-000000000004",
        "engine_version": "0.1.0",
        "rulepack": {"pack_id": "TEST-ONLY", "version": "0.1", "methodology_code": "TEST-ONLY", "methodology_version": "0.1"},
        "input_snapshot_hash": sha256_hex(b"inputs"),
        "result_hash": sha256_hex(b"results"),
        "checks_total": 9,
        "checks_passed": 7,
        "documents": [
            {
                "document_id": "doc-01",
                "filename": "monitoring_report_2023.pdf",
                "sha256": sha256_hex(b"doc-bytes"),
                "media_type": "application/pdf",
                "size_bytes": 1048576,
            }
        ],
        "values": [
            {
                "parameter_code": "net_export_mwh",
                "value": "152345",
                "unit": "MWh",
                "document_id": "doc-01",
                "page_or_unit": "1",
                "locator": {"type": "pdf_span", "page": 1, "bbox": [72, 72, 200, 90]},
                "source_type": "extracted",
                "review_status": "human_confirmed",
            }
        ],
        "findings": [
            {
                "id": "f-01",
                "rule_code": "R-SUM-MONTHLY",
                "severity": "material",
                "status": "open",
                "finding_type": "inconsistency",
                "title": "Monthly exports do not sum to total",
                "explanation": "Reported total 152,345 MWh differs from monthly sum 151,000 MWh",
                "remediation": "Reconcile generation log with invoice statements",
                "evidence_quotes": ["Total: 152,345 MWh", "Sum of months: 151,000 MWh"],
            }
        ],
    }


def test_build_evidence_manifest_readiness_and_hashing(sample_manifest_data):
    manifest = build_evidence_manifest(**sample_manifest_data)

    assert manifest.run_id == sample_manifest_data["run_id"]
    assert manifest.readiness_status == "ACTION_REQUIRED"
    assert PREFLIGHT_DISCLAIMER in manifest.disclaimer
    assert len(manifest.content_hash) == 64

    # Critical finding triggers BLOCKED
    critical_data = dict(sample_manifest_data)
    critical_data["findings"] = [
        dict(sample_manifest_data["findings"][0], severity="critical", status="open")
    ]
    blocked_manifest = build_evidence_manifest(**critical_data)
    assert blocked_manifest.readiness_status == "BLOCKED"

    # All resolved triggers READY
    resolved_data = dict(sample_manifest_data)
    resolved_data["findings"] = [
        dict(sample_manifest_data["findings"][0], status="resolved")
    ]
    resolved_data["checks_passed"] = resolved_data["checks_total"]
    ready_manifest = build_evidence_manifest(**resolved_data)
    assert ready_manifest.readiness_status == "READY_FOR_VERIFICATION"


def test_markdown_report_generation(sample_manifest_data):
    manifest = build_evidence_manifest(**sample_manifest_data)
    report_md = generate_markdown_report(manifest, project_name="Solar Facility AP-01")

    assert "# CarbonFlow Preflight — Audit Readiness Assessment" in report_md
    assert "Solar Facility AP-01" in report_md
    assert "ACTION REQUIRED" in report_md
    assert "Monthly exports do not sum to total" in report_md
    assert "Total: 152,345 MWh" in report_md
    assert PREFLIGHT_DISCLAIMER in report_md


def test_csv_findings_workbook_generation(sample_manifest_data):
    manifest = build_evidence_manifest(**sample_manifest_data)
    csv_text = generate_csv_findings_workbook(manifest)

    assert "finding_id,rule_code,severity,status" in csv_text
    assert "R-SUM-MONTHLY" in csv_text
    assert "152,345 MWh" in csv_text


def test_evidence_package_zip(sample_manifest_data):
    manifest = build_evidence_manifest(**sample_manifest_data)
    zip_bytes = create_evidence_package_zip(manifest, project_name="Solar Facility AP-01")

    assert len(zip_bytes) > 0
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as z:
        names = z.namelist()
        assert "manifest.json" in names
        assert "manifest.sha256" in names
        assert "preflight_report.md" in names
        assert "findings_workbook.csv" in names

        # Verify offline checksum
        manifest_data = z.read("manifest.json")
        computed_hash = sha256_hex(manifest_data)
        checksum_entry = z.read("manifest.sha256").decode("utf-8")
        assert computed_hash in checksum_entry
