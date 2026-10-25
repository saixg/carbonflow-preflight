"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderSimple,
  Sun,
  Wind,
  Plant,
  Drop,
  ArrowRight,
  MagnifyingGlass,
  Plus,
  Funnel,
} from "@phosphor-icons/react/ssr";

export interface ProjectCardItem {
  id: string;
  name: string;
  methodology: string;
  period: string;
  type: string;
  progress: number;
  badges: { crit: number; warn: number; ok: number };
  capacity: string;
  status: string;
}

function getIcon(type: string) {
  if (type === "solar") return <Sun size={20} weight="fill" color="#f0b64a" />;
  if (type === "wind") return <Wind size={20} weight="fill" color="#5aa9ff" />;
  if (type === "biomass") return <Plant size={20} weight="fill" color="#3ddc97" />;
  if (type === "hydro") return <Drop size={20} weight="fill" color="#38bdf8" />;
  return <FolderSimple size={20} weight="fill" color="#3ddc97" />;
}

export function ProjectsList({
  initialProjects,
}: {
  initialProjects: ProjectCardItem[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"readiness_desc" | "readiness_asc" | "name">("readiness_desc");

  const counts = useMemo(() => {
    return {
      all: initialProjects.length,
      solar: initialProjects.filter((p) => p.type === "solar").length,
      wind: initialProjects.filter((p) => p.type === "wind").length,
      biomass: initialProjects.filter((p) => p.type === "biomass").length,
      hydro: initialProjects.filter((p) => p.type === "hydro").length,
    };
  }, [initialProjects]);

  const filtered = useMemo(() => {
    let result = initialProjects.filter((p) => {
      const matchQuery =
        query.trim() === "" ||
        (p.name + " " + p.methodology + " " + p.period + " " + p.capacity)
          .toLowerCase()
          .includes(query.toLowerCase());

      const matchType = typeFilter === "all" || p.type === typeFilter;

      return matchQuery && matchType;
    });

    return result.sort((a, b) => {
      if (sortBy === "readiness_desc") return b.progress - a.progress;
      if (sortBy === "readiness_asc") return a.progress - b.progress;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [initialProjects, query, typeFilter, sortBy]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Reactive Toolbar */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          display: "flex",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <MagnifyingGlass size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--dim)" }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: 36, height: 38 }}
            placeholder="Search projects by name, methodology or capacity..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div
          style={{
            display: "flex",
            gap: 6,
            background: "var(--bg-2)",
            padding: 3,
            borderRadius: 8,
            border: "1px solid var(--line)",
          }}
        >
          {(
            [
              ["all", `All (${counts.all})`],
              ["solar", `Solar (${counts.solar})`],
              ["wind", `Wind (${counts.wind})`],
              ["biomass", `Biomass (${counts.biomass})`],
              ["hydro", `Hydro (${counts.hydro})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              style={{
                background: typeFilter === key ? "var(--surface-2)" : "transparent",
                color: typeFilter === key ? "var(--accent)" : "var(--muted)",
                border: 0,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 10px",
                borderRadius: 6,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <select
          className="select"
          style={{ width: 170, height: 38 }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="readiness_desc">Sort: Highest Readiness</option>
          <option value="readiness_asc">Sort: Lowest Readiness</option>
          <option value="name">Sort: Project Name (A-Z)</option>
        </select>
      </div>

      {/* Projects List */}
      <div className="card" style={{ padding: 20 }}>
        {filtered.length === 0 ? (
          <div className="empty" style={{ padding: "40px 16px" }}>
            <h3>No projects found</h3>
            <p>Try clearing your search query or selecting &quot;All&quot; projects.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTypeFilter("all");
              }}
              className="btn btn-sm btn-primary"
              style={{ marginTop: 12 }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px minmax(0, 1.4fr) 110px minmax(100px, 160px) auto",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--line)",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                className="project-row"
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--line)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {getIcon(p.type)}
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
                    {p.methodology} | {p.period} • Capacity: {p.capacity}
                  </p>
                </div>

                <div>
                  <span
                    className="badge-count"
                    style={{
                      fontSize: 11,
                      background: p.status === "Active" ? "rgba(61, 220, 151, 0.12)" : "rgba(240, 182, 74, 0.12)",
                      color: p.status === "Active" ? "var(--accent)" : "var(--warn)",
                      borderColor: p.status === "Active" ? "rgba(61, 220, 151, 0.3)" : "rgba(240, 182, 74, 0.3)",
                    }}
                  >
                    ● {p.status}
                  </span>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
