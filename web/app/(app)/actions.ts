"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/context";
import { PROJECT_TYPES } from "@/lib/constants";

export type FormState = { error?: string; ok?: boolean } | undefined;

const name = z.string().trim().min(1, "Enter a name.").max(200, "Use 200 characters or fewer.");

export async function createOrgAction(_: FormState, fd: FormData): Promise<FormState> {
  const p = z.object({ name }).safeParse({ name: fd.get("name") });
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("create_org", { p_name: p.data.name });
  if (error) return { error: "Could not create the organization. Try again." };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const projectSchema = z
  .object({
    name,
    project_type: z.enum(PROJECT_TYPES),
    methodology_id: z.string().trim().max(80).optional(),
    methodology_version: z.string().trim().max(40).optional(),
  })
  .refine((v) => Boolean(v.methodology_id) === Boolean(v.methodology_version), {
    message: "Enter both a methodology and its version, or leave both empty.",
  });

export async function createProjectAction(_: FormState, fd: FormData): Promise<FormState> {
  const p = projectSchema.safeParse({
    name: fd.get("name"),
    project_type: fd.get("project_type"),
    methodology_id: (fd.get("methodology_id") as string) || undefined,
    methodology_version: (fd.get("methodology_version") as string) || undefined,
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const { supabase, org } = await getSession();
  if (!org) return { error: "Create an organization first." };
  if (org.role === "viewer") return { error: "Viewers cannot create projects." };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      org_id: org.id,
      name: p.data.name,
      project_type: p.data.project_type,
      methodology_id: p.data.methodology_id ?? null,
      methodology_version: p.data.methodology_version ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the project. Check your permissions and try again." };
  revalidatePath("/", "layout");
  redirect(`/projects/${data.id}`);
}

const periodSchema = z.object({
  start_date: z.string().date("Enter a start date."),
  end_date: z.string().date("Enter an end date."),
});

export async function createPeriodAction(projectId: string, _: FormState, fd: FormData): Promise<FormState> {
  const p = periodSchema.safeParse({ start_date: fd.get("start_date"), end_date: fd.get("end_date") });
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.end_date < p.data.start_date) return { error: "The end date must be on or after the start date." };

  const { supabase } = await getSession();
  const { data: project } = await supabase.from("projects").select("org_id").eq("id", projectId).single();
  if (!project) return { error: "Project not found." };

  const { error } = await supabase
    .from("monitoring_periods")
    .insert({ org_id: project.org_id, project_id: projectId, ...p.data });
  if (error) {
    if (error.code === "23P01") return { error: "This period overlaps an existing monitoring period." };
    if (error.code === "42501") return { error: "You do not have permission to add periods." };
    return { error: "Could not add the period. Try again." };
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
