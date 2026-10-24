from __future__ import annotations

import io
import time
from dataclasses import dataclass, field
from typing import Any

import openpyxl
import pymupdf

from ..parsers import (
    find_span,
    parse_csv,
    parse_pdf,
    parse_pdf_docling,
    parse_pdf_hybrid,
    parse_xlsx,
)


@dataclass
class LabeledField:
    name: str
    expected_text: str
    target_unit_or_page: str


@dataclass
class BenchmarkDoc:
    name: str
    doc_type: str  # text_pdf, table_pdf, scanned_pdf, xlsx, csv
    data: bytes
    media_type: str
    ground_truth: list[LabeledField]


@dataclass
class ParserBenchmarkResult:
    parser_name: str
    doc_name: str
    doc_type: str
    elapsed_ms: float
    fields_evaluated: int
    fields_found: int
    locator_valid_count: int
    accuracy_pct: float
    error: str | None = None


def make_benchmark_corpus() -> list[BenchmarkDoc]:
    """Build a deterministic, self-contained benchmark corpus containing:

    1. Text-based monitoring PDF
    2. Table-structured PDF
    3. Scanned (rasterized) PDF
    4. XLSX workbook with cells
    5. CSV export
    """
    corpus: list[BenchmarkDoc] = []

    # 1. Text PDF
    doc1 = pymupdf.open()
    p1 = doc1.new_page()
    p1.insert_text((72, 72), "Project Monitoring Report: Solar Facility AP-01", fontsize=14)
    p1.insert_text((72, 100), "The monitoring period starts on 01 January 2023 and ends on 31 December 2023.", fontsize=11)
    p1.insert_text((72, 120), "Total net electricity exported was 152,345 MWh during this period.", fontsize=11)
    p1.insert_text((72, 140), "Installed capacity: 100 MW with grid emission factor 0.82 tCO2/MWh.", fontsize=11)
    p1.insert_text((72, 160), "Claimed emission reductions: 124,923 tCO2.", fontsize=11)
    text_pdf_bytes = doc1.tobytes()
    doc1.close()

    corpus.append(
        BenchmarkDoc(
            name="text_monitoring_report.pdf",
            doc_type="text_pdf",
            data=text_pdf_bytes,
            media_type="application/pdf",
            ground_truth=[
                LabeledField("net_export_mwh", "152,345 MWh", "1"),
                LabeledField("installed_capacity_mw", "100 MW", "1"),
                LabeledField("grid_emission_factor", "0.82 tCO2/MWh", "1"),
                LabeledField("claimed_emission_reductions", "124,923 tCO2", "1"),
            ],
        )
    )

    # 2. Table PDF
    doc2 = pymupdf.open()
    p2 = doc2.new_page()
    p2.insert_text((72, 60), "Monthly Electricity Generation Breakdown", fontsize=14)
    # Draw simple table text rows
    rows = [
        ("Month", "Export (MWh)", "Factor (tCO2/MWh)", "Reductions (tCO2)"),
        ("January", "12,695 MWh", "0.82", "10,410 tCO2"),
        ("February", "12,100 MWh", "0.82", "9,922 tCO2"),
        ("March", "13,200 MWh", "0.82", "10,824 tCO2"),
        ("Total Annual", "152,345 MWh", "0.82", "124,923 tCO2"),
    ]
    y = 90
    for r in rows:
        line = f"{r[0]:<15} {r[1]:<18} {r[2]:<20} {r[3]}"
        p2.insert_text((72, y), line, fontsize=10)
        y += 18
    table_pdf_bytes = doc2.tobytes()
    doc2.close()

    corpus.append(
        BenchmarkDoc(
            name="table_generation_breakdown.pdf",
            doc_type="table_pdf",
            data=table_pdf_bytes,
            media_type="application/pdf",
            ground_truth=[
                LabeledField("jan_export", "12,695 MWh", "1"),
                LabeledField("total_export", "152,345 MWh", "1"),
                LabeledField("annual_reductions", "124,923 tCO2", "1"),
            ],
        )
    )

    # 3. Scanned PDF (rasterized text image only)
    temp_doc = pymupdf.open()
    temp_p = temp_doc.new_page(width=600, height=300)
    temp_p.insert_text((50, 80), "Grid Meter Inspection Calibration Certificate", fontsize=16)
    temp_p.insert_text((50, 120), "Cumulative Net Active Energy: 152,345 MWh", fontsize=13)
    temp_p.insert_text((50, 150), "Operating capacity: 100 MW", fontsize=13)
    pix = temp_p.get_pixmap(dpi=150)
    temp_doc.close()

    doc3 = pymupdf.open()
    p3 = doc3.new_page(width=600, height=300)
    p3.insert_image(pymupdf.Rect(0, 0, 600, 300), pixmap=pix)
    scanned_pdf_bytes = doc3.tobytes()
    doc3.close()

    corpus.append(
        BenchmarkDoc(
            name="scanned_meter_certificate.pdf",
            doc_type="scanned_pdf",
            data=scanned_pdf_bytes,
            media_type="application/pdf",
            ground_truth=[
                LabeledField("cumulative_energy", "152,345 MWh", "1"),
                LabeledField("operating_capacity", "100 MW", "1"),
            ],
        )
    )

    # 4. XLSX Workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Monitoring Data"
    ws.append(["Parameter", "Value", "Unit"])
    ws.append(["Net Export", 152345, "MWh"])
    ws.append(["Installed Capacity", 100, "MW"])
    ws.append(["Emission Factor", 0.82, "tCO2/MWh"])
    xlsx_buf = io.BytesIO()
    wb.save(xlsx_buf)

    corpus.append(
        BenchmarkDoc(
            name="monitoring_sheet.xlsx",
            doc_type="xlsx",
            data=xlsx_buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ground_truth=[
                LabeledField("net_export", "152345", "Monitoring Data"),
                LabeledField("installed_capacity", "100", "Monitoring Data"),
            ],
        )
    )

    # 5. CSV Export
    csv_text = "month,export_mwh,emission_factor\nJan,12695,0.82\nFeb,12100,0.82\nTotal,152345,0.82\n"
    corpus.append(
        BenchmarkDoc(
            name="meter_log.csv",
            doc_type="csv",
            data=csv_text.encode("utf-8"),
            media_type="text/csv",
            ground_truth=[
                LabeledField("jan_val", "12695", "1"),
                LabeledField("total_val", "152345", "1"),
            ],
        )
    )

    return corpus


def run_single_benchmark(parser_name: str, doc: BenchmarkDoc) -> ParserBenchmarkResult:
    t0 = time.perf_counter()
    err: str | None = None
    parse_res = None

    try:
        if doc.media_type == "application/pdf":
            if parser_name == "pymupdf":
                parse_res = parse_pdf(doc.data)
            elif parser_name == "docling":
                parse_res = parse_pdf_docling(doc.data)
            elif parser_name == "hybrid_rapidocr":
                parse_res = parse_pdf_hybrid(doc.data)
            else:
                raise ValueError(f"Unknown PDF parser: {parser_name}")
        elif doc.doc_type == "xlsx":
            parse_res = parse_xlsx(doc.data)
        elif doc.doc_type == "csv":
            parse_res = parse_csv(doc.data)
    except Exception as e:
        err = f"{e.__class__.__name__}: {str(e)[:120]}"

    elapsed = (time.perf_counter() - t0) * 1000.0

    found_count = 0
    valid_locators = 0
    total_fields = len(doc.ground_truth)

    if parse_res is not None and not err:
        # Check ground truth field matching & locator generation
        for field in doc.ground_truth:
            # Check units
            for unit in parse_res.units:
                span_hit = find_span(unit, field.expected_text)
                if span_hit is None and " " in field.expected_text:
                    # Case-insensitive / partial whitespace check
                    words = field.expected_text.split()
                    if all(w.lower() in unit.text.lower() for w in words):
                        span_hit = find_span(unit, words[0])
                if span_hit is not None:
                    found_count += 1
                    loc = span_hit.locator
                    if loc and "type" in loc and ("bbox" in loc or "cell" in loc or "row" in loc):
                        valid_locators += 1
                    break

    accuracy = (found_count / total_fields * 100.0) if total_fields else 0.0

    return ParserBenchmarkResult(
        parser_name=parser_name,
        doc_name=doc.name,
        doc_type=doc.doc_type,
        elapsed_ms=round(elapsed, 1),
        fields_evaluated=total_fields,
        fields_found=found_count,
        locator_valid_count=valid_locators,
        accuracy_pct=round(accuracy, 1),
        error=err,
    )


def run_benchmark_suite() -> list[ParserBenchmarkResult]:
    corpus = make_benchmark_corpus()
    results: list[ParserBenchmarkResult] = []

    for doc in corpus:
        if doc.media_type == "application/pdf":
            # Test PyMuPDF
            results.append(run_single_benchmark("pymupdf", doc))
            # Test Docling
            results.append(run_single_benchmark("docling", doc))
            # Test RapidOCR Hybrid
            results.append(run_single_benchmark("hybrid_rapidocr", doc))
        else:
            # Native XLSX / CSV
            results.append(run_single_benchmark("native_parser", doc))

    return results


def format_benchmark_markdown(results: list[ParserBenchmarkResult]) -> str:
    lines = [
        "| Document | Type | Parser | Latency (ms) | Ground Truth Fields | Fields Found | Locator Accuracy | Outcome |",
        "| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |",
    ]
    for r in results:
        status = f"Err: {r.error}" if r.error else f"{r.accuracy_pct}% Found"
        loc_pct = f"{(r.locator_valid_count / r.fields_evaluated * 100):.0f}%" if r.fields_evaluated else "N/A"
        lines.append(
            f"| `{r.doc_name}` | `{r.doc_type}` | **{r.parser_name}** | {r.elapsed_ms}ms | {r.fields_evaluated} | {r.fields_found} | {loc_pct} | {status} |"
        )
    return "\n".join(lines)
