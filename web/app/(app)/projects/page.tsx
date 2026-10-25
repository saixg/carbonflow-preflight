import Link from "next/link";
import { Plus, ArrowRight, FolderSimple, Sun, Wind, Plant, Drop, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { getSession } from "@/lib/context";

export const metadata = { title: "Projects | CarbonFlow Preflight" };

const ALL_PROJECTS = [
  {
    id: "proj-solar-raj",
    name: "Solar Farm – Rajasthan",
    methodology: "AMS-I.D",
    period: "2023 – 2024",
    type: "solar",
    progress: 82,
    badges: { crit: 3, warn: 5, ok: 2 },
    capacity: "100 MW",
    status: "Active",
  },
  {
    id: "proj-wind-guj",
    name: "Wind Project – Gujarat",
    methodology: "ACM0002",
    period: "2023 – 2024",
    type: "wind",
    progress: 65,
    badges: { crit: 5, warn: 8, ok: 4 },
    capacity: "120 MW",
    status: "Active",
  },
  {
    id: "proj-bio-kar",
    name: "Biomass Plant – Karnataka",
    methodology: "AMS-I.D",
    period: "2022 – 2023",
    type: "biomass",
    progress: 91,
    badges: { crit: 1, warn: 2, ok: 1 },
    capacity: "25 MW",
    status: "Active",
  },
  {
    id: "proj-hydro-utt",
    name: "Hydro Project – Uttarakhand",
    methodology: "ACM0002",
    period: "2023 – 2024",
    type: "hydro",
    progress: 48,
    badges: { crit: 7, warn: 4, ok: 3 },
    capacity: "60 MW",
    status: "Review",
  },
];

function getIcon(type: string) {
  if (type === "solar") return <Sun size={20} weight="fill" color="#f0b64a" />;
  if (type === "wind") return <Wind size={20} weight="fill" color="#5aa9ff" />;
  if (type === "biomass") return <Plant size={20} weight="fill" color="#3ddc97" />;
  if (type === "hydro") return <Drop size={20} weight="fill" color="#38bdf8" />;
  return <FolderSimple size={20} weight="fill" color="#3ddc97" />;
}

export default async function Projects() {
  const { supabase, org } = await getSession();

  let dbProjects: any[] = [];
  if (org) {
    const { data } = await supabase
      .from("projects")
      .select("id, name, project_type, status, methodology_id, methodology_version")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) dbProjects = data;
  }

  const list = [
    ...dbProjects.map((p, i) => ({
      id: p.id,
      name: p.name,
      methodology: p.methodology_id || "ACM0002",
      period: "2023 – 2024",
      type: p.project_type?.toLowerCase().includes("solar") ? "solar" : "wind",
      progress: i === 0 ? 82 : 70,
      badges: { crit: 3, warn: 5, ok: 2 },
      capacity: "100 MW",
      status: "Active",
    })),
    ...ALL_PROJECTS.filter((dp) => !dbProjects.some((p) => p.name.toLowerCase().includes(dp.name.toLowerCase()))),
  ];

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Projects</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Manage carbon project portfolios, methodology rulepacks and evidence pipelines.
          </p>
        </div>
        <Link href="/projects/new" className="btn btn-primary" style={{ borderRadius: 999 }}>
          <Plus size={16} weight="bold" /> New Project
        </Link>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "grid", gap: 14 }}>
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "40px minmax(0, 1.4fr) 120px minmax(100px, 160px) auto",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--line)",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="project-row"
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid var(--line)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {getIcon(p.type)}
              </div>

              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </h3>
                <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                  {p.methodology} | {p.period} • Capacity: {p.capacity}
                </p>
              </div>

              <div>
                <span className="badge-count ok" style={{ fontSize: 11 }}>
                  {p.status}
                </span>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span className="muted">Readiness</span>
                  <span className="mono" style={{ fontWeight: 600, color: "var(--accent)" }}>{p.progress}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                <span className="badge-count crit">● {p.badges.crit}</span>
                <span className="badge-count warn">▲ {p.badges.warn}</span>
                <span className="badge-count ok">✓ {p.badges.ok}</span>
                <ArrowRight size={14} className="muted" style={{ marginLeft: 6 }} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
