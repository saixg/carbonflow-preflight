from __future__ import annotations

import csv
import io
from .manifest import EvidenceManifest


def generate_csv_findings_workbook(manifest: EvidenceManifest) -> str:
    """Generate a Findings & Reconciliation Workbook in CSV format for auditors."""
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")

    # Header metadata
    writer.writerow(["# CarbonFlow Preflight Findings & Reconciliation Workbook"])
    writer.writerow(["# Run ID", manifest.run_id])
    writer.writerow(["# Generated At", manifest.generated_at])
    writer.writerow(["# Engine Version", manifest.engine_version])
    writer.writerow(["# Rulepack", f"{manifest.rulepack.get('pack_id')} v{manifest.rulepack.get('version')}"])
    writer.writerow(["# Disclaimer", manifest.disclaimer])
    writer.writerow([])

    # Findings Table
    writer.writerow([
        "finding_id",
        "rule_code",
        "severity",
        "status",
        "type",
        "title",
        "explanation",
        "remediation",
        "evidence_quotes",
    ])

    for f in manifest.findings:
        quotes_joined = " | ".join(f.get("evidence_quotes", []))
        writer.writerow([
            f.get("id", ""),
            f.get("rule_code", ""),
            f.get("severity", ""),
            f.get("status", ""),
            f.get("finding_type", ""),
            f.get("title", ""),
            f.get("explanation", ""),
            f.get("remediation", ""),
            quotes_joined,
        ])

    return output.getvalue()
