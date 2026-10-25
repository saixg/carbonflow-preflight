"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Sun, Wind, Plant, Drop, FolderSimple } from "@phosphor-icons/react/ssr";

export interface DashboardProjectItem {
  id: string;
  name: string;
  methodology: string;
  period: string;
  type: string;
  progress: number;
  badges: { crit: number; warn: number; ok: number };
}

function getProjIcon(type: string) {
  switch (type) {
    case "solar":
      return <Sun size={20} weight="fill" color="#f0b64a" />;
    case "wind":
      return <Wind size={20} weight="fill" color="#5aa9ff" />;
    case "biomass":
      return <Plant size={20} weight="fill" color="#3ddc97" />;
    case "hydro":
      return <Drop size={20} weight="fill" color="#38bdf8" />;
    default:
      return <FolderSimple size={20} weight="fill" color="#3ddc97" />;
  }
}

export function DashboardProjects({
  projects,
}: {
  projects: DashboardProjectItem[];
}) {
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = useMemo(() => {
    if (filterType === "all") return projects;
    return projects.filter((p) => p.type === filterType);
  }, [projects, filterType]);

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="card-h" style={{ marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Project Overview</h2>
          <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
            Active monitoring periods and verification readiness
          </p>
        </div>

        {/* Filter Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "var(--bg-2)",
            padding: 3,
            borderRadius: 8,
            border: "1px solid var(--line)",
          }}
        >
          {["all", "solar", "wind", "biomass"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                background: filterType === t ? "var(--surface-2)" : "transparent",
                color: filterType === t ? "var(--accent)" : "var(--muted)",
                border: 0,
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: 5,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.15s ease",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/projects/new" className="btn btn-primary btn-sm" style={{ borderRadius: 999 }}>
            <Plus size={14} weight="bold" /> New Project
          </Link>
          <Link href="/projects" className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            View all <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 13 }}>
            No projects in this category.
          </div>
        ) : (
          filtered.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "38px minmax(0, 1.2fr) minmax(100px, 160px) auto",
                alignItems: "center",
                gap: 16,
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--line)",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="project-row"
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid var(--line)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {getProjIcon(p.type)}
              </div>

              <div style={{ minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text)",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.name}
                </h3>
                <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
                  {p.methodology} | {p.period}
                </p>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span className="muted">Readiness</span>
                  <span className="mono" style={{ fontWeight: 600, color: "var(--accent)" }}>
                    {p.progress}%
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                <span className="badge-count crit" title={`${p.badges.crit} Critical findings`}>
                  ● {p.badges.crit}
                </span>
                <span className="badge-count warn" title={`${p.badges.warn} Material findings`}>
                  ▲ {p.badges.warn}
                </span>
                <span className="badge-count ok" title={`${p.badges.ok} Minor / Passed`}>
                  ✓ {p.badges.ok}
                </span>
                <ArrowRight size={14} className="muted" style={{ marginLeft: 6 }} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
