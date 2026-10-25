"use client";

import { useState } from "react";
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsClockwise,
  DownloadSimple,
  ArrowsOut,
  Crosshair,
  FileText,
  CheckCircle,
  CaretLeft,
  CaretRight,
  ListDashes,
} from "@phosphor-icons/react/ssr";
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

const defaultSampleItems: ExtractedEvidenceItem[] = [
  {
    id: "x1",
    label: "Net Electricity Exported",
    value: "152,345",
    unit: "MWh",
    confidence: 0.95,
    page: 12,
    tier: "high",
    sourceText: "The total net electricity exported to the grid during the monitoring period is 152,345 MWh.",
    docName: "Monitoring_Report_2023.pdf",
  },
  {
    id: "x2",
    label: "Monitoring Period Start",
    value: "01 Jan 2023",
    unit: "",
    confidence: 0.98,
    page: 3,
    tier: "high",
    sourceText: "The monitoring period runs from 01 January 2023 to 31 December 2023.",
    docName: "Monitoring_Report_2023.pdf",
  },
  {
    id: "x3",
    label: "Monitoring Period End",
    value: "31 Dec 2023",
    unit: "",
    confidence: 0.98,
    page: 3,
    tier: "high",
    sourceText: "The monitoring period runs from 01 January 2023 to 31 December 2023.",
    docName: "Monitoring_Report_2023.pdf",
  },
  {
    id: "x4",
    label: "Installed Capacity",
    value: "100",
    unit: "MW",
    confidence: 0.71,
    page: 5,
    tier: "med",
    sourceText: "The facility is a grid-connected solar plant with an installed capacity of 100 MW.",
    docName: "Monitoring_Report_2023.pdf",
  },
  {
    id: "x5",
    label: "Grid Emission Factor",
    value: "0.82",
    unit: "tCO2/MWh",
    confidence: 0.93,
    page: 14,
    tier: "high",
    sourceText: "The combined margin grid emission factor applied is 0.82 tCO2/MWh.",
    docName: "Monitoring_Report_2023.pdf",
  },
];

export function EvidenceViewer({
  initialItems,
}: {
  initialItems?: ExtractedEvidenceItem[];
}) {
  const items: ExtractedEvidenceItem[] =
    initialItems && initialItems.length > 0 ? initialItems : defaultSampleItems;

  const [active, setActive] = useState<string>("x1");
  const [filterTier, setFilterTier] = useState<"all" | "high" | "review">("all");
  const [zoom, setZoom] = useState<number>(150);
  const [page, setPage] = useState<number>(12);
  const [totalPages] = useState<number>(24);

  const activeItem = items.find((x) => x.id === active) || items[0];

  const filteredItems = items.filter((x) => {
    if (filterTier === "high") return x.tier === "high" || x.confidence >= 0.85;
    if (filterTier === "review") return x.tier === "med" || x.confidence < 0.85;
    return true;
  });

  const jumpToItem = (item: ExtractedEvidenceItem) => {
    setActive(item.id);
    setPage(item.page || 12);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Document Viewport & Extracted Data Split Screen */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.45fr) minmax(360px, 420px)",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left: Document Viewport Canvas */}
        <div
          className="card"
          style={{
            padding: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
          }}
        >
          {/* Document Top Action Toolbar (matching Screen 4) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderBottom: "1px solid var(--line)",
              background: "rgba(255, 255, 255, 0.02)",
            }}
          >
            {/* Left: Page Navigator */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="icon-btn"
                style={{ width: 32, height: 32 }}
                title="Thumbnails sidebar"
              >
                <ListDashes size={16} />
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--surface-2)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", padding: 0 }}
                  title="Previous page"
                >
                  <CaretLeft size={14} />
                </button>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", padding: 0 }}
                  title="Next page"
                >
                  <CaretRight size={14} />
                </button>
              </div>
            </div>

            {/* Center: Zoom Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setZoom((z) => Math.max(80, z - 10))}
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                title="Zoom out"
              >
                <MagnifyingGlassMinus size={14} />
              </button>
              <span className="mono muted" style={{ fontSize: 12, minWidth: 44, textAlign: "center" }}>
                {zoom}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 10))}
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                title="Zoom in"
              >
                <MagnifyingGlassPlus size={14} />
              </button>
            </div>

            {/* Right: Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="icon-btn" style={{ width: 30, height: 30 }} title="Rotate clockwise">
                <ArrowsClockwise size={14} />
              </button>
              <button className="icon-btn" style={{ width: 30, height: 30 }} title="Download original document">
                <DownloadSimple size={14} />
              </button>
              <button className="icon-btn" style={{ width: 30, height: 30 }} title="Toggle fullscreen view">
                <ArrowsOut size={14} />
              </button>
            </div>
          </div>

          {/* Document Content Canvas with Page Thumbnails + Rendered Document Page */}
          <div style={{ display: "flex", minHeight: 640, background: "#0b1411" }}>
            {/* Left Page Thumbnails Strip */}
            <div
              style={{
                width: 72,
                borderRight: "1px solid var(--line)",
                padding: "16px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                alignItems: "center",
                background: "rgba(0, 0, 0, 0.2)",
              }}
            >
              {[1, 2, 3, 5, 12, 14].map((pNum) => (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  style={{
                    width: 50,
                    height: 64,
                    borderRadius: 4,
                    background: pNum === page ? "rgba(61, 220, 151, 0.15)" : "#162520",
                    border: `1.5px solid ${pNum === page ? "var(--accent)" : "rgba(255, 255, 255, 0.08)"}`,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: 4,
                    transition: "all 0.15s ease",
                  }}
                  title={`Page ${pNum}`}
                >
                  <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 1 }} />
                  <div style={{ width: "80%", height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 1 }} />
                  <div style={{ width: "90%", height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 1 }} />
                  <span className="mono" style={{ fontSize: 9, color: pNum === page ? "var(--accent)" : "var(--dim)", alignSelf: "center" }}>
                    {pNum}
                  </span>
                </button>
              ))}
            </div>

            {/* Document Paper Rendering Canvas */}
            <div
              style={{
                flex: 1,
                padding: "36px 40px",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 620,
                  background: "#fdfdfc",
                  color: "#1c2822",
                  borderRadius: 6,
                  padding: "44px 48px",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255,255,255,0.2)",
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  fontFamily: "var(--sans)",
                  transform: `scale(${zoom / 150})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease",
                }}
              >
                {/* Header matching Screen 4 */}
                <div style={{ borderBottom: "1.5px solid #d8dfdb", paddingBottom: 16, marginBottom: 24 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "1px", color: "#667a70", fontWeight: 600 }}>
                    Project Ref: 2023-SOLAR-094
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: "6px 0 0", color: "#0f1c16" }}>
                    Annual Monitoring Report – 2023
                  </h2>
                  <div style={{ fontSize: 12, color: "#667a70", marginTop: 4 }}>
                    Monitoring Period: 01 January 2023 – 31 December 2023 • Page {page} of {totalPages}
                  </div>
                </div>

                {/* Section Content */}
                <div style={{ display: "grid", gap: 16 }}>
                  {page === 12 ? (
                    <>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#14241e", margin: 0 }}>
                        2.4 Electricity Generation
                      </h3>
                      <p style={{ margin: 0 }}>
                        During the verified monitoring period, the project facility maintained continuous grid connection
                        under supervision of the state load dispatch center. Net energy delivered is monitored through
                        calibrated bidirectional revenue meters installed at the project pooling substation.
                      </p>

                      {/* Highlighted Verified Passage */}
                      <div
                        style={{
                          background: "#fff9db",
                          padding: "10px 14px",
                          borderRadius: 6,
                          borderLeft: "4px solid #f0b64a",
                          boxShadow: "0 0 0 2px rgba(240, 182, 74, 0.35)",
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 500, color: "#2d332f" }}>
                          The total net electricity exported to the grid during the monitoring period is{" "}
                          <span
                            style={{
                              background: "#ffdc5c",
                              padding: "2px 6px",
                              borderRadius: 3,
                              fontWeight: 700,
                              color: "#0b1411",
                            }}
                          >
                            152,345 MWh
                          </span>
                          .
                        </p>
                      </div>

                      {/* Monthly readings table */}
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 12,
                          marginTop: 10,
                          border: "1px solid #d0d7d3",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#edf2ee", textAlign: "left" }}>
                            <th style={{ padding: "8px 10px", borderBottom: "1px solid #d0d7d3" }}>Month</th>
                            <th style={{ padding: "8px 10px", borderBottom: "1px solid #d0d7d3" }}>Gross Generation (MWh)</th>
                            <th style={{ padding: "8px 10px", borderBottom: "1px solid #d0d7d3" }}>Net Export (MWh)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid #e4eae6" }}>January 2023</td>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid #e4eae6" }}>12,140</td>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid #e4eae6" }}>11,820</td>
                          </tr>
                          <tr>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid #e4eae6" }}>February 2023</td>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid #e4eae6" }}>12,750</td>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid #e4eae6" }}>12,410</td>
                          </tr>
                          <tr>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid #e4eae6" }}>March 2023</td>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid #e4eae6" }}>14,320</td>
                            <td style={{ padding: "6px 10px", borderBottom: "1px solid #e4eae6" }}>13,960</td>
                          </tr>
                          <tr style={{ background: "#f8faf9", fontStyle: "italic", color: "#667a70" }}>
                            <td colSpan={3} style={{ padding: "6px 10px" }}>
                              ... remaining 9 months detailed in Section 2.4.2 ...
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  ) : page === 3 ? (
                    <>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#14241e", margin: 0 }}>
                        1.2 Monitoring Period
                      </h3>
                      <p style={{ margin: 0 }}>
                        The third periodic monitoring verification covers the period from{" "}
                        <span style={{ background: "#ffdc5c", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>
                          01 January 2023
                        </span>{" "}
                        to{" "}
                        <span style={{ background: "#ffdc5c", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>
                          31 December 2023
                        </span>
                        , encompassing 365 calendar days without discontinuity.
                      </p>
                    </>
                  ) : page === 5 ? (
                    <>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#14241e", margin: 0 }}>
                        1.5 Installed Capacity
                      </h3>
                      <p style={{ margin: 0 }}>
                        The project consists of monocrystalline silicon photovoltaic modules with total aggregate nameplate
                        capacity of{" "}
                        <span style={{ background: "#ffdc5c", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>
                          100 MW
                        </span>
                        .
                      </p>
                    </>
                  ) : page === 14 ? (
                    <>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#14241e", margin: 0 }}>
                        3.1 Emission Factor Calculation
                      </h3>
                      <p style={{ margin: 0 }}>
                        In accordance with the approved CDM methodology ACM0002, the baseline grid emission factor
                        applied is{" "}
                        <span style={{ background: "#ffdc5c", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>
                          0.82 tCO2/MWh
                        </span>
                        .
                      </p>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#667a70" }}>
                      <FileText size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                      <p style={{ margin: 0 }}>Select any extracted field on the right to jump directly to its source page.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Extracted Data Panel (matching Screen 4) */}
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Extracted Data</h2>
            </div>

            {/* Filter Tabs */}
            <div
              style={{
                display: "flex",
                gap: 6,
                background: "var(--bg-2)",
                padding: 4,
                borderRadius: 10,
                border: "1px solid var(--line)",
                marginBottom: 16,
              }}
            >
              <button
                onClick={() => setFilterTier("all")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 7,
                  border: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filterTier === "all" ? "var(--surface-2)" : "transparent",
                  color: filterTier === "all" ? "var(--text)" : "var(--muted)",
                  transition: "all 0.15s ease",
                }}
              >
                All Fields ({items.length})
              </button>
              <button
                onClick={() => setFilterTier("high")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 7,
                  border: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filterTier === "high" ? "var(--surface-2)" : "transparent",
                  color: filterTier === "high" ? "var(--accent)" : "var(--muted)",
                  transition: "all 0.15s ease",
                }}
              >
                High Confidence (15)
              </button>
              <button
                onClick={() => setFilterTier("review")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 7,
                  border: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filterTier === "review" ? "var(--surface-2)" : "transparent",
                  color: filterTier === "review" ? "var(--warn)" : "var(--muted)",
                  transition: "all 0.15s ease",
                }}
              >
                Needs Review (3)
              </button>
            </div>

            {/* Extracted Parameter Cards */}
            <div style={{ display: "grid", gap: 12 }}>
              {/* Card 1: Net Electricity Exported */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: active === "x1" ? "rgba(61, 220, 151, 0.08)" : "var(--surface-2)",
                  border: `1.5px solid ${active === "x1" ? "var(--accent)" : "var(--line)"}`,
                  display: "grid",
                  gap: 10,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span className="muted" style={{ fontSize: 12 }}>Net Electricity Exported</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                      <strong className="mono" style={{ fontSize: 24, fontWeight: 700 }}>152,345</strong>
                      <span className="muted" style={{ fontSize: 13 }}>MWh</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="muted" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Confidence</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>0.95</span>
                      <span className="badge-count ok">High</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 10,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <span className="muted" style={{ fontSize: 12 }}>
                    Source: <span style={{ color: "var(--text)", fontWeight: 500 }}>Page 12</span>
                  </span>
                  <button
                    onClick={() => {
                      setActive("x1");
                      setPage(12);
                    }}
                    className="btn btn-sm"
                    style={{
                      height: 28,
                      padding: "0 10px",
                      fontSize: 12,
                      background: "rgba(61, 220, 151, 0.12)",
                      borderColor: "rgba(61, 220, 151, 0.35)",
                      color: "var(--accent)",
                      borderRadius: 999,
                    }}
                  >
                    <Crosshair size={13} weight="bold" /> View in Document
                  </button>
                </div>
              </div>

              {/* Card 2: Monitoring Period Start & End Grid */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: active === "x2" || active === "x3" ? "rgba(61, 220, 151, 0.08)" : "var(--surface-2)",
                  border: `1.5px solid ${active === "x2" || active === "x3" ? "var(--accent)" : "var(--line)"}`,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setActive("x2");
                  setPage(3);
                }}
              >
                <div>
                  <span className="muted" style={{ fontSize: 12 }}>Monitoring Period Start</span>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>01 Jan 2023</div>
                  <span className="badge-count ok" style={{ marginTop: 6 }}>High</span>
                </div>
                <div>
                  <span className="muted" style={{ fontSize: 12 }}>Monitoring Period End</span>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>31 Dec 2023</div>
                  <span className="badge-count ok" style={{ marginTop: 6 }}>High</span>
                </div>
              </div>

              {/* Card 3: Installed Capacity & Grid Emission Factor Grid */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: active === "x4" || active === "x5" ? "rgba(61, 220, 151, 0.08)" : "var(--surface-2)",
                  border: `1.5px solid ${active === "x4" || active === "x5" ? "var(--accent)" : "var(--line)"}`,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setActive("x4");
                  setPage(5);
                }}
              >
                <div>
                  <span className="muted" style={{ fontSize: 12 }}>Installed Capacity</span>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>100 MW</div>
                  <span className="badge-count warn" style={{ marginTop: 6 }}>Medium</span>
                </div>
                <div>
                  <span className="muted" style={{ fontSize: 12 }}>Grid Emission Factor</span>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>0.82 tCO2/MWh</div>
                  <span className="badge-count ok" style={{ marginTop: 6 }}>High</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
