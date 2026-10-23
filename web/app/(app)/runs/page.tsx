import { SampleBanner } from "@/components/app/Bits";
import { FindingsList } from "@/components/app/FindingsList";
import { CheckRing, Trend } from "@/components/charts";
import { sampleRun, sampleTrend } from "@/lib/sample";

export const metadata = { title: "Runs | CarbonFlow Preflight" };

export default function Runs() {
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Run #{sampleRun.number}</h1>
          <p className="muted">{sampleRun.when}. {sampleRun.rulepack}, {sampleRun.engine}.</p>
        </div>
        <span className="chip ok">Completed</span>
      </div>
      <SampleBanner />
      <div className="grid-2">
        <div className="card"><div className="card-h"><h2>Findings across runs</h2></div><Trend points={sampleTrend} /></div>
        <div className="card" style={{ display: "grid", placeItems: "center" }}><CheckRing done={sampleRun.passed} total={sampleRun.total} /></div>
      </div>
      <FindingsList />
    </div>
  );
}
