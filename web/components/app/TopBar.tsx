"use client";

import { useState } from "react";
import Link from "next/link";
import { MagnifyingGlass, Bell, Gear, User } from "@phosphor-icons/react/ssr";

export function TopBar({
  userName = "Saigai",
  orgName = "GreenEarth Energy",
}: {
  userName?: string;
  orgName?: string;
}) {
  const [query, setQuery] = useState("");

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="search-pill">
          <MagnifyingGlass size={16} className="muted" />
          <input
            type="text"
            placeholder="Search projects, documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search projects and documents"
          />
          <span className="kbd">⌘K</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button className="icon-btn" aria-label="Notifications" title="Notifications">
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
