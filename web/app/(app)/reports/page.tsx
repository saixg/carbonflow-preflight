import { SampleBanner } from "@/components/app/Bits";
import { ReportView } from "@/components/app/ReportView";

export const metadata = { title: "Reports | CarbonFlow Preflight" };

export default function Reports() {
  return (
    <div className="page">
      <div className="page-h"><div><h1>Preflight report</h1><p className="muted">A readable record tied to one exact run.</p></div></div>
      <SampleBanner />
      <ReportView />
    </div>
  );
}
