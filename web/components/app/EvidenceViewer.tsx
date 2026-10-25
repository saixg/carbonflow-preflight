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
  Copy,
  Check,
  MagnifyingGlass,
  Warning,
  Sparkle,
} from "@phosphor-icons/react/ssr";

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
  {
    id: "x6",
    label: "Transmission Loss Discount",
    value: "3.5",
    unit: "%",
    confidence: 0.89,
    page: 8,
    tier: "high",
    sourceText: "Grid transmission loss deduction of 3.5% was applied at the 220kV pooling substation interface.",
    docName: "Monitoring_Report_2023.pdf",
  },
  {
    id: "x7",
    label: "Specific Fuel Consumption Benchmark",
    value: "0.32",
    unit: "kg/kWh",
    confidence: 0.68,
    page: 16,
    tier: "med",
    sourceText: "Captive diesel benchmark of 0.32 kg/kWh is assumed for standby auxiliary power systems.",
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
  const [search, setSearch] = useState<string>("");
  const [zoom, setZoom] = useState<number>(140);
  const [page, setPage] = useState<number>(12);
  const [totalPages] = useState<number>(24);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeItem = items.find((x) => x.id === active) || items[0];

  const highCount = items.filter((x) => x.confidence >= 0.85).length;
  const reviewCount = items.filter((x) => x.confidence < 0.85).length;

  const filteredItems = items.filter((x) => {
    const matchesTier =
      filterTier === "all"
        ? true
        : filterTier === "high"
        ? x.confidence >= 0.85
        : x.confidence < 0.85;

    const matchesSearch =
      search.trim() === "" ||
      (x.label + " " + x.value + " " + (x.sourceText || "")).toLowerCase().includes(search.toLowerCase());

    return matchesTier && matchesSearch;
  });

  const jumpToItem = (item: ExtractedEvidenceItem) => {
    setActive(item.id);
    setPage(item.page || 12);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Document Top Action Toolbar */}
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
                  aria-label="Previous page"
                >
                  <CaretLeft size={14} />
                </button>
                <span className="mono" style={{ fontWeight: 600 }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", padding: 0 }}
                  title="Next page"
                  aria-label="Next page"
                >
                  <CaretRight size={14} />
                </button>
              </div>
            </div>

            {/* Center: Zoom Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setZoom((z) => Math.max(90, z - 10))}
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                title="Zoom out"
                aria-label="Zoom out"
              >
                <MagnifyingGlassMinus size={14} />
              </button>
              <button
                onClick={() => setZoom(140)}
                style={{
                  background: "transparent",
                  border: 0,
                  fontSize: 12,
                  color: "var(--dim)",
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
                title="Reset zoom to 140%"
              >
                <span className="mono">{zoom}%</span>
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(180, z + 10))}
                className="icon-btn"
                style={{ width: 30, height: 30 }}
                title="Zoom in"
                aria-label="Zoom in"
              >
                <MagnifyingGlassPlus size={14} />
              </button>
            </div>

            {/* Right: Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => {
                  const pages = [3, 5, 8, 12, 14, 16];
                  const nextIdx = (pages.indexOf(page) + 1) % pages.length;
                  setPage(pages[nextIdx]);
                }}
                className="btn btn-sm"
                style={{ height: 30, padding: "0 10px", fontSize: 12, background: "rgba(255,255,255,0.03)" }}
                title="Jump to next cited page"
              >
                Next Citation
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
              {[1, 2, 3, 5, 8, 12, 14, 16].map((pNum) => (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  style={{
                    width: 50,
                    height: 64,
                    borderRadius: 6,
                    background: pNum === page ? "rgba(61, 220, 151, 0.16)" : "#14221d",
                    border: `1.5px solid ${pNum === page ? "var(--accent)" : "rgba(255, 255, 255, 0.08)"}`,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: 5,
                    transition: "all 0.15s ease",
                    boxShadow: pNum === page ? "0 0 12px rgba(61, 220, 151, 0.25)" : "none",
                  }}
                  title={`Page ${pNum}`}
                >
                  <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 1 }} />
                  <div style={{ width: "80%", height: 3, background: "rgba(255,255,255,0.18)", borderRadius: 1 }} />
                  <div style={{ width: "90%", height: 3, background: "rgba(255,255,255,0.18)", borderRadius: 1 }} />
                  <span className="mono" style={{ fontSize: 9, color: pNum === page ? "var(--accent)" : "var(--dim)", alignSelf: "center", fontWeight: pNum === page ? 700 : 500 }}>
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
                  transform: `scale(${zoom / 140})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease",
                }}
              >
                {/* Header */}
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

                {/* Section Content Dynamic per Page */}
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
                        <span style={{ background: "#ffdc5c", padding: "2px 6px", borderRadius: 3, fontWeight: 700, color: "#0b1411" }}>
                          01 January 2023
                        </span>{" "}
                        to{" "}
                        <span style={{ background: "#ffdc5c", padding: "2px 6px", borderRadius: 3, fontWeight: 700, color: "#0b1411" }}>
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
                        <span style={{ background: "#ffdc5c", padding: "2px 6px", borderRadius: 3, fontWeight: 700, color: "#0b1411" }}>
                          100 MW
                        </span>
                        . Commissioning certificate validated under engineering register.
                      </p>
                    </>
                  ) : page === 8 ? (
                    <>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#14241e", margin: 0 }}>
                        2.1 Substation Transmission & Discount Factor
                      </h3>
                      <p style={{ margin: 0 }}>
                        In accordance with regional transmission operator tariffs, a standard transmission deduction of{" "}
                        <span style={{ background: "#ffdc5c", padding: "2px 6px", borderRadius: 3, fontWeight: 700, color: "#0b1411" }}>
                          3.5%
                        </span>{" "}
                        was applied to gross production at the 220kV busbar interface.
                      </p>
                    </>
                  ) : page === 14 ? (
                    <>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#14241e", margin: 0 }}>
                        3.1 Emission Factor Calculation
                      </h3>
                      <p style={{ margin: 0 }}>
                        In accordance with the approved CDM methodology ACM0002, the combined margin grid emission factor
                        applied is{" "}
                        <span style={{ background: "#ffdc5c", padding: "2px 6px", borderRadius: 3, fontWeight: 700, color: "#0b1411" }}>
                          0.82 tCO2/MWh
                        </span>
                        .
                      </p>
                    </>
                  ) : page === 16 ? (
                    <>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#14241e", margin: 0 }}>
                        3.4 Auxiliary Fuel Benchmark
                      </h3>
                      <p style={{ margin: 0 }}>
                        The baseline specific fuel consumption benchmark applied for emergency black-start diesel generators is{" "}
                        <span style={{ background: "#ffdc5c", padding: "2px 6px", borderRadius: 3, fontWeight: 700, color: "#0b1411" }}>
                          0.32 kg/kWh
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

        {/* Right: Extracted Data Panel */}
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Extracted Evidence</h2>
                <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Parameters verified against PDF source
                </p>
              </div>
              <span className="mono" style={{ fontSize: 12, color: "var(--accent)", background: "rgba(61, 220, 151, 0.1)", padding: "2px 8px", borderRadius: 999 }}>
                {filteredItems.length} fields
              </span>
            </div>

            {/* Quick Filter Tabs */}
            <div
              style={{
                display: "flex",
                gap: 4,
                background: "var(--bg-2)",
                padding: 3,
                borderRadius: 8,
                border: "1px solid var(--line)",
                marginBottom: 12,
              }}
            >
              <button
                onClick={() => setFilterTier("all")}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filterTier === "all" ? "var(--surface-2)" : "transparent",
                  color: filterTier === "all" ? "var(--text)" : "var(--muted)",
                  transition: "all 0.15s ease",
                }}
              >
                All ({items.length})
              </button>
              <button
                onClick={() => setFilterTier("high")}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filterTier === "high" ? "var(--surface-2)" : "transparent",
                  color: filterTier === "high" ? "var(--accent)" : "var(--muted)",
                  transition: "all 0.15s ease",
                }}
              >
                High Conf ({highCount})
              </button>
              <button
                onClick={() => setFilterTier("review")}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: filterTier === "review" ? "var(--surface-2)" : "transparent",
                  color: filterTier === "review" ? "var(--warn)" : "var(--muted)",
                  transition: "all 0.15s ease",
                }}
              >
                Review ({reviewCount})
              </button>
            </div>

            {/* Search input */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <MagnifyingGlass size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--dim)" }} />
              <input
                type="text"
                placeholder="Filter extracted parameters..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  height: 34,
                  padding: "0 10px 0 32px",
                  fontSize: 12,
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  color: "var(--text)",
                }}
              />
            </div>

            {/* Dynamic Parameter Cards List */}
            <div style={{ display: "grid", gap: 10, maxHeight: 600, overflowY: "auto", paddingRight: 2 }}>
              {filteredItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 12px", color: "var(--muted)", fontSize: 13 }}>
                  No fields match search criteria
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = active === item.id;
                  const isHigh = item.confidence >= 0.85;

                  return (
                    <div
                      key={item.id}
                      onClick={() => jumpToItem(item)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 10,
                        background: isSelected ? "rgba(61, 220, 151, 0.08)" : "var(--surface-2)",
                        border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--line)"}`,
                        display: "grid",
                        gap: 8,
                        cursor: "pointer",
                        transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                        boxShadow: isSelected ? "0 4px 18px rgba(61, 220, 151, 0.15)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span className="muted" style={{ fontSize: 12, display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {item.label}
                          </span>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 3 }}>
                            <strong className="mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
                              {item.value}
                            </strong>
                            {item.unit && <span className="muted" style={{ fontSize: 12 }}>{item.unit}</span>}
                          </div>
                        </div>

                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <span
                            className={`badge-count ${isHigh ? "ok" : "warn"}`}
                            style={{ fontSize: 11, padding: "2px 7px" }}
                          >
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: 8,
                          borderTop: "1px solid var(--line)",
                          fontSize: 11,
                        }}
                      >
                        <span className="muted">
                          Source: <span style={{ color: isSelected ? "var(--accent)" : "var(--text)", fontWeight: 600 }}>Page {item.page}</span>
                        </span>

                        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleCopy(`${item.value} ${item.unit}`.trim(), item.id)}
                            className="btn btn-sm"
                            style={{
                              height: 24,
                              padding: "0 8px",
                              fontSize: 11,
                              borderRadius: 4,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid var(--line)",
                              color: copiedId === item.id ? "var(--accent)" : "var(--muted)",
                            }}
                            title="Copy value"
                          >
                            {copiedId === item.id ? <Check size={11} /> : <Copy size={11} />}
                            {copiedId === item.id ? "Copied" : "Copy"}
                          </button>

                          <button
                            onClick={() => jumpToItem(item)}
                            className="btn btn-sm"
                            style={{
                              height: 24,
                              padding: "0 8px",
                              fontSize: 11,
                              borderRadius: 4,
                              background: isSelected ? "var(--accent)" : "rgba(61, 220, 151, 0.12)",
                              borderColor: isSelected ? "var(--accent)" : "rgba(61, 220, 151, 0.35)",
                              color: isSelected ? "#04120c" : "var(--accent)",
                              fontWeight: 600,
                            }}
                          >
                            <Crosshair size={11} weight="bold" /> View
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
