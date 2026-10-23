import { redirect } from "next/navigation";
import { AuthForm } from "./AuthForm";
import { Brand } from "@/components/landing/Sections";
import Scene from "@/components/three/Scene";
import { AUTH_ENABLED } from "@/lib/flags";

export const metadata = { title: "Sign in | CarbonFlow Preflight" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (!AUTH_ENABLED) redirect("/dashboard");
  const { mode } = await searchParams;
  return (
    <div className="auth">
      <div className="auth-art">
        <div style={{ position: "absolute", top: 28, left: 32 }}><Brand /></div>
        <Scene kind="hero" />
      </div>
      <div className="auth-form">
        <AuthForm initialMode={mode === "signup" ? "signup" : "signin"} />
      </div>
    </div>
  );
}
