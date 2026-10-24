import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ENABLED } from "@/lib/flags";

export type Org = { id: string; name: string; role: "owner" | "admin" | "member" | "viewer" };

/** Signed-in user plus their first organization (null until they create one). */
export const getSession = cache(async () => {
  const supabase = await createClient();

  if (!AUTH_ENABLED) {
    const { data: demoOrg } = await supabase.from("orgs").select("id, name").order("created_at").limit(1).maybeSingle();
    const guestOrg: Org | null = demoOrg
      ? { id: demoOrg.id, name: demoOrg.name, role: "owner" }
      : { id: "280286b2-3677-4743-949a-737d65d9cf35", name: "Gujarat Green Power Corp", role: "owner" };
    return { supabase, user: { id: "3ce59c47-3089-45cc-9eb2-7d6d1156a12b", email: "lead.auditor@carbonflow.internal" }, org: guestOrg, guest: true };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("members")
    .select("role, orgs(id, name)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1);

  const m = data?.[0];
  const o = m ? (Array.isArray(m.orgs) ? m.orgs[0] : m.orgs) : null;
  const org: Org | null = m && o ? { id: o.id, name: o.name, role: m.role } : null;
  return { supabase, user: { id: user.id, email: user.email }, org, guest: false };
});
