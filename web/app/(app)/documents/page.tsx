import { SampleBanner } from "@/components/app/Bits";
import { EvidenceViewer } from "@/components/app/EvidenceViewer";

export const metadata = { title: "Documents | CarbonFlow Preflight" };

export default function Documents() {
  return (
    <div className="page">
      <div className="page-h"><div><h1>Documents and evidence</h1><p className="muted">Read each extracted value next to its source.</p></div></div>
      <SampleBanner />
      <EvidenceViewer />
    </div>
  );
}
