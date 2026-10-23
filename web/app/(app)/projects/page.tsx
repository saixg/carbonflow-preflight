import Link from "next/link";
import { Plus } from "@phosphor-icons/react/ssr";
import { getSession } from "@/lib/context";
import { StatusChip, typeIcon } from "@/components/app/Bits";

export const metadata = { title: "Projects | CarbonFlow Preflight" };

export default async function Projects() {
  const { supabase, org } = await getSession();
  const { data } = org
    ? await supabase.from("projects").select("id, name, project_type, status, methodology_id, methodology_version").order("created_at", { ascending: false })
    : { data: [] };
  const list = data ?? [];
  return (
    <div className="page">
      <div className="page-h">
        <h1>Projects</h1>
        <Link href="/projects/new" className="btn btn-primary"><Plus size={16} weight="bold" /> New project</Link>
      </div>
      <div className="card">
        {list.length === 0 ? (
          <div className="empty">
            <h3>No projects yet</h3>
            <p>{org ? "Create a project to start tracking monitoring periods and evidence." : "Create an organization on the dashboard first."}</p>
            <Link href={org ? "/projects/new" : "/dashboard"} className="btn btn-primary">{org ? "Create project" : "Go to dashboard"}</Link>
          </div>
        ) : (
          <div className="rows">
            {list.map((p) => {
              const Icon = typeIcon(p.project_type);
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="row">
                  <span className="tile"><Icon size={22} /></span>
                  <div>
                    <h3>{p.name}</h3>
                    <p>{p.project_type ?? "Unspecified"}{p.methodology_id ? `, ${p.methodology_id} ${p.methodology_version}` : ", no methodology set"}</p>
                  </div>
                  <StatusChip status={p.status} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
