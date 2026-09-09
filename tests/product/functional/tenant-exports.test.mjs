import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tenantHarness, logged, eventually } from '../helpers/tenant-harness.mjs';
import { caveA, caveB } from '../../../packages/tooling/src/identity-test-database.ts';

test('real export API derives cave and actor from session and refuses foreign identifiers and roles', async t => {
  const h = await tenantHarness(); t.after(() => h.stop());
  const alice = await logged(h, 'alice'), emile = await logged(h, 'emile'), claire = await logged(h, 'claire');
  for (const body of [{ caveId: caveB }, { tenant_id: caveB, role: 'admin' }, { model: { actor: h.people[0].id, cave: caveB } }, { connection_id: randomUUID() }]) {
    assert.equal((await alice.command('/api/team/exports', body, { 'idempotency-key': randomUUID() })).status, 400);
  }
  assert.equal((await claire.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() })).status, 403);
  assert.equal((await alice.command('/api/team/exports', {}, { 'idempotency-key': randomUUID(), 'x-encave-cave': caveB })).status, 409);
  const create = browser => browser.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() });
  const a = await (await create(alice)).json(), b = await (await create(emile)).json();
  assert.equal(a.caveId, caveA); assert.equal(b.caveId, caveB);
  assert.equal((await alice.request(`/api/team/exports/${b.id}`, { headers: { 'x-encave-cave': caveA } })).status, 404);
  assert.equal((await alice.request(`/api/team/exports/${b.id}/download`, { headers: { 'x-encave-cave': caveA } })).status, 404);
  assert.equal((await emile.request(`/api/team/exports/${a.id}/download`, { headers: { 'x-encave-cave': caveB } })).status, 404);
  assert.equal((await alice.request(`/api/team/exports/${a.id}/download`, { headers: { 'x-encave-cave': caveA } })).status, 409);
  await h.startWorker();
  await eventually(async () => assert.equal((await h.pool.query("SELECT count(*)::integer AS count FROM team_exports WHERE state='ready'")).rows[0].count, 2));
  const response = await alice.request(`/api/team/exports/${a.id}/download`, { headers: { 'x-encave-cave': caveA } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.match(response.headers.get('content-disposition'), /^attachment; filename="equipe-/);
  const csvA = await response.text(); assert.ok(csvA.includes('Bruno Favre')); assert.ok(!csvA.includes('Émile Girard'));
  const csvB = await (await emile.request(`/api/team/exports/${b.id}/download`, { headers: { 'x-encave-cave': caveB } })).text();
  assert.ok(csvB.includes('Émile Girard')); assert.ok(!csvB.includes('Bruno Favre'));
  assert.equal((await claire.request(`/api/team/exports/${a.id}/download`, { headers: { 'x-encave-cave': caveA } })).status, 403);
});

test('request replay creates one durable task and expiry prevents later download', async t => {
  const h = await tenantHarness(); t.after(() => h.stop()); const alice = await logged(h, 'alice');
  const key = randomUUID();
  const responses = await Promise.all([1, 2].map(() => alice.command('/api/team/exports', {}, { 'idempotency-key': key })));
  assert.deepEqual(responses.map(response => response.status), [202, 202]);
  const items = await Promise.all(responses.map(response => response.json())); assert.equal(items[0].id, items[1].id);
  assert.equal((await h.pool.query('SELECT count(*)::integer AS count FROM team_export_jobs')).rows[0].count, 1);
  await h.startWorker(); await eventually(async () => assert.equal((await h.pool.query('SELECT state FROM team_exports')).rows[0].state, 'ready'));
  await h.owner.query("UPDATE team_exports SET expires_at=now()-interval '1 second'");
  assert.equal((await alice.request(`/api/team/exports/${items[0].id}/download`, { headers: { 'x-encave-cave': caveA } })).status, 410);
  await eventually(async () => assert.equal((await h.pool.query('SELECT content FROM team_exports')).rows[0].content, null));
});

test('identical display names in two caves never substitute for authorized identifiers', async t => {
  const h = await tenantHarness(); t.after(() => h.stop());
  const alice = await logged(h, 'alice'), emile = await logged(h, 'emile');
  const brunoId = h.people.find(person => person.subject === 'bruno').id;
  const emileId = h.people.find(person => person.subject === 'emile').id;
  await h.owner.query("UPDATE identities SET display_name='Camille Test' WHERE id=ANY($1::uuid[])", [[brunoId, emileId]]);
  const a = await (await alice.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() })).json();
  const b = await (await emile.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() })).json();
  await h.startWorker(); await eventually(async () => assert.equal((await h.pool.query("SELECT count(*)::integer AS n FROM team_exports WHERE state='ready'")).rows[0].n, 2));
  const csvA = await (await alice.request(`/api/team/exports/${a.id}/download`, { headers: { 'x-encave-cave': caveA } })).text();
  const csvB = await (await emile.request(`/api/team/exports/${b.id}/download`, { headers: { 'x-encave-cave': caveB } })).text();
  assert.ok(csvA.includes('Camille Test')); assert.ok(csvB.includes('Camille Test'));
  assert.ok(csvA.includes('bruno@cave-test.example')); assert.ok(!csvA.includes('emile@cave-test.example'));
  assert.ok(csvB.includes('emile@cave-test.example')); assert.ok(!csvB.includes('bruno@cave-test.example'));
  assert.equal((await alice.command('/api/members/revoke', { identityId: emileId, version: 1 })).status, 404);
  assert.equal((await emile.request(`/api/team/exports/${a.id}`, { headers: { 'x-encave-cave': caveB } })).status, 404);
});
