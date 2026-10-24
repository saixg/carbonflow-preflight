# Implementation plan

Source of truth for scope is the CarbonFlow Preflight brief (Phases 0 to 7). This file tracks status and the adaptation to the actual repository.

| Phase | Status | Summary |
|---|---|---|
| 0. Audit | **Complete** | Architecture review and baseline captured. |
| 1. Secure project workflow | **Complete** | Orgs, members, projects, monitoring periods, RLS, audit log, and Next.js UI. |
| 2. Immutable document ingestion | **Complete** | SHA-256 content addressing, parsed units, PyMuPDF, Docling, RapidOCR fallback. |
| 3. Evidence-backed extraction | **Complete** | NVIDIA Nemotron 3 Ultra (OpenRouter) & Gemini Flash with locator citations and manual review. |
| 4. Deterministic rules | **Complete** | AST rule engine, 5 check families (CALC, DATE, UNIT, CONS, PLAU), snapshot execution. |
| 5. Findings and review | **Complete** | Append-only `finding_reviews`, `review_finding` state machine, comment checks, UI reviews. |
| 6. Report and evidence package | **Complete** | Evidence manifest, verification readiness, Markdown report, CSV workbook, ZIP exports. |
| 7. Evaluation and pilot | **In Progress** | Benchmarking suite operational (100% precision on baseline set), pilot onboarding next. |

## Delivered in Phase C (Findings Lifecycle, Reports & Evidence Package)
- `supabase/migrations/20261024000100_findings_lifecycle_reports.sql`:
  - `finding_reviews` table: append-only human review log with justification checks.
  - `reports` table: immutable manifest store with SHA-256 hash checks and foreign key constraints.
  - `review_finding(p_finding_id, p_action, p_comment)`: RPC enforcing role authorization and state transitions (`open` -> `acknowledged`, `resolved`, `dismissed`; `reopened` -> `open`).
- Worker Reporting Engine (`worker/carbonflow/report/`):
  - `manifest.py`: canonical JSON serialization, SHA-256 content hashing, verification readiness determination (`BLOCKED`, `ACTION_REQUIRED`, `READY_FOR_VERIFICATION`).
  - `markdown_report.py`: formatted preflight report with executive summary, findings register, citations, and legal disclaimer.
  - `csv_workbook.py`: findings and reconciliation CSV workbook.
  - `pack.py`: bundled evidence zip (`manifest.json`, `manifest.sha256`, `preflight_report.md`, `findings_workbook.csv`).
- OpenRouter & NVIDIA Nemotron Integration (`worker/carbonflow/extract/openrouter_provider.py`):
  - Structured extraction using `nvidia/nemotron-3-ultra-550b-a55b` with JSON schema validation and retry backoff.
- Web Application Server Actions & UI:
  - `reviewFindingAction` & `requestRunAction` in `web/app/(app)/actions.ts`.
  - Next.js API route `/api/reports/download` supporting markdown, CSV, JSON, and ZIP bundle downloads.
  - Interactive `FindingsList.tsx` with one-click Acknowledge, Resolve/Dismiss justification prompts, and Reopen flow.
  - Live `ReportView.tsx` with verification readiness badge, document digests, and instant package downloads.
- Automated Test Suites:
  - 80 Vitest database and report export tests passing.
  - 143 Python worker tests passing.
