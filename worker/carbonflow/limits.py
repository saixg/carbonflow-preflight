"""Hard limits. Uploaded files are untrusted input; every parser enforces these."""

MAX_FILE_BYTES = 52_428_800  # 50 MiB, matches the documents table and storage bucket
MAX_PDF_PAGES = 500
MAX_XLSX_SHEETS = 50
MAX_XLSX_CELLS = 500_000
MAX_CSV_ROWS = 200_000
MAX_ZIP_ENTRIES = 2_000
MAX_ZIP_UNCOMPRESSED_BYTES = 200 * 1024 * 1024
PARSE_BUDGET_SECONDS = 120.0
MIN_TEXT_CHARS_PER_PAGE = 20

PDF = "application/pdf"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV = "text/csv"
ALLOWED_MEDIA_TYPES = frozenset({PDF, XLSX, CSV})

# Browsers and tools label CSV files inconsistently.
CSV_ALIASES = frozenset({"text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"})
