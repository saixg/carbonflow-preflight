import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ArrowLeft, CheckCircle, Warning, ShieldCheck, DownloadSimple, Clock, ArrowRight } from "@phosphor-icons/react/ssr";
import { getSession } from "@/lib/context";
import { Crumbs, fmtDate, StatusChip } from "@/components/app/Bits";
import { CheckRing } from "@/components/charts";
import { FindingsList, type FindingItem } from "@/components/app/FindingsList";

export const metadata = { title: "Run Details | CarbonFlow Preflight" };

export default async function RunDetailsPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const { supabase, org, guest } = await getSession();

  let run: any = null;
  let projectName = "Gujarat Solar 100MW (Charanka Solar Park)";
  let periodStr = "2024-01-01 to 2024-12-31";
  let checks: any[] = [];
  let findingsList: FindingItem[] = [];

  if (org && runId !== "sample") {
    const { data: runData } = await supabase
      .from("runs")
      .select("*")
      .eq("id", runId)
      .eq("org_id", org.id)
      .maybeSingle();

    if (runData) {
      run = runData;
      checks = Array.isArray(run.checks) ? run.checks : [];

      const [{ data: proj }, { data: period }, { data: dbFindings }] = await Promise.all([
        supabase.from("projects").select("name").eq("id", run.project_id).maybeSingle(),
        supabase.from("monitoring_periods").select("start_date, end_date").eq("id", run.monitoring_period_id).maybeSingle(),
        supabase.from("findings").select("id, rule_code, severity, status, title, explanation, remediation").eq("run_id", run.id),
      ]);

      if (proj) projectName = proj.name;
      if (period) periodStr = `${fmtDate(period.start_date)} to ${fmtDate(period.end_date)}`;

      findingsList = (dbFindings || []).map((f) => ({
        id: f.id,
        rule: f.rule_code,
        severity: f.severity,
        status: f.status,
        title: f.title,
        detail: f.explanation,
        sources: 1,
        remediation: f.remediation ?? undefined,
      }));
    }
  }

  // Fallback demo values if not found or sample run requested
  if (!run && (runId === "sample" || guest)) {
    run = {
      id: runId === "sample" ? "sample-run-101" : runId,
      status: "completed",
      methodology_code: "ACM0002",
      methodology_version: "21.0",
      rulepack_hash: "2ba3d974c0134dccafecfb889e513796",
      engine_version: "engine-0.1.0",
      result_hash: "7a94bc4a0e980a316dc948bf813b1a8d",
      checks_total: 12,
      checks_passed: 12,
      checks_applicable: 12,
      created_at: new Date().toISOString(),
    };
    checks = [
      { rule: "ACM0002-PRES-001", status: "passed", category: "completeness" },
      { rule: "ACM0002-PRES-002", status: "passed", category: "completeness" },
      { rule: "ACM0002-PRES-003", status: "passed", category: "completeness" },
      { rule: "ACM0002-PRES-004", status: "passed", category: "completeness" },
      { rule: "ACM0002-DATE-001", status: "passed", category: "dates" },
      { rule: "ACM0002-DATE-002", status: "passed", category: "dates" },
      { rule: "ACM0002-UNIT-001", status: "passed", category: "units" },
      { rule: "ACM0002-UNIT-002", status: "passed", category: "units" },
      { rule: "ACM0002-RANGE-001", status: "passed", category: "plausibility" },
      { rule: "ACM0002-CONS-001", status: "passed", category: "consistency" },
      { rule: "ACM0002-CALC-001", status: "passed", category: "calculation" },
      { rule: "ACM0002-CALC-002", status: "passed", category: "calculation" },
    ];
  }

  if (!run) notFound();

  const passedCount = run.checks_passed ?? checks.filter((c) => c.status === "passed").length;
  const totalCount = run.checks_applicable ?? checks.length;
  const isClean = findingsList.length === 0;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <Crumbs items={[{ label: "Runs", href: "/runs" }, { label: `Run ${run.id.slice(0, 8)}` }]} />
          <h1>Preflight Run #{run.id.slice(0, 8)}</h1>
          <p className="muted">
            {projectName} • {run.methodology_code} {run.methodology_version} • Period: {periodStr}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className={`chip ${run.status === "completed" ? "ok" : run.status === "running" ? "info" : "danger"}`}>
            {run.status}
          </span>
          <Link href={`/api/reports/download?runId=${run.id}&format=zip`} className="btn btn-primary btn-sm">
            <DownloadSimple size={14} weight="bold" /> Export Package
          </Link>
        </div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ display: "grid", gap: 14 }}>
          <div className="card-h">
            <h2>Verification Readiness</h2>
            <span className={`chip ${isClean ? "ok" : "warn"}`}>
              {isClean ? "READY_FOR_VERIFICATION" : "ACTION_REQUIRED"}
            </span>
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            {isClean
              ? "All 12 ACM0002 methodology rules passed deterministic validation without unresolved findings. All material figures are linked to verified source locators."
              : `${findingsList.length} finding(s) detected during rule execution. Review and reconcile before verification submission.`}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 4 }}>
            <div style={{ background: "var(--bg-subtle)", padding: 12, borderRadius: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>Methodology Rulepack</span>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                {run.methodology_code} v{run.methodology_version}
              </div>
            </div>
            <div style={{ background: "var(--bg-subtle)", padding: 12, borderRadius: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>Engine Version</span>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                {run.engine_version || "engine-0.1.0"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            <Link href={`/api/reports/download?runId=${run.id}&format=markdown`} className="btn btn-sm">
              <FileText size={14} /> Markdown Report
            </Link>
            <Link href={`/api/reports/download?runId=${run.id}&format=csv`} className="btn btn-sm">
              <FileText size={14} /> Findings CSV
            </Link>
            <Link href={`/runs/${run.id}/report`} className="btn btn-sm">
              Full Report View <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 220 }}>
          <CheckRing done={passedCount} total={totalCount || 12} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <h2>Deterministic Rule Checks ({checks.length})</h2>
          <span className="muted" style={{ fontSize: 13 }}>Executed by Fixed-Operation Engine</span>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>Rule Code</th>
              <th>Category</th>
              <th>Status</th>
              <th>Verification Outcome</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.rule}>
                <td className="mono" style={{ fontWeight: 600 }}>{c.rule}</td>
                <td style={{ textTransform: "capitalize" }}>{c.category}</td>
                <td>
                  <span className={`chip ${c.status === "passed" ? "ok" : c.status === "failed" ? "danger" : "warn"}`}>
                    {c.status}
                  </span>
                </td>
                <td style={{ fontSize: 13 }}>
                  {c.status === "passed"
                    ? "Validated against evidence; within acceptable tolerance."
                    : "Condition not satisfied or inputs require review."}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="card-h" style={{ marginBottom: 12 }}>
          <h2>Findings & Audit Actions ({findingsList.length})</h2>
        </div>
        <FindingsList initialFindings={findingsList} />
      </div>
    </div>
  );
}
