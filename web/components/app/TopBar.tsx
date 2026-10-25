"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  Bell,
  FolderSimple,
  FileText,
  Play,
  FlagBanner,
  ChartLineUp,
  UploadSimple,
  CheckCircle,
  Warning,
  X,
  ArrowRight,
} from "@phosphor-icons/react/ssr";

const SEARCH_ITEMS = [
  {
    title: "Solar Farm – Rajasthan",
    category: "Project",
    href: "/projects/proj-solar-raj",
    icon: FolderSimple,
  },
  {
    title: "Wind Project – Gujarat",
    category: "Project",
    href: "/projects/proj-wind-guj",
    icon: FolderSimple,
  },
  {
    title: "Monitoring_Report_2023.pdf",
    category: "Document",
    href: "/documents",
    icon: FileText,
  },
  {
    title: "Run #4 – 12 Jun 2024",
    category: "Run",
    href: "/runs/sample",
    icon: Play,
  },
  {
    title: "Preflight Verification Report",
    category: "Report",
    href: "/runs/sample/report",
    icon: ChartLineUp,
  },
  {
    title: "Net electricity export mismatch (CALC-001)",
    category: "Finding",
    href: "/findings",
    icon: FlagBanner,
  },
  {
    title: "Upload New Evidence Document",
    category: "Action",
    href: "/projects/proj-solar-raj?tab=documents",
    icon: UploadSimple,
  },
];

const NOTIFICATIONS = [
  {
    id: "n1",
    rule: "CALC-001",
    severity: "critical",
    title: "Net electricity export mismatch",
    desc: "152,345 MWh reported vs 149,120 MWh calculated from monthly meter logs.",
    href: "/runs/sample?tab=findings",
    time: "10m ago",
  },
  {
    id: "n2",
    rule: "DOC-002",
    severity: "critical",
    title: "Calibration certificate expired during period",
    desc: "Substation revenue meter certificate expired 30 Sep 2023.",
    href: "/runs/sample?tab=findings",
    time: "45m ago",
  },
  {
    id: "n3",
    rule: "DATE-004",
    severity: "critical",
    title: "Gap in meter data coverage (14-19 Mar 2023)",
    desc: "5 calendar days missing continuous generation records.",
    href: "/runs/sample?tab=findings",
    time: "2h ago",
  },
];

export function TopBar({
  userName = "Saigai",
  orgName = "GreenEarth Energy",
}: {
  userName?: string;
  orgName?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const results = SEARCH_ITEMS.filter((item) =>
    (item.title + " " + item.category).toLowerCase().includes(query.toLowerCase())
  );

  // Keyboard shortcut: Cmd+K / Ctrl+K and arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setOpen(false);
        setNotifOpen(false);
      } else if (open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
        } else if (e.key === "Enter" && results[selectedIndex]) {
          e.preventDefault();
          router.push(results[selectedIndex].href);
          setOpen(false);
          setQuery("");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, router]);

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="topbar">
      {/* Search Bar & Fast Command Palette */}
      <div ref={containerRef} style={{ position: "relative", zIndex: 50 }}>
        <div className="search-pill" onClick={() => setOpen(true)}>
          <MagnifyingGlass size={16} className="muted" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, documents, findings... (⌘K)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setSelectedIndex(0);
            }}
            onFocus={() => setOpen(true)}
            aria-label="Search projects and documents"
          />
          <span className="kbd">⌘K</span>
        </div>

        {/* Reactive Fast Dropdown Results */}
        {open && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              width: 380,
              marginTop: 8,
              borderRadius: 14,
              background: "rgba(10, 24, 19, 0.96)",
              border: "1px solid rgba(61, 220, 151, 0.3)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.65)",
              padding: "8px 0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 14px 8px",
                borderBottom: "1px solid var(--line)",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Quick Navigation
              </span>
              <span style={{ fontSize: 10, color: "var(--dim)" }}>↑↓ to navigate · ↵ to select</span>
            </div>

            {results.length === 0 ? (
              <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
                No matching results found
              </div>
            ) : (
              <div style={{ display: "grid", gap: 2, maxHeight: 340, overflowY: "auto" }}>
                {results.map((item, idx) => {
                  const Icon = item.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.title}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                        router.push(item.href);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        background: isSelected ? "rgba(61, 220, 151, 0.12)" : "transparent",
                        border: 0,
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                        color: "var(--text)",
                        fontSize: 13,
                        transition: "background 0.12s ease",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: isSelected ? "rgba(61, 220, 151, 0.2)" : "rgba(255, 255, 255, 0.05)",
                          display: "grid",
                          placeItems: "center",
                          color: "var(--accent)",
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={15} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--dim)" }}>{item.category}</div>
                      </div>
                      {isSelected && (
                        <ArrowRight size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Notifications Popover */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="icon-btn"
            aria-label="Notifications"
            title="3 critical findings require attention"
            style={{
              position: "relative",
              background: notifOpen ? "rgba(61, 220, 151, 0.15)" : undefined,
              borderColor: notifOpen ? "var(--accent)" : undefined,
            }}
          >
            <Bell size={18} />
            <span className="icon-badge" />
          </button>

          {notifOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                width: 360,
                marginTop: 10,
                borderRadius: 14,
                background: "rgba(10, 24, 19, 0.97)",
                border: "1px solid rgba(61, 220, 151, 0.35)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 25px 50px rgba(0, 0, 0, 0.7)",
                padding: "12px 0",
                zIndex: 60,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0 16px 10px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Action Required</h4>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: 11 }}>
                    3 critical findings blocking verification
                  </p>
                </div>
                <span className="badge-count crit" style={{ fontSize: 11 }}>
                  3 Critical
                </span>
              </div>

              <div style={{ display: "grid", gap: 2, padding: "8px 0" }}>
                {NOTIFICATIONS.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => setNotifOpen(false)}
                    style={{
                      display: "grid",
                      gap: 4,
                      padding: "10px 16px",
                      background: "transparent",
                      textDecoration: "none",
                      transition: "background 0.12s ease",
                      borderLeft: "3px solid #ff6b6b",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 107, 107, 0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#ff8585" }}>
                        {n.rule}
                      </span>
                      <span className="muted" style={{ fontSize: 10 }}>{n.time}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                      {n.desc}
                    </div>
                  </Link>
                ))}
              </div>

              <div style={{ padding: "8px 16px 0", borderTop: "1px solid var(--line)" }}>
                <Link
                  href="/findings"
                  onClick={() => setNotifOpen(false)}
                  className="btn btn-sm btn-primary"
                  style={{ width: "100%", justifyContent: "center", borderRadius: 8, fontSize: 12 }}
                >
                  Review All Findings <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#04120c",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 14,
              boxShadow: "0 0 12px rgba(16, 185, 129, 0.4)",
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
