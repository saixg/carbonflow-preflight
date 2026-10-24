# CarbonFlow Preflight — Implementation Plan for Claude Code

## 1. Your role and objective

Act as the lead full-stack engineer and technical architect for **CarbonFlow Preflight**, an AI-assisted carbon project MRV (Measurement, Reporting and Verification) quality-control platform.

Your job is to inspect the existing `climateG` codebase, understand its current architecture, and implement the product incrementally without breaking existing functionality.

**Do not start by rewriting the project or creating every planned feature at once.** First establish what already exists, identify gaps, and build a tested end-to-end MVP.

### Existing project context

- Project name: `climateG`
- Local project directory: `C:\Users\saigi\climateG`
- Supabase project reference: `vgdpojpevcgpxxnfwoed`
- Product: CarbonFlow Preflight
- Primary users: carbon project developers, MRV consultants, sustainability teams, and carbon project operators.
- Initial market focus: Indian carbon projects, subject to validation of the first applicable methodology and target customer workflow.

Inspect the repository before assuming the frontend framework, package manager, directory structure, existing database schema, authentication implementation, or deployment setup.

Preserve existing working code and follow the conventions already established in the repository unless there is a clear reason to change them.

---

## 2. Product definition

### The problem

Preparing carbon projects for independent verification involves collecting documents, reconciling monitoring data, checking calculations, tracking evidence, and identifying missing or inconsistent information.

These tasks can create avoidable manual work, repeated corrections, delays, and verification preparation costs.

### The solution

CarbonFlow Preflight helps a project team identify documentation gaps, inconsistent values, calculation errors, missing evidence, and other potential issues before submitting its monitoring documentation for independent verification.

The platform should:

1. Organize projects and monitoring periods.
2. Securely ingest source documents and supporting evidence.
3. Extract structured data with traceable references to the source.
4. Validate required fields, units, dates, calculations, and cross-document consistency.
5. Run versioned, methodology-specific deterministic rules.
6. Generate findings with severity, supporting evidence, and suggested corrective actions.
7. Allow users to review, correct, resolve, or accept findings with an audit trail.
8. Generate a report and evidence package that a human reviewer can inspect.

### Product promise

**Find potential MRV problems earlier, with evidence for every finding.**

Do not claim quantified cost savings or guaranteed verification success before these outcomes have been measured in a real pilot.

### Important product boundary

This is a **pre-verification preparedness tool, not a certification or verification authority**.

The platform must not claim that a project is certified, compliant, or guaranteed to receive credits. Authorized independent verifiers remain responsible for verification decisions.

---

## 3. Core engineering principles

These principles apply to every phase.

### 3.1 Deterministic logic is authoritative

Use conventional, tested software for:

- Emissions and energy calculations.
- Unit conversions.
- Formula evaluation.
- Thresholds and tolerances.
- Date and monitoring-period validation.
- Completeness checks.
- Cross-document reconciliation.
- Rule execution.
- Finding severity derived from approved rule definitions.

The LLM may extract, classify, map, summarize, explain, and draft recommendations. It must not independently decide whether a project complies with a methodology.

### 3.2 Every extracted value must be traceable

For each extracted material value, retain, where available:

- Original document ID and SHA-256 hash.
- Page number.
- Source text or table location.
- Bounding box or character offsets, depending on extraction format.
- Original extracted value and normalized value.
- Unit and applicable monitoring period.
- Extraction method, model/version, and timestamp.
- Confidence or review status.
- Human correction history.

Do not silently convert an uncertain extraction into a verified fact.

### 3.3 Make uncertainty visible

If a value cannot be reliably extracted, its source is ambiguous, or two documents disagree, create a review task or finding.

Never invent a missing value or silently select between conflicting values.

### 3.4 Version everything that affects results

Record the versions or immutable identifiers of:

- Methodology and methodology version.
- Rulepack and rules.
- Calculation engine.
- Extraction schema.
- Relevant prompts and model version.
- Source document hashes.
- Run configuration.

A historical run must remain reproducible or clearly document why exact reproduction is not possible.

### 3.5 Security before convenience

Use tenant isolation, least privilege, private storage, validated inputs, and audited actions from the first implementation.

Do not place service-role credentials or LLM provider secrets in browser code.

---

## 4. MVP scope

Build the smallest useful product that demonstrates a complete, trustworthy workflow.

### Included in the first MVP

- Organization-aware authentication and access control.
- Project creation and project listing.
- Monitoring-period creation.
- Document upload to private storage.
- Content hashing and immutable document records.
- Document processing status and error reporting.
- Extraction of a small, defined set of fields.
- Source references for extracted values.
- A versioned deterministic rules engine.
- Initial validation and reconciliation findings.
- Findings list with severity, explanation, and source evidence.
- Human review and finding-resolution workflow.
- A basic preflight report.
- Audit events for important actions.
- Automated tests for core calculations, rules, tenant isolation, and evidence traceability.

### Explicitly out of scope for the first MVP

Do not implement these until the core workflow works:

- Blockchain-based audit infrastructure.
- Marketplace or carbon-credit trading.
- Automated certification or registry submissions.
- Multiple methodology families.
- Autonomous agents that approve findings.
- Complex vector search or RAG unless a demonstrated requirement justifies it.
- Numerous external integrations.
- Enterprise SSO and advanced billing.
- Sophisticated predictive readiness scoring.
- A claim that an AI-generated readiness percentage predicts verification success.

Design the core so that future capabilities can be added without requiring them now.

---

## 5. Architecture

First inspect the existing repository and reuse its current stack where practical. The following is the target architecture, not permission to replace working infrastructure unnecessarily.

### Frontend

Preferred: existing frontend framework; if starting from scratch, use Next.js with TypeScript.

Responsibilities:

- Authentication and organization context.
- Project and monitoring-period management.
- Document upload and processing status.
- Extracted-value review.
- Findings and evidence viewer.
- Finding resolution.
- Report generation and download.

Use schema validation for form inputs and typed API responses.

### Supabase

Use Supabase for:

- PostgreSQL database.
- Authentication.
- Row Level Security.
- Private object storage.
- Database migrations.
- Database-backed project, evidence, rule, finding, and audit records.

Enable only database extensions that the implemented MVP actually needs. Do not add PostGIS or pgvector just because they are in the proposed future architecture.

### Processing worker

Preferred when document processing needs long-running tasks: a Python worker with FastAPI and a durable task queue.

Responsibilities:

- File validation and document extraction.
- Structured extraction and normalization.
- Source-reference validation.
- Deterministic rule execution.
- Reconciliation.
- Report generation.

For the initial slice, use the simplest reliable job mechanism compatible with the existing stack. Do not introduce Temporal, Celery, or another queue until the requirements and deployment environment justify it.

If the project already has a suitable worker, extend it instead of creating a second processing system.

### LLM integration

Implement a provider abstraction only if it can be kept small and useful.

Requirements:

- Structured output validated against a schema.
- Pinned model identifier where supported.
- Configurable timeout and retry limits.
- Error handling for malformed output.
- No secrets in logs.
- No unsupported claims of zero retention; verify provider terms and settings before making such claims.
- Human review when extraction confidence is inadequate.

The platform must still be able to run deterministic rules and display manually entered, source-linked values if the LLM provider is unavailable.

---

## 6. Data model

Inspect the existing schema before creating tables. Reuse compatible tables and write migrations only for genuine gaps.

The following logical entities are required. Their exact names may be adapted to the existing conventions.

### Organization and access

**orgs**
- id
- name
- created_at

**members**
- id
- org_id
- user_id
- role
- created_at

Define and enforce the supported roles. A user must not access another organization’s records merely by changing a URL or request parameter.

### Project and monitoring

**projects**
- id
- org_id
- name
- project_type
- methodology_id
- methodology_version
- status
- created_at
- updated_at

**monitoring_periods**
- id
- org_id
- project_id
- start_date
- end_date
- status
- created_at

Enforce valid date ranges and project ownership. Prevent overlapping periods where the business rules require it; define the scope and behavior before choosing a database constraint.

### Methodologies and rules

**methodologies**
- id
- code
- name
- version
- source_url
- source_hash, where feasible
- effective_date, if applicable
- status

**rulepacks**
- id
- methodology_id
- version
- status
- content_hash
- created_at

**rules**
- id
- rulepack_id
- rule_code
- category
- severity
- configuration
- enabled

Rules must be versioned and reviewed. Never execute arbitrary Python, SQL, or unrestricted code from a database rule definition.

### Documents and evidence

**documents**
- id
- org_id
- project_id
- monitoring_period_id
- storage_path
- sha256
- filename
- media_type
- size_bytes
- processing_status
- uploaded_by
- created_at

**evidence_refs**
- id
- org_id
- document_id
- page_number
- source_text
- locator
- source_hash
- created_at

Use a structured locator that can later support PDF bounding boxes, table cells, or character offsets.

Treat document content as immutable. A correction or replacement should create a new document version or record, not silently overwrite the original evidence.

### Parameters and values

**parameter_defs**
- id
- methodology_id
- parameter_code
- name
- data_type
- canonical_unit
- description

**parameter_values**
- id
- org_id
- project_id
- monitoring_period_id
- parameter_def_id
- original_value
- normalized_value
- unit
- source_type
- evidence_ref_id
- review_status
- created_at

A material extracted value must reference evidence. A manually asserted value must be explicitly marked as asserted, attributed to its author, and flagged for review under a defined rule.

Do not allow an evidence reference from one tenant to be attached to another tenant’s value.

### Claims and processing runs

**emission_claims**
- id
- org_id
- project_id
- monitoring_period_id
- metric_code
- value
- unit
- calculation_version
- input_snapshot
- created_at

**runs**
- id
- org_id
- project_id
- monitoring_period_id
- status
- methodology_version
- rulepack_version
- engine_version
- input_snapshot_hash
- started_at
- completed_at
- error_summary

Store enough immutable input information to explain how a result was produced.

### Findings and review

**findings**
- id
- org_id
- run_id
- rule_code
- finding_type
- severity
- status
- title
- explanation
- remediation
- evidence_refs
- created_at

Use controlled enums or validated values for finding type, severity, and status. Establish a clear mapping for CAR, CL, and FAR terminology only where it is appropriate to the chosen methodology or verification context. Do not label every software warning as a formal CAR.

**reviews**
- id
- org_id
- finding_id
- reviewer_id
- action
- comment
- created_at

### Audit trail

**audit_log**
- id
- org_id
- actor_id
- action
- entity_type
- entity_id
- metadata
- previous_hash, if hash chaining is implemented
- event_hash, if hash chaining is implemented
- created_at

For the MVP, first guarantee that important events are recorded and access-controlled. Add a hash chain only after defining canonical serialization, concurrency handling, key management, verification, and privileged-access limitations.

A hash chain alone does not make a database tamper-proof against a sufficiently privileged administrator.

---

## 7. Database security requirements

Implement and test these requirements before storing real customer documents.

1. Enable RLS on every tenant-owned table.
2. Use authenticated user identity and membership records to authorize access.
3. Enforce authorization in database policies, not only frontend code.
4. Verify nested relationships, including project, monitoring period, document, evidence reference, run, and finding.
5. Ensure storage objects are private and access is authorized.
6. Use short-lived signed URLs where appropriate.
7. Keep service-role and provider secrets on trusted server-side components only.
8. Validate file size, file type, and processing limits.
9. Treat uploaded documents and extracted text as untrusted input.
10. Prevent prompt injection in document contents from changing system behavior or executing tools.
11. Avoid logging full documents, credentials, or unnecessary personal information.
12. Test cross-tenant reads, writes, updates, deletes, and indirect references.

Before applying any migration to the existing remote Supabase project, inspect the current schema, review the migration diff, and obtain explicit approval. Do not reset the database or drop existing tables.

---

## 8. Methodology decision gate

Do not invent carbon accounting requirements or assume a methodology is suitable merely because it is familiar.

Candidate starting points include:

- A relevant methodology under India’s Carbon Credit Trading Scheme, potentially BM EN01.001 if applicable to the intended project and current official rules.
- UNFCCC AMS-I.D for grid-connected renewable electricity projects within its applicable scope.
- UNFCCC ACM0002 for grid-connected electricity generation from renewable sources within its applicable scope.

These are candidates, not a final selection.

### Before implementing methodology-specific rules

1. Identify the intended customer and project type.
2. Retrieve the current official methodology and relevant program requirements.
3. Record the exact document title, identifier, version, and source URL.
4. Confirm its applicability conditions and relevant monitoring requirements.
5. Collect publicly available monitoring reports, verification reports, and supporting documents.
6. Create a parameter inventory and a rule inventory.
7. Mark each rule as directly sourced, derived from an approved requirement, or an internal quality-control heuristic.
8. Have a domain expert review the interpretation before treating it as a methodology-specific requirement.

**Until this gate is complete, build a methodology-neutral engine and use clearly labeled test rules.** Do not market test rules as real compliance checks.

---

## 9. Implementation phases

Work through these phases sequentially. Each phase must have working code, tests, and a clear completion report.

### Phase 0 — Repository and environment audit

Tasks:

1. Inspect the project tree, package scripts, dependencies, frontend, backend, tests, and environment variable examples.
2. Inspect existing Supabase integration and migrations.
3. Determine whether authentication, storage, tables, and background processing already exist.
4. Identify broken builds, missing tests, and risky assumptions.
5. Document the current architecture and proposed minimal changes.
6. Check available development commands and the current git state.

Deliverables:

- `docs/architecture/current-state.md`
- `docs/implementation/implementation-plan.md`
- `docs/implementation/decisions.md`
- A list of blockers, risks, and assumptions.

Do not print secrets or copy `.env` values into documentation.

**Exit criteria:** The implementation approach fits the actual repository and preserves existing functionality.

### Phase 1 — Product foundation and secure project workflow

Tasks:

1. Implement or adapt organization membership and access control.
2. Implement project creation and listing.
3. Implement monitoring-period creation and validation.
4. Add required database migrations locally.
5. Add RLS policies and storage authorization.
6. Add tenant-isolation tests.
7. Build basic project and monitoring-period screens.
8. Add loading, error, and empty states.

Deliverable: an authenticated user can create a project and monitoring period and cannot access another organization’s data.

**Exit criteria:** Tests pass, access controls are verified, and no migration has been applied remotely without approval.

### Phase 2 — Immutable document ingestion

Tasks:

1. Build a document upload interface.
2. Validate file size, permitted formats, and project ownership.
3. Compute SHA-256 on a trusted server-side path.
4. Store files in a private bucket using a deterministic content-addressed path.
5. Record document metadata and processing status.
6. Handle duplicate content deliberately.
7. Preserve the original file and create new records for replacements.
8. Implement retries and clear processing failures.
9. Add an initial PDF text-extraction adapter and fixtures.

Do not rely on the object path alone to guarantee immutability. Configure storage permissions and database behavior explicitly.

Deliverable: users can upload a supported PDF, see its processing status, and inspect its metadata.

**Exit criteria:** Uploaded documents are private, hash-verified, associated with the correct project, and cannot be accessed across tenants.

### Phase 3 — Evidence-backed structured extraction

Tasks:

1. Define a small extraction schema for the selected workflow.
2. Extract a limited number of important fields from the source documents.
3. Retain page-level or finer-grained source references.
4. Validate the output against a strict schema.
5. Normalize numeric values and units without discarding the original value.
6. Mark ambiguous, missing, or conflicting values for human review.
7. Implement a review screen for accepting or correcting extracted values.
8. Store the extraction method and model version.
9. Add tests for incorrect pages, missing fields, unit ambiguity, and malformed model output.

A value is not trustworthy merely because a model returns a high confidence score. Verify that its cited source actually supports the extracted value.

Deliverable: a reviewer can see a value, its normalized representation, its unit, and the source passage or table from which it was extracted.

**Exit criteria:** All material values used in calculations are traceable, and uncertain values cannot silently pass into an authoritative calculation.

### Phase 4 — Deterministic rules and calculations

Tasks:

1. Define a typed rule interface and versioned rulepack format.
2. Implement a small, allowlisted rule engine.
3. Support completeness, unit validation, date validation, calculation, and cross-document consistency checks.
4. Use `Decimal` for financial or high-precision decimal arithmetic where appropriate.
5. Use explicit unit conversions and dimensional checks, for example with Pint in Python if the worker uses Python.
6. Record rule inputs, outputs, versions, and relevant evidence.
7. Implement deterministic test fixtures with known expected outcomes.
8. Add clear error handling for missing or invalid inputs.

Avoid a generic, unrestricted expression evaluator. Rules should use typed operators and a limited, reviewed set of functions.

Deliverable: a user can run a preflight check and receive reproducible findings from a defined input snapshot.

**Exit criteria:** Repeated runs on the same frozen inputs, rulepack, and engine version produce the same results.

### Phase 5 — Findings and human review

Tasks:

1. Display findings by project, monitoring period, and run.
2. Show severity, rule code, explanation, evidence, and suggested remediation.
3. Distinguish blocking data-quality issues from material warnings and minor issues.
4. Support review actions such as open, acknowledged, resolved, or dismissed, with documented semantics.
5. Require a comment or justification for appropriate review decisions.
6. Preserve previous findings and review history.
7. Allow rerunning checks against corrected inputs without erasing the original run.
8. Use the LLM only to draft explanations and remediation suggestions grounded in rule output and evidence.

Deliverable: a project team can investigate findings, make corrections, and see the resulting change in a new run.

**Exit criteria:** Every finding can be traced to a rule, input snapshot, and supporting evidence; human decisions are auditable.

### Phase 6 — Preflight report and evidence package

Tasks:

1. Generate a report containing project and monitoring-period metadata.
2. Record methodology and rulepack versions.
3. Summarize completed checks, outstanding issues, and unresolved reviews.
4. Include source references for material findings.
5. Export a machine-readable findings file.
6. Generate an evidence manifest containing document identifiers and SHA-256 hashes.
7. Ensure reports identify the exact run and input snapshot.
8. Include a clear disclaimer that the output is a preparedness assessment, not certification.
9. Add tests for report completeness, access control, and reproducibility.

Potential outputs:

- Preflight Report (PDF).
- Findings and Reconciliation Workbook (CSV initially; spreadsheet later if justified).
- Evidence Manifest (JSON).
- Evidence Package (ZIP), subject to private storage and download authorization.

Deliverable: a user can download a traceable report that matches the completed run.

**Exit criteria:** The report never presents unresolved or unverified data as confirmed facts and identifies the limitations of the assessment.

### Phase 7 — Evaluation and pilot readiness

Tasks:

1. Build a golden test corpus from permitted public or properly authorized project documents.
2. Record expected values, known issues, source locations, and the basis for each expected result.
3. Include corrupted files, scanned PDFs, unit swaps, date shifts, missing evidence, and conflicting values.
4. Measure extraction precision on a defined field-level basis.
5. Measure false positives and recall for independently labeled issues where the dataset supports those metrics.
6. Measure time to first finding and end-to-end preparation time.
7. Add regression tests for methodology and rulepack changes.
8. Run security checks, tenant-isolation tests, and dependency checks.
9. Pilot with a small number of users before adding integrations or expanding methodologies.

Do not claim that public verification reports alone establish a complete golden dataset. Their contents may not disclose every expected input, calculation, or finding.

**Exit criteria:** The team can show measured accuracy, known limitations, reproducible results, and a documented pilot evaluation.

---

## 10. Initial UI routes

Adapt these to the existing routing system.

- `/dashboard` — project overview.
- `/projects/new` — create a project.
- `/projects/[projectId]` — project overview.
- `/projects/[projectId]/periods/[periodId]` — monitoring period.
- `/projects/[projectId]/documents` — document upload and document list.
- `/projects/[projectId]/evidence` — extracted values and evidence review.
- `/projects/[projectId]/runs` — preflight runs.
- `/runs/[runId]` — run summary and findings.
- `/findings/[findingId]` — finding details, evidence, and review history.
- `/runs/[runId]/report` — report preview and authorized export.

Do not build all routes as empty placeholders. Implement only the routes needed for the current vertical slice.

---

## 11. Testing and quality requirements

### Unit tests

Cover:

- Unit conversions.
- Decimal calculations.
- Date and monitoring-period validation.
- Rule evaluation.
- Severity mapping.
- Evidence-reference validation.
- Hash calculation.
- Finding lifecycle and status transitions.

### Integration tests

Cover:

- Authentication and membership authorization.
- Database constraints and RLS.
- Private document upload and download.
- Document processing failures and retries.
- Extraction schema validation.
- Rule execution and frozen run snapshots.
- Report generation and export authorization.

### Security tests

Include attempts to:

- Read another organization’s project.
- Attach another tenant’s evidence reference.
- Download an unauthorized storage object.
- Change project IDs in requests.
- Alter a completed run.
- Upload a malicious or oversized file.
- Inject instructions into a source document.
- Trigger unauthorized processing or export.

### Quality gates

- No unreviewed remote database migrations.
- No secrets committed to the repository.
- No material calculated value without traceable inputs.
- No LLM-generated compliance verdict.
- No silent fallback from extraction failure to invented data.
- No regression in existing application functionality.
- All newly implemented behavior has automated tests appropriate to its risk.

---

## 12. Definition of done for the first end-to-end MVP

The first MVP is complete only when this workflow works:

1. A user signs in.
2. The user creates a project and monitoring period.
3. The user uploads a PDF document.
4. The system stores it privately and calculates its SHA-256 hash.
5. The system extracts a small, defined set of values.
6. The interface shows each extracted value alongside its source evidence.
7. The user can correct or approve extracted values.
8. The user starts a preflight run.
9. The deterministic engine executes the applicable, versioned rules.
10. The interface displays findings with severity, explanation, and evidence.
11. The user can review and resolve findings without deleting the historical record.
12. The user generates a report tied to the exact run.
13. Another organization cannot access any of the project’s data.
14. Automated tests demonstrate these properties.

If the chosen methodology has not been approved, use clearly labeled synthetic fixtures and test rules. Do not present those results as real methodology-specific assessments.

---

## 13. Development workflow and guardrails

Follow this sequence:

1. Inspect the repository and current git status.
2. Summarize the existing architecture and the smallest safe implementation path.
3. Identify any decisions that block real methodology-specific development.
4. Create or update the implementation documentation.
5. Implement one small vertical slice at a time.
6. Run relevant tests after each meaningful change.
7. Review database migrations and security implications before proposing remote changes.
8. Summarize changed files, commands run, tests passed, failures, and next steps.

Additional requirements:

- Use the existing package manager and linting conventions.
- Keep environment variables documented in an example file without real secrets.
- Never reset the existing Supabase project as a shortcut.
- Never apply migrations to the remote Supabase database without explicit authorization.
- Never delete existing user data or replace existing schema wholesale.
- Prefer additive, reversible migrations.
- Do not install a new dependency without explaining why it is needed.
- If an existing implementation conflicts with this plan, explain the conflict and propose the smallest safe adaptation.
- If a requirement is ambiguous, implement only the safe, methodology-neutral portion and record the unresolved decision.

---

## 14. First assignment to execute now

Start with **Phase 0 and then the smallest safe portion of Phase 1**.

First inspect the current project. Do not assume it is a blank repository.

Then:

1. Report the actual frontend, backend, database, authentication, storage, test setup, and migration state.
2. Identify what can be reused.
3. List the five highest-priority implementation risks.
4. Propose the minimum files and additive migrations needed for the first vertical slice.
5. Implement the first slice in the local repository, including tests, if the existing architecture and available environment permit it.
6. Do not change the remote Supabase schema or data.
7. Run the relevant checks and report their actual results.
8. Stop at a meaningful review point rather than generating the entire product in one pass.

The first development milestone should establish a secure project and monitoring-period workflow, with a tested data model and access controls. Next, add immutable document ingestion, followed by evidence-backed extraction and deterministic validation.

Do not begin by enabling every extension, implementing a generic AI agent, or creating the entire proposed schema without inspecting the current project.

## Final instruction

Optimize for **correctness, evidence traceability, tenant security, and a working end-to-end workflow** rather than feature count.

The product’s credibility depends on being able to explain where a value came from, which rule evaluated it, what the result means, and what a human still needs to review.
