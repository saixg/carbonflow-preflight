import { redirect } from "next/navigation";
import { getSession } from "@/lib/context";
import { ProjectForm } from "@/components/app/Forms";
import { Crumbs } from "@/components/app/Bits";

export const metadata = { title: "New project | CarbonFlow Preflight" };

export default async function NewProject() {
  const { org } = await getSession();
  if (!org) redirect("/dashboard");
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <Crumbs items={[{ label: "Projects", href: "/projects" }, { label: "New project" }]} />
          <h1>New project</h1>
        </div>
      </div>
      <div className="card"><ProjectForm /></div>
    </div>
  );
}
