"use client";

import { useMemo, useState } from "react";
import { DownloadSimple, FileZip, FileXls, Leaf, ShieldCheck, Warning, XCircle } from "@phosphor-icons/react/ssr";
import { CheckRing, Donut } from "@/components/charts";
import { sampleDocs, sampleFindings, sampleRun } from "@/lib/sample";
import { PREFLIGHT_DISCLAIMER, type EvidenceManifest, type VerificationReadiness } from "@/lib/reports";

const SECTIONS = ["Summary", "Project details", "Scope", "Findings", "Evidence index"];

export function ReportView({
  runId = "sample",
  initialManifest,
}: {
  runId?: string;
  initialManifest?: EvidenceManifest;
}) {
  const [sec, setSec] = useState("Summary");

  // If initialManifest is provided, use it; otherwise compute from sample data
  const manifest = useMemo<EvidenceManifest>(() => {
    if (initialManifest) return initialManifest;

    const crit = sampleFindings.filter((f) => f.severity === "critical" && f.status === "open").length;
    const mat = sampleFindings.filter((f) => f.severity === "material" && f.status === "open").length;

    let readiness: VerificationReadiness = "READY_FOR_VERIFICATION";
    const reasons: string[] = [];
    if (crit > 0) {
      readiness = "BLOCKED";
      reasons.push(`${crit} critical finding(s) remain open. Must be reconciled prior to verification.`);
    } else if (mat > 0) {
      readiness = "ACTION_REQUIRED";
      reasons.push(`${mat} material finding(s) require remediation before audit.`);
    } else {
      reasons.push("All critical and material findings have been resolved or addressed.");
    }

    return {
      manifest_version: "1.0.0",
      generator: "CarbonFlow Preflight v0.2.0",
      generated_at: "2024-06-12T14:32:00Z",
      disclaimer: PREFLIGHT_DISCLAIMER,
      run_id: `run-#${sampleRun.number}`,
      project_id: "proj-001",
      monitoring_period_id: "mp-2023",
      org_id: "org-001",
      project_name: "Gujarat Solar 100MW Grid Connected Project",
      methodology: `${sampleRun.methodology} (${sampleRun.rulepack})`,
      verification_readiness: readiness,
      readiness_reasons: reasons,
      stats: {
        total_documents: sampleDocs.length,
        total_findings: sampleFindings.length,
        open_findings: sampleFindings.filter((f) => f.status === "open").length,
        critical_findings: sampleFindings.filter((f) => f.severity === "critical").length,
        material_findings: sampleFindings.filter((f) => f.severity === "material").length,
        minor_findings: sampleFindings.filter((f) => f.severity === "minor").length,
        resolved_findings: sampleFindings.filter((f) => f.status === "resolved").length,
        dismissed_findings: 0,
      },
      documents: sampleDocs.map((d, i) => ({
        id: `doc-${i + 1}`,
        name: d.name,
        sha256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85${i}`,
        media_type: d.type === "PDF" ? "application/pdf" : "application/vnd.ms-excel",
        page_count: 12,
      })),
      findings: sampleFindings.map((f) => ({
        id: f.id,
        rule_code: f.rule,
        severity: f.severity,
        status: f.status as any,
        title: f.title,
        detail: f.detail,
        remediation: f.remediation,
        review_comment: f.review_comment,
        quotes: [`Extracted source evidence matching rule ${f.rule}`],
      })),
      content_hash: "7a94bc4a0e980a316dc948bf813b1a8d0be423218fe00e39bc348ff992ea407c",
    };
  }, [initialManifest]);

  const crit = manifest.stats.critical_findings;
  const mat = manifest.stats.material_findings;
  const min = manifest.stats.minor_findings;

  const readinessColor =
    manifest.verification_readiness === "READY_FOR_VERIFICATION"
      ? "var(--accent)"
      : manifest.verification_readiness === "ACTION_REQUIRED"
      ? "var(--warn)"
      : "var(--crit)";

  const ReadinessIcon =
    manifest.verification_readiness === "READY_FOR_VERIFICATION"
      ? ShieldCheck
      : manifest.verification_readiness === "ACTION_REQUIRED"
      ? Warning
      : XCircle;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Download Action Buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <a
          href={`/api/reports/download?runId=${encodeURIComponent(runId)}&format=markdown`}
          className="btn"
          download
        >
          <DownloadSimple size={16} /> Download Markdown (.md)
        </a>
        <a
          href={`/api/reports/download?runId=${encodeURIComponent(runId)}&format=csv`}
          className="btn"
          download
        >
          <FileXls size={16} /> Download CSV Workbook (.csv)
        </a>
        <a
          href={`/api/reports/download?runId=${encodeURIComponent(runId)}&format=zip`}
          className="btn btn-primary"
          download
        >
          <FileZip size={16} weight="bold" /> Download Evidence Package (.zip)
        </a>
      </div>

      <div className="report">
        {/* Table of Contents */}
        <nav className="toc" aria-label="Report sections">
          {SECTIONS.map((s) => (
            <a
              key={s}
              href={`#${s}`}
              aria-current={sec === s}
              onClick={(e) => {
                e.preventDefault();
                setSec(s);
              }}
            >
              {s}
            </a>
          ))}
        </nav>

        {/* Main Document Paper */}
        <article className="card" style={{ padding: 32, display: "grid", gap: 24, minHeight: 480 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="brand-mark">
                <Leaf size={20} weight="fill" />
              </span>
              <b>CarbonFlow Preflight</b>
            </div>
            <div
              className="chip"
              style={{
                borderColor: readinessColor,
                color: readinessColor,
                background: `color-mix(in srgb, ${readinessColor} 12%, transparent)`,
                fontWeight: 600,
                fontSize: 13,
                height: 28,
              }}
            >
              <ReadinessIcon size={16} weight="bold" />
              {manifest.verification_readiness.replace(/_/g, " ")}
            </div>
          </div>

          <h2 style={{ fontSize: 28, letterSpacing: "-0.02em" }}>{sec === "Summary" ? "Preflight Verification Report" : sec}</h2>

          {sec === "Summary" && (
            <>
              {/* Readiness callout banner */}
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: `1px solid ${readinessColor}40`,
                  background: `color-mix(in srgb, ${readinessColor} 8%, transparent)`,
                  display: "grid",
                  gap: 4,
                }}
              >
                <b style={{ color: readinessColor, fontSize: 14 }}>
                  Readiness Assessment: {manifest.verification_readiness.replace(/_/g, " ")}
                </b>
                {manifest.readiness_reasons.map((r, i) => (
                  <span key={i} className="muted" style={{ fontSize: 13 }}>
                    {r}
                  </span>
                ))}
              </div>

              <p className="muted" style={{ fontSize: 14 }}>
                Run ID: <code className="mono">{manifest.run_id}</code> &bull; Generated: {manifest.generated_at} &bull; Methodology: {manifest.methodology}
              </p>

              <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
                <CheckRing done={sampleRun.passed} total={sampleRun.total} />
                <Donut
                  caption="findings"
                  slices={[
                    { label: "Critical", value: crit, color: "var(--crit)" },
                    { label: "Material", value: mat, color: "var(--warn)" },
                    { label: "Minor", value: min, color: "var(--info)" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <h3 style={{ fontSize: 16 }}>Cryptographic Proof</h3>
                <p className="muted" style={{ fontSize: 13 }}>
                  This report is bound to an immutable evidence manifest with canonical SHA-256 digest:
                </p>
                <div
                  className="mono"
                  style={{
                    padding: "8px 12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 8,
                    fontSize: 12,
                    wordBreak: "break-all",
                    color: "var(--accent)",
                  }}
                >
                  {manifest.content_hash}
                </div>
              </div>
            </>
          )}

          {sec === "Project details" && (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, fontSize: 14 }}>
                <span className="muted">Project Name:</span>
                <b>{manifest.project_name}</b>
                <span className="muted">Project ID:</span>
                <span className="mono">{manifest.project_id}</span>
                <span className="muted">Monitoring Period:</span>
                <span className="mono">{manifest.monitoring_period_id}</span>
                <span className="muted">Methodology:</span>
                <span>{manifest.methodology}</span>
              </div>
            </div>
          )}

          {sec === "Scope" && (
            <div style={{ display: "grid", gap: 12, fontSize: 14 }}>
              <p>
                This preflight run evaluated all uploaded monitoring period documents against standard validation checks,
                data reconciliation rules, date coverage requirements, unit conversions, and plausible operational boundaries.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8 }}>
                <span className="muted">Rulepack:</span>
                <span>{sampleRun.rulepack}</span>
                <span className="muted">Engine Version:</span>
                <span>{sampleRun.engine}</span>
                <span className="muted">Checks Evaluated:</span>
                <span>{sampleRun.total} rules executed ({sampleRun.passed} passed)</span>
              </div>
            </div>
          )}

          {sec === "Findings" && (
            <div className="rows">
              {manifest.findings.map((f) => (
                <div
                  key={f.id}
                  className="row"
                  style={{ gridTemplateColumns: "96px minmax(0,1fr) auto", padding: "16px 4px" }}
                >
                  <span
                    className={`chip ${
                      f.severity === "critical" ? "crit" : f.severity === "material" ? "warn" : "info"
                    }`}
                  >
                    {f.severity}
                  </span>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        {f.rule_code}
                      </span>
                      <span className="chip" style={{ height: 20, fontSize: 11 }}>
                        {f.status}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15 }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0" }}>{f.detail}</p>
                    {f.remediation && (
                      <p style={{ fontSize: 12, color: "var(--text)" }}>
                        <b>Remediation:</b> {f.remediation}
                      </p>
                    )}
                  </div>
                  <span className="mono muted" style={{ fontSize: 12 }}>
                    #{f.id}
                  </span>
                </div>
              ))}
            </div>
          )}

          {sec === "Evidence index" && (
            <div style={{ display: "grid", gap: 14 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Format</th>
                    <th>SHA-256 Digest</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.documents.map((d) => (
                    <tr key={d.id}>
                      <td><b>{d.name}</b></td>
                      <td className="muted">{d.media_type}</td>
                      <td className="mono" style={{ fontSize: 11, wordBreak: "break-all" }}>
                        {d.sha256}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legal Non-Certification Disclaimer */}
          <div
            style={{
              marginTop: "auto",
              padding: "14px 16px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--line)",
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--dim)",
            }}
          >
            <b>Notice:</b> {manifest.disclaimer}
          </div>
        </article>

        {/* Sidebar Info */}
        <aside className="card" style={{ display: "grid", gap: 14 }}>
          <h3 style={{ fontSize: 15 }}>Run Details</h3>
          {[
            ["Documents indexed", String(manifest.stats.total_documents)],
            ["Total findings", String(manifest.stats.total_findings)],
            ["Open findings", String(manifest.stats.open_findings)],
            ["Resolved findings", String(manifest.stats.resolved_findings)],
            ["Critical open", String(manifest.findings.filter((f) => f.severity === "critical" && f.status === "open").length)],
            ["Readiness", manifest.verification_readiness.replace(/_/g, " ")],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
              <span className="muted">{k}</span>
              <b className="mono">{v}</b>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
