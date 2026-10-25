"use client";

import { useMemo, useState } from "react";
import {
  DownloadSimple,
  FileZip,
  FileXls,
  FilePdf,
  Leaf,
  ShieldCheck,
  Warning,
  XCircle,
  CheckCircle,
  FileText,
  Table,
} from "@phosphor-icons/react/ssr";
import { sampleDocs, sampleFindings, sampleRun } from "@/lib/sample";
import { PREFLIGHT_DISCLAIMER, type EvidenceManifest, type VerificationReadiness } from "@/lib/reports";

const REPORT_TOC = [
  "Executive Summary",
  "Project Details",
  "Methodology & Scope",
  "Findings Summary",
  "Detailed Findings",
  "Calculations",
  "Evidence Index",
  "Appendices",
];

export function ReportView({
  runId = "sample",
  initialManifest,
}: {
  runId?: string;
  initialManifest?: EvidenceManifest;
}) {
  const [activeSec, setActiveSec] = useState("Executive Summary");
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (fmt: string) => {
    setDownloading(fmt);
    setTimeout(() => setDownloading(null), 2500);
  };

  // Manifest calculation
  const manifest = useMemo<EvidenceManifest>(() => {
    if (initialManifest) return initialManifest;

    return {
      manifest_version: "1.0.0",
      generator: "CarbonFlow Preflight v0.3.1",
      generated_at: "2024-06-12T14:45:00Z",
      disclaimer: PREFLIGHT_DISCLAIMER,
      run_id: `run-#4`,
      project_id: "proj-solar-001",
      monitoring_period_id: "mp-2023-2024",
      org_id: "org-001",
      project_name: "Solar Farm – Rajasthan",
      methodology: "AMS-I.D (Grid connected renewable electricity generation)",
      verification_readiness: "ACTION_REQUIRED",
      readiness_reasons: [
        "3 critical findings remain open. Mismatches must be reconciled prior to audit submission.",
        "5 material findings require documentation alignment.",
      ],
      stats: {
        total_documents: 12,
        total_findings: 10,
        open_findings: 10,
        critical_findings: 3,
        material_findings: 5,
        minor_findings: 2,
        resolved_findings: 0,
        dismissed_findings: 0,
      },
      documents: sampleDocs.map((d, i) => ({
        id: `doc-${i + 1}`,
        name: d.name,
        sha256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85${i}`,
        media_type: d.type === "PDF" ? "application/pdf" : "application/vnd.ms-excel",
        page_count: 24,
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
        quotes: [`Verified locator for ${f.rule} contradicts target document`],
      })),
      content_hash: "7a94bc4a0e980a316dc948bf813b1a8d0be423218fe00e39bc348ff992ea407c",
    };
  }, [initialManifest]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Top Header Actions (matching Screen 6) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Preflight Report</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Solar Farm – Rajasthan | 2023 – 2024
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a
            href={`/api/reports/download?runId=${encodeURIComponent(runId)}&format=markdown`}
            className="btn btn-sm"
            style={{ borderRadius: 999, background: "rgba(255,255,255,0.04)" }}
            onClick={() => handleDownload("pdf")}
            download
          >
            <FilePdf size={15} /> {downloading === "pdf" ? "Preparing PDF..." : "Download PDF"}
          </a>
          <a
            href={`/api/reports/download?runId=${encodeURIComponent(runId)}&format=csv`}
            className="btn btn-sm"
            style={{ borderRadius: 999, background: "rgba(255,255,255,0.04)" }}
            onClick={() => handleDownload("excel")}
            download
          >
            <FileXls size={15} /> {downloading === "excel" ? "Generating Excel..." : "Download Excel"}
          </a>
          <a
            href={`/api/reports/download?runId=${encodeURIComponent(runId)}&format=zip`}
            className="btn btn-primary btn-sm"
            style={{ borderRadius: 999 }}
            onClick={() => handleDownload("pack")}
            download
          >
            <FileZip size={15} weight="bold" /> {downloading === "pack" ? "Packaging ZIP..." : "Download Evidence Pack"}
          </a>
        </div>
      </div>

      {/* Main 2-Column Split: TOC on Left, Main Report Canvas on Right */}
      <div className="report">
        {/* Left TOC Sidebar */}
        <nav className="toc" aria-label="Report Table of Contents">
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, paddingLeft: 12 }}>
            Table of Contents
          </div>
          {REPORT_TOC.map((sec) => (
            <a
              key={sec}
              href={`#${sec}`}
              aria-current={activeSec === sec}
              onClick={(e) => {
                e.preventDefault();
                setActiveSec(sec);
              }}
            >
              <span>{sec}</span>
            </a>
          ))}
        </nav>

        {/* Main Document Canvas */}
        <article style={{ display: "grid", gap: 24 }}>
          {/* Cover Hero Banner (matching Screen 6) */}
          <div
            className="card"
            style={{
              padding: 0,
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid var(--line-strong)",
              background: "linear-gradient(180deg, rgba(6, 24, 18, 0.9), rgba(4, 14, 10, 0.98))",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5)",
              position: "relative",
            }}
          >
            {/* Landscape photo backdrop with gradient overlay */}
            <div
              style={{
                height: 240,
                width: "100%",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 78, 59, 0.4)), url('https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1400&q=80') center/cover",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(6, 16, 13, 0.3) 0%, rgba(6, 16, 13, 0.9) 100%)",
                }}
              />
            </div>

            {/* Cover Content with Side Overlay */}
            <div
              style={{
                padding: "28px 36px 36px",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 340px)",
                gap: 24,
                alignItems: "flex-end",
                marginTop: -80,
                position: "relative",
                zIndex: 2,
              }}
            >
              {/* Left Title Box */}
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 12px",
                    borderRadius: 999,
                    background: "rgba(61, 220, 151, 0.15)",
                    border: "1px solid rgba(61, 220, 151, 0.4)",
                    color: "var(--accent)",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  <Leaf size={14} weight="fill" />
                  CarbonFlow Preflight
                </div>

                <h2 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--text)" }}>
                  Verification Readiness Preflight Report
                </h2>

                <p className="muted" style={{ fontSize: 14, marginTop: 10 }}>
                  Solar Farm – Rajasthan • Monitoring Period: 01 Jan 2023 – 31 Dec 2024
                </p>
              </div>

              {/* Right Score & Summary Box (matching Screen 6) */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 14,
                  background: "rgba(10, 24, 19, 0.8)",
                  border: "1px solid rgba(61, 220, 151, 0.35)",
                  backdropFilter: "blur(14px)",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <span className="muted" style={{ fontSize: 12 }}>Readiness Score</span>
                    <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>
                      78%
                    </div>
                  </div>

                  <div style={{ width: 48, height: 48 }}>
                    <svg width="48" height="48" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                      <circle
                        cx="24"
                        cy="24"
                        r="19"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 19}`}
                        strokeDashoffset={`${2 * Math.PI * 19 * (1 - 0.78)}`}
                        transform="rotate(-90 24 24)"
                      />
                    </svg>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", marginBottom: 14 }}>
                  <span className="badge-count crit" style={{ fontSize: 11 }}>● 3 Critical</span>
                  <span className="badge-count warn" style={{ fontSize: 11 }}>▲ 5 Material</span>
                  <span className="badge-count ok" style={{ fontSize: 11 }}>✓ 2 Minor</span>
                </div>

                <div style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Documents Processed:</span>
                    <b className="mono" style={{ color: "var(--text)" }}>12</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Extracted Data Points:</span>
                    <b className="mono" style={{ color: "var(--text)" }}>48</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Report Generated:</span>
                    <b className="mono" style={{ color: "var(--text)" }}>12 Jun 2024, 14:45</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section Body */}
          <div className="card" style={{ padding: 32, display: "grid", gap: 20 }}>
            {activeSec === "Executive Summary" && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Executive Summary</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                  This Verification Readiness Preflight Report summarizes the automated compliance and data integrity
                  assessment conducted for <strong>Solar Farm – Rajasthan</strong> under UNFCCC methodology{" "}
                  <strong>AMS-I.D</strong>.
                </p>

                <div style={{ padding: 16, borderRadius: 10, background: "rgba(240, 182, 74, 0.08)", borderLeft: "3px solid var(--warn)" }}>
                  <strong style={{ color: "var(--warn)", display: "block", marginBottom: 4 }}>
                    Action Required Prior to Verification
                  </strong>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
                    3 critical findings remain unresolved, notably a 3,225 MWh net electricity export discrepancy
                    between the annual monitoring report summary and monthly substation meter logs. Reconciling this figure
                    is mandatory before independent auditor submission.
                  </p>
                </div>
              </>
            )}

            {activeSec === "Project Details" && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Project Details</h3>
                <table className="tbl">
                  <tbody>
                    <tr><td className="muted" style={{ width: 200 }}>Project Name</td><td>Solar Farm – Rajasthan</td></tr>
                    <tr><td className="muted">Location</td><td>Thar Desert, Rajasthan, India</td></tr>
                    <tr><td className="muted">Installed Capacity</td><td className="mono">100 MW (DC) / 98.5 MW (AC Interconnection)</td></tr>
                    <tr><td className="muted">Approved Methodology</td><td>AMS-I.D v18.0 (Grid connected renewable electricity)</td></tr>
                    <tr><td className="muted">Crediting Period</td><td>01 Jan 2023 – 31 Dec 2024 (24 months)</td></tr>
                    <tr><td className="muted">Host Grid</td><td>Northern Regional Grid (NEWNE), India</td></tr>
                  </tbody>
                </table>
              </>
            )}

            {activeSec === "Methodology & Scope" && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Methodology & Scope</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                  Preflight verifies monitoring compliance against 12 formal rules across four pillars: presence,
                  bounding, mathematical consistency, and cross-document reconciliation.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div style={{ padding: 14, background: "var(--surface-2)", borderRadius: 10 }}>
                    <b style={{ color: "var(--accent)" }}>ACM0002 / AMS-I.D</b>
                    <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>Baseline grid emission calculations and meter tolerances.</p>
                  </div>
                  <div style={{ padding: 14, background: "var(--surface-2)", borderRadius: 10 }}>
                    <b style={{ color: "var(--accent)" }}>VCS / Gold Standard Criteria</b>
                    <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>Evidence grounding and calibration continuity checks.</p>
                  </div>
                </div>
              </>
            )}

            {(activeSec === "Findings Summary" || activeSec === "Detailed Findings") && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Findings Breakdown</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {sampleFindings.slice(0, 4).map((f) => (
                    <div
                      key={f.id}
                      style={{
                        padding: 16,
                        borderRadius: 10,
                        background: "var(--surface-2)",
                        borderLeft: `4px solid ${f.severity === "critical" ? "var(--crit)" : f.severity === "material" ? "var(--warn)" : "var(--info)"}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span className={`badge-count ${f.severity === "critical" ? "crit" : f.severity === "material" ? "warn" : "info"}`}>
                            {f.severity.toUpperCase()}
                          </span>
                          <span className="mono" style={{ fontWeight: 600 }}>{f.rule}</span>
                        </div>
                        <span className="badge-count" style={{ background: "rgba(255,255,255,0.05)" }}>
                          {f.status}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 4px" }}>{f.title}</h4>
                      <p className="muted" style={{ fontSize: 13, margin: 0 }}>{f.detail}</p>
                      <div style={{ marginTop: 10, fontSize: 12, color: "var(--accent)" }}>
                        <strong>Remediation:</strong> {f.remediation}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeSec === "Calculations" && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Calculations Reconciliation</h3>
                <p style={{ fontSize: 14 }}>
                  Automated re-computation of baseline emissions reductions:
                </p>
                <div className="card" style={{ background: "var(--bg-2)", padding: 18, fontFamily: "var(--mono)", fontSize: 13 }}>
                  <div style={{ color: "var(--accent)" }}># Baseline Emission Reductions Formula</div>
                  <div>ER_y = EG_facility_y * EF_grid_CM_y - PE_y - LE_y</div>
                  <div style={{ marginTop: 8, color: "var(--muted)" }}>
                    <div>EG_facility_y: 152,345 MWh (Report) vs 149,120 MWh (Meter Log Sum) [MISMATCH: -3,225 MWh]</div>
                    <div>EF_grid_CM_y: 0.820 tCO2/MWh</div>
                    <div>Calculated Reductions (Report): 124,922.9 tCO2e</div>
                    <div>Calculated Reductions (Meter Sum): 122,278.4 tCO2e</div>
                  </div>
                </div>
              </>
            )}

            {activeSec === "Evidence Index" && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Evidence Index</h3>
                <table className="tbl">
                  <thead>
                    <tr><th>Ref</th><th>Document Name</th><th>Type</th><th>SHA-256 Digest</th><th>Verified Pages</th></tr>
                  </thead>
                  <tbody>
                    {manifest.documents.map((d, i) => (
                      <tr key={d.id}>
                        <td className="mono">DOC-0{i + 1}</td>
                        <td>{d.name}</td>
                        <td>{d.media_type.includes("pdf") ? "PDF" : "Excel"}</td>
                        <td className="mono muted" style={{ fontSize: 11 }}>{d.sha256.slice(0, 16)}...</td>
                        <td className="mono">p. 1-24</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {activeSec === "Appendices" && (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Appendices & Audit Sign-Off</h3>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  {PREFLIGHT_DISCLAIMER}
                </p>
              </>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
