# Current state (audited 2026-10-23)

## Local repository: `C:\Users\saigi\climateG`
- Was empty and not a git repository. `git init` was run (no commits yet).
- No frontend, backend, worker, auth code, or tests existed before this session.

## Toolchain
| Tool | State |
|---|---|
| Node / npm | v24.18.0 / 11.16.0 |
| Python | 3.13.0 |
| Git | installed |
| pnpm, Docker, Supabase CLI | **not installed** |

Without Docker or the Supabase CLI there is no local Supabase stack. Database tests therefore run on PGlite (real Postgres in WASM) with a small stub of Supabase's `auth` schema and roles (`supabase/tests/support/supabase_stub.sql`).

## Remote Supabase project `climateG` (`vgdpojpevcgpxxnfwoed`, ap-south-1)
Created this session. Inspected read-only:
- Tables in `public`: none. Migrations applied: none.
- Extensions installed: `plpgsql`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`. Nothing else enabled. `btree_gist` is available but not yet installed.
- Nothing from this repository has been applied remotely.
- A second project, `version1` (`eqcsdhngkunhwbscuzmq`), exists in the same org and is untouched.

## Reusable
Nothing from the repo. The remote project is empty, so there is no schema to conflict with.

## Top risks
1. **Tests are not run against real Supabase.** PGlite plus a stub approximates it. Before any real data, run the same suite against a local Supabase stack or a throwaway branch.
2. **Methodology is undecided.** Only methodology-neutral work is safe until the decision gate in the plan is passed.
3. **Storage authorization is untested.** Storage policies (Phase 2) cannot be validated in PGlite.
4. **No frontend or auth UI yet.** The RLS contract is tested only at the SQL level.
5. **LLM data handling is unverified.** Provider retention terms must be checked before real documents are sent. No zero-retention claims.

## Blockers and assumptions
- Assumption: Next.js + TypeScript for the frontend and a Python worker later, per the plan; nothing is installed yet.
- Blocker for remote apply: explicit approval of the migration diff.
