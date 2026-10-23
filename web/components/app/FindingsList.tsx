"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { sampleFindings, type FindingStatus, type Severity } from "@/lib/sample";

const SEV: Record<Severity, { label: string; chip: string; color: string; hint: string }> = {
  critical: { label: "Critical", chip: "crit", color: "var(--crit)", hint: "Fix before verification" },
  material: { label: "Material", chip: "warn", color: "var(--warn)", hint: "Should be addressed" },
  minor: { label: "Minor", chip: "info", color: "var(--info)", hint: "Nice to have" },
};

export function FindingsList() {
  const [sev, setSev] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<FindingStatus | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>("f1");

  const counts = useMemo(
    () => ({
      critical: sampleFindings.filter((f) => f.severity === "critical").length,
      material: sampleFindings.filter((f) => f.severity === "material").length,
      minor: sampleFindings.filter((f) => f.severity === "minor").length,
    }),
    [],
  );
  const shown = sampleFindings.filter(
    (f) =>
      (sev === "all" || f.severity === sev) &&
      (status === "all" || f.status === status) &&
      (f.title + f.detail + f.rule).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="grid-4" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        {(Object.keys(SEV) as Severity[]).map((k) => (
          <button
            key={k}
            className="card sev"
            style={{ cursor: "pointer", textAlign: "left", outline: sev === k ? `1px solid ${SEV[k].color}` : undefined }}
            onClick={() => setSev(sev === k ? "all" : k)}
            aria-pressed={sev === k}
          >
            <i style={{ background: `color-mix(in srgb, ${SEV[k].color} 16%, transparent)`, color: SEV[k].color }}>
              <span className="dot" style={{ background: SEV[k].color }} />
            </i>
            <div>
              <strong className="mono">{counts[k]}</strong> <span style={{ fontSize: 14 }}>{SEV[k].label}</span>
              <small>{SEV[k].hint}</small>
            </div>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="filters" style={{ marginBottom: 8 }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <MagnifyingGlass size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--dim)" }} />
            <label htmlFor="fq" className="sr-only">Search findings</label>
            <input id="fq" className="input" style={{ paddingLeft: 36 }} placeholder="Search findings" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label className="sr-only" htmlFor="fs">Status</label>
          <select id="fs" className="select" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value as FindingStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        {shown.length === 0 && (
          <div className="empty"><h3>No findings match</h3><p>Clear a filter or change the search text.</p></div>
        )}
        {shown.map((f) => (
          <div key={f.id}>
            <button className="finding" onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={open === f.id}>
              <span className={`chip ${SEV[f.severity].chip}`}>{SEV[f.severity].label}</span>
              <div>
                <div className="meta">
                  <span className="mono muted" style={{ fontSize: 12 }}>{f.rule}</span>
                  <span className="chip">{f.status}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.detail}</p>
              </div>
              <span className="muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                {f.sources} sources
                <motion.span animate={{ rotate: open === f.id ? 180 : 0 }}><CaretDown size={14} /></motion.span>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open === f.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ padding: "4px 8px 16px 96px", display: "grid", gap: 6 }}>
                    <b style={{ fontSize: 13 }}>Suggested action</b>
                    <span className="muted" style={{ fontSize: 14 }}>{f.remediation}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
