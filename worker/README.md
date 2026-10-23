# CarbonFlow worker

Python worker for ingestion and parsing. It claims jobs from the `jobs` table, verifies each stored file against its recorded SHA-256, parses it into text with page, cell and bounding-box locators, and stores the result.

## Setup

```bash
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
.venv\Scripts\python.exe -m pytest
```

## Run

Required environment variables (never commit real values):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection for a privileged role (bypasses row-level security, so all queries are scoped by `org_id`) |
| `SUPABASE_URL` | Project URL, for Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage access. Server side only |
| `WORKER_ID` | Optional name shown in job locks |

```bash
.venv\Scripts\python.exe -m carbonflow.worker
```

## Layout

- `carbonflow/sniff.py`, `limits.py`: decide what a file really is and enforce size, page, cell and time limits.
- `carbonflow/parsers/`: PDF, XLSX and CSV into `ParsedUnit`s. `find_span` locates a quoted passage and returns its evidence locator.
- `carbonflow/ingest.py`: staging upload to immutable, hashed document plus a parse job.
- `carbonflow/pipeline.py`: one job from claim to status update. `worker.py`: the loop.
- `carbonflow/repo.py`, `storage.py`: Postgres and Supabase Storage access. Tests use the fakes in `tests/fakes.py`.

## Not covered yet

`PsycopgRepo` and `SupabaseStorage` have not run against a real Supabase stack. That test pass needs Docker and the Supabase CLI.
