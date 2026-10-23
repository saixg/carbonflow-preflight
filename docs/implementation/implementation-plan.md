# Implementation plan

Source of truth for scope is the CarbonFlow Preflight brief (Phases 0 to 7). This file tracks status and the adaptation to the actual repository.

| Phase | Status |
|---|---|
| 0. Audit | Done. See `docs/architecture/current-state.md`. |
| 1. Secure project workflow | **Database layer done and tested locally.** Frontend not started. |
| 2. Immutable document ingestion | Not started. Needs storage policies, which require a real Supabase stack to test. |
| 3. Evidence-backed extraction | Not started. |
| 4. Deterministic rules | Not started. Methodology-neutral engine first; labeled test rules only until the methodology gate passes. |
| 5. Findings and review | Not started. |
| 6. Report and evidence package | Not started. |
| 7. Evaluation and pilot | Not started. |

## Phase 1 delivered
- `supabase/migrations/20261023000100_foundation.sql`: orgs, members, projects, monitoring_periods, audit_log; RLS on all; role helpers in a private schema; audit triggers; immutable-column and last-owner guards.
- `tests/db/tenant-isolation.test.ts`: cross-tenant reads/writes, roles, period constraints, audit-log permissions.
- Run with `npm test`.

## Phase 1 remaining
1. Next.js + TypeScript scaffold, Supabase Auth, org context.
2. Project and monitoring-period screens with loading/error/empty states and schema-validated forms.
3. Re-run the SQL suite against a real local Supabase stack (needs Docker + Supabase CLI) or a throwaway branch.
4. Review the migration diff, then request approval to apply it remotely.
