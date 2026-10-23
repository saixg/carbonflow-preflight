import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDoc, addEvidence, as, createDb, createOrg, createPeriod, createProject, newUser, paramId, sha } from './helpers';

let db: PGlite;
let alice: string, bob: string;
let orgA: string, orgB: string;
let projA: string, projA2: string, projB: string;
let periodA: string, periodA2: string, periodB: string;
let param: string;

beforeAll(async () => {
  db = await createDb();
  alice = await newUser(db, 'alice@a.test');
  bob = await newUser(db, 'bob@b.test');
  orgA = await createOrg(db, alice, 'Org A');
  orgB = await createOrg(db, bob, 'Org B');
  projA = await createProject(db, alice, orgA, 'A1');
  projA2 = await createProject(db, alice, orgA, 'A2');
  projB = await createProject(db, bob, orgB, 'B1');
  periodA = await createPeriod(db, alice, orgA, projA);
  periodA2 = await createPeriod(db, alice, orgA, projA2);
  periodB = await createPeriod(db, bob, orgB, projB);
  param = await paramId(db);
});
afterAll(async () => {
  await db.close();
});

const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ c: string }>(`select count(*)::text c from (${sql}) t`, params)).rows[0].c);

describe('documents', () => {
  it('enforces content-addressed path, hash format, media type and size', async () => {
    const good = sha('x');
    const ins = (path: string, h: string, media = 'application/pdf', size = 10) =>
      db.query(
        `insert into public.documents (org_id, project_id, storage_path, sha256, filename, media_type, size_bytes, uploaded_by)
         values ($1,$2,$3,$4,'f.pdf',$5,$6,$7)`,
        [orgA, projA, path, h, media, size, alice],
      );
    await expect(ins(`${orgA}/sha256/${good}`, good)).resolves.toBeTruthy();
    await expect(ins(`${orgA}/sha256/${sha('y')}`, good)).rejects.toThrow(/documents_path_chk/);
    await expect(ins(`${orgA}/sha256/nothex`, 'nothex')).rejects.toThrow(/sha256_check|violates check/);
    await expect(ins(`${orgA}/sha256/${good}`, good, 'application/zip')).rejects.toThrow(/media_type/);
    await expect(ins(`${orgA}/sha256/${good}`, good, 'application/pdf', 52428801)).rejects.toThrow(/size_bytes/);
  });

  it('cannot point at another tenant\'s project or a period of another project', async () => {
    await expect(addDoc(db, { org: orgA, project: projB, user: alice })).rejects.toThrow(/documents_project_fk/);
    await expect(addDoc(db, { org: orgA, project: projA, period: periodA2, user: alice })).rejects.toThrow(/documents_period_fk/);
    await expect(addDoc(db, { org: orgA, project: projA, period: periodB, user: alice })).rejects.toThrow(/documents_period_fk/);
  });

  it('is immutable except for status, and statuses follow the allowed path', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, period: periodA, user: alice });
    await expect(db.query("update public.documents set filename = 'other.pdf' where id = $1", [d.id])).rejects.toThrow(/immutable/);
    await expect(db.query("update public.documents set storage_path = 'x' where id = $1", [d.id])).rejects.toThrow(/immutable/);
    await expect(db.query("update public.documents set processing_status = 'processed' where id = $1", [d.id])).rejects.toThrow(/invalid document status/);
    await db.query("update public.documents set processing_status = 'processing' where id = $1", [d.id]);
    await db.query("update public.documents set processing_status = 'failed', error_summary = 'boom' where id = $1", [d.id]);
    await db.query("update public.documents set processing_status = 'processing' where id = $1", [d.id]);
    await db.query("update public.documents set processing_status = 'processed', processed_at = now() where id = $1", [d.id]);
    await expect(db.query("update public.documents set processing_status = 'processing' where id = $1", [d.id])).rejects.toThrow(/invalid document status/);
    await expect(db.query('delete from public.documents where id = $1', [d.id])).rejects.toThrow(/append-only/);
  });

  it('records the same bytes twice as separate records, linked as duplicates', async () => {
    const a = await addDoc(db, { org: orgA, project: projA, user: alice, seed: 'dup' });
    const r = await db.query<{ id: string }>(
      `insert into public.documents (org_id, project_id, storage_path, sha256, filename, media_type, size_bytes, uploaded_by, duplicate_of_id)
       values ($1,$2,$3,$4,'again.pdf','application/pdf',1000,$5,$6) returning id`,
      [orgA, projA, `${orgA}/sha256/${a.sha}`, a.sha, alice, a.id],
    );
    expect(r.rows[0].id).not.toBe(a.id);
  });

  it('is readable by members only, and not writable by users', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, user: alice });
    await as(db, alice, async () => expect(await count('select 1 from public.documents where id = $1', [d.id])).toBe(1));
    await as(db, bob, async () => expect(await count('select 1 from public.documents where id = $1', [d.id])).toBe(0));
    await expect(as(db, alice, () => db.query("update public.documents set error_summary = 'x' where id = $1", [d.id]))).rejects.toThrow(/permission denied/);
    await expect(as(db, alice, () => db.query('delete from public.documents where id = $1', [d.id]))).rejects.toThrow(/permission denied/);
    await expect(
      as(db, alice, () =>
        db.query(
          `insert into public.documents (org_id, project_id, storage_path, sha256, filename, media_type, size_bytes, uploaded_by)
           values ($1,$2,$3,$4,'f.pdf','application/pdf',10,$5)`,
          [orgA, projA, `${orgA}/sha256/${sha('z')}`, sha('z'), alice],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('writes audit entries for create and status change', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, user: alice });
    await db.query("update public.documents set processing_status = 'processing' where id = $1", [d.id]);
    const r = await db.query<{ action: string; metadata: any }>('select action, metadata from public.audit_log where entity_id = $1 order by id', [d.id]);
    expect(r.rows.map((x) => x.action)).toEqual(['document.insert', 'document.update']);
    expect(r.rows[1].metadata).toEqual({ processing_status: { old: 'uploaded', new: 'processing' } });
  });
});

describe('evidence refs and parsed units', () => {
  it('requires a real locator and a matching text hash', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, user: alice });
    const ins = (locator: unknown, text: string, hash: string) =>
      db.query('insert into public.evidence_refs (org_id, document_id, source_text, locator, source_hash) values ($1,$2,$3,$4,$5)', [orgA, d.id, text, JSON.stringify(locator), hash]);
    await expect(ins({ type: 'pdf_span', page: 1 }, 'abc', sha('abc'))).resolves.toBeTruthy();
    await expect(ins({ type: 'guess' }, 'abc', sha('abc'))).rejects.toThrow(/locator/);
    await expect(ins({ page: 1 }, 'abc', sha('abc'))).rejects.toThrow(/locator/);
    await expect(ins({ type: 'pdf_span' }, 'abc', sha('different'))).rejects.toThrow(/hash_chk/);
  });

  it('cannot reference another tenant\'s document and is append-only', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, user: alice });
    await expect(
      db.query('insert into public.evidence_refs (org_id, document_id, source_text, locator, source_hash) values ($1,$2,$3,$4,$5)', [orgB, d.id, 'a', JSON.stringify({ type: 'pdf_span' }), sha('a')]),
    ).rejects.toThrow(/evidence_refs_document_fk/);
    const e = await addEvidence(db, orgA, d.id);
    await expect(db.query("update public.evidence_refs set source_text = 'x' where id = $1", [e])).rejects.toThrow(/append-only/);
    await expect(db.query('delete from public.evidence_refs where id = $1', [e])).rejects.toThrow(/append-only/);
  });

  it('stores parsed units once per parser version and keeps them append-only', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, user: alice });
    const ins = (v: string) =>
      db.query(
        `insert into public.parsed_units (org_id, document_id, unit_type, unit_ref, text, parser_name, parser_version) values ($1,$2,'page','1','hello','pdf',$3)`,
        [orgA, d.id, v],
      );
    await ins('1');
    await expect(ins('1')).rejects.toThrow(/duplicate key/);
    await expect(ins('2')).resolves.toBeTruthy();
    await expect(db.query("update public.parsed_units set text = 'x' where document_id = $1", [d.id])).rejects.toThrow(/append-only/);
  });

  it('hides evidence and parsed text from other tenants', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, user: alice });
    const e = await addEvidence(db, orgA, d.id);
    await as(db, bob, async () => expect(await count('select 1 from public.evidence_refs where id = $1', [e])).toBe(0));
    await as(db, alice, async () => expect(await count('select 1 from public.evidence_refs where id = $1', [e])).toBe(1));
  });
});

describe('parameter values', () => {
  const insert = (o: { source: string; evidence?: string | null; extractor?: unknown; asserted?: string | null; status?: string; project?: string; period?: string; org?: string; supersedes?: string | null; reviewer?: string | null }) =>
    db.query<{ id: string }>(
      `insert into public.parameter_values
        (org_id, project_id, monitoring_period_id, parameter_def_id, original_value, normalized_value, unit, source_type, evidence_ref_id, extractor, asserted_by, review_status, supersedes_id, reviewed_by)
       values ($1,$2,$3,$4,'152,345 MWh',152345,'MWh',$5,$6,$7,$8,$9,$10,$11) returning id`,
      [o.org ?? orgA, o.project ?? projA, o.period ?? periodA, param, o.source, o.evidence ?? null, o.extractor ? JSON.stringify(o.extractor) : null, o.asserted ?? null, o.status ?? 'needs_review', o.supersedes ?? null, o.reviewer ?? null],
    );
  const ext = { method: 'test', model: 'fake', version: '1', prompt_hash: 'abc' };

  it('rejects numbers with no evidence unless explicitly asserted', async () => {
    await expect(insert({ source: 'extracted', extractor: ext })).rejects.toThrow(/evidence_required/);
    await expect(insert({ source: 'manual_evidenced' })).rejects.toThrow(/evidence_required/);
    await expect(insert({ source: 'asserted', asserted: alice })).resolves.toBeTruthy();
  });

  it('requires an author for assertions and a needs_review start', async () => {
    await expect(insert({ source: 'asserted' })).rejects.toThrow(/needs_author/);
    await expect(insert({ source: 'asserted', asserted: alice, status: 'human_confirmed', reviewer: alice })).rejects.toThrow(/asserted value must start/);
  });

  it('requires extractor details for extracted values and limits auto-accept to them', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, period: periodA, user: alice });
    const e = await addEvidence(db, orgA, d.id);
    await expect(insert({ source: 'extracted', evidence: e })).rejects.toThrow(/needs_extractor/);
    await expect(insert({ source: 'manual_evidenced', evidence: e, status: 'auto_accepted' })).rejects.toThrow(/auto_accept/);
    await expect(insert({ source: 'extracted', evidence: e, extractor: ext, status: 'auto_accepted' })).resolves.toBeTruthy();
    await expect(insert({ source: 'extracted', evidence: e, extractor: ext, status: 'human_confirmed' })).rejects.toThrow(/human_review/);
  });

  it('rejects evidence from another project, another period, or another tenant', async () => {
    const dOtherProject = await addDoc(db, { org: orgA, project: projA2, period: periodA2, user: alice });
    const eOtherProject = await addEvidence(db, orgA, dOtherProject.id);
    await expect(insert({ source: 'extracted', evidence: eOtherProject, extractor: ext })).rejects.toThrow(/different project/);

    const dB = await addDoc(db, { org: orgB, project: projB, period: periodB, user: bob });
    const eB = await addEvidence(db, orgB, dB.id);
    await expect(insert({ source: 'extracted', evidence: eB, extractor: ext })).rejects.toThrow(/pv_evidence_fk|different project/);

    const dOtherPeriod = await db.query<{ id: string }>(
      `insert into public.monitoring_periods (org_id, project_id, start_date, end_date, created_by) values ($1,$2,'2024-01-01','2024-12-31',$3) returning id`,
      [orgA, projA, alice],
    );
    const d2 = await addDoc(db, { org: orgA, project: projA, period: dOtherPeriod.rows[0].id, user: alice });
    const e2 = await addEvidence(db, orgA, d2.id);
    await expect(insert({ source: 'extracted', evidence: e2, extractor: ext })).rejects.toThrow(/different project or monitoring period/);
  });

  it('keeps values immutable, allows review fields to change, and keeps correction history', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, period: periodA, user: alice });
    const e = await addEvidence(db, orgA, d.id);
    const v1 = (await insert({ source: 'extracted', evidence: e, extractor: ext })).rows[0].id;
    await expect(db.query("update public.parameter_values set original_value = '1' where id = $1", [v1])).rejects.toThrow(/immutable/);
    await expect(db.query('delete from public.parameter_values where id = $1', [v1])).rejects.toThrow(/append-only/);

    const authoritative = () => count('select 1 from public.authoritative_values where id = $1', [v1]);
    expect(await authoritative()).toBe(0); // needs_review does not feed calculations
    await db.query("update public.parameter_values set review_status = 'human_confirmed', reviewed_by = $2, reviewed_at = now() where id = $1", [v1, alice]);
    expect(await authoritative()).toBe(1);

    const v2 = (await insert({ source: 'manual_evidenced', evidence: e, status: 'human_corrected', reviewer: alice, supersedes: v1 })).rows[0].id;
    expect(await authoritative()).toBe(0); // replaced
    expect(await count('select 1 from public.authoritative_values where id = $1', [v2])).toBe(1);
    await expect(insert({ source: 'manual_evidenced', evidence: e, status: 'human_corrected', reviewer: alice, supersedes: v1 })).rejects.toThrow(/pv_one_correction_uk/);
  });

  it('is hidden from other tenants and not writable by users', async () => {
    const d = await addDoc(db, { org: orgA, project: projA, period: periodA, user: alice });
    const e = await addEvidence(db, orgA, d.id);
    const v = (await insert({ source: 'extracted', evidence: e, extractor: ext })).rows[0].id;
    await as(db, bob, async () => expect(await count('select 1 from public.parameter_values where id = $1', [v])).toBe(0));
    await as(db, alice, async () => expect(await count('select 1 from public.parameter_values where id = $1', [v])).toBe(1));
    await expect(as(db, alice, () => db.query("update public.parameter_values set review_status = 'human_confirmed', reviewed_by = $2 where id = $1", [v, alice]))).rejects.toThrow(/permission denied/);
  });
});

describe('methodologies', () => {
  it('are readable by any signed-in user but not by anon or writable', async () => {
    await as(db, bob, async () => expect(await count("select 1 from public.methodologies where code = 'TEST-ONLY'")).toBe(1));
    await expect(as(db, null, () => db.query('select * from public.methodologies'))).rejects.toThrow(/permission denied/);
    await expect(as(db, bob, () => db.query("update public.methodologies set status = 'approved'"))).rejects.toThrow(/permission denied/);
  });
});

describe('job queue', () => {
  const asWorker = async <T>(fn: () => Promise<T>) => {
    await db.exec('set role service_role');
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
    }
  };
  const newJob = async (maxAttempts = 3) => {
    const d = await addDoc(db, { org: orgA, project: projA, user: alice });
    const r = await db.query<{ id: string }>(
      "insert into public.jobs (org_id, document_id, kind, max_attempts) values ($1,$2,'parse_document',$3) returning id",
      [orgA, d.id, maxAttempts],
    );
    return r.rows[0].id;
  };
  const claim = (w: string) => asWorker(async () => (await db.query<{ id: string | null; status: string; attempts: number }>("select * from public.claim_job($1, array['parse_document'])", [w])).rows[0]);

  it('is invisible and unusable to signed-in users', async () => {
    await as(db, alice, async () => {
      await expect(db.query('select * from public.jobs')).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.claim_job('w', array['parse_document'])")).rejects.toThrow(/permission denied/);
    });
  });

  it('hands each queued job to exactly one worker', async () => {
    await db.exec("delete from public.jobs");
    const j1 = await newJob();
    const j2 = await newJob();
    const a = await claim('w1');
    const b = await claim('w2');
    expect(new Set([a.id, b.id])).toEqual(new Set([j1, j2]));
    expect(a.status).toBe('running');
    expect(a.attempts).toBe(1);
    const c = await claim('w3');
    expect(c.id).toBeNull();
  });

  it('lets only the lock holder complete a job', async () => {
    await db.exec("delete from public.jobs");
    const id = await newJob();
    await claim('w1');
    expect((await asWorker(() => db.query<{ complete_job: boolean }>('select public.complete_job($1,$2)', [id, 'other']))).rows[0].complete_job).toBe(false);
    expect((await asWorker(() => db.query<{ complete_job: boolean }>('select public.complete_job($1,$2)', [id, 'w1']))).rows[0].complete_job).toBe(true);
    expect((await db.query<{ status: string }>('select status from public.jobs where id = $1', [id])).rows[0].status).toBe('succeeded');
  });

  it('retries with growing backoff and then marks the job dead', async () => {
    await db.exec("delete from public.jobs");
    const id = await newJob(2);
    await claim('w1');
    const s1 = await asWorker(() => db.query<{ fail_job: string }>('select public.fail_job($1,$2,$3)', [id, 'w1', 'boom']));
    expect(s1.rows[0].fail_job).toBe('queued');
    const first = (await db.query<{ s: number }>('select extract(epoch from run_after - now())::float s from public.jobs where id = $1', [id])).rows[0].s;
    expect(first).toBeGreaterThan(20);
    expect(first).toBeLessThanOrEqual(30);
    expect((await claim('w1')).id).toBeNull(); // not due yet
    await db.query("update public.jobs set run_after = now() where id = $1", [id]);
    await claim('w1');
    const s2 = await asWorker(() => db.query<{ fail_job: string }>('select public.fail_job($1,$2,$3)', [id, 'w1', 'boom again']));
    expect(s2.rows[0].fail_job).toBe('dead');
    expect((await db.query<{ last_error: string }>('select last_error from public.jobs where id = $1', [id])).rows[0].last_error).toBe('boom again');
  });

  it('can fail a job permanently without retrying', async () => {
    await db.exec("delete from public.jobs");
    const id = await newJob(5);
    await claim('w1');
    const s = await asWorker(() => db.query<{ fail_job: string }>('select public.fail_job($1,$2,$3,false)', [id, 'w1', 'unsupported file']));
    expect(s.rows[0].fail_job).toBe('dead');
  });

  it('requeues jobs whose worker disappeared', async () => {
    await db.exec("delete from public.jobs");
    const id = await newJob();
    await claim('w1');
    await db.query("update public.jobs set locked_at = now() - interval '1 hour' where id = $1", [id]);
    const n = await asWorker(() => db.query<{ requeue_stale_jobs: number }>("select public.requeue_stale_jobs('15 minutes')"));
    expect(n.rows[0].requeue_stale_jobs).toBe(1);
    expect((await db.query<{ status: string }>('select status from public.jobs where id = $1', [id])).rows[0].status).toBe('queued');
  });
});

describe('storage policies (approximated on a stub, re-test on real Supabase)', () => {
  const put = (uid: string, name: string) =>
    as(db, uid, () => db.query("insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)", [name, uid]));

  it('lets members stage uploads in their own org only', async () => {
    await expect(put(alice, `${orgA}/staging/abc`)).resolves.toBeTruthy();
    await expect(put(bob, `${orgA}/staging/def`)).rejects.toThrow(/row-level security/);
    await expect(put(alice, `${orgA}/sha256/${sha('q')}`)).rejects.toThrow(/row-level security/);
    await expect(put(alice, `not-a-uuid/staging/x`)).rejects.toThrow(/row-level security/);
  });

  it('keeps viewers from uploading', async () => {
    const viewer = await newUser(db, 'viewer@a.test');
    await db.query("insert into public.members (org_id, user_id, role) values ($1,$2,'viewer')", [orgA, viewer]);
    await expect(put(viewer, `${orgA}/staging/v`)).rejects.toThrow(/row-level security/);
  });

  it('lets members read their org objects, hides other orgs, and forbids edits', async () => {
    await db.query("insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${orgA}/sha256/${sha('r')}`]);
    await as(db, alice, async () => expect(await count("select 1 from storage.objects where name like $1", [`${orgA}/%`])).toBeGreaterThan(0));
    await as(db, bob, async () => expect(await count("select 1 from storage.objects where name like $1", [`${orgA}/%`])).toBe(0));
    const upd = await as(db, alice, () => db.query("update storage.objects set name = name || 'x' where name like $1", [`${orgA}/%`]));
    expect(upd.affectedRows).toBe(0);
    const del = await as(db, alice, () => db.query("delete from storage.objects where name like $1", [`${orgA}/%`]));
    expect(del.affectedRows).toBe(0);
  });

  it('is a private bucket with a size limit and a media allowlist', async () => {
    const b = (await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>("select public, file_size_limit::text, allowed_mime_types from storage.buckets where id = 'documents'")).rows[0];
    expect(b.public).toBe(false);
    expect(b.file_size_limit).toBe('52428800');
    expect(b.allowed_mime_types).toContain('application/pdf');
    expect(b.allowed_mime_types).not.toContain('application/zip');
  });
});
