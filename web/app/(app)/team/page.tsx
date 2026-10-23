import { getSession } from "@/lib/context";

export const metadata = { title: "Team | CarbonFlow Preflight" };

export default async function Team() {
  const { supabase, user, org } = await getSession();
  const { data } = org ? await supabase.from("members").select("id, user_id, role, created_at").order("created_at") : { data: [] };
  return (
    <div className="page">
      <div className="page-h"><div><h1>Team</h1><p className="muted">{org?.name ?? "No organization"}</p></div></div>
      <div className="card">
        {(data ?? []).length === 0 ? (
          <div className="empty"><h3>No members to show</h3><p>Create an organization on the dashboard first.</p></div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Member</th><th>Role</th></tr></thead>
            <tbody>
              {(data ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.user_id === user.id ? `${user.email} (you)` : `${m.user_id.slice(0, 8)}`}</td>
                  <td><span className="chip">{m.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="hint" style={{ marginTop: 16 }}>Invitations are not built yet. Owners can add members directly in the database for now.</p>
      </div>
    </div>
  );
}
