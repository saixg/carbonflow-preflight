"""Worker loop: claim parse jobs and process them. Run with `python -m carbonflow.worker`."""

from __future__ import annotations

import logging
import os
import signal
import socket
import time

import psycopg

from pathlib import Path

from .extract.openai_provider import OpenAIProvider
from .pipeline import Services, process_job
from .repo import Repo
from .repo_run import PsycopgRunRepo
from .runflow import load_rulepacks
from .storage import ObjectStore, SupabaseStorage

log = logging.getLogger("carbonflow.worker")
KINDS = ["parse_document", "extract_document", "run_preflight"]


def run(repo: Repo, store: ObjectStore, worker: str, *, services: Services | None = None, idle_sleep: float = 2.0, stop=lambda: False, max_jobs: int | None = None) -> int:
    done = 0
    last_sweep = 0.0
    while not stop():
        if time.monotonic() - last_sweep > 300:
            n = repo.requeue_stale()
            if n:
                log.warning("requeued %d stale job(s)", n)
            last_sweep = time.monotonic()
        job = repo.claim_job(worker, KINDS)
        if job is None:
            if max_jobs is not None:
                break
            time.sleep(idle_sleep)
            continue
        process_job(repo, store, job, worker, services)
        done += 1
        if max_jobs is not None and done >= max_jobs:
            break
    return done


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    worker = os.environ.get("WORKER_ID") or f"{socket.gethostname()}-{os.getpid()}"
    conn = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)
    store = SupabaseStorage(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    provider = None
    if os.environ.get("OPENAI_API_KEY") and os.environ.get("OPENAI_MODEL"):
        provider = OpenAIProvider(os.environ["OPENAI_API_KEY"], os.environ["OPENAI_MODEL"])
    rulepack_dir = Path(os.environ.get("RULEPACKS_DIR", Path(__file__).resolve().parents[2] / "rulepacks"))
    services = Services(provider=provider, rulepacks=load_rulepacks(rulepack_dir),
                        auto_accept=os.environ.get("AUTO_ACCEPT") == "true")
    stopping = {"flag": False}
    signal.signal(signal.SIGINT, lambda *_: stopping.update(flag=True))
    signal.signal(signal.SIGTERM, lambda *_: stopping.update(flag=True))
    log.info("worker %s started (extraction %s, %d rulepack(s))", worker, "on" if provider else "off", len(services.rulepacks))
    run(PsycopgRunRepo(conn), store, worker, services=services, stop=lambda: stopping["flag"])
    log.info("worker %s stopped", worker)


if __name__ == "__main__":
    main()
