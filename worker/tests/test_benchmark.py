from __future__ import annotations

import pytest

from carbonflow.benchmark.runner import (
    format_benchmark_markdown,
    make_benchmark_corpus,
    run_benchmark_suite,
)


def test_make_benchmark_corpus():
    corpus = make_benchmark_corpus()
    assert len(corpus) == 5
    types = {d.doc_type for d in corpus}
    assert types == {"text_pdf", "table_pdf", "scanned_pdf", "xlsx", "csv"}


def test_benchmark_suite_execution():
    results = run_benchmark_suite()
    assert len(results) >= 11  # 3 PDF parsers x 3 PDF docs + 1 xlsx + 1 csv = 11

    # Check scanned document failure vs recovery
    scanned_pymupdf = [r for r in results if r.doc_type == "scanned_pdf" and r.parser_name == "pymupdf"][0]
    assert scanned_pymupdf.error is not None or scanned_pymupdf.fields_found == 0

    scanned_hybrid = [r for r in results if r.doc_type == "scanned_pdf" and r.parser_name == "hybrid_rapidocr"][0]
    assert scanned_hybrid.error is None
    assert scanned_hybrid.fields_found > 0

    # Format markdown report
    md = format_benchmark_markdown(results)
    assert "| Document | Type | Parser |" in md
    print("\n\n" + md + "\n")
