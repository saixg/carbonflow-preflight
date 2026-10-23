"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarBlank, ChartLineUp, FileText, FlagBanner, FolderSimple, Gauge, Play, Users,
} from "@phosphor-icons/react/ssr";
import { Brand } from "@/components/landing/Sections";
import { signOutAction } from "@/app/login/actions";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/projects", label: "Projects", icon: FolderSimple },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/periods", label: "Monitoring periods", icon: CalendarBlank },
  { href: "/runs", label: "Runs", icon: Play },
  { href: "/findings", label: "Findings", icon: FlagBanner },
  { href: "/reports", label: "Reports", icon: ChartLineUp },
  { href: "/team", label: "Team", icon: Users },
];

export function Sidebar({ orgName, email }: { orgName: string; email: string }) {
  const path = usePathname();
  return (
    <aside className="side">
      <Brand />
      <nav className="nav" aria-label="Main">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="side-foot">
        <span className="avatar">{email.slice(0, 1).toUpperCase()}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{orgName}</div>
          <form action={signOutAction}>
            <button className="hint" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>Sign out</button>
          </form>
        </div>
      </div>
    </aside>
  );
}
