import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, UploadSimple, DotsThreeVertical, FilePdf, FileXls, FileArchive } from "@phosphor-icons/react/ssr";
import { getSession } from "@/lib/context";
import { Crumbs, fmtDate, StatusChip } from "@/components/app/Bits";
import { PeriodForm } from "@/components/app/Forms";
import Scene from "@/components/three/Scene";
import { FindingsList } from "@/components/app/FindingsList";
import { EvidenceViewer } from "@/components/app/EvidenceViewer";
import { DocumentUploader } from "@/components/app/DocumentUploader";
import { ReportView } from "@/components/app/ReportView";

const TABS = [
  ["overview", "Overview"],
  ["documents", "Documents"],
  ["periods", "Monitoring Periods"],
  ["evidence", "Extracted Data"],
  ["findings", "Findings"],
  ["reports", "Reports"],
] as const;

const DEMO_RECENT_DOCS = [
  {
    name: "Monitoring_Report_2023.pdf",
    type: "PDF",
    size: "4.2 MB",
    status: "Processed",
    uploadedAt: "12 Jun 2024, 10:24",
  },
  {
    name: "Meter_Reading_Jan-Dec.xlsx",
    type: "Excel",
    size: "1.1 MB",
    status: "Processing",
    uploadedAt: "12 Jun 2024, 09:11",
  },
  {
    name: "PPA_Agreement.pdf",
    type: "PDF",
    size: "2.8 MB",
    status: "Processed",
    uploadedAt: "11 Jun 2024, 16:03",
  },
  {
    name: "Site_Photos.zip",
    type: "ZIP",
    size: "48 MB",
    status: "Queued",
    uploadedAt: "11 Jun 2024, 15:20",
  },
];

function getDocIcon(type: string) {
  if (type === "PDF") return <FilePdf size={18} weight="fill" color="#ff6b6b" />;
  if (type === "Excel") return <FileXls size={18} weight="fill" color="#3ddc97" />;
  if (type === "ZIP") return <FileArchive size={18} weight="fill" color="#f0b64a" />;
  return <FileText size={18} weight="fill" color="#5aa9ff" />;
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ projectId }, { tab = "documents" }] = await Promise.all([params, searchParams]);
  const { supabase, org } = await getSession();

  let project: any = null;
  let periods: any[] = [];
  let realDocs: any[] = [];

  if (org) {
    const { data: p } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    project = p;
    if (project) {
      const [{ data: per }, { data: docs }] = await Promise.all([
        supabase.from("monitoring_periods").select("*").eq("project_id", projectId).order("start_date", { ascending: false }),
        supabase.from("documents").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);
      periods = per || [];
      realDocs = docs || [];
    }
  }

  // Fallback demo matching Screen 3 if project not in DB
  if (!project) {
    project = {
      id: projectId,
      name: "Solar Farm – Rajasthan",
      project_type: "Grid-connected solar project",
      methodology_id: "AMS-I.D",
      methodology_version: "2023 – 2024",
      status: "active",
    };
  }

  const docsToDisplay =
    realDocs && realDocs.length > 0
      ? realDocs.map((d) => ({
          name: d.filename,
          type: d.media_type.includes("pdf") ? "PDF" : d.media_type.includes("spreadsheetml") ? "Excel" : "CSV",
          size: d.size_bytes < 1048576 ? `${(d.size_bytes / 1024).toFixed(1)} KB` : `${(d.size_bytes / 1048576).toFixed(1)} MB`,
          status: d.processing_status === "processed" ? "Processed" : d.processing_status === "processing" ? "Processing" : "Queued",
          uploadedAt: fmtDate(d.created_at),
        }))
      : DEMO_RECENT_DOCS;

  return (
    <div className="page">
      {/* Breadcrumbs matching Screen 3 */}
      <div className="crumbs" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--dim)", marginBottom: 4 }}>
        <Link href="/projects" style={{ color: "var(--muted)" }}>Projects</Link>
        <span>›</span>
        <span style={{ color: "var(--text)" }}>{project.name}</span>
      </div>

      {/* Header Bar */}
      <div className="page-h">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{project.name}</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {project.project_type ?? "Grid-connected solar project"} | {project.methodology_id ?? "AMS-I.D"} | {project.methodology_version ?? "2023 – 2024"}
          </p>
        </div>

        <div>
          <Link href={`/projects/${projectId}?tab=documents`} className="btn btn-primary" style={{ borderRadius: 999 }}>
            <UploadSimple size={16} weight="bold" /> Upload Documents
          </Link>
        </div>
      </div>

      {/* Navigation Tabs matching Screen 3 */}
      <nav className="tabs" aria-label="Project sections" style={{ marginTop: 8 }}>
        {TABS.map(([k, l]) => (
          <Link
            key={k}
            href={`/projects/${projectId}?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
          >
            {l}
          </Link>
        ))}
      </nav>

      {/* Documents Tab (matching Screen 3) */}
      {tab === "documents" && (
        <div style={{ display: "grid", gap: 20, marginTop: 16 }}>
          {/* Main Hero Card: Dropzone on Left, 3D Document Cascade on Right */}
          <div
            className="card"
            style={{
              padding: 24,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 1fr)",
              gap: 24,
              alignItems: "center",
              background: "linear-gradient(135deg, rgba(10, 26, 20, 0.7), rgba(6, 16, 13, 0.9))",
              border: "1px solid var(--line-strong)",
              borderRadius: 18,
            }}
          >
            <div>
              <DocumentUploader
                projectId={projectId}
                periods={periods.map((p) => ({ id: p.id, start_date: fmtDate(p.start_date), end_date: fmtDate(p.end_date) }))}
              />
            </div>

            {/* 3D Holographic Document Cascade */}
            <div style={{ height: 280, position: "relative" }}>
              <Scene kind="docs" />
            </div>
          </div>

          {/* Recently Uploaded Table */}
          <div className="card" style={{ padding: 22 }}>
            <div className="card-h" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recently Uploaded</h2>
            </div>

            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Uploaded at</th>
                  <th style={{ textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {docsToDisplay.map((d, i) => (
                  <tr key={d.name + i}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {getDocIcon(d.type)}
                        <span style={{ fontWeight: 500, color: "var(--text)" }}>{d.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: 13 }}>{d.type}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 13 }}>
                      {d.size}
                    </td>
                    <td>
                      <span
                        className="badge-count"
                        style={{
                          background:
                            d.status === "Processed"
                              ? "rgba(61, 220, 151, 0.15)"
                              : d.status === "Processing"
                              ? "rgba(90, 169, 255, 0.15)"
                              : "rgba(240, 182, 74, 0.15)",
                          color:
                            d.status === "Processed"
                              ? "var(--accent)"
                              : d.status === "Processing"
                              ? "var(--info)"
                              : "var(--warn)",
                          border: `1px solid ${
                            d.status === "Processed"
                              ? "rgba(61, 220, 151, 0.3)"
                              : d.status === "Processing"
                              ? "rgba(90, 169, 255, 0.3)"
                              : "rgba(240, 182, 74, 0.3)"
                          }`,
                        }}
                      >
                        {d.status === "Processing" && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--info)", animation: "pulse 1.5s infinite" }} />
                        )}
                        {d.status === "Processed" && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                        )}
                        {d.status === "Queued" && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warn)" }} />
                        )}
                        {d.status}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {d.uploadedAt}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="icon-btn" style={{ width: 28, height: 28, border: 0, background: "transparent" }}>
                        <DotsThreeVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monitoring Periods Tab */}
      {tab === "periods" && (
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-h"><h2>Monitoring Periods</h2></div>
            {periods.length === 0 ? (
              <div className="empty"><h3>No monitoring periods</h3><p>Add a period to attach verified meter readings.</p></div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Start</th><th>End</th><th>Status</th></tr></thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{fmtDate(p.start_date)}</td>
                      <td className="mono">{fmtDate(p.end_date)}</td>
                      <td><StatusChip status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <div className="card-h"><h2>Add a Period</h2></div>
            <PeriodForm projectId={projectId} />
          </div>
        </div>
      )}

      {/* Extracted Data Tab */}
      {tab === "evidence" && (
        <div style={{ marginTop: 16 }}>
          <EvidenceViewer />
        </div>
      )}

      {/* Findings Tab */}
      {tab === "findings" && (
        <div style={{ marginTop: 16 }}>
          <FindingsList />
        </div>
      )}

      {/* Reports Tab */}
      {tab === "reports" && (
        <div style={{ marginTop: 16 }}>
          <ReportView runId={projectId} />
        </div>
      )}

      {/* Overview Tab */}
      {tab === "overview" && (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div className="grid-2">
            <div className="card" style={{ padding: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Project Overview</h2>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
                100 MW solar facility situated in Rajasthan delivering clean electricity into the regional grid.
                Preflight validates the third periodic monitoring period calculations against ACM0002.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 10 }}>
                  <span className="muted" style={{ fontSize: 12 }}>Registered Methodology</span>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>AMS-I.D (Grid solar)</div>
                </div>
                <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 10 }}>
                  <span className="muted" style={{ fontSize: 12 }}>Installed Capacity</span>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>100 MW</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Quick Actions</h2>
              <div style={{ display: "grid", gap: 10 }}>
                <Link href={`/projects/${projectId}?tab=documents`} className="btn" style={{ justifyContent: "flex-start", gap: 10 }}>
                  <UploadSimple size={16} /> Upload New Evidence File
                </Link>
                <Link href={`/runs`} className="btn btn-primary" style={{ justifyContent: "flex-start", gap: 10 }}>
                  <FileText size={16} /> Run Preflight Rulepack
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
