import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  ArrowRight,
  ArrowsClockwise,
  DownloadSimple,
  CheckCircle,
  Warning,
  MagnifyingGlass,
  Funnel,
  CaretDown,
} from "@phosphor-icons/react/ssr";
import { getSession } from "@/lib/context";
import { CheckRing } from "@/components/charts";
import { FindingsList, type FindingItem } from "@/components/app/FindingsList";

export const metadata = { title: "Run Details | CarbonFlow Preflight" };

const TABS = [
  ["overview", "Overview"],
  ["findings", "Findings"],
  ["calculations", "Calculations"],
  ["evidence", "Evidence"],
  ["logs", "Logs"],
] as const;

export default async function RunDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ runId }, { tab = "findings" }] = await Promise.all([params, searchParams]);
  const { supabase, org, guest } = await getSession();

  let run: any = null;
  let projectName = "Solar Farm – Rajasthan";
  let methodologyStr = "AMS-I.D | Rulepack v1.2 | Engine v0.3.1";
  let runDateStr = "12 Jun 2024, 14:32";
  let checks: any[] = [];
  let findingsList: FindingItem[] = [];

  if (org && runId !== "sample" && supabase?.from) {
    try {
      const { data: runData } = await supabase
        .from("runs")
        .select("*")
        .eq("id", runId)
        .eq("org_id", org.id)
        .maybeSingle();

      if (runData) {
        run = runData;
        checks = Array.isArray(run.checks) ? run.checks : [];

        const [{ data: proj }, { data: dbFindings }] = await Promise.all([
          supabase.from("projects").select("name").eq("id", run.project_id).maybeSingle(),
          supabase.from("findings").select("id, rule_code, severity, status, title, explanation, remediation").eq("run_id", run.id),
        ]);

        if (proj) projectName = proj.name;
        methodologyStr = `${run.methodology_code || "ACM0002"} | Rulepack v1.2 | Engine ${run.engine_version || "v0.3.1"}`;

        findingsList = (dbFindings || []).map((f: any) => ({
          id: f.id,
          rule: f.rule_code,
          severity: f.severity,
          status: f.status,
          title: f.title,
          detail: f.explanation,
          sources: 3,
          remediation: f.remediation ?? undefined,
        }));
      }
    } catch (e) {
      console.warn("Run details DB query fallback:", e);
    }
  }

  // Fallback demo data matching Screen 5
  if (!run || findingsList.length === 0) {
    run = {
      id: runId === "sample" ? "4" : runId,
      status: "completed",
      checks_total: 12,
      checks_passed: 10,
    };
    findingsList = [
      {
        id: "f1",
        rule: "CALC-001",
        severity: "critical",
        status: "open",
        title: "Net electricity export mismatch",
        detail: "The net electricity exported (152,345 MWh) does not match the sum of monthly meter readings (149,120 MWh).",
        sources: 3,
        remediation: "Reconcile the annual report total with the monthly grid meter readings log.",
      },
      {
        id: "f2",
        rule: "DOC-002",
        severity: "critical",
        status: "open",
        title: "Calibration certificate expired during period",
        detail: "The primary substation meter calibration certificate expired on 30 Sep 2023, prior to period completion.",
        sources: 2,
        remediation: "Attach valid recertification report covering full monitoring span.",
      },
      {
        id: "f3",
        rule: "DATE-004",
        severity: "critical",
        status: "open",
        title: "Gap in meter data coverage (14-19 Mar 2023)",
        detail: "No generation records exist for 5 calendar days. Methodology mandates continuous log.",
        sources: 2,
        remediation: "Document grid maintenance outage with state utility confirmation memo.",
      },
      {
        id: "f4",
        rule: "CONS-007",
        severity: "material",
        status: "open",
        title: "Installed capacity differs between documents",
        detail: "Monitoring report states 100 MW nameplate; PPA schedules indicate 98.5 MW.",
        sources: 2,
        remediation: "Confirm as-built capacity with engineering commissioning memo.",
      },
      {
        id: "f5",
        rule: "UNIT-003",
        severity: "material",
        status: "open",
        title: "Unit inconsistency in emission factor",
        detail: "Emission factor reported as 0.82 tCO2/MWh in Table 3 and 820 kgCO2/MWh in Annex 2.",
        sources: 2,
        remediation: "Standardize to approved methodology unit tCO2/MWh across all sections.",
      },
      {
        id: "f6",
        rule: "DOC-009",
        severity: "material",
        status: "open",
        title: "Stakeholder consultation record undated",
        detail: "Local community consultation memo lacks formal date stamp and signatory validation.",
        sources: 1,
        remediation: "Attach signed and dated meeting registry.",
      },
      {
        id: "f7",
        rule: "PLAU-002",
        severity: "material",
        status: "open",
        title: "Capacity factor above plausible regional range",
        detail: "Calculated annual capacity factor of 23.8% exceeds regional ceiling benchmark of 22.5%.",
        sources: 2,
        remediation: "Verify irradiation data and check for double-counted inverter strings.",
      },
      {
        id: "f8",
        rule: "DOC-011",
        severity: "material",
        status: "open",
        title: "Report version control header unpopulated",
        detail: "Cover sheet lacks approved version number and release approval timestamp.",
        sources: 1,
        remediation: "Apply standard document control numbering.",
      },
      {
        id: "f9",
        rule: "FMT-001",
        severity: "minor",
        status: "open",
        title: "Inconsistent date format across tables",
        detail: "Dates formatted as DD/MM/YYYY and YYYY-MM-DD within same submission package.",
        sources: 1,
        remediation: "Align on ISO YYYY-MM-DD throughout.",
      },
      {
        id: "f10",
        rule: "FMT-004",
        severity: "minor",
        status: "open",
        title: "Missing figure caption for single-line diagram",
        detail: "Figure 2.1 electrical single-line diagram lacks descriptive caption and source note.",
        sources: 1,
        remediation: "Insert standardized figure caption and drawing revision tag.",
      },
    ];
  }

  const critCount = findingsList.filter((f) => f.severity === "critical").length;
  const matCount = findingsList.filter((f) => f.severity === "material").length;
  const minCount = findingsList.filter((f) => f.severity === "minor").length;

  return (
    <div className="page">
      {/* Breadcrumb matching Screen 5 */}
      <div className="crumbs" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--dim)", marginBottom: 8 }}>
        <Link href="/projects" style={{ color: "var(--muted)" }}>Projects</Link>
        <span>›</span>
        <Link href="/projects" style={{ color: "var(--muted)" }}>Solar Farm – Rajasthan</Link>
        <span>›</span>
        <Link href="/runs" style={{ color: "var(--muted)" }}>Runs</Link>
        <span>›</span>
        <span style={{ color: "var(--text)" }}>Run #4</span>
      </div>

      {/* Header Bar matching Screen 5 */}
      <div className="page-h" style={{ alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
              Run #4 – {runDateStr}
            </h1>
            <span
              className="badge-count ok"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3ddc97" }} />
              Completed
            </span>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Methodology: {methodologyStr}
          </p>
        </div>

        {/* Top Right Action Buttons */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href={`/runs/${runId}/report`} className="btn btn-sm" style={{ borderRadius: 999, padding: "0 18px", background: "rgba(255,255,255,0.04)" }}>
            Download Report
          </Link>
          <Link href={`/runs`} className="btn btn-primary btn-sm" style={{ borderRadius: 999, padding: "0 18px" }}>
            <ArrowsClockwise size={14} weight="bold" /> Re-run
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="tabs" aria-label="Run sections" style={{ marginTop: 8 }}>
        {TABS.map(([k, l]) => (
          <Link
            key={k}
            href={`/runs/${runId}?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
          >
            {l}
          </Link>
        ))}
      </nav>

      {/* Interactive Findings List & Scorecard */}
      <div style={{ marginTop: 16 }}>
        <FindingsList initialFindings={findingsList} readinessScore={78} />
      </div>
    </div>
  );
}
