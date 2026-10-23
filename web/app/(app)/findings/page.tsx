import { SampleBanner } from "@/components/app/Bits";
import { FindingsList } from "@/components/app/FindingsList";

export const metadata = { title: "Findings | CarbonFlow Preflight" };

export default function Findings() {
  return (
    <div className="page">
      <div className="page-h"><div><h1>Findings</h1><p className="muted">Issues found by rule checks, each with its evidence.</p></div></div>
      <SampleBanner />
      <FindingsList />
    </div>
  );
}
