import Link from "next/link";
import { getSession } from "@/lib/context";
import { fmtDate, StatusChip } from "@/components/app/Bits";

export const metadata = { title: "Monitoring periods | CarbonFlow Preflight" };

export default async function Periods() {
  const { supabase, org } = await getSession();
  const { data } = org
    ? await supabase.from("monitoring_periods").select("id, start_date, end_date, status, projects(id, name)").order("start_date", { ascending: false })
    : { data: [] };
  const list = data ?? [];
  return (
    <div className="page">
      <div className="page-h"><h1>Monitoring periods</h1></div>
      <div className="card">
        {list.length === 0 ? (
          <div className="empty"><h3>No monitoring periods</h3><p>Periods are added from a project.</p><Link href="/projects" className="btn">Open projects</Link></div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Project</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((p) => {
                const pr = Array.isArray(p.projects) ? p.projects[0] : p.projects;
                return (
                  <tr key={p.id}>
                    <td>{pr ? <Link href={`/projects/${pr.id}`}>{pr.name}</Link> : "Unknown"}</td>
                    <td className="mono">{fmtDate(p.start_date)}</td>
                    <td className="mono">{fmtDate(p.end_date)}</td>
                    <td><StatusChip status={p.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
