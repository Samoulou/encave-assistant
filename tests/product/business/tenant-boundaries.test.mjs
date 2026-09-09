import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { executeExportTask, runNextExport, requireApplicationRole } from '@encave/tenancy';
import { tenantHarness, logged, eventually } from '../helpers/tenant-harness.mjs';
import { caveA, caveB } from '../../../packages/tooling/src/identity-test-database.ts';

test('actual application role rejects composite references and a forged task envelope', async t => {
  const h = await tenantHarness(); t.after(() => h.stop());
  await requireApplicationRole(h.pool); await assert.rejects(requireApplicationRole(h.owner), /excessive privileges/);
  const alice = await logged(h, 'alice'), emile = await logged(h, 'emile');
  const a = await (await alice.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() })).json();
  const b = await (await emile.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() })).json();
  const job = (await h.pool.query('SELECT * FROM team_export_jobs WHERE export_id=$1', [a.id])).rows[0];
  const task = { jobId: job.id, caveId: job.cave_id, exportId: job.export_id };
  await assert.rejects(h.pool.query('UPDATE team_export_jobs SET export_id=$1 WHERE id=$2', [b.id, job.id]), { code: '23503' });
  await assert.rejects(h.pool.query('UPDATE team_export_jobs SET cave_id=$1 WHERE id=$2', [caveB, job.id]), { code: '23503' });
  await assert.rejects(h.pool.query('ALTER TABLE team_exports DISABLE TRIGGER ALL'), { code: '42501' });
  await assert.rejects(executeExportTask(h.pool, { ...task, caveId: caveB }), { code: 'task_scope_forbidden' });
  await assert.rejects(executeExportTask(h.pool, { ...task, exportId: b.id }), { code: 'task_scope_forbidden' });
  assert.equal((await h.pool.query('SELECT content FROM team_exports WHERE cave_id=$1 AND id=$2', [caveA, a.id])).rows[0].content, null);
  assert.equal(await executeExportTask(h.pool, task), true); assert.equal(await executeExportTask(h.pool, task), false);
  const rendered = (await h.pool.query('SELECT content FROM team_exports WHERE cave_id=$1 AND id=$2', [caveA, a.id])).rows[0].content;
  assert.ok(rendered.includes('Bruno Favre')); assert.ok(!rendered.includes('Émile Girard'));
});

test('revocation after enqueue prevents work and a later reactivation cannot recover the old export', async t => {
  const h = await tenantHarness(); t.after(() => h.stop());
  const alice = await logged(h, 'alice'), bruno = await logged(h, 'bruno');
  const aliceId = (await alice.session()).body.identity.id, brunoId = (await bruno.session()).body.identity.id;
  await h.owner.query("UPDATE members SET role='admin' WHERE cave_id=$1 AND identity_id=$2", [caveA, brunoId]);
  const item = await (await alice.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() })).json();
  assert.equal((await bruno.command('/api/members/revoke', { identityId: aliceId, version: 1 })).status, 200);
  assert.equal(await runNextExport(h.pool), true);
  const row = (await h.pool.query('SELECT state,error_code,content FROM team_exports')).rows[0];
  assert.deepEqual(row, { state: 'refused', error_code: 'access_changed', content: null });
  assert.equal((await alice.request(`/api/team/exports/${item.id}/download`, { headers: { 'x-encave-cave': caveA } })).status, 403);
  const invitation = await (await bruno.command('/api/invitations', { email: 'alice@cave-test.example', role: 'admin' })).json();
  assert.equal((await alice.command('/api/invitations/accept', { token: invitation.token })).status, 200);
  assert.equal((await alice.request(`/api/team/exports/${item.id}/download`, { headers: { 'x-encave-cave': caveA } })).status, 403);
});

test('a killed worker rolls back its claim and a new process finishes the durable export', async t => {
  const h = await tenantHarness(); t.after(() => h.stop()); const alice = await logged(h, 'alice');
  await alice.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() });
  const lock = await h.owner.connect();
  try {
    await lock.query('BEGIN'); await lock.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [caveA]);
    const worker = await h.startWorker();
    await eventually(async () => assert.ok((await h.owner.query("SELECT 1 FROM pg_stat_activity WHERE application_name='encave-team-export-worker' AND wait_event='advisory'")).rowCount > 0), 3000);
    await h.stopWorker(worker);
    assert.equal((await h.pool.query('SELECT state FROM team_export_jobs')).rows[0].state, 'pending');
    await lock.query('COMMIT');
    await h.startWorker();
    await eventually(async () => assert.equal((await h.pool.query('SELECT state FROM team_exports')).rows[0].state, 'ready'));
    assert.equal((await h.pool.query('SELECT count(*)::integer AS count FROM team_exports')).rows[0].count, 1);
  } finally { await lock.query('ROLLBACK'); lock.release(); }
});

test('two concurrent worker transactions produce one result for one pending task', async t => {
  const h = await tenantHarness(); t.after(() => h.stop()); const alice = await logged(h, 'alice');
  await alice.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() });
  const results = await Promise.all([runNextExport(h.pool), runNextExport(h.pool)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await h.pool.query("SELECT count(*)::integer AS n FROM team_export_jobs WHERE state='done'")).rows[0].n, 1);
  assert.equal((await h.pool.query("SELECT count(*)::integer AS n FROM team_exports WHERE state='ready' AND content IS NOT NULL")).rows[0].n, 1);
});
