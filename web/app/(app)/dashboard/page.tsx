import Link from "next/link";
import { Plus, ArrowRight, CheckCircle, Circle } from "@phosphor-icons/react/ssr";
import { getSession } from "@/lib/context";
import { greeting } from "@/lib/constants";
import { CreateOrgForm } from "@/components/app/Forms";
import { Donut } from "@/components/charts";
import { CountUp, Reveal } from "@/components/motion";
import { fmtDate, StatusChip, typeIcon } from "@/components/app/Bits";

export const metadata = { title: "Dashboard | CarbonFlow Preflight" };

export default async function Dashboard() {
  const { supabase, user, org } = await getSession();
  const first = (user.email ?? "there").split("@")[0];

  if (!org) {
    return (
      <div className="page">
        <div className="page-h"><div><h1>{greeting()}, {first}</h1><p className="muted">Create an organization to start.</p></div></div>
        <div className="card" style={{ display: "grid", gap: 16 }}>
          <h2 style={{ fontSize: 18 }}>Set up your organization</h2>
          <p className="muted" style={{ maxWidth: "52ch" }}>Projects, documents and findings belong to an organization. Only its members can see them.</p>
          <CreateOrgForm />
        </div>
      </div>
    );
  }

  const [{ data: projects }, { data: periods }, { data: events }] = await Promise.all([
    supabase.from("projects").select("id, name, project_type, status, methodology_id, methodology_version").order("created_at", { ascending: false }),
    supabase.from("monitoring_periods").select("id, project_id, start_date, end_date, status"),
    supabase.from("audit_log").select("id, action, entity_type, created_at").order("id", { ascending: false }).limit(6),
  ]);
  const list = projects ?? [];
  const per = periods ?? [];
  const open = per.filter((p) => p.status === "open").length;
  const count = (s: string) => list.filter((p) => p.status === s).length;

  const kpis = [
    { l: "Projects", v: list.length, live: true, e: "In your organization" },
    { l: "Monitoring periods", v: per.length, live: true, e: `${open} open` },
    { l: "Documents", v: null, e: "Upload arrives next" },
    { l: "Open findings", v: null, e: "Rules arrive later" },
  ];
  const phases = [
    ["Projects and monitoring periods", true],
    ["Document upload and hashing", false],
    ["Evidence-backed extraction", false],
    ["Rules and findings", false],
    ["Reports and evidence pack", false],
  ] as const;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>{greeting()}, {first}</h1>
          <p className="muted">Here is the status of your carbon projects.</p>
        </div>
        <Link href="/projects/new" className="btn btn-primary"><Plus size={16} weight="bold" /> New project</Link>
      </div>

      <div className="grid-4">
        {kpis.map((k, i) => (
          <Reveal key={k.l} delay={i * 0.06}>
            <div className={`card kpi ${k.live ? "live" : ""}`}>
              <small>{k.l}</small>
              <strong className="mono">{k.v === null ? "n/a" : <CountUp to={k.v} />}</strong>
              <em>{k.e}</em>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h">
            <h2>Project overview</h2>
            <Link href="/projects" className="muted" style={{ fontSize: 13 }}>View all <ArrowRight size={12} style={{ verticalAlign: "-1px" }} /></Link>
          </div>
          {list.length === 0 ? (
            <div className="empty">
              <h3>No projects yet</h3>
              <p>Create your first project, then add a monitoring period to start collecting evidence.</p>
              <Link href="/projects/new" className="btn btn-primary">Create project</Link>
            </div>
          ) : (
            <div className="rows">
              {list.slice(0, 6).map((p) => {
                const Icon = typeIcon(p.project_type);
                const n = per.filter((x) => x.project_id === p.id).length;
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="row">
                    <span className="tile"><Icon size={22} /></span>
                    <div>
                      <h3>{p.name}</h3>
                      <p>{p.project_type ?? "Unspecified"}{p.methodology_id ? `, ${p.methodology_id} ${p.methodology_version}` : ""}</p>
                    </div>
                    <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span className="muted" style={{ fontSize: 13 }}>{n} {n === 1 ? "period" : "periods"}</span>
                      <StatusChip status={p.status} />
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card">
            <div className="card-h"><h2>Projects by status</h2></div>
            {list.length === 0 ? <p className="muted" style={{ fontSize: 14 }}>Appears once you create a project.</p> : (
              <Donut caption="projects" slices={[
                { label: "Active", value: count("active"), color: "var(--accent)" },
                { label: "Draft", value: count("draft"), color: "var(--info)" },
                { label: "Archived", value: count("archived"), color: "var(--dim)" },
              ]} />
            )}
          </div>
          <div className="card">
            <div className="card-h"><h2>Build progress</h2></div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, fontSize: 14 }}>
              {phases.map(([t, done]) => (
                <li key={t} style={{ display: "flex", gap: 10, alignItems: "center", color: done ? "var(--text)" : "var(--muted)" }}>
                  {done ? <CheckCircle size={18} weight="fill" color="var(--accent)" /> : <Circle size={18} />} {t}
                </li>
              ))}
            </ul>
          </div>
          {(events ?? []).length > 0 && (
            <div className="card">
              <div className="card-h"><h2>Recent activity</h2></div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, fontSize: 13 }}>
                {(events ?? []).map((e) => (
                  <li key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span className="mono">{e.action}</span>
                    <span className="muted">{fmtDate(e.created_at.slice(0, 10))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
