# CarbonFlow Preflight — Product Context, GitHub Pipeline Selection, and Implementation Strategy

## 1. Product mission

We are building **CarbonFlow Preflight**, an evidence-first, AI-assisted MRV (Measurement, Reporting and Verification) quality-control platform for carbon project developers and MRV consultants.

The product helps teams prepare carbon project monitoring documentation for independent verification by identifying:

- Missing or unsupported evidence.
- Inconsistent values across documents.
- Unit conversion and calculation errors.
- Monitoring-period and date inconsistencies.
- Missing monitoring data.
- Potential double counting or duplicate claims where the available data supports the check.
- Other issues defined by approved, versioned methodology rules.

The product generates findings linked to their sources, provides suggested remediation, supports human review, and produces a reproducible preflight report and evidence package.

**Product boundary:** This is a preparedness assessment, not certification. Never claim that a project is compliant, certified, or guaranteed to receive credits solely because the software reports no findings.

## 2. The fundamental invariant

A material value must not enter an authoritative calculation unless:

1. It is linked to the original source document.
2. The original document has a verified SHA-256 hash.
3. The source locator points to actual parsed content.
4. The source supports the specific parameter, value, unit, and monitoring period.
5. The value has been normalized and validated by deterministic code.
6. The applicable acceptance or human-review requirements have been satisfied.

A model-generated quotation is not proof of evidence. A second LLM pass is not proof of correctness.

The calculation engine, not the LLM, determines calculation outcomes and rule findings.

## 3. Existing implementation to inspect first

The current project is reported to contain:

- A Next.js and React frontend.
- A Python document-processing worker.
- Supabase PostgreSQL migrations and private storage policies.
- PDF, XLSX, and CSV parsing.
- Page, cell, and bounding-box source locators.
- Number, date, and unit parsing.
- Evidence-linked parameter values.
- A fixed-operation deterministic rule engine.
- OpenAI extraction behind an interface, tested with mocks.
- Immutable-run and finding infrastructure.
- A TEST ONLY rulepack.
- A database-backed processing queue.

Treat all these items as reported claims until you verify the actual repository, test results, and runtime behavior.

Do not rewrite the system or replace its parsers before understanding their current behavior.

## 4. Architecture decision: hybrid, not fully custom

We will reuse mature open-source document-processing components where they demonstrably improve results. We will build and own the evidence-control layer, carbon-MRV rule engine, review workflow, run snapshots, and evaluation harness.

We will not train our own LLM in the MVP.

We will not adopt a generic AI-agent or carbon-credit repository as the entire product.

We will not install every library listed below. The repositories are candidates to evaluate, not dependencies already approved for production.

## 5. Specific GitHub repositories to evaluate

### A. Primary PDF/document parsing candidate: Docling

Repository: https://github.com/docling-project/docling

Evaluate Docling for:

- PDF text extraction and reading order.
- Document layout.
- Table reconstruction.
- Structured document output.
- Source-location retention.
- Local processing and deployment.
- Scanned-document handling.

Docling is a strong first candidate because it supports multiple document formats and layout-aware PDF processing and is MIT-licensed at the core repository level. Check model and dependency licenses separately.

**Decision rule:** Benchmark Docling against the existing parser. Do not replace the current implementation until the benchmark demonstrates better or acceptably equivalent accuracy, traceability, resource usage, and maintainability.

### B. OCR fallback candidate: PaddleOCR

Repository: https://github.com/PaddlePaddle/PaddleOCR

Evaluate PaddleOCR only for cases where existing extraction and Docling cannot adequately process:

- Scanned PDFs.
- Image-only pages.
- Poor-quality scans.
- Tables or page regions requiring OCR and layout recognition.

Measure numeric accuracy, date accuracy, unit preservation, table-cell association, and locator quality.

Do not make OCR mandatory for every PDF if the file already has a usable text layer. Do not assume OCR confidence is the same as correctness.

Check the license of the selected repository release, model weights, and dependencies.

### C. Optional OCR preprocessing candidate: OCRmyPDF

Repository: https://github.com/ocrmypdf/OCRmyPDF

Evaluate OCRmyPDF as a preprocessing tool that can add a searchable text layer to scanned PDFs, correct rotation, and deskew pages.

It is not a replacement for our evidence model or rule engine.

Check its MPL-2.0 license and any bundled component licenses. Use it only if the evaluation demonstrates a benefit over the direct OCR path.

### D. Alternative document-processing candidate: Unstructured

Repository: https://github.com/Unstructured-IO/unstructured

Treat Unstructured as an alternative benchmark candidate if Docling performs poorly on our actual document corpus or if its document partitioning and ingestion features provide a concrete advantage.

Do not integrate both Docling and Unstructured into production by default. Two overlapping parsers create more maintenance, configuration, and disagreement-handling work.

Choose one primary parser based on measured performance.

### E. Optional alternative PDF pipeline: Marker

Repository: https://github.com/datalab-to/marker

Evaluate Marker only if the benchmark shows a meaningful advantage for difficult PDFs, equations, or tables that the primary parser cannot handle.

Inspect its current license and commercial-use terms carefully, including any model or deployment restrictions. Do not assume that all components have the same license.

Do not add Marker merely because it produces attractive Markdown or has a popular GitHub repository.

## 6. Keep the existing spreadsheet parsers initially

For XLSX and CSV files, retain the existing native parser unless tests reveal a clear deficiency.

Spreadsheet processing must preserve:

- Workbook and sheet names.
- Exact cell coordinates.
- Original cell values.
- Formula text and cached values where available.
- Units and date formats.
- Numeric precision.
- Row and column relationships.
- Relevant hidden rows or sheets when needed for interpretation.

Do not flatten spreadsheets into generic text and discard cell provenance. Do not silently treat a formula's cached result as a freshly recalculated result.

A spreadsheet value must remain traceable to its exact workbook, sheet, cell, and relevant formula context.

## 7. Our custom pipeline A: ingestion and parsing

Implement and verify this workflow:

Original upload
→ file type and size validation
→ SHA-256 hash
→ immutable original stored privately
→ document parser selected
→ structured parse output
→ validated page, block, table, or cell locators
→ persisted parsed content and processing status.

Requirements:

- Never overwrite the original document.
- Treat files as untrusted input.
- Restrict parser resource consumption.
- Handle timeouts, malformed files, and processing failures.
- Record parser name, version, configuration, and output hash.
- Make processing idempotent where appropriate.
- Retain enough source information to inspect the original evidence.
- Keep original and derived files distinct.

## 8. Our custom pipeline B: extraction and evidence validation

Use OpenAI through the existing provider abstraction to extract candidate fields from bounded, relevant source content.

Require structured output validated against a strict schema.

For each candidate, retain:

- Parameter identifier.
- Original extracted value.
- Unit.
- Monitoring period.
- Document identifier and hash.
- Page, cell, or bounding-box locator.
- Supporting source text or table context.
- Extraction model and schema version.
- Confidence and review status.
- Human correction or acceptance history.

Implement deterministic validation that checks the quotation against actual parser output. Verify the locator and its association with the original document.

The LLM may propose a field mapping, but it must not independently approve a value for use in calculations.

When evidence is ambiguous, missing, contradictory, or incorrectly located, require human review.

Keep the pipeline functional when the LLM is unavailable. Manual entry must still require a clear assertion status, attribution, and review policy.

## 9. Our custom pipeline C: deterministic carbon-MRV rules

Retain and improve the existing fixed-operation rule engine.

The rule engine must:

- Accept only explicitly authorized input types and operations.
- Use decimal-safe arithmetic where appropriate.
- Validate units and dimensions.
- Validate monitoring-period boundaries.
- Support versioned methodology and rulepacks.
- Record rule inputs and outputs.
- Link findings to supporting evidence.
- Freeze the run's input snapshot.
- Produce reproducible results.
- Reject missing, unapproved, or unsupported calculation inputs.

Do not execute arbitrary Python, SQL, or unrestricted expressions from rulepack data.

The LLM may explain a rule finding using its recorded output and evidence. It may not create a compliance verdict independent of deterministic rules.

## 10. Our custom pipeline D: evaluation and regression

Build an evaluation harness rather than trusting successful builds or mocked provider tests.

Use authorized, representative documents and manually reviewed expected results.

Measure:

- Numeric field extraction precision.
- Source-locator accuracy.
- Parameter-mapping correctness.
- Unit and date preservation.
- Table row/column association.
- Calculation correctness.
- Rule false-positive rate.
- Issue recall where ground-truth labels exist.
- Processing latency and resource cost.
- Failure and retry behavior.

Keep synthetic fixtures separate from real-document evaluation results.

Run regression tests when changing the parser, extraction model, prompt, schema, rulepack, or calculation engine.

Do not claim 95% accuracy until the field-level denominator, labeling method, test corpus, and observed results are documented.

## 11. Methodology decision

BM EN01.001 remains the candidate starting methodology. Do not implement production methodology-specific rules until:

1. The applicable official methodology and program requirements have been sourced.
2. The exact version and applicability conditions are recorded.
3. The parameter and monitoring requirements have been inventoried.
4. Proposed rules are traceable to authoritative source passages.
5. Relevant interpretations have been reviewed by a qualified carbon-MRV expert.
6. The rulepack has deterministic tests and a documented approval status.

Until then, use only explicitly labeled TEST ONLY rules.

Do not silently convert an internal quality-control heuristic into an official methodology requirement.

## 12. Required parser benchmark

Before installing or replacing a parser, build a reproducible benchmark using a small representative document set.

Include:

- Text-based monitoring PDFs.
- PDFs with tables.
- Scanned or low-quality PDFs, if representative of the intended customer workflow.
- XLSX monitoring workbooks.
- CSV exports.

For each document, manually label a set of important values and their true locations.

Compare the current parser with Docling. Evaluate OCRmyPDF and PaddleOCR on scan-specific cases. Add Unstructured or Marker only if there is an unresolved performance gap.

Produce a report with:

- Document and field counts.
- Numeric extraction accuracy.
- Locator accuracy.
- Table-structure accuracy.
- Unit and date preservation.
- Runtime and memory use.
- Failure rates.
- License and dependency risks.
- Integration complexity.
- A justified recommendation.

Do not compare parsers solely on the quality of their Markdown output.

## 13. Integration and dependency rules

- Inspect repository documentation and license files for each selected project.
- Pin dependencies and document the chosen versions.
- Review model-weight and third-party dependency licenses separately.
- Keep parsers behind an interface so the implementation can change without modifying the MRV rules.
- Avoid adding multiple overlapping parsers without measured justification.
- Avoid introducing new queue systems, vector databases, agent frameworks, or training pipelines unless a concrete requirement supports them.
- Keep remote Supabase unchanged during this evaluation.
- Do not overwrite uncommitted work.
- Do not push commits or deploy without explicit approval.
- Do not expose credentials or request that secrets be pasted into chat.

## 14. Required deliverables

Create a proposed pipeline decision document containing:

1. Verified current architecture.
2. Current parser behavior and test coverage.
3. Candidate GitHub repositories and their roles.
4. License and dependency review.
5. Benchmark methodology and results.
6. Recommended primary parser and any justified OCR fallback.
7. Custom versus reused component boundaries.
8. Integration changes and risks.
9. Required security and regression tests.
10. Explicit items that remain unverified.

Begin with a read-only audit. Then implement only the benchmark in a safe local environment after preserving existing work.

Do not begin by installing every candidate or rewriting the backend.

## Final product principle

CarbonFlow Preflight is not simply a PDF-to-LLM application.

It is an evidence-controlled, deterministic MRV validation system that uses AI as an assistant. Our differentiating value is the integrity of the chain from original document to accepted value, rule execution, finding, and reproducible report.

Optimize for correctness, source traceability, reproducibility, security, and customer usefulness—not the number of AI models or GitHub repositories integrated.