import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const root = join(import.meta.dirname, '..', '..', 'supabase');

export async function createDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(readFileSync(join(root, 'tests', 'support', 'supabase_stub.sql'), 'utf8'));
  const dir = join(root, 'migrations');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  await db.exec(readFileSync(join(root, 'seed.sql'), 'utf8'));
  return db;
}

export const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createPeriod(db: PGlite, uid: string, org: string, project: string, start = '2023-01-01', end = '2023-12-31') {
  return as(db, uid, async () => {
    const r = await db.query<{ id: string }>(
      'insert into public.monitoring_periods (org_id, project_id, start_date, end_date) values ($1,$2,$3,$4) returning id',
      [org, project, start, end],
    );
    return r.rows[0].id;
  });
}

/** Insert a document the way the worker would (superuser, bypasses RLS). */
export async function addDoc(
  db: PGlite,
  o: { org: string; project: string; user: string; period?: string | null; seed?: string; media?: string; size?: number; name?: string },
) {
  const hash = sha(o.seed ?? Math.random().toString());
  const r = await db.query<{ id: string }>(
    `insert into public.documents (org_id, project_id, monitoring_period_id, storage_path, sha256, filename, media_type, size_bytes, uploaded_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [o.org, o.project, o.period ?? null, `${o.org}/sha256/${hash}`, hash, o.name ?? 'report.pdf', o.media ?? 'application/pdf', o.size ?? 1000, o.user],
  );
  return { id: r.rows[0].id, sha: hash };
}

export async function addEvidence(db: PGlite, org: string, doc: string, text = '152,345 MWh') {
  const r = await db.query<{ id: string }>(
    `insert into public.evidence_refs (org_id, document_id, page_number, source_text, locator, source_hash)
     values ($1,$2,12,$3,$4,$5) returning id`,
    [org, doc, text, JSON.stringify({ type: 'pdf_span', page: 12, bbox: [0, 0, 1, 1], char_start: 0, char_end: text.length }), sha(text)],
  );
  return r.rows[0].id;
}

export async function paramId(db: PGlite, code = 'net_export_mwh') {
  const r = await db.query<{ id: string }>('select id from public.parameter_defs where parameter_code = $1', [code]);
  return r.rows[0].id;
}

export async function newUser(db: PGlite, email: string): Promise<string> {
  const r = await db.query<{ id: string }>('insert into auth.users (email) values ($1) returning id', [email]);
  return r.rows[0].id;
}

/** Run fn as an authenticated Supabase user (RLS applies). Pass null for anon. */
export async function as<T>(db: PGlite, uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

export async function createOrg(db: PGlite, uid: string, name: string): Promise<string> {
  return as(db, uid, async () => {
    const r = await db.query<{ create_org: string }>('select public.create_org($1)', [name]);
    return r.rows[0].create_org;
  });
}

export async function addMember(db: PGlite, org: string, uid: string, role: string) {
  await db.query('insert into public.members (org_id, user_id, role) values ($1, $2, $3)', [org, uid, role]);
}

export async function createProject(db: PGlite, uid: string, org: string, name = 'P'): Promise<string> {
  return as(db, uid, async () => {
    const r = await db.query<{ id: string }>(
      'insert into public.projects (org_id, name) values ($1, $2) returning id',
      [org, name],
    );
    return r.rows[0].id;
  });
}
