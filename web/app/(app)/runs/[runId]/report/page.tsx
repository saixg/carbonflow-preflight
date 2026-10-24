import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { Crumbs } from "@/components/app/Bits";
import { ReportView } from "@/components/app/ReportView";

export const metadata = { title: "Preflight Report | CarbonFlow Preflight" };

export default async function RunReportPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <Crumbs
            items={[
              { label: "Runs", href: "/runs" },
              { label: `Run ${runId.slice(0, 8)}`, href: `/runs/${runId}` },
              { label: "Report" },
            ]}
          />
          <h1>Preflight Verification Report</h1>
          <p className="muted">
            Formal preparedness evaluation package and evidence manifest for Run #{runId.slice(0, 8)}.
          </p>
        </div>
        <div>
          <Link href={`/runs/${runId}`} className="btn btn-sm">
            <ArrowLeft size={14} /> Back to Run
          </Link>
        </div>
      </div>

      <ReportView runId={runId} />
    </div>
  );
}
