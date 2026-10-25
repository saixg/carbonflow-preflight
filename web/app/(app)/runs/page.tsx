import Link from "next/link";
import { getSession } from "@/lib/context";
import { fmtDate } from "@/components/app/Bits";
import { CheckRing, Trend } from "@/components/charts";
import { sampleRun, sampleTrend } from "@/lib/sample";
import { ArrowRight, FileText, Play, CheckCircle, ArrowsClockwise } from "@phosphor-icons/react/ssr";

export const metadata = { title: "Runs | CarbonFlow Preflight" };

const DEMO_RUNS = [
  {
    id: "sample",
    number: "Run #4",
    date: "12 Jun 2024, 14:32",
    projectName: "Solar Farm – Rajasthan",
    methodology: "AMS-I.D",
    passed: 10,
    total: 12,
    readiness: 78,
    status: "Completed",
  },
  {
    id: "run-3",
    number: "Run #3",
    date: "10 Jun 2024, 11:20",
    projectName: "Wind Project – Gujarat",
    methodology: "ACM0002",
    passed: 8,
    total: 12,
    readiness: 65,
    status: "Completed",
  },
  {
    id: "run-2",
    number: "Run #2",
    date: "08 Jun 2024, 16:45",
    projectName: "Biomass Plant – Karnataka",
    methodology: "AMS-I.D",
    passed: 11,
    total: 12,
    readiness: 91,
    status: "Completed",
  },
  {
    id: "run-1",
    number: "Run #1",
    date: "01 Jun 2024, 09:30",
    projectName: "Hydro Project – Uttarakhand",
    methodology: "ACM0002",
    passed: 6,
    total: 12,
    readiness: 48,
    status: "Completed",
  },
];

export default async function Runs() {
  const { supabase, org } = await getSession();

  let dbRuns: any[] = [];
  if (org) {
    const { data: runs } = await supabase
      .from("runs")
      .select("id, status, created_at, methodology_code, checks_passed, checks_applicable, project_id")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (runs && runs.length > 0) {
      dbRuns = await Promise.all(
        runs.map(async (r, i) => {
          const { data: proj } = await supabase.from("projects").select("name").eq("id", r.project_id).maybeSingle();
          return {
            id: r.id,
            number: `Run #${runs.length - i}`,
            date: fmtDate(r.created_at.slice(0, 10)),
            projectName: proj?.name || "Gujarat Solar 100MW",
            methodology: r.methodology_code || "ACM0002",
            passed: r.checks_passed || 10,
            total: r.checks_applicable || 12,
            readiness: Math.round(((r.checks_passed || 10) / (r.checks_applicable || 12)) * 100),
            status: r.status === "completed" ? "Completed" : "Processing",
          };
        })
      );
    }
  }

  const list = dbRuns.length > 0 ? dbRuns : DEMO_RUNS;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Preflight Runs</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Deterministic rule evaluations across project monitoring periods and frozen snapshots.
          </p>
        </div>
        <Link href="/runs/sample" className="btn btn-primary" style={{ borderRadius: 999 }}>
          <ArrowsClockwise size={15} weight="bold" /> New Preflight Run
        </Link>
      </div>

      {/* 2 Top Metric Cards */}
      <div className="grid-2">
        <div className="card" style={{ padding: 22 }}>
          <div className="card-h" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Findings Trend Across Runs</h2>
            <span className="mono muted" style={{ fontSize: 12 }}>Last 10 Runs</span>
          </div>
          <Trend points={sampleTrend} height={130} />
        </div>

        <div className="card" style={{ padding: 22, display: "grid", placeItems: "center" }}>
          <CheckRing done={10} total={12} size={140} />
        </div>
      </div>

      {/* Preflight Runs Table */}
      <div className="card" style={{ padding: 22 }}>
        <div className="card-h" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Evaluation History</h2>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>Run</th>
              <th>Project</th>
              <th>Methodology</th>
              <th>Rule Checks</th>
              <th>Readiness</th>
              <th>Status</th>
              <th>Date</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/runs/${r.id}`} style={{ fontWeight: 600, color: "var(--accent)" }}>
                    {r.number}
                  </Link>
                </td>
                <td style={{ fontWeight: 500 }}>{r.projectName}</td>
                <td>
                  <span className="mono muted" style={{ fontSize: 12 }}>{r.methodology}</span>
                </td>
                <td>
                  <span className="mono">{r.passed} / {r.total} passed</span>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mono" style={{ fontWeight: 600, color: "var(--accent)", fontSize: 13 }}>
                      {r.readiness}%
                    </span>
                    <div className="progress-bar-bg" style={{ width: 60 }}>
                      <div className="progress-bar-fill" style={{ width: `${r.readiness}%` }} />
                    </div>
                  </div>
                </td>
                <td>
                  <span className="badge-count ok">
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />
                    {r.status}
                  </span>
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{r.date}</td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/runs/${r.id}/report`} className="btn btn-sm" style={{ borderRadius: 999 }}>
                    <FileText size={13} /> Report
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
