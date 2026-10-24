from __future__ import annotations

from typing import Any
from .manifest import EvidenceManifest


def generate_markdown_report(manifest: EvidenceManifest, *, project_name: str = "Carbon Project") -> str:
    """Generate an audit-ready Preflight Report in Markdown format."""
    lines: list[str] = []

    status_badge = {
        "READY_FOR_VERIFICATION": "[READY FOR VERIFICATION - 100% CHECKS PASSED]",
        "ACTION_REQUIRED": "[ACTION REQUIRED - MATERIAL FINDINGS IDENTIFIED]",
        "BLOCKED": "[BLOCKED - CRITICAL FINDINGS OUTSTANDING]",
    }.get(manifest.readiness_status, manifest.readiness_status)

    lines.append(f"# CarbonFlow Preflight — Audit Readiness Assessment")
    lines.append("")
    lines.append(f"**Project**: {project_name}  ")
    lines.append(f"**Run ID**: `{manifest.run_id}`  ")
    lines.append(f"**Assessment Date**: `{manifest.generated_at}`  ")
    lines.append(f"**Status**: **{status_badge}**  ")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Summary table
    lines.append("## 1. Executive Summary")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("| :--- | :--- |")
    lines.append(f"| **Methodology** | `{manifest.rulepack.get('methodology_code', 'N/A')}` v`{manifest.rulepack.get('methodology_version', 'N/A')}` |")
    lines.append(f"| **Rulepack** | `{manifest.rulepack.get('pack_id', 'N/A')}` v`{manifest.rulepack.get('version', 'N/A')}` |")
    lines.append(f"| **Engine Version** | `{manifest.engine_version}` |")
    lines.append(f"| **Input Snapshot Hash** | `{manifest.input_snapshot_hash[:16]}...` |")
    lines.append(f"| **Manifest Content Hash** | `{manifest.content_hash[:16]}...` |")
    lines.append(f"| **Rule Checks Passed** | **{manifest.checks_passed} / {manifest.checks_total}** ({round(manifest.checks_passed / max(manifest.checks_total, 1) * 100, 1)}%) |")
    lines.append(f"| **Documents Evaluated** | {len(manifest.documents)} |")
    lines.append(f"| **Traceable Values Extracted** | {len(manifest.values)} |")
    lines.append(f"| **Outstanding Findings** | {len([f for f in manifest.findings if f.get('status') != 'resolved'])} |")
    lines.append("")

    # Findings section
    lines.append("## 2. Preflight Findings & Remediation")
    lines.append("")
    if not manifest.findings:
        lines.append("No findings identified. All deterministic rule checks satisfied.")
        lines.append("")
    else:
        for idx, f in enumerate(manifest.findings, 1):
            sev_badge = f.get("severity", "minor").upper()
            status_badge_f = f.get("status", "open").upper()
            lines.append(f"### Finding #{idx}: [{sev_badge}] {f.get('title', 'Untitled')}")
            lines.append(f"- **Rule Code**: `{f.get('rule_code')}`")
            lines.append(f"- **Status**: `{status_badge_f}`")
            lines.append(f"- **Type**: `{f.get('finding_type', 'data_quality')}`")
            lines.append(f"- **Explanation**: {f.get('explanation')}")
            lines.append(f"- **Recommended Remediation**: {f.get('remediation')}")

            # Evidence quotes
            quotes = f.get("evidence_quotes", [])
            if quotes:
                lines.append("- **Supporting Evidence Quotes**:")
                for q in quotes:
                    lines.append(f"  > \"{q}\"")
            lines.append("")

    # Evidence & Document Manifest
    lines.append("## 3. Evidence & Ingestion Manifest")
    lines.append("")
    lines.append("| Document Name | Media Type | Size (Bytes) | SHA-256 Hash |")
    lines.append("| :--- | :--- | :---: | :--- |")
    for d in manifest.documents:
        lines.append(f"| `{d.get('filename')}` | `{d.get('media_type')}` | {d.get('size_bytes')} | `{d.get('sha256', '')[:16]}...` |")
    lines.append("")

    # Parameter values extracted
    lines.append("## 4. Extracted & Verified Values")
    lines.append("")
    lines.append("| Parameter | Value | Unit | Source Document | Page / Cell | Status |")
    lines.append("| :--- | :--- | :--- | :--- | :--- | :--- |")
    for v in manifest.values:
        doc_ref = v.get("document_id", "")[:8]
        lines.append(
            f"| `{v.get('parameter_code')}` | **{v.get('value')}** | {v.get('unit') or '—'} | `{doc_ref}...` | {v.get('page_or_unit', '1')} | `{v.get('review_status')}` |"
        )
    lines.append("")

    # Disclaimer
    lines.append("---")
    lines.append("## Legal & Verification Boundary Disclaimer")
    lines.append("")
    lines.append(f"> [!IMPORTANT]\n> {manifest.disclaimer}")
    lines.append("")

    return "\n".join(lines)
