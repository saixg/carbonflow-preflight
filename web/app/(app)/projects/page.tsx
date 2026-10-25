import Link from "next/link";
import { Plus } from "@phosphor-icons/react/ssr";
import { getSession } from "@/lib/context";
import { ProjectsList, type ProjectCardItem } from "@/components/app/ProjectsList";

export const metadata = { title: "Projects | CarbonFlow Preflight" };

const ALL_PROJECTS: ProjectCardItem[] = [
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

export default async function Projects() {
  const { supabase, org } = await getSession();

  let dbProjects: any[] = [];
  if (org && supabase?.from) {
    try {
      const { data } = await supabase
        .from("projects")
        .select("id, name, project_type, status, methodology_id, methodology_version")
        .order("created_at", { ascending: false });
      if (data && data.length > 0) dbProjects = data;
    } catch (e) {
      console.warn("Projects DB query fallback:", e);
    }
  }

  const list: ProjectCardItem[] = [
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

      <ProjectsList initialProjects={list} />
    </div>
  );
}
