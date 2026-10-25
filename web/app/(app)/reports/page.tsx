import { getSession } from "@/lib/context";
import { ReportView } from "@/components/app/ReportView";

export const metadata = { title: "Reports | CarbonFlow Preflight" };

export default async function Reports() {
  const { supabase, org } = await getSession();

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

  return (
    <div className="page">
      <ReportView runId={runId} />
    </div>
  );
}
