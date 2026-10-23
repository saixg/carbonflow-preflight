# Backend build plan: 3 phases (no frontend)

Goal: a working system where a document goes in and a reproducible, evidence-backed findings report comes out, driven entirely through the database and an API. The web app is a client of this and is not part of these phases.

## What the plan actually requires

Five properties, in priority order. Every phase is judged against them.

1. **Deterministic authority.** Calculations, units, dates, rules and severity come from tested code. The LLM only reads, maps, explains and drafts.
2. **Traceability.** Every material value points to a document hash, page and locator. Nothing uncertain becomes a fact silently.
3. **Reproducibility.** A run freezes methodology, rulepack, engine, extraction schema, prompts, model and input hashes.
4. **Tenant isolation.** RLS in the database, private storage, no service-role secrets in browsers.
5. **Honest boundary.** A preparedness assessment. No certification claims, no predicted verification success.

## Architecture (backend only)

| Part | Choice | Why |
|---|---|---|
| Database | Supabase Postgres, RLS on every table | Already live (`foundation` migration applied) |
| Files | Supabase Storage, private bucket, path `sha256/<hash>` | Content addressing, short-lived signed URLs |
| Jobs | A `jobs` table claimed with `FOR UPDATE SKIP LOCKED` | No new queue until load demands one |
| Worker and API | Python 3.13, FastAPI, in `worker/` | Parsing, `pint`, `Decimal` and PDF tooling are Python-native |
| Simple CRUD and review actions | Postgres functions called through Supabase RPC | State transitions and invariants stay in the database |
| LLM | Small provider interface, pinned model id, schema-validated output | Pipeline must still run with the LLM off |
| Tests | pytest for the engine, vitest and PGlite for fast RLS checks, local Supabase (CLI plus Docker) for storage and full-stack RLS | Storage policies cannot be tested in PGlite |

Service-role rule: the worker bypasses RLS, so every query it makes is scoped by the `org_id` on the job row, and tests prove it cannot read or write across tenants.

Repo layout to add: `worker/carbonflow/` (package), `worker/tests/`, `rulepacks/`, `fixtures/` (synthetic documents and expected outputs).

---

## Phase A: Evidence spine

**Status (2026-10-23):** migrations `...000200_evidence_spine.sql` and `...000300_storage.sql` are applied to the `climateG` project (recorded remotely as `evidence_spine` and `storage_documents_bucket`) and passed a 16-check integration run against the real database and storage schema, executed in a rolled-back transaction. The worker's parsers, ingest, job queue and pipeline are written with tests, but `PsycopgRepo` and `SupabaseStorage` have not yet run against the live project. Adjustments made while building, all deliberate:

- Tables for rulepacks, rules, runs, findings, reviews and emission claims move to the Phase B migration, where their shape (rule format, run snapshot) is decided. Designing them now would have been guesswork.
- Content-addressed paths are per tenant (`<org_id>/sha256/<hash>`). A global path would let one tenant learn whether another already uploaded the same file.
- Upload flow: client puts the file in `<org_id>/staging/...`; the worker's finalize step re-reads it, checks the real file type, hashes it, copies it to the final path without overwriting, registers the document and queues parsing. The client never supplies the hash or the final path.
- The HTTP API (signed upload URLs, JWT verification, finalize endpoint) is not written yet. It needs the Supabase JWT settings and is the next item once Docker is available for a real test.

**Outcome:** a file goes in, is stored immutably, and comes out as parsed text and tables with locators. Everything later depends on this being solid.

**Database (additive migrations, reviewed before any remote apply):**
- `documents`, `evidence_refs`, `parameter_defs`, `parameter_values`, `methodologies`, `rulepacks`, `rules`, `runs`, `findings`, `reviews`, `emission_claims`, `jobs`.
- Invariants in Postgres:
  - documents are insert-only (update and delete blocked)
  - a `parameter_values` row needs an evidence ref or is explicitly `ASSERTED` with an author
  - composite foreign keys so evidence, values and findings cannot cross tenants
  - completed runs cannot be altered
- Audit triggers on the new tables. Hash chaining stays deferred (see Phase C).
- Private storage bucket with policies; upload through a signed URL.

**Worker:**
- Claim loop with retries, backoff, a dead-letter state and a clear error summary per job.
- Server-side SHA-256, then move to `sha256/<hash>`. Duplicate content is deduplicated deliberately: one stored object, separate document records.
- Parsers returning a common structure `{text, page, locator}`:
  - PDF: text and word boxes (PyMuPDF). Scanned pages are flagged "needs OCR", not guessed.
  - XLSX and CSV: sheet, cell and row locators.
- Limits: file size, allowed media types, page count, parse timeout. Files are untrusted input.

**Tests and exit gate:**
- Tenant-isolation suite extended to every new table.
- Fixture files (clean PDF, scanned PDF, corrupted PDF, oversized file, XLSX with merged cells) produce expected parse output or the expected failure.
- Storage policy and full-stack RLS tests on the local Supabase stack (CLI plus Docker).
- **Gate:** upload, hash, store, parse, and read back locators, with cross-tenant access denied at every step.

---

## Phase B: Extraction and the deterministic engine

**Outcome:** values are extracted with evidence, validated by rules, and a run produces reproducible findings from a frozen input snapshot.

**Extraction:**
- Extraction schema (versioned) for a small, defined field set.
- Pipeline: parsed text, then schema-constrained LLM call, then validation.
  - The returned number must appear verbatim in the cited span.
  - A second, independent verifier call re-reads the span.
  - Critical fields are extracted three times with varied prompts, and disagreement goes to review.
- Normalization keeps the original value, converts units with `pint`, uses `Decimal`, and never discards the source string.
- Review states: `auto_accepted_high`, `needs_review`, `conflicting`, `human_confirmed`, `human_corrected`. Uncertain values cannot enter an authoritative calculation.
- Manual entry path: a user (through RPC) enters a value with its evidence ref or marks it `ASSERTED`. The system must work with the LLM unavailable.
- Malformed model output triggers a retry and then a review task. It is never coerced.

**Rule engine:**
- Typed rule format, declared as data, with a fixed operator allowlist: `present`, `in_range`, `equals_within_tolerance`, `sums_to`, `dates_cover_period`, `unit_compatible`, `recompute_matches`, `cross_document_equal`. No `eval`, no arbitrary expressions or SQL.
- Rulepacks are content-hashed and immutable once published.
- Reconciliation: cross-document variance and temporal gap or overlap detection.
- Run orchestration: snapshot all inputs, record versions, execute, write findings with rule id, observed and expected values, severity and evidence refs.
- Until the methodology gate is passed, ship a **methodology-neutral engine** and a rulepack clearly labelled `TEST ONLY`.

**Tests and exit gate:**
- Property tests for unit conversion and decimal math.
- Golden synthetic corpus with known expected values and findings.
- Adversarial fixtures: unit swap, year-shifted date, inflated figure, missing evidence, conflicting documents, prompt-injection text inside a document (must not change behaviour or call tools).
- **Gate:** the same frozen inputs, rulepack and engine give byte-identical findings on repeat runs, and no value without evidence reaches a calculation.

---

## Phase C: Findings lifecycle, reports, evaluation and hardening

**Outcome:** a team can work findings to closure, export a traceable report and evidence pack, and the system's accuracy is measured rather than claimed.

**Findings and review (all as database functions):**
- Status machine: `open`, `acknowledged`, `resolved`, `dismissed`, with allowed transitions enforced in SQL. Dismiss and resolve require a comment.
- Review history is append-only. Rerunning after corrections creates a new run and keeps the original.
- Optional LLM drafting of explanations and remediation, grounded only in rule output and evidence. It never sets severity or status.
- CAR, CL and FAR labels are applied only where the chosen methodology or registry context defines them. Most findings stay "data-quality issue".

**Reports and exports:**
- Preflight report (PDF), findings workbook (CSV first), evidence manifest (JSON: document hashes, locators, rulepack and engine versions, run id, input snapshot hash), and a ZIP evidence pack.
- Report states unresolved items plainly, never presents unverified data as confirmed, and carries the "preparedness assessment, not certification" disclaimer.
- Downloads authorized per tenant with short-lived signed URLs.

**Evaluation and hardening:**
- Eval harness measuring field-level extraction precision, finding false-positive rate, recall where independent labels exist, and time to first finding. Results stored per run so regressions are visible.
- Regression gate in CI: a rulepack change that flips a golden finding needs explicit sign-off.
- Security suite: cross-tenant reads, writes and downloads; attaching another tenant's evidence; altering a completed run; malicious and oversized uploads; prompt injection; unauthorized export.
- Audit hash chain only after defining canonical serialization, concurrency handling, verification and key management, and documenting that it does not stop a privileged admin.
- Deployment: choose worker hosting, move secrets to the host, add structured logs without document contents, rate limits and a job-lag alert.

**Methodology gate (can run in parallel from the start of Phase B):**
choose the intended customer and methodology, retrieve the current official text and record its id and version, build the parameter and rule inventory, mark each rule as directly sourced, derived, or an internal heuristic, and get domain-expert review. Only then replace the `TEST ONLY` rulepack.

**Gate:** a seeded project goes end to end (upload, extract, run, review, rerun, export) with the evidence pack re-checkable offline, and the eval numbers recorded.

---

## Decisions (recorded 2026-10-23)

| Decision | Choice | Condition |
|---|---|---|
| Methodology | India CCTS offset methodology BM EN01.001, grid-connected electricity generation from renewable sources, v1.0, as the **candidate** | Not a requirement until the methodology gate passes: confirm the current official text, version, applicability and monitoring requirements, record the source URL and hash, and get domain-expert review. Until then only the `TEST ONLY` rulepack runs. |
| Initial customer | Indian grid-connected solar and wind developers, and MRV consultants managing their monitoring documents | Hypothesis. Validate with customer interviews before assuming willingness to pay. |
| Worker hosting | Render Background Worker (Python), single worker, Supabase Postgres as source of truth and job queue with database-backed retries | Paid service. Containerize in Phase C. Secrets live in Render, not the repo. |
| LLM provider | OpenAI API behind the provider interface, structured outputs, schema validation, bounded retries, source-evidence checks | Check current data-retention terms and privacy controls before any confidential customer document is sent. Deterministic checks keep working with the LLM off. A fake provider is used in tests. |
| Database testing | Local Supabase CLI plus Docker, with migrations, seed fixtures and automated RLS and storage tests | Docker and the CLI are not installed yet (see blockers). Remote stays unchanged until migrations are reviewed and approved. |
| Queue | Postgres `jobs` table | Unchanged. |
| Frontend | Out of scope for these phases. Later: Next.js with a findings and evidence-first workflow, PDF highlighting, restrained motion | The 3D effects stay on the landing page only. |

### Provisional quality gates

- Extraction: at least 95% precision on in-scope fields, measured on a labeled test set.
- Deterministic calculations and seeded rule tests: 100% correct outcomes.
- Security suite: zero cross-tenant access.
- False-positive rate and issue recall: measured against independently labeled examples. No public accuracy claims until measured.

### First release scope

One methodology candidate, one monitoring workflow, a limited set of evidence-backed fields, deterministic rules, human review, and a reproducible preflight report. No certification claims.

### Blockers

1. **Docker Desktop and the Supabase CLI** must be installed locally before any storage or full-RLS test can run. Migrations and the worker's parsers can be written and unit-tested without them.
2. **Methodology gate** must pass before real BM EN01.001 rules replace the test rulepack.
3. **OpenAI account, key and retention review** before any real document goes through extraction.

## Sequencing and size

A then B then C, with the methodology gate in parallel. Each phase ends at a review point, with migrations shown to you before any remote apply, as before.

## Phase B status (2026-10-23)

Built and tested locally; migration `...000400_runs_findings.sql` is written but **not yet applied** to the remote project.

- **Parsing helpers:** strict number parsing (western and Indian grouping, decimal commas refused), strict dates (ambiguous day/month refused), exact unit conversion with an allowlist of spellings.
- **Rule engine:** nine fixed operations, rulepacks as validated JSON with a content hash, deterministic results (byte-identical across input orderings), values must be reviewed and carry evidence or the snapshot is refused. The only rulepack is `rulepacks/test-only-0.1.0.json`, labelled TEST ONLY.
- **Extraction:** a model proposes quotes; the document is the judge (quote must exist, value and unit must sit inside it). Three passes plus an independent check; auto-accept is off by default. Provider is OpenAI over plain HTTP with a pinned model, bounded retries and strict schemas, tested against a mock transport only.
- **Database:** runs, findings and their evidence links are append-only once a run finishes; users can enter values, review values (confirm, reject, correct with a comment) and request runs through audited functions that check the caller's role in the row's own organization.
- **Orchestration:** `parse_document` queues `extract_document` when a provider is configured; `run_preflight` freezes inputs, runs the rules and stores findings in one transaction, or marks the run failed.
- **Verification so far:** 65 database tests (PGlite) and 122 worker tests. The worker's SQL lives in `carbonflow/sql.py` so the same statements can be run against a real database.