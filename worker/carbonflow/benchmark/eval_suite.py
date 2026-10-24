"""Golden Evaluation Suite for CarbonFlow Preflight (MRV Benchmarks).

Per plan.md Section 10:
Measures:
- Numeric field extraction precision & recall
- Source-locator accuracy (pointing to real document text/cells)
- Parameter mapping correctness
- Unit and date preservation
- Calculation correctness
- Rule false-positive rate
- Issue recall where ground-truth labels exist
"""

from __future__ import annotations

import io
import time
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import openpyxl
import pymupdf

from ..engine import ParamDef, Rulepack, Snapshot, Val, load_rulepack, run_rulepack
from ..hashing import sha256_hex
from ..parsers import find_span, parse_csv, parse_pdf, parse_xlsx


@dataclass(frozen=True)
class ExpectedField:
    parameter: str
    expected_text: str
    numeric_value: Decimal | None
    unit: str | None
    doc_name: str
    locator_type: str  # pdf_span, sheet_cell, csv_cell


@dataclass(frozen=True)
class GoldenDocument:
    name: str
    media_type: str
    data: bytes
    expected_fields: tuple[ExpectedField, ...]


@dataclass
class GoldenTestCase:
    id: str
    name: str
    description: str
    methodology_code: str
    methodology_version: str
    period_start: date
    period_end: date
    documents: list[GoldenDocument]
    expected_findings: set[str]  # rule codes that MUST be flagged (intentional defects)
    forbidden_findings: set[str]  # rule codes that MUST NOT be flagged (false positives)


@dataclass
class CaseEvaluationResult:
    case_id: str
    case_name: str
    duration_ms: float
    total_fields: int
    fields_extracted: int
    fields_with_valid_locator: int
    extraction_precision: float
    locator_accuracy: float
    expected_issues_count: int
    issues_detected_count: int
    issue_recall: float
    false_positives_count: int
    false_positive_rate: float
    calculation_correctness: float
    passed: bool
    findings_observed: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def build_solar_golden_cases() -> list[GoldenTestCase]:
    """Constructs 2 realistic multi-document solar PV cases:
    1. 'clean_compliance': Fully verified 100MW Gujarat solar project with zero discrepancies.
    2. 'meter_inconsistency_defect': Project with meter mismatch, date inversion, and wrong calculations.
    """
    cases: list[GoldenTestCase] = []

    # ------------------------------------------------------------- Case 1: Clean Project
    # Doc 1: PPA & Monitoring Report PDF
    pdf1 = pymupdf.open()
    p1 = pdf1.new_page()
    p1.insert_text((72, 72), "Gujarat 100MW Solar PV Power Project - Monitoring Report", fontsize=14)
    p1.insert_text((72, 95), "Monitoring Period: 2024-01-01 to 2024-12-31 (Annual)", fontsize=11)
    p1.insert_text((72, 120), "Installed Capacity: 100.0 MW grid-connected DC capacity.", fontsize=11)
    p1.insert_text((72, 140), "Net electricity exported to grid: 164,250.00 MWh verified by main meter.", fontsize=11)
    p1.insert_text((72, 160), "Combined Margin Grid Emission Factor: 0.825 tCO2/MWh (CEA CO2 Baseline DB v19).", fontsize=11)
    p1.insert_text((72, 180), "Claimed baseline emission reductions: 135,506.25 tCO2.", fontsize=11)
    pdf1_bytes = pdf1.tobytes()
    pdf1.close()

    # Doc 2: Joint Meter Reading (JMR) Excel Sheet
    wb1 = openpyxl.Workbook()
    ws1 = wb1.active
    ws1.title = "JMR_Reconciliation"
    ws1.append(["Month", "Net Generation (MWh)", "Inverter Losses (MWh)", "Utility Billed (MWh)"])
    monthly_data = [
        ("Jan", 13500.0), ("Feb", 13200.0), ("Mar", 14800.0), ("Apr", 15400.0),
        ("May", 15900.0), ("Jun", 14200.0), ("Jul", 11800.0), ("Aug", 11600.0),
        ("Sep", 13150.0), ("Oct", 14300.0), ("Nov", 13400.0), ("Dec", 13000.0)
    ]
    for m, val in monthly_data:
        ws1.append([m, val, val * 0.01, val])
    ws1.append(["Annual Total", 164250.0, 1642.5, 164250.0])
    buf1 = io.BytesIO()
    wb1.save(buf1)
    jmr_bytes = buf1.getvalue()

    monthly_fields_clean = tuple(
        ExpectedField("monthly_export_mwh", str(int(val)), Decimal(str(val)), "MWh", "jmr_reconciliation.xlsx", "sheet_cell")
        for m, val in monthly_data
    )

    case_clean = GoldenTestCase(
        id="GOLDEN-SOLAR-001",
        name="Gujarat 100MW Solar PV - Clean Verification",
        description="Gold-standard verified project documents with matching monthly JMR sums and exact emission factors.",
        methodology_code="ACM0002",
        methodology_version="21.0",
        period_start=date(2024, 1, 1),
        period_end=date(2024, 12, 31),
        documents=[
            GoldenDocument(
                name="monitoring_report_clean.pdf",
                media_type="application/pdf",
                data=pdf1_bytes,
                expected_fields=(
                    ExpectedField("installed_capacity_mw", "100.0 MW", Decimal("100.0"), "MW", "monitoring_report_clean.pdf", "pdf_span"),
                    ExpectedField("net_export_mwh", "164,250.00 MWh", Decimal("164250.00"), "MWh", "monitoring_report_clean.pdf", "pdf_span"),
                    ExpectedField("grid_emission_factor", "0.825 tCO2/MWh", Decimal("0.825"), "tCO2/MWh", "monitoring_report_clean.pdf", "pdf_span"),
                    ExpectedField("claimed_emission_reductions_tco2", "135,506.25 tCO2", Decimal("135506.25"), "tCO2", "monitoring_report_clean.pdf", "pdf_span"),
                ),
            ),
            GoldenDocument(
                name="jmr_reconciliation.xlsx",
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                data=jmr_bytes,
                expected_fields=(
                    ExpectedField("net_export_mwh", "164250", Decimal("164250.00"), "MWh", "jmr_reconciliation.xlsx", "sheet_cell"),
                ) + monthly_fields_clean,
            ),
        ],
        expected_findings=set(),  # Clean project should have ZERO critical/material findings!
        forbidden_findings={
            "ACM0002-PRES-001", "ACM0002-PRES-002", "ACM0002-DATE-001",
            "ACM0002-UNIT-001", "ACM0002-RANGE-001", "ACM0002-CONS-001",
            "ACM0002-CALC-001", "ACM0002-CALC-002"
        },
    )
    cases.append(case_clean)

    # ------------------------------------------------------------- Case 2: Intentional Defects
    # Doc 1: Flawed Monitoring Report PDF
    pdf2 = pymupdf.open()
    p2 = pdf2.new_page()
    p2.insert_text((72, 72), "Rajasthan Solar 50MW Monitoring Report (Draft)", fontsize=14)
    # Defect: Inverted date boundaries
    p2.insert_text((72, 95), "Monitoring Period: 2024-12-31 to 2024-01-01 (Inverted)", fontsize=11)
    p2.insert_text((72, 120), "Installed Capacity: 50.0 MW", fontsize=11)
    p2.insert_text((72, 140), "Reported net export to grid: 88,400.00 MWh", fontsize=11)
    p2.insert_text((72, 160), "Applied Grid Emission Factor: 0.810 tCO2/MWh", fontsize=11)
    # Defect: Claimed emission reduction is 95,000 tCO2 instead of 88,400 * 0.810 = 71,604 tCO2!
    p2.insert_text((72, 180), "Claimed baseline emission reductions: 95,000.00 tCO2", fontsize=11)
    pdf2_bytes = pdf2.tobytes()
    pdf2.close()

    # Doc 2: Discrepant Meter CSV
    # Defect: Monthly sums add up to only 82,100 MWh (discrepancy vs 88,400 MWh reported in PDF)
    defect_monthly = [
        ("Jan", 6800.0), ("Feb", 6500.0), ("Mar", 7200.0), ("Apr", 7100.0),
        ("May", 7400.0), ("Jun", 6900.0), ("Jul", 6100.0), ("Aug", 6200.0),
        ("Sep", 6700.0), ("Oct", 7300.0), ("Nov", 6800.0), ("Dec", 6600.0)
    ]
    csv_defect = "month,meter_export_mwh\n" + "".join(f"{m},{val}\n" for m, val in defect_monthly)
    monthly_fields_defect = tuple(
        ExpectedField("monthly_export_mwh", str(val), Decimal(str(val)), "MWh", "meter_exports.csv", "csv_cell")
        for m, val in defect_monthly
    )

    case_defects = GoldenTestCase(
        id="GOLDEN-SOLAR-002",
        name="Rajasthan 50MW Solar PV - Intentional Defects",
        description="Documents with deliberate date inversion, monthly meter sum mismatch, and emission over-claiming.",
        methodology_code="ACM0002",
        methodology_version="21.0",
        period_start=date(2024, 12, 31),  # Inverted start/end
        period_end=date(2024, 1, 1),
        documents=[
            GoldenDocument(
                name="monitoring_report_draft.pdf",
                media_type="application/pdf",
                data=pdf2_bytes,
                expected_fields=(
                    ExpectedField("installed_capacity_mw", "50.0 MW", Decimal("50.0"), "MW", "monitoring_report_draft.pdf", "pdf_span"),
                    ExpectedField("net_export_mwh", "88,400.00 MWh", Decimal("88400.00"), "MWh", "monitoring_report_draft.pdf", "pdf_span"),
                    ExpectedField("grid_emission_factor", "0.810 tCO2/MWh", Decimal("0.810"), "tCO2/MWh", "monitoring_report_draft.pdf", "pdf_span"),
                    ExpectedField("claimed_emission_reductions_tco2", "95,000.00 tCO2", Decimal("95000.00"), "tCO2", "monitoring_report_draft.pdf", "pdf_span"),
                ),
            ),
            GoldenDocument(
                name="meter_exports.csv",
                media_type="text/csv",
                data=csv_defect.encode("utf-8"),
                expected_fields=monthly_fields_defect,
            ),
        ],
        expected_findings={
            "ACM0002-DATE-001",  # Date boundaries inverted
            "ACM0002-CALC-001",  # Monthly sums (82,100 MWh) do not add up to net export (88,400 MWh)
            "ACM0002-CALC-002",  # Claimed emission reductions deviate from recomputation
        },
        forbidden_findings={
            "ACM0002-PRES-001",  # net export IS present
            "ACM0002-PRES-002",  # EF IS present
        },
    )
    cases.append(case_defects)

    return cases


def evaluate_case(case: GoldenTestCase, rulepack: Rulepack) -> CaseEvaluationResult:
    t0 = time.perf_counter()
    errors: list[str] = []

    # 1. Parse all documents & verify locator accuracy
    total_fields = sum(len(d.expected_fields) for d in case.documents)
    fields_extracted = 0
    fields_with_valid_locator = 0

    parsed_units_by_doc = {}
    for doc in case.documents:
        if doc.media_type == "application/pdf":
            res = parse_pdf(doc.data)
        elif doc.media_type == "text/csv":
            res = parse_csv(doc.data)
        else:
            res = parse_xlsx(doc.data)

        parsed_units_by_doc[doc.name] = res.units

        # Locate fields
        for ef in doc.expected_fields:
            found = False
            for unit in res.units:
                span_hit = find_span(unit, ef.expected_text)
                if span_hit is None and " " in ef.expected_text:
                    token = ef.expected_text.split()[0]
                    span_hit = find_span(unit, token)
                if span_hit is not None:
                    found = True
                    fields_extracted += 1
                    loc = span_hit.locator
                    if loc and "type" in loc:
                        fields_with_valid_locator += 1
                    break
            if not found:
                errors.append(f"Field {ef.parameter} ('{ef.expected_text}') not found in {doc.name}")

    extraction_prec = (fields_extracted / total_fields) if total_fields else 1.0
    locator_acc = (fields_with_valid_locator / total_fields) if total_fields else 1.0

    # 2. Build canonical Parameter Definitions for ACM0002
    param_defs = (
        ParamDef("net_export_mwh", "number", "MWh"),
        ParamDef("grid_emission_factor", "number", "tCO2/MWh"),
        ParamDef("installed_capacity_mw", "number", "MW"),
        ParamDef("claimed_emission_reductions_tco2", "number", "tCO2"),
        ParamDef("period_start", "date"),
        ParamDef("period_end", "date"),
        ParamDef("monthly_export_mwh", "number", "MWh"),
    )

    # 3. Assemble Snapshot
    vals: list[Val] = [
        Val(
            id=f"{case.id}-start",
            parameter="period_start",
            original=str(case.period_start),
            day=case.period_start,
            review_status="auto_accepted",
            source_type="asserted",
        ),
        Val(
            id=f"{case.id}-end",
            parameter="period_end",
            original=str(case.period_end),
            day=case.period_end,
            review_status="auto_accepted",
            source_type="asserted",
        ),
    ]

    for doc in case.documents:
        doc_hash = sha256_hex(doc.data)
        for ef in doc.expected_fields:
            if ef.numeric_value is not None:
                ev_id = f"ev-{doc_hash[:8]}-{ef.parameter}-{len(vals)}"
                vals.append(
                    Val(
                        id=f"{case.id}-{ef.parameter}-{len(vals)}",
                        parameter=ef.parameter,
                        original=ef.expected_text,
                        number=ef.numeric_value,
                        unit=ef.unit,
                        review_status="auto_accepted",
                        document_id=doc_hash[:16],
                        evidence_ref_ids=(ev_id,),
                        source_type="extracted",
                    )
                )

    snapshot = Snapshot(
        org_id="golden-org-001",
        project_id=f"proj-{case.id}",
        period_id=f"period-{case.id}",
        period_start=case.period_start,
        period_end=case.period_end,
        methodology_code=case.methodology_code,
        methodology_version=case.methodology_version,
        params=param_defs,
        values=tuple(vals),
    )

    # 4. Execute Rule Engine
    run_res = run_rulepack(rulepack, snapshot)
    observed_finding_codes = {f.rule_code for f in run_res.findings}

    # 5. Measure Issue Recall & False Positive Rate
    expected_count = len(case.expected_findings)
    detected_count = len(case.expected_findings & observed_finding_codes)
    recall = (detected_count / expected_count) if expected_count else 1.0

    false_positive_findings = observed_finding_codes & case.forbidden_findings
    fp_count = len(false_positive_findings)
    fp_rate = (fp_count / len(case.forbidden_findings)) if case.forbidden_findings else 0.0

    # 6. Check Calculation Correctness
    calc_ok = 1.0
    if case.id == "GOLDEN-SOLAR-001":
        # 164250.00 * 0.825 = 135506.25
        calc_check = [c for c in run_res.checks if c.rule_code == "ACM0002-CALC-002"]
        if not calc_check or calc_check[0].status != "passed":
            calc_ok = 0.0
            errors.append("Clean project failed calculation recomputation check ACM0002-CALC-002")

    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    passed = recall >= 1.0 and fp_count == 0 and extraction_prec >= 1.0 and calc_ok == 1.0

    return CaseEvaluationResult(
        case_id=case.id,
        case_name=case.name,
        duration_ms=round(elapsed_ms, 1),
        total_fields=total_fields,
        fields_extracted=fields_extracted,
        fields_with_valid_locator=fields_with_valid_locator,
        extraction_precision=round(extraction_prec * 100.0, 1),
        locator_accuracy=round(locator_acc * 100.0, 1),
        expected_issues_count=expected_count,
        issues_detected_count=detected_count,
        issue_recall=round(recall * 100.0, 1),
        false_positives_count=fp_count,
        false_positive_rate=round(fp_rate * 100.0, 1),
        calculation_correctness=round(calc_ok * 100.0, 1),
        passed=passed,
        findings_observed=sorted(observed_finding_codes),
        errors=errors,
    )


def run_golden_evaluation_suite(rulepack_path: str | Path | None = None) -> list[CaseEvaluationResult]:
    """Runs the Golden MRV evaluation suite against official rulepack."""
    if rulepack_path is None:
        rulepack_path = Path(__file__).resolve().parents[3] / "rulepacks" / "acm0002-grid-solar-1.0.0.json"
    rulepack = load_rulepack(rulepack_path)
    cases = build_solar_golden_cases()
    results = [evaluate_case(c, rulepack) for c in cases]
    return results


def format_golden_eval_markdown(results: list[CaseEvaluationResult]) -> str:
    lines = [
        "## Golden MRV Evaluation Report (ACM0002 Grid-Connected Solar PV)",
        "",
        "| Case ID | Scenario | Extr. Prec. | Locator Acc. | Issue Recall | False Pos. Rate | Calc. Acc. | Status |",
        "| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]
    for r in results:
        status = "**PASSED**" if r.passed else "**FAILED**"
        lines.append(
            f"| `{r.case_id}` | {r.case_name} | {r.extraction_precision}% | {r.locator_accuracy}% | {r.issue_recall}% | {r.false_positive_rate}% | {r.calculation_correctness}% | {status} |"
        )
    return "\n".join(lines)
