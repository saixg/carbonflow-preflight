"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

function parse(fd: FormData) {
  return schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
}

export async function signInAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const p = parse(fd);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(p.data);
  if (error) return { error: "Email or password is incorrect." };
  redirect("/dashboard");
}

export async function signUpAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const p = parse(fd);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(p.data);
  if (error) return { error: error.message };
  if (!data.session) return { message: "Check your email to confirm your account, then sign in." };
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
