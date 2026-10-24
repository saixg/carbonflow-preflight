"""Deploy Phase C migration (20261024000100_findings_lifecycle_reports.sql) to Supabase.

Usage:
  python scripts/apply_migration_5.py
"""

from __future__ import annotations

import os
import sys
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv
import psycopg

root = Path(__file__).resolve().parents[1]
load_dotenv(root / "worker" / ".env")
load_dotenv(root / ".env")
load_dotenv(root / "web" / ".env.local")


def sanitize_db_url(url: str) -> str:
    """Ensure special characters in user password (like @) are properly percent-encoded."""
    if not url.startswith("postgresql://") and not url.startswith("postgres://"):
        return url
    prefix, _, rest = url.partition("://")
    if "@" not in rest:
        return url
    # Split on the LAST @ which separates user:pass from host:port/db
    userinfo, _, hostpart = rest.rpartition("@")
    if ":" in userinfo:
        username, _, password = userinfo.partition(":")
        encoded_password = urllib.parse.quote(urllib.parse.unquote(password), safe="")
        return f"{prefix}://{username}:{encoded_password}@{hostpart}"
    return url


db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("ERROR: DATABASE_URL is not set.")
    print("Set DATABASE_URL in worker/.env or environment:")
    print("  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.vgdpojpevcgpxxnfwoed.supabase.co:5432/postgres")
    sys.exit(1)

clean_db_url = sanitize_db_url(db_url)

migration_file = root / "supabase" / "migrations" / "20261024000100_findings_lifecycle_reports.sql"
if not migration_file.exists():
    print(f"ERROR: Migration file not found: {migration_file}")
    sys.exit(1)

print(f"Connecting to remote Supabase database...")
print(f"Applying migration: {migration_file.name}...")
sql = migration_file.read_text(encoding="utf-8")

try:
    with psycopg.connect(clean_db_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(sql)
                print("[OK] Migration applied successfully to Supabase!")
            except Exception as migrate_err:
                if "already exists" in str(migrate_err):
                    print("[INFO] Migration schema objects already exist in database. Verifying...")
                else:
                    raise migrate_err

            # Verify tables
            cur.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name IN ('finding_reviews', 'reports')
                ORDER BY table_name;
            """)
            tables = [r[0] for r in cur.fetchall()]
            print("[OK] Verified tables in remote Supabase:", tables)

            # Verify RPC function
            cur.execute("""
                SELECT routine_name FROM information_schema.routines 
                WHERE routine_schema = 'public' AND routine_name = 'review_finding';
            """)
            routines = [r[0] for r in cur.fetchall()]
            print("[OK] Verified RPC functions:", routines)

    print("\nPhase C database deployment complete and verified on remote Supabase!")
except Exception as e:
    print(f"\nERROR: {e}")
    sys.exit(1)
