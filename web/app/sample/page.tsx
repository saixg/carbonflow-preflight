import Link from "next/link";
import { Brand } from "@/components/landing/Sections";
import { ReportView } from "@/components/app/ReportView";
import { SampleBanner } from "@/components/app/Bits";

export const metadata = { title: "Sample report | CarbonFlow Preflight" };

export default function SampleReport() {
  return (
    <div className="land" style={{ minHeight: "100dvh" }}>
      <header className="lnav">
        <div className="wrap">
          <Brand />
          <Link href="/login?mode=signup" className="btn btn-primary btn-sm">Get started</Link>
        </div>
      </header>
      <main className="wrap" style={{ padding: "32px 24px 80px", display: "grid", gap: 20 }}>
        <h1 style={{ fontSize: 30, letterSpacing: "-0.02em" }}>Sample preflight report</h1>
        <SampleBanner>This report uses invented sample data to show the layout.</SampleBanner>
        <ReportView />
      </main>
    </div>
  );
}
