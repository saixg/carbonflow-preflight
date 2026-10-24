import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createDb, createOrg, createPeriod, createProject, newUser, sha } from './helpers';

let db: PGlite;
let alice: string, bob: string, viewer: string;
let orgA: string, orgB: string;
let projA: string, projB: string;
let periodA: string, periodB: string;
let runA: string, runB: string;
let findingA1: string, findingA2: string, findingB: string;

beforeAll(async () => {
  db = await createDb();
  alice = await newUser(db, 'alice@a.test');
  bob = await newUser(db, 'bob@b.test');
  viewer = await newUser(db, 'viewer@a.test');
  orgA = await createOrg(db, alice, 'Org A');
  orgB = await createOrg(db, bob, 'Org B');
  await db.query("insert into public.members (org_id, user_id, role) values ($1,$2,'viewer')", [orgA, viewer]);

  projA = await createProject(db, alice, orgA, 'Project A');
  projB = await createProject(db, bob, orgB, 'Project B');
  await db.query("update public.projects set methodology_id = 'TEST-ONLY', methodology_version = '0.1' where id = any($1)", [[projA, projB]]);

  periodA = await createPeriod(db, alice, orgA, projA);
  periodB = await createPeriod(db, bob, orgB, projB);

  // Create running runs in superuser mode to seed findings
  const rA = await db.query<{ id: string }>(
    `insert into public.runs (org_id, project_id, monitoring_period_id, requested_by, methodology_code, methodology_version, status)
     values ($1,$2,$3,$4,'TEST-ONLY','0.1','running') returning id`,
    [orgA, projA, periodA, alice],
  );
  runA = rA.rows[0].id;

  const fA1 = await db.query<{ id: string }>(
    `insert into public.findings (org_id, run_id, rule_code, rule_version, finding_type, severity, title, explanation, remediation)
     values ($1,$2,'R-001','0.1','data_quality','critical','Missing value','Not provided','Please enter') returning id`,
    [orgA, runA],
  );
  findingA1 = fA1.rows[0].id;

  const fA2 = await db.query<{ id: string }>(
    `insert into public.findings (org_id, run_id, rule_code, rule_version, finding_type, severity, title, explanation, remediation)
     values ($1,$2,'R-002','0.1','inconsistency','material','Unit mismatch','MWh expected','Convert unit') returning id`,
    [orgA, runA],
  );
  findingA2 = fA2.rows[0].id;

  const rB = await db.query<{ id: string }>(
    `insert into public.runs (org_id, project_id, monitoring_period_id, requested_by, methodology_code, methodology_version, status)
     values ($1,$2,$3,$4,'TEST-ONLY','0.1','running') returning id`,
    [orgB, projB, periodB, bob],
  );
  runB = rB.rows[0].id;

  const fB = await db.query<{ id: string }>(
    `insert into public.findings (org_id, run_id, rule_code, rule_version, finding_type, severity, title, explanation, remediation)
     values ($1,$2,'R-001','0.1','data_quality','minor','Check warning','Check details','No action') returning id`,
    [orgB, runB],
  );
  findingB = fB.rows[0].id;

  // Complete runs
  await db.query(
    `update public.runs set status = 'completed', input_snapshot = '{}', input_snapshot_hash = $1, result_hash = $1, rulepack_hash = $1, engine_version = '0.1.0', checks = '[]'
     where id in ($2, $3)`,
    [sha('mock'), runA, runB],
  );
});

afterAll(async () => {
  await db.close();
});

const reviewFinding = (uid: string | null, findingId: string, action: string, comment: string | null = null) =>
  as(db, uid, async () => {
    const res = await db.query<{ review_finding: string }>(
      'select public.review_finding($1, $2, $3)',
      [findingId, action, comment],
    );
    return res.rows[0]?.review_finding;
  });

describe('findings lifecycle and review transitions', () => {
  it('allows acknowledging an open finding', async () => {
    const status = await reviewFinding(alice, findingA1, 'acknowledge');
    expect(status).toBe('acknowledged');

    const res = await db.query('select status from public.findings where id = $1', [findingA1]);
    expect(res.rows[0].status).toBe('acknowledged');

    const reviews = await db.query(
      'select action, reviewer_id from public.finding_reviews where finding_id = $1',
      [findingA1],
    );
    expect(reviews.rows).toHaveLength(1);
    expect(reviews.rows[0].action).toBe('acknowledge');
    expect(reviews.rows[0].reviewer_id).toBe(alice);
  });

  it('requires a comment when resolving or dismissing a finding', async () => {
    // Missing comment must fail
    await expect(reviewFinding(alice, findingA1, 'resolve', null)).rejects.toThrow(/requires a comment/);
    await expect(reviewFinding(alice, findingA1, 'resolve', '  ')).rejects.toThrow(/requires a comment/);
    await expect(reviewFinding(alice, findingA1, 'dismiss', 'ok')).rejects.toThrow(/at least 3 characters/);

    // Valid comment succeeds
    const status = await reviewFinding(alice, findingA1, 'resolve', 'Verified with grid operator meter log');
    expect(status).toBe('resolved');

    const res = await db.query('select status from public.findings where id = $1', [findingA1]);
    expect(res.rows[0].status).toBe('resolved');
  });

  it('allows dismissing an open finding with justification', async () => {
    const status = await reviewFinding(alice, findingA2, 'dismiss', 'Deemed immaterial by lead verifier');
    expect(status).toBe('dismissed');

    const res = await db.query('select status from public.findings where id = $1', [findingA2]);
    expect(res.rows[0].status).toBe('dismissed');
  });

  it('allows reopening a resolved or dismissed finding', async () => {
    const status = await reviewFinding(alice, findingA1, 'reopen');
    expect(status).toBe('open');

    const res = await db.query('select status from public.findings where id = $1', [findingA1]);
    expect(res.rows[0].status).toBe('open');
  });

  it('prevents illegal transitions (e.g. reopening an already open finding)', async () => {
    await expect(reviewFinding(alice, findingA1, 'reopen')).rejects.toThrow(/cannot reopen an open finding/);
  });

  it('enforces append-only on finding_reviews history', async () => {
    const [rev] = (await db.query<{ id: string }>('select id from public.finding_reviews limit 1')).rows;
    await expect(db.query('update public.finding_reviews set comment = $1 where id = $2', ['altered', rev.id])).rejects.toThrow(/append-only/);
    await expect(db.query('delete from public.finding_reviews where id = $1', [rev.id])).rejects.toThrow(/append-only/);
  });
});

describe('findings security and tenant isolation', () => {
  it('prevents users from reviewing findings belonging to another organization', async () => {
    // Bob cannot review Alice's finding
    await expect(reviewFinding(bob, findingA1, 'acknowledge')).rejects.toThrow(/not found/);
    // Alice cannot review Bob's finding
    await expect(reviewFinding(alice, findingB, 'acknowledge')).rejects.toThrow(/not found/);
  });

  it('prevents viewers and anonymous callers from reviewing findings', async () => {
    await expect(reviewFinding(viewer, findingA1, 'acknowledge')).rejects.toThrow(/not found/);
    await expect(reviewFinding(null, findingA1, 'acknowledge')).rejects.toThrow(/permission denied/);
  });

  it('RLS hides finding reviews across tenants', async () => {
    const aliceReviews = await as(db, alice, async () =>
      (await db.query('select * from public.finding_reviews')).rows,
    );
    expect(aliceReviews.length).toBeGreaterThan(0);

    const bobReviews = await as(db, bob, async () =>
      (await db.query('select * from public.finding_reviews')).rows,
    );
    expect(bobReviews).toHaveLength(0); // Bob has not made reviews in Org B yet
  });
});

describe('preflight reports and evidence manifests', () => {
  it('stores immutable reports and enforces tenant isolation', async () => {
    const reportHash = sha('mock-report-content');
    const manifest = {
      version: '1.0',
      run_id: runA,
      input_snapshot_hash: sha('mock'),
      rulepack: { code: 'TEST-ONLY', version: '0.1' },
      engine_version: '0.1.0',
      findings_summary: { critical: 1, material: 1, minor: 0 },
      disclaimer: 'CarbonFlow Preflight is a pre-verification preparedness tool, not a certification.',
    };

    // Alice inserts report
    const r = await db.query<{ id: string }>(
      `insert into public.reports (org_id, project_id, monitoring_period_id, run_id, report_format, content_hash, title, manifest, created_by)
       values ($1,$2,$3,$4,'json',$5,'Preflight Run #1 Report',$6,$7) returning id`,
      [orgA, projA, periodA, runA, reportHash, JSON.stringify(manifest), alice],
    );
    const reportId = r.rows[0].id;

    // Reports are append-only
    await expect(db.query('update public.reports set title = $1 where id = $2', ['new title', reportId])).rejects.toThrow(/append-only/);
    await expect(db.query('delete from public.reports where id = $1', [reportId])).rejects.toThrow(/append-only/);

    // RLS: Alice can read it, Bob cannot
    const aliceReports = await as(db, alice, async () =>
      (await db.query('select * from public.reports where id = $1', [reportId])).rows,
    );
    expect(aliceReports).toHaveLength(1);
    expect(aliceReports[0].title).toBe('Preflight Run #1 Report');

    const bobReports = await as(db, bob, async () =>
      (await db.query('select * from public.reports where id = $1', [reportId])).rows,
    );
    expect(bobReports).toHaveLength(0);
  });
});
