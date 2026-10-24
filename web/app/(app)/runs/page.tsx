import Link from "next/link";
import { getSession } from "@/lib/context";
import { fmtDate, SampleBanner } from "@/components/app/Bits";
import { FindingsList } from "@/components/app/FindingsList";
import { CheckRing, Trend } from "@/components/charts";
import { sampleRun, sampleTrend } from "@/lib/sample";
import { ArrowRight, FileText, Play } from "@phosphor-icons/react/ssr";

export const metadata = { title: "Runs | CarbonFlow Preflight" };

export default async function Runs() {
  const { supabase, org, guest } = await getSession();

  let latestRun: any = null;
  let runList: any[] = [];

  if (org) {
    const { data: runs } = await supabase
      .from("runs")
      .select("id, status, created_at, methodology_code, methodology_version, checks_passed, checks_applicable, project_id, monitoring_period_id")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (runs && runs.length > 0) {
      runList = await Promise.all(
        runs.map(async (r) => {
          const { data: proj } = await supabase.from("projects").select("name").eq("id", r.project_id).maybeSingle();
          return {
            ...r,
            projectName: proj?.name || "Gujarat Solar 100MW",
          };
        })
      );
      latestRun = runList[0];
    }
  }

  const isDemo = guest || !latestRun;
  const passedCount = latestRun?.checks_passed ?? sampleRun.passed;
  const totalCount = latestRun?.checks_applicable ?? sampleRun.total;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>{latestRun ? `Run: ${latestRun.id.slice(0, 8)}` : `Run #${sampleRun.number}`}</h1>
          <p className="muted">
            {latestRun
              ? `${latestRun.projectName} — ${latestRun.methodology_code} ${latestRun.methodology_version || ""}`
              : `${sampleRun.when}. ${sampleRun.rulepack}, ${sampleRun.engine}.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="chip ok">{latestRun ? latestRun.status : "Completed"}</span>
          <Link href={latestRun ? `/runs/${latestRun.id}/report` : "/reports"} className="btn btn-primary btn-sm">
            <FileText size={14} weight="bold" /> View Report
          </Link>
        </div>
      </div>

      {isDemo && (
        <SampleBanner>
          {guest
            ? "Sign-in is turned off. Showing sample preflight run."
            : "No runs executed yet. Displaying sample baseline run metrics."}
        </SampleBanner>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-h">
            <h2>Findings across runs</h2>
            <Link href="/reports" className="muted" style={{ fontSize: 13 }}>
              Evidence pack <ArrowRight size={12} style={{ verticalAlign: "-1px" }} />
            </Link>
          </div>
          <Trend points={sampleTrend} />
        </div>
        <div className="card" style={{ display: "grid", placeItems: "center" }}>
          <CheckRing done={passedCount} total={totalCount} />
        </div>
      </div>

      {runList.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <h2>Preflight Runs History ({runList.length})</h2>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Project</th>
                <th>Methodology</th>
                <th>Checks Passed</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {runList.map((r) => (
                <tr key={r.id}>
                  <td className="mono">
                    <Link href={`/runs/${r.id}`} style={{ fontWeight: 600, color: "var(--accent)" }}>
                      #{r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{r.projectName}</td>
                  <td>{r.methodology_code} {r.methodology_version}</td>
                  <td className="mono">{r.checks_passed ?? 0} / {r.checks_applicable ?? 0}</td>
                  <td>
                    <span className={`chip ${r.status === "completed" ? "ok" : "info"}`}>{r.status}</span>
                  </td>
                  <td className="muted">{fmtDate(r.created_at)}</td>
                  <td>
                    <Link href={`/runs/${r.id}`} className="btn btn-sm" style={{ padding: "3px 8px", fontSize: 12 }}>
                      Inspect Run <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card-h" style={{ marginTop: 20, marginBottom: 0 }}>
        <h2>Findings from this run</h2>
      </div>

      <FindingsList />
    </div>
  );
}
