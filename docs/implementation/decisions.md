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

| 12 | Phase A tables: documents, parsed_units, evidence_refs, parameter_values, jobs, methodologies, parameter_defs. Rules, runs, findings and reviews wait for Phase B | Their shape depends on the rule format and run snapshot. |
| 13 | Documents, parsed text, evidence refs and parameter values are append-only; status and review fields are the only mutable columns | Evidence must not change under a finding. Corrections are new rows that point at what they replace. |
| 14 | Storage path is `<org_id>/sha256/<hash>` and the database enforces it | Per-tenant content addressing; no cross-tenant "already uploaded" signal. |
| 15 | Users only read the Phase A tables; the worker writes them | Hashing and parsing must happen on a trusted path. User-facing writes arrive later as audited RPC functions. |
| 16 | Job queue is a Postgres table claimed with `FOR UPDATE SKIP LOCKED`, with backoff, dead state and stale-lock recovery | No separate queue needed at this scale. |
| 17 | A value feeds calculations only through `authoritative_values` (reviewed or auto-accepted, not replaced) | Uncertain extractions cannot silently pass into a calculation. |
| 18 | Scanned PDFs end as `needs_ocr`, encrypted or corrupted files as `failed`; neither is guessed at | Wrong is worse than missing. |
| 19 | Excel midnight datetimes display as plain dates; formulas with no saved value are flagged, never computed | Values come from what the file stores. |

## Open decisions
- First methodology and customer (BM EN01.001, AMS-I.D, ACM0002 are candidates only).
- Hosting for the Python worker.
- LLM provider and its data-retention terms.
