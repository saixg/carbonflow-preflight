"use client";

import { useState } from "react";
import { sampleExtracted } from "@/lib/sample";

export interface ExtractedEvidenceItem {
  id: string;
  label: string;
  value: string;
  unit: string;
  page: number;
  confidence: number;
  tier: "high" | "med" | "low";
  sourceText?: string;
  locator?: Record<string, any>;
  reviewStatus?: string;
  docName?: string;
}

const defaultSampleItems: ExtractedEvidenceItem[] = sampleExtracted.map((s) => ({
  id: s.id,
  label: s.label,
  value: s.value,
  unit: s.unit,
  page: s.page,
  confidence: s.confidence,
  tier: s.tier === "high" ? "high" : "med",
}));

export function EvidenceViewer({
  initialItems,
}: {
  initialItems?: ExtractedEvidenceItem[];
}) {
  const items: ExtractedEvidenceItem[] = initialItems && initialItems.length > 0 ? initialItems : defaultSampleItems;
  const [active, setActive] = useState<string>(items[0]?.id || "x1");
  const activeItem = items.find((x) => x.id === active) || items[0];
  const [page, setPage] = useState<number>(activeItem?.page || 12);

  const pagesAvailable = Array.from(new Set(items.map((x) => x.page))).sort((a, b) => a - b);

  return (
    <div className="viewer">
      <div className="thumbs" aria-label="Pages">
        {(pagesAvailable.length > 0 ? pagesAvailable : [3, 5, 12, 14]).map((p) => (
          <button
            key={p}
            className="thumb"
            data-on={page === p}
            onClick={() => setPage(p)}
            aria-label={`Page ${p}`}
            style={{
              border: 0,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#55645c",
              fontSize: 12,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="paper" aria-live="polite">
        <div style={{ borderBottom: "1px solid var(--line-subtle)", paddingBottom: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            {activeItem?.docName || "Annual Monitoring Report, 2023"}
          </h3>
          <span className="muted" style={{ fontSize: 12 }}>
            Viewing Page {page} • Source-verified bounding box locator
          </span>
        </div>

        {activeItem?.sourceText ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: "var(--bg-subtle)", padding: 16, borderRadius: 10, borderLeft: "3px solid var(--accent)" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Source Excerpt (Exact OCR / Vector Text)
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                {activeItem.sourceText.includes(activeItem.value) ? (
                  <>
                    {activeItem.sourceText.split(activeItem.value)[0]}
                    <mark data-active="true" style={{ background: "var(--accent-tint)", color: "var(--accent-text)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                      {activeItem.value} {activeItem.unit}
                    </mark>
                    {activeItem.sourceText.split(activeItem.value).slice(1).join(activeItem.value)}
                  </>
                ) : (
                  <mark data-active="true" style={{ background: "var(--accent-tint)", color: "var(--accent-text)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                    {activeItem.sourceText}
                  </mark>
                )}
              </p>
            </div>

            {activeItem.locator && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12 }} className="muted">
                <span>Locator Type: <code className="mono">{activeItem.locator.type || "pdf_span"}</code></span>
                {activeItem.locator.bbox && (
                  <span>BBox: <code className="mono">[{activeItem.locator.bbox.map((n: number) => n.toFixed(1)).join(", ")}]</code></span>
                )}
                {activeItem.locator.cell && (
                  <span>Cell: <code className="mono">{activeItem.locator.cell}</code></span>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Default mock paper representation */
          <>
            {page === 3 && (
              <>
                <h4>1.2 Monitoring period</h4>
                The monitoring period runs from <mark data-active={active === "x2"}>01 January 2023</mark> to{" "}
                <mark data-active={active === "x3"}>31 December 2023</mark>.
              </>
            )}
            {page === 5 && (
              <>
                <h4>1.5 Project description</h4>
                The facility is a grid-connected solar plant with an installed capacity of{" "}
                <mark data-active={active === "x4"}>100 MW</mark>.
              </>
            )}
            {page === 12 && (
              <>
                <h4>2.4 Electricity generation</h4>
                The total net electricity exported to the grid during the monitoring period is{" "}
                <mark data-active={active === "x1"}>152,345 MWh</mark>.
                <table>
                  <thead>
                    <tr><th>Month</th><th>Exported (MWh)</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>January</td><td>11,820</td></tr>
                    <tr><td>February</td><td>12,410</td></tr>
                    <tr><td>March</td><td>13,960</td></tr>
                    <tr><td colSpan={2}>Remaining months omitted in preview</td></tr>
                  </tbody>
                </table>
              </>
            )}
            {page === 14 && (
              <>
                <h4>3.1 Emission factor</h4>
                The combined margin grid emission factor applied is{" "}
                <mark data-active={active === "x5"}>0.82 tCO2/MWh</mark>.
              </>
            )}
            {page !== 3 && page !== 5 && page !== 12 && page !== 14 && (
              <p className="muted">Select a parameter card on the right to jump directly to its verified source passage.</p>
            )}
          </>
        )}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Extracted Evidence ({items.length})</h2>
        {items.map((x) => (
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
            <b>
              {x.value} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{x.unit}</span>
            </b>
            <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className={`chip ${x.tier === "high" || x.reviewStatus === "human_confirmed" ? "ok" : "warn"}`}>
                {x.reviewStatus ? x.reviewStatus : x.tier === "high" ? "High confidence" : "Needs review"}
              </span>
              <small className="mono">
                p.{x.page} {x.docName ? `• ${x.docName.slice(0, 16)}` : ""}
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
