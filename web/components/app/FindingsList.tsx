"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CaretDown,
  Check,
  CheckCircle,
  MagnifyingGlass,
  ArrowCounterClockwise,
  XCircle,
  Eye,
  ChatCircleText,
  FileText,
  ArrowRight,
  ShieldCheck,
} from "@phosphor-icons/react/ssr";
import { reviewFindingAction } from "@/app/(app)/actions";
import { sampleFindings, type FindingStatus, type Severity } from "@/lib/sample";

export type FindingItem = {
  id: string;
  rule: string;
  severity: Severity;
  status: FindingStatus | "dismissed";
  title: string;
  detail: string;
  sources: number;
  remediation?: string;
  quotes?: string[];
  review_comment?: string;
};

const SEV: Record<Severity, { label: string; chip: string; color: string; hint: string }> = {
  critical: { label: "Critical", chip: "crit", color: "#ff6b6b", hint: "Must fix before verification" },
  material: { label: "Material", chip: "warn", color: "#f0b64a", hint: "Should be addressed" },
  minor: { label: "Minor", chip: "info", color: "#5aa9ff", hint: "Nice to have" },
};

const STATUS_CHIPS: Record<string, { label: string; chipClass: string }> = {
  open: { label: "Open", chipClass: "" },
  acknowledged: { label: "Acknowledged", chipClass: "info" },
  resolved: { label: "Resolved", chipClass: "ok" },
  dismissed: { label: "Dismissed", chipClass: "" },
};

export function FindingsList({
  initialFindings,
  readOnly = false,
  readinessScore = 78,
  showScorecard = true,
}: {
  initialFindings?: FindingItem[];
  readOnly?: boolean;
  readinessScore?: number;
  showScorecard?: boolean;
}) {
  const [findings, setFindings] = useState<FindingItem[]>(() => {
    if (initialFindings && initialFindings.length > 0) {
      return initialFindings;
    }
    return sampleFindings.map((f) => ({
      ...f,
      status: f.status as FindingStatus | "dismissed",
      quotes: [`Extracted data for rule ${f.rule} contradicts source document.`],
    }));
  });

  const [sev, setSev] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<FindingStatus | "dismissed" | "all">("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"severity" | "rule" | "status">("severity");
  const [open, setOpen] = useState<string | null>("f1");

  // Review modal / expander state
  const [activeAction, setActiveAction] = useState<{
    findingId: string;
    action: "resolve" | "dismiss";
  } | null>(null);
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(
    () => ({
      critical: findings.filter((f) => f.severity === "critical").length,
      material: findings.filter((f) => f.severity === "material").length,
      minor: findings.filter((f) => f.severity === "minor").length,
    }),
    [findings]
  );

  const statusCounts = useMemo(
    () => ({
      all: findings.length,
      open: findings.filter((f) => f.status === "open").length,
      acknowledged: findings.filter((f) => f.status === "acknowledged").length,
      resolved: findings.filter((f) => f.status === "resolved").length,
      dismissed: findings.filter((f) => f.status === "dismissed").length,
    }),
    [findings]
  );

  const shown = useMemo(() => {
    const list = findings.filter(
      (f) =>
        (sev === "all" || f.severity === sev) &&
        (status === "all" || f.status === status) &&
        (f.title + " " + f.detail + " " + f.rule).toLowerCase().includes(q.toLowerCase())
    );

    return list.sort((a, b) => {
      if (sortBy === "severity") {
        const order: Record<Severity, number> = { critical: 1, material: 2, minor: 3 };
        return order[a.severity] - order[b.severity];
      }
      if (sortBy === "rule") {
        return a.rule.localeCompare(b.rule);
      }
      if (sortBy === "status") {
        const sOrder: Record<string, number> = { open: 1, acknowledged: 2, resolved: 3, dismissed: 4 };
        return (sOrder[a.status] || 5) - (sOrder[b.status] || 5);
      }
      return 0;
    });
  }, [findings, sev, status, q, sortBy]);

  const handleReview = (
    findingId: string,
    action: "acknowledge" | "resolve" | "dismiss" | "reopen",
    reviewComment?: string
  ) => {
    setActionError(null);
    startTransition(async () => {
      const res = await reviewFindingAction(findingId, action, reviewComment);
      if (res.error) {
        setActionError(res.error);
        return;
      }

      // Optimistic update
      const newStatus = (res.status || (action === "reopen" ? "open" : action === "acknowledge" ? "acknowledged" : action)) as
        | FindingStatus
        | "dismissed";

      setFindings((prev) =>
        prev.map((item) => {
          if (item.id === findingId) {
            return {
              ...item,
              status: newStatus,
              review_comment: reviewComment || (action === "reopen" ? undefined : item.review_comment),
            };
          }
          return item;
        })
      );

      setActiveAction(null);
      setComment("");
    });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Unified Interactive 4-Card Scorecard (Screen 5) */}
      {showScorecard && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {/* Critical Card */}
          <button
            type="button"
            className="card"
            onClick={() => setSev(sev === "critical" ? "all" : "critical")}
            style={{
              padding: "18px 20px",
              textAlign: "left",
              cursor: "pointer",
              borderLeft: "4px solid #ff6b6b",
              background: sev === "critical" ? "rgba(255, 107, 107, 0.12)" : "rgba(255, 107, 107, 0.04)",
              border: sev === "critical" ? "1.5px solid #ff6b6b" : "1px solid var(--line)",
              borderLeftWidth: 4,
              boxShadow: sev === "critical" ? "0 0 20px rgba(255, 107, 107, 0.25)" : "none",
              transition: "all 0.18s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <strong className="mono" style={{ fontSize: 28, fontWeight: 700, color: "#ff6b6b" }}>
                {counts.critical}
              </strong>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Critical</span>
            </div>
            <span className="muted" style={{ fontSize: 12, marginTop: 6, display: "block" }}>
              Must fix before verification
            </span>
          </button>

          {/* Material Card */}
          <button
            type="button"
            className="card"
            onClick={() => setSev(sev === "material" ? "all" : "material")}
            style={{
              padding: "18px 20px",
              textAlign: "left",
              cursor: "pointer",
              borderLeft: "4px solid #f0b64a",
              background: sev === "material" ? "rgba(240, 182, 74, 0.12)" : "rgba(240, 182, 74, 0.04)",
              border: sev === "material" ? "1.5px solid #f0b64a" : "1px solid var(--line)",
              borderLeftWidth: 4,
              boxShadow: sev === "material" ? "0 0 20px rgba(240, 182, 74, 0.25)" : "none",
              transition: "all 0.18s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <strong className="mono" style={{ fontSize: 28, fontWeight: 700, color: "#f0b64a" }}>
                {counts.material}
              </strong>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Material</span>
            </div>
            <span className="muted" style={{ fontSize: 12, marginTop: 6, display: "block" }}>
              Should be addressed
            </span>
          </button>

          {/* Minor Card */}
          <button
            type="button"
            className="card"
            onClick={() => setSev(sev === "minor" ? "all" : "minor")}
            style={{
              padding: "18px 20px",
              textAlign: "left",
              cursor: "pointer",
              borderLeft: "4px solid #5aa9ff",
              background: sev === "minor" ? "rgba(90, 169, 255, 0.12)" : "rgba(90, 169, 255, 0.04)",
              border: sev === "minor" ? "1.5px solid #5aa9ff" : "1px solid var(--line)",
              borderLeftWidth: 4,
              boxShadow: sev === "minor" ? "0 0 20px rgba(90, 169, 255, 0.25)" : "none",
              transition: "all 0.18s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <strong className="mono" style={{ fontSize: 28, fontWeight: 700, color: "#5aa9ff" }}>
                {counts.minor}
              </strong>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Minor</span>
            </div>
            <span className="muted" style={{ fontSize: 12, marginTop: 6, display: "block" }}>
              Nice to have
            </span>
          </button>

          {/* Readiness Score Card with Circular SVG Gauge Ring */}
          <button
            type="button"
            className="card"
            onClick={() => {
              setSev("all");
              setStatus("all");
              setQ("");
            }}
            style={{
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "left",
              cursor: "pointer",
              background: sev === "all" && status === "all" ? "rgba(61, 220, 151, 0.08)" : "rgba(61, 220, 151, 0.03)",
              border: "1px solid rgba(61, 220, 151, 0.25)",
              boxShadow: sev === "all" ? "0 0 20px rgba(61, 220, 151, 0.15)" : "none",
              transition: "all 0.18s ease",
            }}
            title="Reset filters to view all findings"
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <strong className="mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>
                  {readinessScore}%
                </strong>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>Readiness</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--accent)", marginTop: 4, display: "block", fontWeight: 500 }}>
                {sev === "all" ? "Showing all" : "Click to view all"}
              </span>
            </div>

            <div style={{ position: "relative", width: 54, height: 54 }}>
              <svg width="54" height="54" viewBox="0 0 54 54">
                <circle cx="27" cy="27" r="21" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                <circle
                  cx="27"
                  cy="27"
                  r="21"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 21}`}
                  strokeDashoffset={`${2 * Math.PI * 21 * (1 - readinessScore / 100)}`}
                  transform="rotate(-90 27 27)"
                />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* Main Filter & Findings Container */}
      <div className="card" style={{ padding: 20 }}>
        {/* Filter Toolbar */}
        <div className="filters" style={{ marginBottom: 16, alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <MagnifyingGlass size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--dim)" }} />
            <input
              id="fq"
              className="input"
              style={{ paddingLeft: 36, height: 38 }}
              placeholder="Search findings by rule, description or code..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search findings"
            />
          </div>

          <select
            id="fsev"
            className="select"
            style={{ width: 150, height: 38 }}
            value={sev}
            onChange={(e) => setSev(e.target.value as Severity | "all")}
            aria-label="Filter by severity"
          >
            <option value="all">All Severity ({findings.length})</option>
            <option value="critical">Critical ({counts.critical})</option>
            <option value="material">Material ({counts.material})</option>
            <option value="minor">Minor ({counts.minor})</option>
          </select>

          <select
            id="fs"
            className="select"
            style={{ width: 140, height: 38 }}
            value={status}
            onChange={(e) => setStatus(e.target.value as FindingStatus | "dismissed" | "all")}
            aria-label="Filter by status"
          >
            <option value="all">All Status ({statusCounts.all})</option>
            <option value="open">Open ({statusCounts.open})</option>
            <option value="acknowledged">Acknowledged ({statusCounts.acknowledged})</option>
            <option value="resolved">Resolved ({statusCounts.resolved})</option>
            <option value="dismissed">Dismissed ({statusCounts.dismissed})</option>
          </select>

          <select
            id="sort"
            className="select"
            style={{ width: 160, height: 38 }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Sort findings"
          >
            <option value="severity">Sort by: Severity</option>
            <option value="rule">Sort by: Rule</option>
            <option value="status">Sort by: Status</option>
          </select>

          {(sev !== "all" || status !== "all" || q.trim() !== "") && (
            <button
              onClick={() => {
                setSev("all");
                setStatus("all");
                setQ("");
              }}
              className="btn btn-sm"
              style={{ height: 38, padding: "0 12px", fontSize: 12, color: "var(--muted)" }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {actionError && (
          <div className="banner" style={{ marginBottom: 12, borderColor: "var(--crit)", color: "var(--crit)" }}>
            <XCircle size={18} />
            <span>{actionError}</span>
          </div>
        )}

        {shown.length === 0 ? (
          <div className="empty" style={{ padding: "40px 16px" }}>
            <h3>No findings match current filters</h3>
            <p>Clear the severity filter or refine your search keyword.</p>
            <button
              onClick={() => {
                setSev("all");
                setStatus("all");
                setQ("");
              }}
              className="btn btn-sm btn-primary"
              style={{ marginTop: 12 }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div style={{ display: "grid" }}>
            {shown.map((f) => {
              const isExpanded = open === f.id;
              const statusConfig = STATUS_CHIPS[f.status] || { label: f.status, chipClass: "" };
              const isActionOpen = activeAction?.findingId === f.id;

              return (
                <div key={f.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <div
                    className="finding"
                    style={{ borderTop: "none", cursor: "pointer" }}
                    onClick={() => setOpen(isExpanded ? null : f.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setOpen(isExpanded ? null : f.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className={`chip ${SEV[f.severity].chip}`}>{SEV[f.severity].label}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="meta" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span className="mono muted" style={{ fontSize: 12, fontWeight: 600 }}>
                          {f.rule}
                        </span>
                        <span className={`chip ${statusConfig.chipClass}`}>{statusConfig.label}</span>
                        {f.review_comment && (
                          <span className="muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ChatCircleText size={13} /> {f.review_comment}
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "4px 0 2px", color: "var(--text)" }}>{f.title}</h3>
                      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>{f.detail}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <span className="muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                        {f.sources} source{f.sources === 1 ? "" : "s"}
                        <motion.span animate={{ rotate: isExpanded ? 180 : 0 }}>
                          <CaretDown size={14} />
                        </motion.span>
                      </span>
                    </div>
                  </div>

                  {/* Collapsible Action Panel */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ padding: "4px 16px 20px 88px", display: "grid", gap: 14 }}>
                          {f.remediation && (
                            <div style={{ display: "grid", gap: 4 }}>
                              <b style={{ fontSize: 13, color: "var(--text)" }}>Suggested Remediation</b>
                              <span className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                                {f.remediation}
                              </span>
                            </div>
                          )}

                          {f.quotes && f.quotes.length > 0 && (
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <b style={{ fontSize: 13, color: "var(--text)" }}>Evidence Citations</b>
                                <Link
                                  href="/documents"
                                  className="muted"
                                  style={{ fontSize: 12, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}
                                >
                                  <FileText size={13} /> View in Evidence Viewer <ArrowRight size={11} />
                                </Link>
                              </div>
                              {f.quotes.map((q, idx) => (
                                <blockquote
                                  key={idx}
                                  style={{
                                    margin: 0,
                                    padding: "8px 14px",
                                    borderLeft: "2px solid var(--accent)",
                                    background: "rgba(61, 220, 151, 0.05)",
                                    borderRadius: 4,
                                    fontSize: 13,
                                    color: "var(--text)",
                                    fontStyle: "italic",
                                  }}
                                >
                                  &ldquo;{q}&rdquo;
                                </blockquote>
                              ))}
                            </div>
                          )}

                          {/* Human Review Controls */}
                          {!readOnly && (
                            <div
                              style={{
                                marginTop: 6,
                                paddingTop: 12,
                                borderTop: "1px dashed var(--line)",
                                display: "grid",
                                gap: 12,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>Review action:</span>

                                {f.status === "open" && (
                                  <button
                                    className="btn btn-sm"
                                    disabled={isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReview(f.id, "acknowledge");
                                    }}
                                    title="Acknowledge this finding"
                                  >
                                    <Eye size={14} /> Acknowledge
                                  </button>
                                )}

                                {(f.status === "open" || f.status === "acknowledged") && (
                                  <>
                                    <button
                                      className="btn btn-sm"
                                      style={{ borderColor: "rgba(61, 220, 151, 0.4)", color: "var(--accent)" }}
                                      disabled={isPending}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveAction({ findingId: f.id, action: "resolve" });
                                        setComment("");
                                      }}
                                    >
                                      <CheckCircle size={14} /> Resolve...
                                    </button>
                                    <button
                                      className="btn btn-sm"
                                      style={{ borderColor: "rgba(255, 107, 107, 0.4)", color: "var(--crit)" }}
                                      disabled={isPending}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveAction({ findingId: f.id, action: "dismiss" });
                                        setComment("");
                                      }}
                                    >
                                      <XCircle size={14} /> Dismiss...
                                    </button>
                                  </>
                                )}

                                {(f.status === "resolved" || f.status === "dismissed") && (
                                  <button
                                    className="btn btn-sm"
                                    disabled={isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReview(f.id, "reopen");
                                    }}
                                  >
                                    <ArrowCounterClockwise size={14} /> Reopen finding
                                  </button>
                                )}
                              </div>

                              {/* Justification input prompt for Resolve or Dismiss */}
                              {isActionOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  style={{
                                    background: "var(--surface-2)",
                                    padding: 14,
                                    borderRadius: 10,
                                    border: "1px solid var(--line-strong)",
                                    display: "grid",
                                    gap: 10,
                                    maxWidth: 540,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <b style={{ fontSize: 13 }}>
                                      {activeAction.action === "resolve" ? "Resolution Justification" : "Dismissal Rationale"}
                                    </b>
                                    <span className="muted" style={{ fontSize: 12 }}>
                                      Min 3 characters
                                    </span>
                                  </div>
                                  <textarea
                                    className="input"
                                    style={{ minHeight: 64, height: 72, padding: "8px 12px", resize: "vertical" }}
                                    placeholder={
                                      activeAction.action === "resolve"
                                        ? "Describe how this issue was corrected or reconciled (e.g. Invoiced meter logs attached)."
                                        : "Explain why this finding is dismissed or excluded per methodology."
                                    }
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                  />
                                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm"
                                      disabled={isPending}
                                      onClick={() => setActiveAction(null)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-primary"
                                      disabled={isPending || comment.trim().length < 3}
                                      onClick={() => handleReview(f.id, activeAction.action, comment)}
                                    >
                                      {isPending ? "Submitting..." : activeAction.action === "resolve" ? "Confirm Resolution" : "Confirm Dismissal"}
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
