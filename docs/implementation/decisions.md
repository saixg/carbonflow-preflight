# Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Database-first first slice; no frontend scaffold yet | Access control is the riskiest part and is testable without Docker; UI comes after the contract is reviewed. |
| 2 | Tests on PGlite with a Supabase stub | No Docker or Supabase CLI on this machine. Stub lives under `supabase/tests/support/` and is never a migration. |
| 3 | Orgs are created only through `public.create_org()` (security definer) | Avoids a chicken-and-egg RLS problem; direct inserts into `orgs` are denied by privileges. |
| 4 | Only owners manage members in the MVP | Invite flows are out of scope; smallest safe rule. Last owner cannot be removed or demoted. |
| 5 | Roles: owner, admin, member, viewer. Owner/admin/member write projects and periods; viewer reads. | Minimal supported set; enforced in policies. |
| 6 | Monitoring periods: inclusive date ranges, no overlap within a project, `end_date >= start_date` | Chosen scope for the "define before constraining" requirement. Enforced by an exclusion constraint (needs `btree_gist`, the only extension added). Revisit when a methodology needs different rules. |
| 7 | Composite FK `(project_id, org_id)` on periods | Makes cross-tenant attachment structurally impossible, not just policy-blocked. |
| 8 | No delete policy on projects and periods | Records are archived via `status`, not deleted. |
| 9 | Audit log: written only by triggers, append-only, readable by owner/admin, no hash chain | Hash chain deferred until serialization, concurrency and key management are defined. A chain would not stop a privileged admin. |
| 10 | `projects.methodology_id/version` are plain nullable text | The `methodologies` table waits for the methodology decision gate. |
| 11 | No PostGIS, pgvector, queue or worker yet | Not needed by the implemented slice. |

## Open decisions
- First methodology and customer (BM EN01.001, AMS-I.D, ACM0002 are candidates only).
- Hosting for the Python worker.
- LLM provider and its data-retention terms.
