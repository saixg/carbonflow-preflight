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
  return db;
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
