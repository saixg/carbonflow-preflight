import { getSession } from "@/lib/context";
import { Users, Plus, ShieldCheck, EnvelopeSimple } from "@phosphor-icons/react/ssr";

export const metadata = { title: "Team | CarbonFlow Preflight" };

const DEFAULT_MEMBERS = [
  {
    id: "m1",
    name: "Saigai",
    email: "saigai@carbonflow.io",
    role: "Owner",
    access: "Full organization & signing permissions",
    avatar: "S",
  },
  {
    id: "m2",
    name: "Aarav Mehta",
    email: "aarav.mehta@greenearth.in",
    role: "Admin",
    access: "Manage projects, rule runs & upload evidence",
    avatar: "A",
  },
  {
    id: "m3",
    name: "Priya Sharma",
    email: "priya.s@greenearth.in",
    role: "Member",
    access: "Document review and parameter entry",
    avatar: "P",
  },
  {
    id: "m4",
    name: "Independent VV Body Assessor",
    email: "auditor@vvb-climate.com",
    role: "Auditor (Viewer)",
    access: "Read-only access to verification packages",
    avatar: "V",
  },
];

export default async function Team() {
  const { user, org } = await getSession();

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Team & Permissions</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {org?.name ?? "GreenEarth Energy"} • Workspace members, verification roles and audit access.
          </p>
        </div>
        <button className="btn btn-primary" style={{ borderRadius: 999 }}>
          <Plus size={16} weight="bold" /> Invite Member
        </button>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Access Level</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_MEMBERS.map((m) => (
              <tr key={m.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: m.role === "Owner" ? "linear-gradient(135deg, #10b981, #047857)" : "var(--surface-2)",
                        color: m.role === "Owner" ? "#fff" : "var(--accent)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        fontSize: 13,
                        border: "1px solid var(--line)",
                      }}
                    >
                      {m.avatar}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{m.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{m.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className="badge-count"
                    style={{
                      background: m.role === "Owner" ? "rgba(61, 220, 151, 0.15)" : "rgba(255, 255, 255, 0.05)",
                      color: m.role === "Owner" ? "var(--accent)" : "var(--text)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {m.role}
                  </span>
                </td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {m.access}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="icon-btn" style={{ width: 28, height: 28, border: 0, background: "transparent" }}>
                    <EnvelopeSimple size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
