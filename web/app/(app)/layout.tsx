import { getSession } from "@/lib/context";
import { Sidebar } from "@/components/app/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org } = await getSession();
  return (
    <div className="app">
      <Sidebar orgName={org?.name ?? "No organization"} email={user.email ?? "?"} />
      <main className="main">{children}</main>
    </div>
  );
}
