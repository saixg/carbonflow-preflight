from __future__ import annotations

import io
import zipfile

from ..engine.canon import canonical_json
from .csv_workbook import generate_csv_findings_workbook
from .manifest import EvidenceManifest
from .markdown_report import generate_markdown_report


def create_evidence_package_zip(manifest: EvidenceManifest, *, project_name: str = "Carbon Project") -> bytes:
    """Create a self-contained, auditable ZIP evidence package."""
    buf = io.BytesIO()

    # Canonical JSON serialization ensures manifest.content_hash exactly matches manifest.json
    manifest_bytes = canonical_json(manifest.to_dict()).encode("utf-8")
    report_md = generate_markdown_report(manifest, project_name=project_name)
    workbook_csv = generate_csv_findings_workbook(manifest)
    checksum_txt = f"{manifest.content_hash}  manifest.json\n"

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", manifest_bytes)
        z.writestr("manifest.sha256", checksum_txt.encode("utf-8"))
        z.writestr("preflight_report.md", report_md.encode("utf-8"))
        z.writestr("findings_workbook.csv", workbook_csv.encode("utf-8"))

    return buf.getvalue()
