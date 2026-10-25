import { getSession } from "@/lib/context";
import { SampleBanner } from "@/components/app/Bits";
import { FindingsList, type FindingItem } from "@/components/app/FindingsList";

export const metadata = { title: "Findings | CarbonFlow Preflight" };

export default async function Findings() {
  const { supabase, org, guest } = await getSession();

  let initialFindings: FindingItem[] | undefined = undefined;

  if (org && supabase?.from) {
    try {
      const { data } = await supabase
        .from("findings")
        .select("id, rule_code, severity, status, title, explanation, remediation")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        initialFindings = data.map((f: any) => ({
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
    } catch (e) {
      console.warn("Findings DB query fallback:", e);
    }
  }

  const isDemo = guest || !initialFindings || initialFindings.length === 0;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Findings</h1>
          <p className="muted">Issues found by rule checks, with citations and audit history.</p>
        </div>
      </div>
      {isDemo && (
        <SampleBanner>
          {guest
            ? "Sign-in is turned off. Showing sample preflight findings with interactive review workflows."
            : "No runs with findings found for your organization yet. Showing sample findings."}
        </SampleBanner>
      )}
      <FindingsList initialFindings={initialFindings} />
    </div>
  );
}
