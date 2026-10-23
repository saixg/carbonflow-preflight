import Link from "next/link";
import { Drop, Flame, Leaf, Sun, Wind, Warning } from "@phosphor-icons/react/ssr";

type Icon = typeof Leaf;

export function SampleBanner({ children }: { children?: React.ReactNode }) {
  return (
    <div className="banner" role="note">
      <Warning size={18} />
      <span>{children ?? "Sample data. This screen previews a feature that is not built yet. Nothing here comes from your projects."}</span>
    </div>
  );
}

export function typeIcon(type: string | null): Icon {
  const t = (type ?? "").toLowerCase();
  if (t.includes("solar")) return Sun;
  if (t.includes("wind")) return Wind;
  if (t.includes("hydro")) return Drop;
  if (t.includes("biomass")) return Flame;
  return Leaf;
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={c.label} style={{ display: "contents" }}>
          {i > 0 && <span aria-hidden="true">/</span>}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function StatusChip({ status }: { status: string }) {
  const cls = status === "active" || status === "open" ? "ok" : status === "closed" ? "info" : "";
  return <span className={`chip ${cls}`}>{status}</span>;
}

export function fmtDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
