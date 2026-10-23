import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDoc, addEvidence, as, createDb, createOrg, createPeriod, createProject, newUser, sha } from './helpers';

let db: PGlite;
let alice: string, bob: string, viewer: string;
let orgA: string, orgB: string;
let projA: string, projNoMeth: string, projB: string;
let periodA: string, periodNoMeth: string, periodB: string;
let evidenceA: string;

beforeAll(async () => {
  db = await createDb();
  alice = await newUser(db, 'alice@a.test');
  bob = await newUser(db, 'bob@b.test');
  viewer = await newUser(db, 'viewer@a.test');
  orgA = await createOrg(db, alice, 'Org A');
  orgB = await createOrg(db, bob, 'Org B');
  await db.query("insert into public.members (org_id, user_id, role) values ($1,$2,'viewer')", [orgA, viewer]);
  projA = await createProject(db, alice, orgA, 'A');
  projNoMeth = await createProject(db, alice, orgA, 'No methodology');
  projB = await createProject(db, bob, orgB, 'B');
  await db.query("update public.projects set methodology_id = 'TEST-ONLY', methodology_version = '0.1' where id = any($1)", [[projA, projB]]);
  periodA = await createPeriod(db, alice, orgA, projA);
  periodNoMeth = await createPeriod(db, alice, orgA, projNoMeth);
  periodB = await createPeriod(db, bob, orgB, projB);
  const d = await addDoc(db, { org: orgA, project: projA, period: periodA, user: alice });
  evidenceA = await addEvidence(db, orgA, d.id);
});
afterAll(async () => {
  await db.close();
});

const q = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const rpc = <T>(uid: string | null, sql: string, params: unknown[]) => as(db, uid, async () => (await db.query<T>(sql, params)).rows[0]);
const enter = (uid: string | null, period: string, code: string, original: string, num: number | null, date: string | null, unit: string | null, ev: string | null) =>
  rpc<{ enter_manual_value: string }>(uid, 'select public.enter_manual_value($1,$2,$3,$4,$5,$6,$7)', [period, code, original, num, date, unit, ev]).then((r) => r.enter_manual_value);
const review = (uid: string, id: string, action: string, comment: string | null = null, num: number | null = null, date: string | null = null) =>
  rpc<{ review_value: string }>(uid, 'select public.review_value($1,$2,$3,$4,$5)', [id, action, comment, num, date]).then((r) => r.review_value);

describe('manual values', () => {
  it('without evidence is an explicit assertion flagged for review', async () => {
    const id = await enter(alice, periodA, 'net_export_mwh', '152,345 MWh', 152345, null, 'MWh', null);
    const [v] = await q('select source_type, review_status, asserted_by, normalized_value::text n from public.parameter_values where id = $1', [id]);
    expect(v).toMatchObject({ source_type: 'asserted', review_status: 'needs_review', asserted_by: alice, n: '152345' });
  });

  it('with evidence is a normal value waiting for review', async () => {
    const id = await enter(alice, periodA, 'period_start', '01 January 2023', null, '2023-01-01', null, evidenceA);
    const [v] = await q('select source_type, review_status, asserted_by, normalized_date::text d from public.parameter_values where id = $1', [id]);
    expect(v).toMatchObject({ source_type: 'manual_evidenced', review_status: 'needs_review', asserted_by: null, d: '2023-01-01' });
  });

  it('rejects unknown parameters, number plus date, other tenants, viewers and anonymous callers', async () => {
    await expect(enter(alice, periodA, 'made_up', 'x', 1, null, null, null)).rejects.toThrow(/unknown parameter/);
    await expect(enter(alice, periodA, 'net_export_mwh', 'x', 1, '2023-01-01', 'MWh', null)).rejects.toThrow(/not both/);
    await expect(enter(bob, periodA, 'net_export_mwh', 'x', 1, null, 'MWh', null)).rejects.toThrow(/not found/);
    await expect(enter(viewer, periodA, 'net_export_mwh', 'x', 1, null, 'MWh', null)).rejects.toThrow(/not found/);
    await expect(enter(null, periodA, 'net_export_mwh', 'x', 1, null, 'MWh', null)).rejects.toThrow(/permission denied/);
  });

  it('cannot borrow evidence from another project or tenant', async () => {
    const dB = await addDoc(db, { org: orgB, project: projB, period: periodB, user: bob });
    const eB = await addEvidence(db, orgB, dB.id);
    await expect(enter(alice, periodA, 'net_export_mwh', 'x', 1, null, 'MWh', eB)).rejects.toThrow();
  });

  it('is audited', async () => {
    const rows = await q("select count(*)::int c from public.audit_log where action = 'parameter_value.insert' and org_id = $1", [orgA]);
    expect(rows[0].c).toBeGreaterThanOrEqual(2);
  });
});

describe('reviewing values', () => {
  const fresh = (num = 100) => enter(alice, periodA, 'installed_capacity_mw', `${num} MW`, num, null, 'MW', evidenceA);
  const status = async (id: string) => (await q('select review_status s, reviewed_by from public.parameter_values where id = $1', [id]))[0];

  it('confirming makes a value authoritative', async () => {
    const id = await fresh();
    expect((await q('select 1 from public.authoritative_values where id = $1', [id])).length).toBe(0);
    await review(alice, id, 'confirm');
    expect(await status(id)).toMatchObject({ s: 'human_confirmed', reviewed_by: alice });
    expect((await q('select 1 from public.authoritative_values where id = $1', [id])).length).toBe(1);
  });

  it('rejecting and correcting need a comment', async () => {
    const id = await fresh();
    await expect(review(alice, id, 'reject')).rejects.toThrow(/comment is required/);
    await expect(review(alice, id, 'correct', '  ', 90)).rejects.toThrow(/comment is required/);
    await review(alice, id, 'reject', 'wrong table');
    expect((await status(id)).s).toBe('rejected');
  });

  it('a correction is a new row that replaces the old one and keeps its evidence', async () => {
    const id = await fresh(100);
    const newId = await review(alice, id, 'correct', 'typo in the report', 98.5);
    expect(newId).not.toBe(id);
    const [n] = await q('select review_status, supersedes_id, evidence_ref_id, normalized_value::text v from public.parameter_values where id = $1', [newId]);
    expect(n).toMatchObject({ review_status: 'human_corrected', supersedes_id: id, evidence_ref_id: evidenceA, v: '98.5' });
    expect((await status(id)).s).toBe('rejected');
    const auth = await q("select id from public.authoritative_values where parameter_def_id = (select parameter_def_id from public.parameter_values where id = $1) and id = any($2)", [id, [id, newId]]);
    expect(auth.map((r: any) => r.id)).toEqual([newId]);
  });

  it('only values waiting for review can be reviewed, only with evidence can be corrected', async () => {
    const id = await fresh();
    await review(alice, id, 'confirm');
    await expect(review(alice, id, 'confirm')).rejects.toThrow(/not waiting/);
    const asserted = await enter(alice, periodA, 'net_export_mwh', '5', 5, null, 'MWh', null);
    await expect(review(alice, asserted, 'correct', 'x', 6)).rejects.toThrow(/only a value with evidence/);
    await expect(review(alice, await fresh(), 'frobnicate')).rejects.toThrow(/unknown action/);
  });

  it('is limited to writers of the same organization', async () => {
    const id = await fresh();
    await expect(review(bob, id, 'confirm')).rejects.toThrow(/not found/);
    await expect(review(viewer, id, 'confirm')).rejects.toThrow(/not found/);
    expect((await status(id)).s).toBe('needs_review');
  });
});

describe('requesting a run', () => {
  const request = (uid: string | null, period: string) =>
    rpc<{ request_run: string }>(uid, 'select public.request_run($1)', [period]).then((r) => r.request_run);

  it('needs a methodology on the project', async () => {
    await expect(request(alice, periodNoMeth)).rejects.toThrow(/methodology/);
  });

  it('creates one queued run and one job, and refuses a second while one is open', async () => {
    const id = await request(alice, periodA);
    const [run] = await q('select status, methodology_code, methodology_version, previous_run_id from public.runs where id = $1', [id]);
    expect(run).toMatchObject({ status: 'queued', methodology_code: 'TEST-ONLY', methodology_version: '0.1', previous_run_id: null });
    const jobs = await q("select kind, payload from public.jobs where kind = 'run_preflight' and payload->>'run_id' = $1", [id]);
    expect(jobs).toHaveLength(1);
    await expect(request(alice, periodA)).rejects.toThrow(/already in progress/);
  });

  it('links a rerun to the previous completed run', async () => {
    const open = (await q("select id from public.runs where monitoring_period_id = $1 and status = 'queued'", [periodA]))[0].id;
    await db.query("update public.runs set status = 'running', started_at = now() where id = $1", [open]);
    await db.query(
      `update public.runs set status = 'completed', completed_at = now(), input_snapshot = '{}', input_snapshot_hash = $2,
         result_hash = $2, rulepack_hash = $2, engine_version = 'e', checks = '[]', checks_applicable = 0, checks_passed = 0 where id = $1`,
      [open, sha('x')],
    );
    const next = await request(alice, periodA);
    expect((await q('select previous_run_id from public.runs where id = $1', [next]))[0].previous_run_id).toBe(open);
  });

  it('is limited to writers of the same organization', async () => {
    await expect(request(bob, periodA)).rejects.toThrow(/not found/);
    await expect(request(viewer, periodA)).rejects.toThrow(/not found/);
    await expect(request(null, periodA)).rejects.toThrow(/permission denied/);
  });
});

describe('run and finding integrity', () => {
  const newRun = async () => {
    const r = await q<{ id: string }>(
      `insert into public.runs (org_id, project_id, monitoring_period_id, requested_by, methodology_code, methodology_version)
       values ($1,$2,$3,$4,'TEST-ONLY','0.1') returning id`,
      [orgB, projB, periodB, bob],
    );
    return r[0].id;
  };
  const complete = (id: string) =>
    db.query(
      `update public.runs set status = 'completed', input_snapshot = '{}', input_snapshot_hash = $2, result_hash = $2,
         rulepack_hash = $2, engine_version = 'e', checks = '[]', checks_applicable = 2, checks_passed = 1 where id = $1`,
      [id, sha('r')],
    );
  const addFinding = (run: string, org = orgB) =>
    db.query<{ id: string }>(
      `insert into public.findings (org_id, run_id, rule_code, rule_version, finding_type, severity, title, explanation, remediation)
       values ($1,$2,'T-1','0.1.0','data_quality','critical','t','e','r') returning id`,
      [org, run],
    );

  it('follows queued, running, completed and then never changes', async () => {
    const run = await newRun();
    await expect(complete(run)).rejects.toThrow(/invalid run status/); // cannot skip running
    await db.query("update public.runs set status = 'running' where id = $1", [run]);
    await expect(db.query("update public.runs set requested_by = $2 where id = $1", [run, alice])).rejects.toThrow(/immutable/);
    await expect(db.query("update public.runs set status = 'completed' where id = $1", [run])).rejects.toThrow(/must record its inputs/);
    await complete(run);
    await expect(db.query("update public.runs set error_summary = 'x' where id = $1", [run])).rejects.toThrow(/finished run cannot be changed/);
    await expect(db.query('delete from public.runs where id = $1', [run])).rejects.toThrow(/append-only/);
  });

  it('only accepts findings while the run is running, and links evidence inside the tenant', async () => {
    const run = await newRun();
    await expect(addFinding(run)).rejects.toThrow(/running run/);
    await db.query("update public.runs set status = 'running' where id = $1", [run]);
    const f = (await addFinding(run)).rows[0].id;
    const dB = await addDoc(db, { org: orgB, project: projB, period: periodB, user: bob });
    const eB = await addEvidence(db, orgB, dB.id);
    await db.query('insert into public.finding_evidence (finding_id, evidence_ref_id, org_id) values ($1,$2,$3)', [f, eB, orgB]);
    await expect(db.query('insert into public.finding_evidence (finding_id, evidence_ref_id, org_id) values ($1,$2,$3)', [f, evidenceA, orgB])).rejects.toThrow();
    await expect(addFinding(run, orgA)).rejects.toThrow(/findings_run_fk/);
    await complete(run);
    await expect(addFinding(run)).rejects.toThrow(/running run/);
    await expect(db.query('insert into public.finding_evidence (finding_id, evidence_ref_id, org_id) values ($1,$2,$3)', [f, eB, orgB])).rejects.toThrow(/running run|duplicate/);
  });

  it('keeps findings fixed and hidden from other tenants', async () => {
    const run = await newRun();
    await db.query("update public.runs set status = 'running' where id = $1", [run]);
    const f = (await addFinding(run)).rows[0].id;
    await expect(db.query("update public.findings set title = 'x' where id = $1", [f])).rejects.toThrow(/immutable/);
    await expect(db.query('delete from public.findings where id = $1', [f])).rejects.toThrow(/append-only/);
    await as(db, bob, async () => expect((await db.query('select 1 from public.findings where id = $1', [f])).rows).toHaveLength(1));
    await as(db, alice, async () => expect((await db.query('select 1 from public.findings where id = $1', [f])).rows).toHaveLength(0));
    await expect(as(db, bob, () => db.query("update public.findings set status = 'resolved' where id = $1", [f]))).rejects.toThrow(/permission denied/);
  });

  it('keeps rulepacks append-only but readable', async () => {
    await db.query(
      `insert into public.rulepacks (pack_id, version, label, test_only, methodology_code, methodology_version, content_hash, content)
       values ('test-only','0.1.0','TEST ONLY',true,'TEST-ONLY','0.1',$1,'{}')`,
      [sha('pack')],
    );
    await expect(db.query("update public.rulepacks set label = 'x'")).rejects.toThrow(/append-only/);
    await as(db, bob, async () => expect((await db.query('select 1 from public.rulepacks')).rows).toHaveLength(1));
    await expect(as(db, bob, () => db.query('delete from public.rulepacks'))).rejects.toThrow(/permission denied/);
  });

  it('stores a date value without a number and refuses both', async () => {
    await expect(
      db.query(
        `insert into public.parameter_values (org_id, project_id, monitoring_period_id, parameter_def_id, original_value, normalized_value, normalized_date, unit, source_type, asserted_by)
         select $1,$2,$3,id,'x',1,'2023-01-01','MWh','asserted',$4 from public.parameter_defs limit 1`,
        [orgA, projA, periodA, alice],
      ),
    ).rejects.toThrow(/pv_one_normalized_chk/);
  });
});
