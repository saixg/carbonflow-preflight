import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, as, createDb, createOrg, createProject, newUser } from './helpers';

let db: PGlite;
let alice: string; // owner of org A
let bob: string; // owner of org B
let aliceOrg: string;
let bobOrg: string;
let aliceProject: string;

beforeAll(async () => {
  db = await createDb();
  alice = await newUser(db, 'alice@a.test');
  bob = await newUser(db, 'bob@b.test');
  aliceOrg = await createOrg(db, alice, 'Org A');
  bobOrg = await createOrg(db, bob, 'Org B');
  aliceProject = await createProject(db, alice, aliceOrg, 'Solar A');
});
afterAll(async () => {
  await db.close();
});

const count = async (sql: string, params: unknown[] = []) =>
  (await db.query<{ c: string }>(`select count(*)::text c from (${sql}) t`, params)).rows[0].c;

describe('org creation', () => {
  it('makes the creator an owner', async () => {
    const r = await as(db, alice, () =>
      db.query<{ role: string }>('select role from public.members where org_id = $1', [aliceOrg]),
    );
    expect(r.rows).toEqual([{ role: 'owner' }]);
  });
  it('rejects anonymous callers and direct inserts', async () => {
    await expect(as(db, null, () => db.query('select public.create_org($1)', ['x']))).rejects.toThrow();
    await expect(as(db, alice, () => db.query("insert into public.orgs (name) values ('x')"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('cross-tenant reads', () => {
  it('hides other orgs, members and projects', async () => {
    await as(db, bob, async () => {
      expect(await count('select 1 from public.projects where id = $1', [aliceProject])).toBe('0');
      expect(await count('select 1 from public.orgs where id = $1', [aliceOrg])).toBe('0');
      expect(await count('select 1 from public.members where org_id = $1', [aliceOrg])).toBe('0');
    });
  });
  it('gives anon no access at all', async () => {
    await expect(as(db, null, () => db.query('select * from public.projects'))).rejects.toThrow(/permission denied/);
  });
});

describe('cross-tenant writes', () => {
  it('blocks inserting a project into another org', async () => {
    await expect(
      as(db, bob, () => db.query("insert into public.projects (org_id, name) values ($1, 'x')", [aliceOrg])),
    ).rejects.toThrow(/row-level security/);
  });
  it('blocks updating another org\'s project', async () => {
    const r = await as(db, bob, () => db.query("update public.projects set name = 'pwned' where id = $1", [aliceProject]));
    expect(r.affectedRows).toBe(0);
    expect((await db.query<{ name: string }>('select name from public.projects where id = $1', [aliceProject])).rows[0].name).toBe('Solar A');
  });
  it('blocks moving a project to another org', async () => {
    await expect(
      as(db, alice, () => db.query('update public.projects set org_id = $1 where id = $2', [bobOrg, aliceProject])),
    ).rejects.toThrow(/immutable|row-level security/);
  });
  it('blocks a period in your org that references another org\'s project', async () => {
    await expect(
      as(db, bob, () =>
        db.query(
          "insert into public.monitoring_periods (org_id, project_id, start_date, end_date) values ($1, $2, '2025-01-01', '2025-12-31')",
          [bobOrg, aliceProject],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });
  it('blocks adding yourself to another org', async () => {
    await expect(
      as(db, bob, () => db.query("insert into public.members (org_id, user_id, role) values ($1, $2, 'owner')", [aliceOrg, bob])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('roles', () => {
  it('lets viewers read but not write', async () => {
    const viewer = await newUser(db, 'viewer@a.test');
    await addMember(db, aliceOrg, viewer, 'viewer');
    await as(db, viewer, async () => {
      expect(await count('select 1 from public.projects where org_id = $1', [aliceOrg])).toBe('1');
    });
    await expect(
      as(db, viewer, () => db.query("insert into public.projects (org_id, name) values ($1, 'v')", [aliceOrg])),
    ).rejects.toThrow(/row-level security/);
  });
  it('lets members create projects but not manage members', async () => {
    const member = await newUser(db, 'member@a.test');
    await addMember(db, aliceOrg, member, 'member');
    await expect(createProject(db, member, aliceOrg, 'M')).resolves.toBeTruthy();
    await expect(
      as(db, member, () => db.query("update public.members set role = 'owner' where user_id = $1", [member])),
    ).resolves.toMatchObject({ affectedRows: 0 });
  });
  it('keeps at least one owner', async () => {
    await expect(
      as(db, alice, () => db.query("update public.members set role = 'viewer' where user_id = $1 and org_id = $2", [alice, aliceOrg])),
    ).rejects.toThrow(/at least one owner/);
    await expect(
      as(db, alice, () => db.query('delete from public.members where user_id = $1 and org_id = $2', [alice, aliceOrg])),
    ).rejects.toThrow(/at least one owner/);
  });
});

describe('monitoring periods', () => {
  const insert = (project: string, org: string, s: string, e: string) =>
    as(db, alice, () =>
      db.query('insert into public.monitoring_periods (org_id, project_id, start_date, end_date) values ($1,$2,$3,$4)', [org, project, s, e]),
    );
  it('rejects end before start', async () => {
    await expect(insert(aliceProject, aliceOrg, '2025-06-01', '2025-05-01')).rejects.toThrow(/dates_chk/);
  });
  it('rejects overlap within a project but allows adjacent and other projects', async () => {
    await insert(aliceProject, aliceOrg, '2024-01-01', '2024-12-31');
    await expect(insert(aliceProject, aliceOrg, '2024-12-31', '2025-06-30')).rejects.toThrow(/no_overlap/);
    await expect(insert(aliceProject, aliceOrg, '2025-01-01', '2025-12-31')).resolves.toBeTruthy();
    const other = await createProject(db, alice, aliceOrg, 'Other');
    await expect(insert(other, aliceOrg, '2024-01-01', '2024-12-31')).resolves.toBeTruthy();
  });
  it('does not let a period change project or org', async () => {
    const other = await createProject(db, alice, aliceOrg, 'Other2');
    await expect(
      as(db, alice, () => db.query("update public.monitoring_periods set project_id = $1 where start_date = '2024-01-01' and project_id = $2", [other, aliceProject])),
    ).rejects.toThrow(/immutable/);
  });
});

describe('audit log', () => {
  it('records creates and changed columns', async () => {
    await as(db, alice, () => db.query("update public.projects set status = 'active' where id = $1", [aliceProject]));
    const r = await db.query<{ action: string; actor_id: string; metadata: any }>(
      "select action, actor_id, metadata from public.audit_log where entity_id = $1 order by id",
      [aliceProject],
    );
    expect(r.rows.map((x) => x.action)).toEqual(['project.insert', 'project.update']);
    expect(r.rows[1].actor_id).toBe(alice);
    expect(r.rows[1].metadata).toEqual({ status: { old: 'draft', new: 'active' } });
  });
  it('is readable by owners/admins of the org only', async () => {
    const member = await newUser(db, 'm2@a.test');
    await addMember(db, aliceOrg, member, 'member');
    await as(db, alice, async () => expect(Number(await count('select 1 from public.audit_log'))).toBeGreaterThan(0));
    await as(db, member, async () => expect(await count('select 1 from public.audit_log')).toBe('0'));
    await as(db, bob, async () =>
      expect(await count('select 1 from public.audit_log where org_id = $1', [aliceOrg])).toBe('0'),
    );
  });
  it('cannot be written, edited or deleted by users', async () => {
    await expect(
      as(db, alice, () => db.query("insert into public.audit_log (org_id, action, entity_type, entity_id) values ($1,'x','x',$1)", [aliceOrg])),
    ).rejects.toThrow(/permission denied/);
    await expect(as(db, alice, () => db.query("update public.audit_log set action = 'x'"))).rejects.toThrow(/permission denied/);
    await expect(as(db, alice, () => db.query('delete from public.audit_log'))).rejects.toThrow(/permission denied/);
  });
  it('is append-only even for privileged roles', async () => {
    await expect(db.query("update public.audit_log set action = 'x'")).rejects.toThrow(/append-only/);
    await expect(db.query('delete from public.audit_log')).rejects.toThrow(/append-only/);
  });
});
