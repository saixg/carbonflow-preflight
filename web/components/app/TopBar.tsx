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
    title: "Upload New Document",
    category: "Action",
    href: "/projects/proj-solar-raj?tab=documents",
    icon: UploadSimple,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = SEARCH_ITEMS.filter((item) =>
    (item.title + item.category).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <header className="topbar">
      <div ref={containerRef} style={{ position: "relative", zIndex: 50 }}>
        <div className="search-pill" onClick={() => setOpen(true)}>
          <MagnifyingGlass size={16} className="muted" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, documents..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
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
              width: 360,
              marginTop: 8,
              borderRadius: 14,
              background: "rgba(10, 24, 19, 0.96)",
              border: "1px solid rgba(61, 220, 151, 0.3)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
              padding: "8px 0",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "6px 14px 8px", fontSize: 11, fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Quick Navigation
            </div>

            {results.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
                No matching results
              </div>
            ) : (
              <div style={{ display: "grid", gap: 2 }}>
                {results.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.title}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                        router.push(item.href);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 16px",
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                        color: "var(--text)",
                        fontSize: 13,
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(61, 220, 151, 0.1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: "rgba(255, 255, 255, 0.05)",
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
        <button
          className="icon-btn"
          aria-label="Notifications"
          title="3 critical findings require attention"
        >
          <Bell size={18} />
          <span className="icon-badge" />
        </button>

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
