"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import {
  CaretDown,
  Check,
  CheckCircle,
  MagnifyingGlass,
  ArrowCounterClockwise,
  XCircle,
  Eye,
  ChatCircleText,
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
  critical: { label: "Critical", chip: "crit", color: "var(--crit)", hint: "Fix before verification" },
  material: { label: "Material", chip: "warn", color: "var(--warn)", hint: "Should be addressed" },
  minor: { label: "Minor", chip: "info", color: "var(--info)", hint: "Nice to have" },
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
}: {
  initialFindings?: FindingItem[];
  readOnly?: boolean;
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

  const shown = findings.filter(
    (f) =>
      (sev === "all" || f.severity === sev) &&
      (status === "all" || f.status === status) &&
      (f.title + f.detail + f.rule).toLowerCase().includes(q.toLowerCase())
  );

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
      {/* KPI Cards for Severity */}
      <div className="grid-4" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        {(Object.keys(SEV) as Severity[]).map((k) => (
          <button
            key={k}
            className="card sev"
            style={{
              cursor: "pointer",
              textAlign: "left",
              outline: sev === k ? `1.5px solid ${SEV[k].color}` : undefined,
              boxShadow: sev === k ? `0 0 16px ${SEV[k].color}20` : undefined,
            }}
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
        {/* Filters and search */}
        <div className="filters" style={{ marginBottom: 12, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <MagnifyingGlass size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--dim)" }} />
            <label htmlFor="fq" className="sr-only">
              Search findings
            </label>
            <input
              id="fq"
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search findings..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <label className="sr-only" htmlFor="fsev">
            Severity
          </label>
          <select
            id="fsev"
            className="select"
            style={{ width: 150 }}
            value={sev}
            onChange={(e) => setSev(e.target.value as Severity | "all")}
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical ({counts.critical})</option>
            <option value="material">Material ({counts.material})</option>
            <option value="minor">Minor ({counts.minor})</option>
          </select>

          <label className="sr-only" htmlFor="fs">
            Status
          </label>
          <select
            id="fs"
            className="select"
            style={{ width: 140 }}
            value={status}
            onChange={(e) => setStatus(e.target.value as FindingStatus | "dismissed" | "all")}
          >
            <option value="all">All Status</option>
            <option value="open">Open ({statusCounts.open})</option>
            <option value="acknowledged">Acknowledged ({statusCounts.acknowledged})</option>
            <option value="resolved">Resolved ({statusCounts.resolved})</option>
            <option value="dismissed">Dismissed ({statusCounts.dismissed})</option>
          </select>

          <select
            id="sort"
            className="select"
            style={{ width: 150 }}
            defaultValue="severity"
          >
            <option value="severity">Sort by: Severity</option>
            <option value="rule">Sort by: Rule</option>
            <option value="status">Sort by: Status</option>
          </select>
        </div>

        {actionError && (
          <div className="banner" style={{ marginBottom: 12, borderColor: "var(--crit)", color: "var(--crit)" }}>
            <XCircle size={18} />
            <span>{actionError}</span>
          </div>
        )}

        {shown.length === 0 && (
          <div className="empty">
            <h3>No findings match</h3>
            <p>Clear a filter or change the search text.</p>
          </div>
        )}

        {shown.map((f) => {
          const isExpanded = open === f.id;
          const statusConfig = STATUS_CHIPS[f.status] || { label: f.status, chipClass: "" };
          const isActionOpen = activeAction?.findingId === f.id;

          return (
            <div key={f.id} style={{ borderTop: "1px solid var(--line)" }}>
              <div
                className="finding"
                style={{ borderTop: "none" }}
                onClick={() => setOpen(isExpanded ? null : f.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setOpen(isExpanded ? null : f.id)}
                aria-expanded={isExpanded}
              >
                <span className={`chip ${SEV[f.severity].chip}`}>{SEV[f.severity].label}</span>
                <div>
                  <div className="meta">
                    <span className="mono muted" style={{ fontSize: 12 }}>
                      {f.rule}
                    </span>
                    <span className={`chip ${statusConfig.chipClass}`}>{statusConfig.label}</span>
                    {f.review_comment && (
                      <span className="muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ChatCircleText size={13} /> {f.review_comment}
                      </span>
                    )}
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.detail}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ padding: "4px 12px 20px 88px", display: "grid", gap: 14 }}>
                      {f.remediation && (
                        <div style={{ display: "grid", gap: 4 }}>
                          <b style={{ fontSize: 13, color: "var(--text)" }}>Suggested Remediation</b>
                          <span className="muted" style={{ fontSize: 14 }}>
                            {f.remediation}
                          </span>
                        </div>
                      )}

                      {f.quotes && f.quotes.length > 0 && (
                        <div style={{ display: "grid", gap: 6 }}>
                          <b style={{ fontSize: 13, color: "var(--text)" }}>Evidence Citations</b>
                          {f.quotes.map((q, idx) => (
                            <blockquote
                              key={idx}
                              style={{
                                margin: 0,
                                padding: "6px 12px",
                                borderLeft: "2px solid var(--accent)",
                                background: "rgba(61, 220, 151, 0.05)",
                                borderRadius: 4,
                                fontSize: 13,
                                color: "var(--muted)",
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
    </div>
  );
}
