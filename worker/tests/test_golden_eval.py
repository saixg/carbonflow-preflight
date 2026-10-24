from pathlib import Path

from carbonflow.benchmark.eval_suite import (
    format_golden_eval_markdown,
    run_golden_evaluation_suite,
)


def test_golden_evaluation_suite_solar_acm0002():
    rulepack_path = Path(__file__).resolve().parents[2] / "rulepacks" / "acm0002-grid-solar-1.0.0.json"
    results = run_golden_evaluation_suite(rulepack_path)

    assert len(results) == 2

    # Clean case
    clean_res = next(r for r in results if r.case_id == "GOLDEN-SOLAR-001")
    assert clean_res.passed is True
    assert clean_res.extraction_precision == 100.0
    assert clean_res.locator_accuracy == 100.0
    assert clean_res.false_positives_count == 0
    assert clean_res.false_positive_rate == 0.0
    assert clean_res.calculation_correctness == 100.0

    # Defects case
    defect_res = next(r for r in results if r.case_id == "GOLDEN-SOLAR-002")
    assert defect_res.passed is True
    assert defect_res.issue_recall == 100.0  # Detected both date inversion & calculation mismatch
    assert "ACM0002-DATE-001" in defect_res.findings_observed
    assert "ACM0002-CALC-002" in defect_res.findings_observed
    assert defect_res.false_positives_count == 0

    md = format_golden_eval_markdown(results)
    assert "GOLDEN-SOLAR-001" in md
    assert "PASSED" in md
