import { getSession } from "@/lib/context";
import { Sidebar } from "@/components/app/Sidebar";
import { TopBar } from "@/components/app/TopBar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org, guest } = await getSession();
  const userName = user?.email ? user.email.split("@")[0] : "Saigai";
  return (
    <div className="app">
      <Sidebar orgName={org?.name ?? (guest ? "GreenEarth Energy" : "No organization")} email={user?.email ?? "saigai@carbonflow.io"} guest={guest} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: "100dvh" }}>
        <TopBar userName={userName} orgName={org?.name ?? "GreenEarth Energy"} />
        <main className="main" style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
