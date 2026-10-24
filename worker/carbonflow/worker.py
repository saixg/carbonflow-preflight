"""Worker loop: claim parse jobs and process them. Run with `python -m carbonflow.worker`."""

from __future__ import annotations

import logging
import os
import signal
import socket
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

# Load environment configuration from worker/.env, root .env, and web/.env.local
_root = Path(__file__).resolve().parents[2]
load_dotenv(_root / "worker" / ".env")
load_dotenv(_root / ".env")
load_dotenv(_root / "web" / ".env.local")

import psycopg

from .extract.gemini_provider import GeminiProvider
from .extract.openai_provider import OpenAIProvider
from .extract.openrouter_provider import OpenRouterProvider
from .pipeline import Services, process_job
from .repo import Repo
from .repo_run import PsycopgRunRepo
from .runflow import load_rulepacks
from .storage import ObjectStore, SupabaseStorage

log = logging.getLogger("carbonflow.worker")
KINDS = ["parse_document", "extract_document", "run_preflight"]


def run(
    repo: Repo,
    store: ObjectStore,
    worker: str,
    *,
    services: Services | None = None,
    idle_sleep: float = 2.0,
    stop=lambda: False,
    max_jobs: int | None = None,
) -> int:
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


def run_local_demo(services: Services) -> None:
    """Run an in-memory preflight verification demo with the active extraction provider."""
    from .benchmark.runner import format_benchmark_markdown, run_benchmark_suite

    log.info("Running CarbonFlow Preflight local verification benchmark...")
    results = run_benchmark_suite()
    log.info("Local benchmark complete. Evaluated %d parser configurations.", len(results))
    print("\n" + format_benchmark_markdown(results) + "\n")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    worker = os.environ.get("WORKER_ID") or f"{socket.gethostname()}-{os.getpid()}"

    provider = None
    llm_kind = os.environ.get("LLM_PROVIDER", "").lower()
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("LLM_PROVIDER_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if llm_kind == "openrouter" or (not llm_kind and openrouter_key):
        openrouter_model = os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b")
        if openrouter_key:
            provider = OpenRouterProvider(openrouter_key, openrouter_model)
            log.info("Configured OpenRouter provider with model: %s", openrouter_model)
    elif llm_kind == "gemini" or (not llm_kind and gemini_key):
        gemini_model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        if gemini_key:
            provider = GeminiProvider(gemini_key, gemini_model)
            log.info("Configured Gemini provider with model: %s", gemini_model)
    elif openai_key and os.environ.get("OPENAI_MODEL"):
        provider = OpenAIProvider(openai_key, os.environ["OPENAI_MODEL"])
        log.info("Configured OpenAI provider with model: %s", os.environ["OPENAI_MODEL"])

    rulepack_dir = Path(os.environ.get("RULEPACKS_DIR", _root / "rulepacks"))
    services = Services(
        provider=provider,
        rulepacks=load_rulepacks(rulepack_dir),
        auto_accept=os.environ.get("AUTO_ACCEPT") == "true",
    )

    if "--demo" in sys.argv or "--dry-run" in sys.argv:
        run_local_demo(services)
        return

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        log.warning("DATABASE_URL is not set in environment or worker/.env.")
        log.info(
            "To connect to your remote Supabase instance, set DATABASE_URL in worker/.env:\n"
            "  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.vgdpojpevcgpxxnfwoed.supabase.co:5432/postgres\n"
            "  SUPABASE_URL=https://vgdpojpevcgpxxnfwoed.supabase.co\n"
            "  SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]"
        )
        log.info("Running in local verification mode instead (--demo)...")
        run_local_demo(services)
        return

    supabase_url = os.environ.get("SUPABASE_URL", "https://vgdpojpevcgpxxnfwoed.supabase.co")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not service_key:
        log.warning(
            "SUPABASE_SERVICE_ROLE_KEY is not set. Storage downloads from bucket will be unavailable, "
            "but rule calculations and preflight checks will process normally."
        )

    conn = psycopg.connect(db_url, autocommit=True)
    store = SupabaseStorage(supabase_url, service_key or "unconfigured")

    stopping = {"flag": False}
    signal.signal(signal.SIGINT, lambda *_: stopping.update(flag=True))
    signal.signal(signal.SIGTERM, lambda *_: stopping.update(flag=True))
    log.info(
        "worker %s started (extraction %s, %d rulepack(s))",
        worker,
        "on" if provider else "off",
        len(services.rulepacks),
    )
    run(PsycopgRunRepo(conn), store, worker, services=services, stop=lambda: stopping["flag"])
    log.info("worker %s stopped", worker)


if __name__ == "__main__":
    main()
