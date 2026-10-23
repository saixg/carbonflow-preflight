import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadSimple, FileText } from "@phosphor-icons/react/ssr";
import { getSession } from "@/lib/context";
import { Crumbs, fmtDate, SampleBanner, StatusChip } from "@/components/app/Bits";
import { PeriodForm } from "@/components/app/Forms";
import Scene from "@/components/three/Scene";
import { FindingsList } from "@/components/app/FindingsList";
import { EvidenceViewer } from "@/components/app/EvidenceViewer";
import { sampleDocs } from "@/lib/sample";

const TABS = [
  ["overview", "Overview"],
  ["documents", "Documents"],
  ["periods", "Monitoring periods"],
  ["evidence", "Extracted data"],
  ["findings", "Findings"],
] as const;

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ projectId }, { tab = "overview" }] = await Promise.all([params, searchParams]);
  const { supabase, org } = await getSession();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const { data: periods } = await supabase.from("monitoring_periods").select("*").eq("project_id", projectId).order("start_date", { ascending: false });
  const canWrite = org?.role !== "viewer";

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <Crumbs items={[{ label: "Projects", href: "/projects" }, { label: project.name }]} />
          <h1>{project.name}</h1>
          <p className="muted">
            {project.project_type ?? "Unspecified type"}
            {project.methodology_id ? `, ${project.methodology_id} ${project.methodology_version}` : ", no methodology set"}
          </p>
        </div>
        <StatusChip status={project.status} />
      </div>

      <nav className="tabs" aria-label="Project sections">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/projects/${projectId}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>
        ))}
      </nav>

      {(tab === "overview" || tab === "periods") && (
        <div className="grid-2">
          <div className="card">
            <div className="card-h"><h2>Monitoring periods</h2></div>
            {(periods ?? []).length === 0 ? (
              <div className="empty"><h3>No monitoring periods</h3><p>Add the first period to start attaching evidence.</p></div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Start</th><th>End</th><th>Status</th></tr></thead>
                <tbody>
                  {(periods ?? []).map((p) => (
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
            <div className="card-h"><h2>Add a period</h2></div>
            {canWrite ? <PeriodForm projectId={projectId} /> : <p className="muted">Viewers cannot add periods.</p>}
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div style={{ display: "grid", gap: 16 }}>
          <SampleBanner>Upload is not built yet. The table below is sample data.</SampleBanner>
          <div className="card" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 16, alignItems: "center" }}>
            <div style={{ border: "1.5px dashed var(--line-strong)", borderRadius: 14, padding: 36, textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
              <UploadSimple size={30} color="var(--accent)" />
              <b>Drag and drop your documents here</b>
              <span className="muted" style={{ fontSize: 13 }}>PDF, Excel or CSV, up to 50 MB each</span>
              <button className="btn" disabled>Choose files</button>
            </div>
            <div style={{ height: 240 }}><Scene kind="docs" /></div>
          </div>
          <div className="card">
            <div className="card-h"><h2>Recently uploaded</h2></div>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Status</th><th>Uploaded</th></tr></thead>
              <tbody>
                {sampleDocs.map((d) => (
                  <tr key={d.name}>
                    <td><FileText size={16} style={{ verticalAlign: "-3px", marginRight: 8 }} />{d.name}</td>
                    <td>{d.type}</td><td className="mono">{d.size}</td>
                    <td><span className={`chip ${d.status === "Processed" ? "ok" : d.status === "Processing" ? "info" : "warn"}`}>{d.status}</span></td>
                    <td className="muted">{d.at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "evidence" && (<><SampleBanner /><EvidenceViewer /></>)}
      {tab === "findings" && (<><SampleBanner /><FindingsList /></>)}
    </div>
  );
}
