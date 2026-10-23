"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthState } from "./actions";

export function AuthForm({ initialMode }: { initialMode: "signin" | "signup" }) {
  const [mode, setMode] = useState(initialMode);
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signInAction : signUpAction,
    undefined,
  );
  return (
    <form action={action} key={mode} noValidate>
      <div>
        <h1 style={{ fontSize: 28, letterSpacing: "-0.02em" }}>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {mode === "signin" ? "Sign in to continue to your projects." : "Start organizing evidence for your next verification."}
        </p>
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required />
        {mode === "signup" && <span className="hint">At least 8 characters.</span>}
      </div>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.message && <p className="chip ok" role="status" style={{ height: "auto", padding: "8px 12px", whiteSpace: "normal" }}>{state.message}</p>}
      <button className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? "Please wait" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
      <button type="button" className="btn" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
