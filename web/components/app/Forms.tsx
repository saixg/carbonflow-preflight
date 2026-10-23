"use client";

import { useActionState, useEffect, useRef } from "react";
import { createOrgAction, createPeriodAction, createProjectAction, type FormState } from "@/app/(app)/actions";
import { PROJECT_TYPES } from "@/lib/constants";

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Saving" : children}
    </button>
  );
}

export function CreateOrgForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrgAction, undefined);
  return (
    <form action={action} className="form-grid" style={{ maxWidth: 420 }}>
      <div className="field">
        <label htmlFor="org-name">Organization name</label>
        <input id="org-name" name="name" className="input" required maxLength={200} />
        <span className="hint">Usually your company or consultancy.</span>
      </div>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <div><Submit pending={pending}>Create organization</Submit></div>
    </form>
  );
}

export function ProjectForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createProjectAction, undefined);
  return (
    <form action={action} className="form-grid" style={{ maxWidth: 560 }}>
      <div className="field">
        <label htmlFor="p-name">Project name</label>
        <input id="p-name" name="name" className="input" required maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="p-type">Project type</label>
        <select id="p-type" name="project_type" className="select" defaultValue={PROJECT_TYPES[0]}>
          {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 12 }}>
        <div className="field">
          <label htmlFor="p-meth">Methodology (optional)</label>
          <input id="p-meth" name="methodology_id" className="input" maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="p-ver">Version</label>
          <input id="p-ver" name="methodology_version" className="input" maxLength={40} />
        </div>
      </div>
      <p className="hint">Methodology rules are not applied until a methodology is formally supported. Enter both fields or neither.</p>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <div><Submit pending={pending}>Create project</Submit></div>
    </form>
  );
}

export function PeriodForm({ projectId }: { projectId: string }) {
  const bound = createPeriodAction.bind(null, projectId);
  const [state, action, pending] = useActionState<FormState, FormData>(bound, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="form-grid">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
        <div className="field">
          <label htmlFor="start">Start date</label>
          <input id="start" name="start_date" type="date" className="input" required />
        </div>
        <div className="field">
          <label htmlFor="end">End date</label>
          <input id="end" name="end_date" type="date" className="input" required />
        </div>
      </div>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <div><Submit pending={pending}>Add period</Submit></div>
    </form>
  );
}
