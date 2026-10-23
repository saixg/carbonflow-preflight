"use client";

import { useState } from "react";
import { DownloadSimple, FileZip, FileXls, Leaf } from "@phosphor-icons/react/ssr";
import { CheckRing, Donut } from "@/components/charts";
import { sampleFindings, sampleRun } from "@/lib/sample";

const SECTIONS = ["Summary", "Project details", "Scope", "Findings", "Evidence index"];

export function ReportView() {
  const [sec, setSec] = useState("Summary");
  const crit = sampleFindings.filter((f) => f.severity === "critical").length;
  const mat = sampleFindings.filter((f) => f.severity === "material").length;
  const min = sampleFindings.filter((f) => f.severity === "minor").length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {["Download PDF", "Download CSV", "Download evidence pack"].map((l, i) => (
          <button key={l} className="btn" disabled title="Exports arrive with the reporting phase">
            {[<DownloadSimple key="a" size={16} />, <FileXls key="b" size={16} />, <FileZip key="c" size={16} />][i]} {l}
          </button>
        ))}
      </div>
      <div className="report">
        <nav className="toc" aria-label="Report sections">
          {SECTIONS.map((s) => (
            <a key={s} href={`#${s}`} aria-current={sec === s} onClick={(e) => { e.preventDefault(); setSec(s); }}>{s}</a>
          ))}
        </nav>

        <article className="card" style={{ padding: 32, display: "grid", gap: 20, minHeight: 480 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="brand-mark"><Leaf size={20} weight="fill" /></span>
            <b>CarbonFlow Preflight</b>
          </div>
          <h2 style={{ fontSize: 30, letterSpacing: "-0.02em" }}>{sec === "Summary" ? "Preflight report" : sec}</h2>
          {sec === "Summary" && (
            <>
              <p className="muted">Run #{sampleRun.number} on {sampleRun.when}. Rules: {sampleRun.rulepack}. {sampleRun.engine}.</p>
              <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
                <CheckRing done={sampleRun.passed} total={sampleRun.total} />
                <Donut caption="findings" slices={[
                  { label: "Critical", value: crit, color: "var(--crit)" },
                  { label: "Material", value: mat, color: "var(--warn)" },
                  { label: "Minor", value: min, color: "var(--info)" },
                ]} />
              </div>
              <p className="hint">The ring counts rule checks that passed out of those that applied. It is not a prediction of verification success.</p>
            </>
          )}
          {sec === "Findings" && (
            <div className="rows">
              {sampleFindings.slice(0, 5).map((f) => (
                <div key={f.id} className="row" style={{ gridTemplateColumns: "88px minmax(0,1fr) auto" }}>
                  <span className={`chip ${f.severity === "critical" ? "crit" : f.severity === "material" ? "warn" : "info"}`}>{f.severity}</span>
                  <div><h3>{f.title}</h3><p>{f.detail}</p></div>
                  <span className="mono muted" style={{ fontSize: 12 }}>{f.rule}</span>
                </div>
              ))}
            </div>
          )}
          {sec !== "Summary" && sec !== "Findings" && (
            <p className="muted">This section is part of the report template and fills in from the run record once reporting is built.</p>
          )}
          <p className="hint" style={{ marginTop: "auto" }}>
            This report is a preparedness assessment. It is not a verification or certification and does not guarantee credit issuance.
          </p>
        </article>

        <aside className="card" style={{ display: "grid", gap: 14 }}>
          <h3 style={{ fontSize: 15 }}>Run details</h3>
          {[
            ["Documents processed", "4"],
            ["Values extracted", "5"],
            ["Open findings", String(sampleFindings.filter((f) => f.status === "open").length)],
            ["Methodology", sampleRun.methodology],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
              <span className="muted">{k}</span><b className="mono">{v}</b>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
