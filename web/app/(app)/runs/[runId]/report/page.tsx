import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
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
      {/* Breadcrumbs matching Screen 6 */}
      <div className="crumbs" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--dim)", marginBottom: 4 }}>
        <Link href="/projects" style={{ color: "var(--muted)" }}>Projects</Link>
        <span>›</span>
        <Link href="/projects" style={{ color: "var(--muted)" }}>Solar Farm – Rajasthan</Link>
        <span>›</span>
        <Link href="/runs" style={{ color: "var(--muted)" }}>Runs</Link>
        <span>›</span>
        <Link href={`/runs/${runId}`} style={{ color: "var(--muted)" }}>Run #4</Link>
        <span>›</span>
        <span style={{ color: "var(--text)" }}>Report</span>
      </div>

      <ReportView runId={runId} />
    </div>
  );
}
