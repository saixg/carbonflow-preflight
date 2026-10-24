import os
import sys
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv
import psycopg

root = Path(__file__).resolve().parents[1]
load_dotenv(root / "worker" / ".env")
load_dotenv(root / ".env")

def sanitize_db_url(url: str) -> str:
    if not url.startswith("postgresql://") and not url.startswith("postgres://"):
        return url
    prefix, _, rest = url.partition("://")
    if "@" not in rest:
        return url
    userinfo, _, hostpart = rest.rpartition("@")
    if ":" in userinfo:
        username, _, password = userinfo.partition(":")
        encoded_password = urllib.parse.quote(urllib.parse.unquote(password), safe="")
        return f"{prefix}://{username}:{encoded_password}@{hostpart}"
    return url

url = sanitize_db_url(os.environ["DATABASE_URL"])

with psycopg.connect(url) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT id, email FROM auth.users LIMIT 10;")
        users = cur.fetchall()
        print("Users:", users)

        cur.execute("SELECT id, name, slug FROM public.orgs LIMIT 10;")
        orgs = cur.fetchall()
        print("Orgs:", orgs)

        cur.execute("SELECT id, name, project_type, methodology_id, methodology_version FROM public.projects LIMIT 10;")
        projects = cur.fetchall()
        print("Projects:", projects)

        cur.execute("SELECT count(*) FROM public.rulepacks;")
        print("Rulepacks count:", cur.fetchone()[0])
