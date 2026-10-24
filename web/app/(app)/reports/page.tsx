import { getSession } from "@/lib/context";
import { SampleBanner } from "@/components/app/Bits";
import { ReportView } from "@/components/app/ReportView";

export const metadata = { title: "Reports | CarbonFlow Preflight" };

export default async function Reports() {
  const { supabase, org, guest } = await getSession();

  let runId = "sample";
  if (org) {
    const { data: latestRun } = await supabase
      .from("runs")
      .select("id")
      .eq("org_id", org.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRun) {
      runId = latestRun.id;
    }
  }

  const isDemo = guest || runId === "sample";

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Preflight report</h1>
          <p className="muted">Cryptographically verified assessment tied to run evidence.</p>
        </div>
      </div>
      {isDemo && (
        <SampleBanner>
          {guest
            ? "Sign-in is turned off. Showing sample preflight report with downloadable evidence package."
            : "No completed runs found yet. Showing sample report with downloadable packages."}
        </SampleBanner>
      )}
      <ReportView runId={runId} />
    </div>
  );
}
