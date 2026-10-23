import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Org = { id: string; name: string; role: "owner" | "admin" | "member" | "viewer" };

/** Signed-in user plus their first organization (null until they create one). */
export const getSession = cache(async () => {
  const supabase = await createClient();
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
  return { supabase, user, org };
});

