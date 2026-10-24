import { describe, expect, it } from "vitest";
import {
  buildEvidenceManifest,
  canonicalJsonHash,
  generateMarkdownReport,
  generateCsvWorkbook,
  createEvidencePackageZip,
  PREFLIGHT_DISCLAIMER,
  type ReportDocument,
  type ReportFinding,
} from "../web/lib/reports";
import JSZip from "../web/node_modules/jszip";

describe("Web Reports and Evidence Package Generator", () => {
  const sampleDocs: ReportDocument[] = [
    {
      id: "doc-1",
      name: "Monitoring_Report_2023.pdf",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      media_type: "application/pdf",
      page_count: 24,
    },
  ];

  const sampleFindings: ReportFinding[] = [
    {
      id: "f-1",
      rule_code: "CALC-001",
      severity: "critical",
      status: "open",
      title: "Net electricity export mismatch",
      detail: "152,345 MWh vs 149,120 MWh sum of monthly meter logs.",
      remediation: "Reconcile meter logs.",
      quotes: ["Net exported: 152,345 MWh"],
    },
    {
      id: "f-2",
      rule_code: "FMT-001",
      severity: "minor",
      status: "resolved",
      title: "Date formatting variance",
      detail: "DD/MM/YYYY vs YYYY-MM-DD",
      remediation: "Standardize dates.",
      review_comment: "Format unified across table 2.",
    },
  ];

  it("builds evidence manifest with canonical hash and BLOCKED readiness when critical open", () => {
    const manifest = buildEvidenceManifest({
      run_id: "run-001",
      project_id: "proj-001",
      monitoring_period_id: "mp-001",
      org_id: "org-001",
      project_name: "Solar MRV Alpha",
      methodology: "ACM0002 v21.0",
      documents: sampleDocs,
      findings: sampleFindings,
    });

    expect(manifest.verification_readiness).toBe("BLOCKED");
    expect(manifest.stats.total_documents).toBe(1);
    expect(manifest.stats.total_findings).toBe(2);
    expect(manifest.stats.critical_findings).toBe(1);
    expect(manifest.stats.resolved_findings).toBe(1);
    expect(manifest.disclaimer).toBe(PREFLIGHT_DISCLAIMER);
    expect(manifest.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sets READY_FOR_VERIFICATION when all critical/material findings resolved", () => {
    const resolvedFindings: ReportFinding[] = sampleFindings.map((f) => ({
      ...f,
      status: "resolved",
    }));

    const manifest = buildEvidenceManifest({
      run_id: "run-002",
      project_id: "proj-001",
      monitoring_period_id: "mp-001",
      org_id: "org-001",
      documents: sampleDocs,
      findings: resolvedFindings,
    });

    expect(manifest.verification_readiness).toBe("READY_FOR_VERIFICATION");
    expect(manifest.readiness_reasons[0]).toContain("resolved");
  });

  it("generates markdown report containing disclaimer, citations, and summary table", () => {
    const manifest = buildEvidenceManifest({
      run_id: "run-001",
      project_id: "proj-001",
      monitoring_period_id: "mp-001",
      org_id: "org-001",
      project_name: "Solar MRV Alpha",
      methodology: "ACM0002 v21.0",
      documents: sampleDocs,
      findings: sampleFindings,
    });

    const md = generateMarkdownReport(manifest);
    expect(md).toContain("# CarbonFlow Preflight");
    expect(md).toContain("BLOCKED");
    expect(md).toContain("ACM0002 v21.0");
    expect(md).toContain(manifest.content_hash);
    expect(md).toContain(PREFLIGHT_DISCLAIMER);
    expect(md).toContain("Net exported: 152,345 MWh");
    expect(md).toContain("Format unified across table 2.");
  });

  it("generates CSV reconciliation workbook with correct headers and quotes", () => {
    const manifest = buildEvidenceManifest({
      run_id: "run-001",
      project_id: "proj-001",
      monitoring_period_id: "mp-001",
      org_id: "org-001",
      documents: sampleDocs,
      findings: sampleFindings,
    });

    const csv = generateCsvWorkbook(manifest);
    expect(csv).toContain('"Finding ID","Rule Code","Severity","Status"');
    expect(csv).toContain('"CALC-001"');
    expect(csv).toContain('"critical"');
    expect(csv).toContain('"Net exported: 152,345 MWh"');
  });

  it("packages ZIP bundle with manifest.json, manifest.sha256, report, and csv", async () => {
    const manifest = buildEvidenceManifest({
      run_id: "run-001",
      project_id: "proj-001",
      monitoring_period_id: "mp-001",
      org_id: "org-001",
      documents: sampleDocs,
      findings: sampleFindings,
    });

    const zipBuffer = await createEvidencePackageZip(manifest);
    expect(zipBuffer.length).toBeGreaterThan(100);

    const loadedZip = await JSZip.loadAsync(zipBuffer);
    expect(loadedZip.file("manifest.json")).not.toBeNull();
    expect(loadedZip.file("manifest.sha256")).not.toBeNull();
    expect(loadedZip.file("preflight_report.md")).not.toBeNull();
    expect(loadedZip.file("findings_workbook.csv")).not.toBeNull();

    const sha256Content = await loadedZip.file("manifest.sha256")!.async("string");
    expect(sha256Content).toContain(manifest.content_hash);
  });
});
