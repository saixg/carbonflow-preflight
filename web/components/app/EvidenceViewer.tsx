"use client";

import { useState } from "react";
import { sampleExtracted } from "@/lib/sample";

type Item = (typeof sampleExtracted)[number];

function Mark({ item, active, children }: { item: Item; active: string; children: React.ReactNode }) {
  return <mark data-active={active === item.id}>{children}</mark>;
}

export function EvidenceViewer() {
  const [active, setActive] = useState<string>("x1");
  const [page, setPage] = useState(12);
  const by = (id: string) => sampleExtracted.find((x) => x.id === id)!;

  return (
    <div className="viewer">
      <div className="thumbs" aria-label="Pages">
        {[3, 5, 12, 14].map((p) => (
          <button key={p} className="thumb" data-on={page === p} onClick={() => setPage(p)} aria-label={`Page ${p}`} style={{ border: 0, cursor: "pointer", display: "grid", placeItems: "center", color: "#55645c", fontSize: 12 }}>
            {p}
          </button>
        ))}
      </div>

      <div className="paper" aria-live="polite">
        {page === 3 && (
          <>
            <h3>Annual Monitoring Report, 2023</h3>
            <h4>1.2 Monitoring period</h4>
            The monitoring period runs from <Mark item={by("x2")} active={active}>01 January 2023</Mark> to{" "}
            <Mark item={by("x3")} active={active}>31 December 2023</Mark>.
          </>
        )}
        {page === 5 && (
          <>
            <h3>Annual Monitoring Report, 2023</h3>
            <h4>1.5 Project description</h4>
            The facility is a grid-connected solar plant with an installed capacity of <Mark item={by("x4")} active={active}>100 MW</Mark>.
          </>
        )}
        {page === 12 && (
          <>
            <h3>Annual Monitoring Report, 2023</h3>
            <h4>2.4 Electricity generation</h4>
            The total net electricity exported to the grid during the monitoring period is{" "}
            <Mark item={by("x1")} active={active}>152,345 MWh</Mark>.
            <table>
              <thead><tr><th>Month</th><th>Exported (MWh)</th></tr></thead>
              <tbody>
                <tr><td>January</td><td>11,820</td></tr>
                <tr><td>February</td><td>12,410</td></tr>
                <tr><td>March</td><td>13,960</td></tr>
                <tr><td colSpan={2}>Remaining months omitted in this preview</td></tr>
              </tbody>
            </table>
          </>
        )}
        {page === 14 && (
          <>
            <h3>Annual Monitoring Report, 2023</h3>
            <h4>3.1 Emission factor</h4>
            The combined margin grid emission factor applied is <Mark item={by("x5")} active={active}>0.82 tCO2/MWh</Mark>.
          </>
        )}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Extracted data</h2>
        {sampleExtracted.map((x) => (
          <button
            key={x.id}
            className="fieldcard"
            aria-pressed={active === x.id}
            onClick={() => {
              setActive(x.id);
              setPage(x.page);
            }}
          >
            <small>{x.label}</small>
            <b>{x.value} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{x.unit}</span></b>
            <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className={`chip ${x.tier === "high" ? "ok" : "warn"}`}>{x.tier === "high" ? "High confidence" : "Needs review"}</span>
              <small className="mono">{x.confidence.toFixed(2)} on page {x.page}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
