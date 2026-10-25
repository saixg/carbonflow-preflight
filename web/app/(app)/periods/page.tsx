import Link from "next/link";
import { getSession } from "@/lib/context";
import { fmtDate, StatusChip } from "@/components/app/Bits";
import { CalendarBlank, FolderSimple, ArrowRight } from "@phosphor-icons/react/ssr";

export const metadata = { title: "Monitoring Periods | CarbonFlow Preflight" };

const DEMO_PERIODS = [
  {
    id: "p1",
    projectId: "proj-solar-raj",
    projectName: "Solar Farm – Rajasthan",
    start: "2023-01-01",
    end: "2024-12-31",
    status: "active",
    documentsCount: 4,
  },
  {
    id: "p2",
    projectId: "proj-wind-guj",
    projectName: "Wind Project – Gujarat",
    start: "2023-01-01",
    end: "2024-12-31",
    status: "active",
    documentsCount: 3,
  },
  {
    id: "p3",
    projectId: "proj-bio-kar",
    projectName: "Biomass Plant – Karnataka",
    start: "2022-01-01",
    end: "2023-12-31",
    status: "active",
    documentsCount: 2,
  },
  {
    id: "p4",
    projectId: "proj-hydro-utt",
    projectName: "Hydro Project – Uttarakhand",
    start: "2023-01-01",
    end: "2024-12-31",
    status: "open",
    documentsCount: 3,
  },
];

export default async function Periods() {
  const { supabase, org } = await getSession();
  let dbPeriods: any[] = [];

  if (org) {
    const { data } = await supabase
      .from("monitoring_periods")
      .select("id, start_date, end_date, status, projects(id, name)")
      .order("start_date", { ascending: false });

    if (data && data.length > 0) {
      dbPeriods = data.map((p) => {
        const pr = Array.isArray(p.projects) ? p.projects[0] : p.projects;
        return {
          id: p.id,
          projectId: pr?.id || "proj-solar-raj",
          projectName: pr?.name || "Gujarat Solar 100MW",
          start: p.start_date,
          end: p.end_date,
          status: p.status,
          documentsCount: 2,
        };
      });
    }
  }

  const list = dbPeriods.length > 0 ? dbPeriods : DEMO_PERIODS;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Monitoring Periods</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Verification intervals tracking generation continuity, meter readings, and rule evaluation baselines.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Project</th>
              <th>Period Start</th>
              <th>Period End</th>
              <th>Evidence Docs</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/projects/${p.projectId}`} style={{ fontWeight: 600, color: "var(--text)" }}>
                    {p.projectName}
                  </Link>
                </td>
                <td className="mono">{fmtDate(p.start)}</td>
                <td className="mono">{fmtDate(p.end)}</td>
                <td>
                  <span className="mono muted">{p.documentsCount} documents</span>
                </td>
                <td>
                  <span className="badge-count ok">
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />
                    {p.status}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/projects/${p.projectId}?tab=documents`} className="btn btn-sm" style={{ borderRadius: 999 }}>
                    Open Project <ArrowRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
