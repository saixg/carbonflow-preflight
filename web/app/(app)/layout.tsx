import { getSession } from "@/lib/context";
import { Sidebar } from "@/components/app/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org, guest } = await getSession();
  return (
    <div className="app">
      <Sidebar orgName={org?.name ?? (guest ? "Guest mode" : "No organization")} email={user.email ?? "?"} guest={guest} />
      <main className="main">{children}</main>
    </div>
  );
}
