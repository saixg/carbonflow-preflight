import copy
import json
import random
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from carbonflow.engine import (
    ENGINE_VERSION, EngineInputError, InvalidRulepack, ParamDef, Snapshot, Val, load_rulepack, parse_rulepack, run_rulepack,
)
from carbonflow.engine.canon import canonical_json

PACK_PATH = Path(__file__).resolve().parents[2] / "rulepacks" / "test-only-0.1.0.json"

PARAMS = (
    ParamDef("net_export_mwh", "number", "MWh"),
    ParamDef("period_start", "date"),
    ParamDef("period_end", "date"),
    ParamDef("installed_capacity_mw", "number", "MW"),
    ParamDef("grid_emission_factor", "number", "tCO2/MWh"),
    ParamDef("monthly_export_mwh", "number", "MWh"),
    ParamDef("claimed_emission_reductions_tco2", "number", "tCO2"),
)

_n = 0


def val(parameter, number=None, day=None, unit=None, doc="doc1", status="human_confirmed", ev=True, source="extracted"):
    global _n
    _n += 1
    return Val(
        id=f"v{_n:03d}", parameter=parameter, original=str(number if number is not None else day), review_status=status,
        number=Decimal(str(number)) if number is not None else None, day=day, unit=unit, document_id=doc,
        evidence_ref_ids=(f"e{_n:03d}",) if ev else (), source_type=source,
    )


def good_values():
    months = [Decimal("12695.4166")] * 12  # 152,345 (rounded) spread over the year
    vals = [
        val("net_export_mwh", 152345, unit="MWh"),
        val("period_start", day=date(2023, 1, 1)),
        val("period_end", day=date(2023, 12, 31)),
        val("installed_capacity_mw", 100, unit="MW"),
        val("grid_emission_factor", "0.82", unit="tCO2/MWh"),
        val("claimed_emission_reductions_tco2", "124923.9", unit="tCO2"),
    ]
    vals += [val("monthly_export_mwh", m, unit="MWh") for m in months]
    return vals


def snap(values, **kw):
    return Snapshot(
        org_id="org", project_id="proj", period_id="per", period_start=kw.get("start", date(2023, 1, 1)),
        period_end=kw.get("end", date(2023, 12, 31)), methodology_code="TEST-ONLY", methodology_version="0.1",
        params=PARAMS, values=tuple(values),
    )


@pytest.fixture(scope="module")
def pack():
    return load_rulepack(PACK_PATH)


def statuses(result):
    return {c.rule_code: c.status for c in result.checks}


def codes(result):
    return [f.rule_code for f in result.findings]


# ------------------------------------------------------------- happy path


def test_clean_data_passes_every_check(pack):
    r = run_rulepack(pack, snap(good_values()))
    assert r.findings == ()
    assert set(statuses(r).values()) == {"passed", "not_applicable"}
    assert statuses(r)["T-CONS-001"] == "not_applicable"  # one document, nothing to compare
    assert r.passed == r.applicable == 10


def test_rulepack_is_marked_test_only_and_hashed(pack):
    assert pack.test_only and "TEST ONLY" in pack.label
    assert len(pack.content_hash) == 64
    assert all(r.basis == "internal_heuristic" for r in pack.rules)


# --------------------------------------------------------- each op catches its problem


def test_missing_values_are_findings_not_silent_passes(pack):
    vals = [v for v in good_values() if v.parameter != "net_export_mwh"]
    r = run_rulepack(pack, snap(vals))
    assert statuses(r)["T-PRES-001"] == "failed"
    assert statuses(r)["T-CALC-001"] == "cannot_evaluate"  # cannot add up to a missing total
    assert statuses(r)["T-CALC-002"] == "cannot_evaluate"
    undecided = [f for f in r.findings if f.finding_type == "incomplete_input"]
    assert {f.rule_code for f in undecided} >= {"T-CALC-001", "T-CALC-002"}


def test_total_that_does_not_match_monthly_values(pack):
    vals = [v for v in good_values() if v.parameter != "net_export_mwh"] + [val("net_export_mwh", 149120, unit="MWh")]
    r = run_rulepack(pack, snap(vals))
    f = next(f for f in r.findings if f.rule_code == "T-CALC-001")
    assert f.finding_type == "calculation_mismatch" and f.severity == "critical"
    assert f.observed["total"] == Decimal("149120")
    assert f.evidence_ref_ids  # every finding points at evidence


def test_inflated_claim_is_caught_by_recomputation(pack):
    vals = [v for v in good_values() if v.parameter != "claimed_emission_reductions_tco2"]
    vals.append(val("claimed_emission_reductions_tco2", "135000", unit="tCO2"))
    r = run_rulepack(pack, snap(vals))
    f = next(f for f in r.findings if f.rule_code == "T-CALC-002")
    assert f.expected["recomputed"] == Decimal("152345") * Decimal("0.82")


def test_two_documents_that_disagree(pack):
    vals = good_values() + [val("net_export_mwh", 160000, unit="MWh", doc="doc2")]
    r = run_rulepack(pack, snap(vals))
    assert "T-CONS-001" in codes(r)
    # a conflicting total cannot feed the calculation checks: they must say so, not pick one
    assert statuses(r)["T-CALC-001"] == "cannot_evaluate" and statuses(r)["T-CALC-002"] == "cannot_evaluate"


def test_dates_out_of_order_and_not_matching_the_period(pack):
    vals = [v for v in good_values() if v.parameter not in ("period_start", "period_end")]
    vals += [val("period_start", day=date(2023, 12, 31)), val("period_end", day=date(2023, 1, 1))]
    r = run_rulepack(pack, snap(vals))
    assert "T-DATE-001" in codes(r)
    assert "T-DATE-002" in codes(r)


def test_year_shifted_date_is_caught(pack):
    vals = [v for v in good_values() if v.parameter != "period_end"] + [val("period_end", day=date(2024, 12, 31))]
    r = run_rulepack(pack, snap(vals))
    f = next(f for f in r.findings if f.rule_code == "T-DATE-002")
    assert f.observed == {"period_end": date(2024, 12, 31)}


def test_wrong_unit_dimension_and_missing_unit(pack):
    vals = [v for v in good_values() if v.parameter != "net_export_mwh"] + [val("net_export_mwh", 100, unit="MW")]
    assert "T-UNIT-001" in codes(run_rulepack(pack, snap(vals)))
    vals = [v for v in good_values() if v.parameter != "net_export_mwh"] + [val("net_export_mwh", 152345, unit=None)]
    assert "T-UNIT-001" in codes(run_rulepack(pack, snap(vals)))


def test_implausible_capacity(pack):
    vals = [v for v in good_values() if v.parameter != "installed_capacity_mw"] + [val("installed_capacity_mw", 100000, unit="MW")]
    assert "T-RANGE-001" in codes(run_rulepack(pack, snap(vals)))


# ----------------------------------------------------- safety properties


def test_unreviewed_or_unsupported_values_cannot_enter(pack):
    with pytest.raises(EngineInputError, match="cannot feed"):
        snap([val("net_export_mwh", 1, unit="MWh", status="needs_review")])
    with pytest.raises(EngineInputError, match="cannot feed"):
        snap([val("net_export_mwh", 1, unit="MWh", status="conflicting")])
    with pytest.raises(EngineInputError, match="no evidence"):
        snap([val("net_export_mwh", 1, unit="MWh", ev=False)])
    with pytest.raises(EngineInputError, match="unknown parameter"):
        snap([val("made_up", 1)])


def test_rulepack_for_another_methodology_version_is_refused(pack):
    s = Snapshot("o", "p", "q", date(2023, 1, 1), date(2023, 12, 31), "TEST-ONLY", "9.9", PARAMS, ())
    with pytest.raises(ValueError, match="different methodology"):
        run_rulepack(pack, s)


def test_same_inputs_give_byte_identical_results(pack):
    base = good_values() + [val("net_export_mwh", 160000, unit="MWh", doc="doc2")]
    first = run_rulepack(pack, snap(base))
    for seed in range(5):
        shuffled = base[:]
        random.Random(seed).shuffle(shuffled)
        again = run_rulepack(pack, snap(shuffled))
        assert again.result_hash == first.result_hash
        assert again.snapshot_hash == first.snapshot_hash
        assert canonical_json([f.to_canonical() for f in again.findings]) == canonical_json([f.to_canonical() for f in first.findings])


def test_changing_any_input_changes_the_hashes(pack):
    base = good_values()
    a = run_rulepack(pack, snap(base))
    changed = [v for v in base if v.parameter != "installed_capacity_mw"] + [val("installed_capacity_mw", 101, unit="MW")]
    b = run_rulepack(pack, snap(changed))
    assert a.snapshot_hash != b.snapshot_hash and a.result_hash != b.result_hash


def test_result_names_the_exact_rules_and_engine(pack):
    r = run_rulepack(pack, snap(good_values()))
    assert (r.rulepack_id, r.rulepack_version, r.rulepack_hash, r.engine_version) == ("test-only", "0.1.0", pack.content_hash, ENGINE_VERSION)


def test_findings_are_ordered_most_severe_first(pack):
    vals = [v for v in good_values() if v.parameter not in ("installed_capacity_mw", "net_export_mwh")]
    vals += [val("installed_capacity_mw", 100000, unit="MW")]
    r = run_rulepack(pack, snap(vals))
    ranks = [{"critical": 0, "material": 1, "minor": 2}[f.severity] for f in r.findings]
    assert ranks == sorted(ranks)


# ------------------------------------------------- rulepack validation


def raw():
    return json.loads(PACK_PATH.read_text(encoding="utf-8"))


def test_rulepack_validation_rejects_unsafe_or_malformed_rules():
    d = raw(); d["rules"][0]["op"] = "eval"
    with pytest.raises(InvalidRulepack, match="unknown operation"):
        parse_rulepack(d)
    d = raw(); d["rules"][0]["params"]["code"] = "__import__('os')"
    with pytest.raises(InvalidRulepack, match="unexpected parameters"):
        parse_rulepack(d)
    d = raw(); del d["rules"][0]["params"]["parameter"]
    with pytest.raises(InvalidRulepack, match="missing parameters"):
        parse_rulepack(d)
    d = raw(); d["rules"][1]["code"] = d["rules"][0]["code"]
    with pytest.raises(InvalidRulepack, match="duplicate"):
        parse_rulepack(d)
    d = raw(); d["rules"][0]["severity"] = "urgent"
    with pytest.raises(InvalidRulepack, match="severity"):
        parse_rulepack(d)
    d = raw(); d["rules"][8]["params"]["rel_tol"] = "lots"
    with pytest.raises(InvalidRulepack, match="number string"):
        parse_rulepack(d)
    d = raw(); next(r for r in d["rules"] if r["op"] == "recompute_matches")["params"]["calc"] = "os.system"
    with pytest.raises(InvalidRulepack, match="unknown calculation"):
        parse_rulepack(d)


def test_test_only_pack_cannot_claim_a_sourced_requirement():
    d = raw(); d["rules"][0]["basis"] = "directly_sourced"
    with pytest.raises(InvalidRulepack, match="TEST ONLY"):
        parse_rulepack(d)


def test_hash_changes_when_any_rule_changes():
    a = parse_rulepack(raw())
    d = raw(); d["rules"][0]["remediation"] = "something else"
    assert parse_rulepack(d).content_hash != a.content_hash
    assert parse_rulepack(copy.deepcopy(raw())).content_hash == a.content_hash
