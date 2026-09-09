import test from 'node:test';
import assert from 'node:assert/strict';
import { identityHarness, HttpBrowser } from '../helpers/identity-harness.mjs';
import { caveA, caveB } from '../../../packages/tooling/src/identity-test-database.ts';

async function logged(h, person) {
  const browser = new HttpBrowser(h.appOrigin);
  assert.equal((await browser.login(person)).location, h.appOrigin + '/espace');
  return browser;
}

test('an invitation binds verified identity, cave and role; acceptance persists and cannot replay', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  const alice = await logged(h, 'alice'), diane = await logged(h, 'diane'), bruno = await logged(h, 'bruno');
  const response = await alice.command('/api/invitations', { email: 'diane@cave-test.example', role: 'reader', caveId: caveB });
  assert.equal(response.status, 201); const invitation = await response.json();
  assert.equal((await bruno.command('/api/invitations/preview', { token: invitation.token })).status, 400);
  assert.equal((await bruno.command('/api/invitations/accept', { token: invitation.token })).status, 400);
  const preview = await diane.command('/api/invitations/preview', { token: invitation.token });
  assert.equal(preview.status, 200); assert.equal((await preview.json()).name, 'Cave des Roches — test');
  assert.equal((await diane.command('/api/invitations/accept', { token: invitation.token, role: 'admin', caveId: caveB })).status, 200);
  const session = await diane.session(); assert.equal(session.body.activeCave.id, caveA); assert.equal(session.body.activeCave.role, 'reader');
  assert.equal((await diane.command('/api/invitations/accept', { token: invitation.token })).status, 400);
  assert.equal((await diane.command('/api/invitations', { email: 'other@cave-test.example', role: 'admin' })).status, 403);
  const saved = (await h.owner.query('SELECT role FROM members WHERE cave_id=$1 AND identity_id=$2', [caveA, session.body.identity.id])).rows;
  assert.deepEqual(saved, [{ role: 'reader' }]);
  assert.equal((await h.owner.query("SELECT count(*)::integer AS count FROM identity_audit WHERE action='accept_invitation'")).rows[0].count, 1);
});

test('revocation cuts open sessions in its cave while preserving other memberships and last administrator', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  const alice = await logged(h, 'alice'), bruno = await logged(h, 'bruno'), emile = await logged(h, 'emile');
  const brunoIdentity = (await bruno.session()).body.identity.id;
  await h.owner.query("INSERT INTO members(cave_id,identity_id,role) VALUES($1,$2,'reader')", [caveB, brunoIdentity]);
  const aliceIdentity = (await alice.session()).body.identity.id;
  assert.equal((await alice.command('/api/members/revoke', { identityId: aliceIdentity, version: 1 })).status, 409);
  assert.equal((await bruno.command('/api/members/revoke', { identityId: aliceIdentity, version: 1 })).status, 403);
  const foreign = (await emile.session()).body.identity.id;
  assert.equal((await alice.command('/api/members/revoke', { identityId: foreign, version: 1 })).status, 404);
  assert.equal((await alice.command('/api/members/revoke', { identityId: brunoIdentity, version: 99 })).status, 409);
  assert.equal((await alice.command('/api/members/revoke', { identityId: brunoIdentity, version: 1 })).status, 200);
  assert.equal((await bruno.session()).body.accessRevoked, true);
  assert.equal((await bruno.request('/api/team', { headers: { 'x-encave-cave': caveA } })).status, 403);
  assert.equal((await bruno.command('/api/caves/switch', { caveId: caveB })).status, 200);
  assert.equal((await bruno.session()).body.activeCave.role, 'reader');
  assert.equal((await bruno.request('/api/team', { headers: { 'x-encave-cave': caveB } })).status, 200);
  assert.equal((await bruno.command('/api/caves/switch', { caveId: caveA })).status, 403);
  assert.equal((await emile.session()).body.activeCave.id, caveB);
  assert.equal((await alice.command('/api/caves/switch', { caveId: caveB })).status, 200);
  assert.equal((await alice.session()).body.activeCave.id, caveB);
  assert.equal((await alice.request('/api/team', { headers: { 'x-encave-cave': caveA } })).status, 409);
});

test('an obsolete invitation cannot demote an active member; explicit re-invitation reactivates a revoked member', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  const alice = await logged(h, 'alice'), bruno = await logged(h, 'bruno');
  const aliceId = (await alice.session()).body.identity.id;
  const invitation = await (await alice.command('/api/invitations', { email: 'changed@cave-test.example', role: 'reader' })).json();
  // Model an issuer-verified address change for the same immutable OIDC subject.
  await h.owner.query('UPDATE identities SET email=$1 WHERE id=$2', ['changed@cave-test.example', aliceId]);
  assert.equal((await alice.command('/api/invitations/accept', { token: invitation.token })).status, 409);
  assert.equal((await alice.session()).body.activeCave.role, 'admin');
  assert.equal((await h.owner.query("SELECT count(*)::integer AS count FROM members WHERE cave_id=$1 AND role='admin' AND revoked_at IS NULL", [caveA])).rows[0].count, 1);
  assert.equal((await h.owner.query('SELECT accepted_at FROM invitations WHERE id=$1', [invitation.id])).rows[0].accepted_at, null);
  const brunoId = (await bruno.session()).body.identity.id;
  assert.equal((await alice.command('/api/members/revoke', { identityId: brunoId, version: 1 })).status, 200);
  const fresh = await (await alice.command('/api/invitations', { email: 'bruno@cave-test.example', role: 'reader' })).json();
  assert.equal((await bruno.command('/api/invitations/accept', { token: fresh.token })).status, 200);
  assert.equal((await bruno.session()).body.activeCave.role, 'reader');
});

test('expired and revoked invitations fail; concurrent creation keeps one pending invitation', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  const alice = await logged(h, 'alice'), diane = await logged(h, 'diane');
  const attempts = await Promise.all([1, 2].map(() => alice.command('/api/invitations', { email: 'diane@cave-test.example', role: 'operator' })));
  assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409]);
  const invitation = await attempts.find(r => r.status === 201).json();
  await h.owner.query("UPDATE invitations SET expires_at=now()-interval '1 second' WHERE id=$1", [invitation.id]);
  assert.equal((await diane.command('/api/invitations/accept', { token: invitation.token })).status, 400);
  const next = await (await alice.command('/api/invitations', { email: 'diane@cave-test.example', role: 'operator' })).json();
  assert.equal((await alice.command('/api/invitations/revoke', { id: next.id })).status, 200);
  assert.equal((await diane.command('/api/invitations/accept', { token: next.token })).status, 400);
  assert.equal((await diane.session()).body.activeCave, null);
});

test('concurrent administrator revocations retain an active administrator', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  const alice = await logged(h, 'alice'), diane = await logged(h, 'diane');
  const invitation = await (await alice.command('/api/invitations', { email: 'diane@cave-test.example', role: 'admin' })).json();
  assert.equal((await diane.command('/api/invitations/accept', { token: invitation.token })).status, 200);
  const aliceId = (await alice.session()).body.identity.id, dianeId = (await diane.session()).body.identity.id;
  const [aliceSnapshot, dianeSnapshot] = await Promise.all([alice.session(), diane.session()]);
  const revoke = (browser, snapshot, identityId) => browser.request('/api/members/revoke', {
    method: 'POST', headers: { origin: h.appOrigin, 'content-type': 'application/json', 'x-csrf-token': snapshot.body.csrf, 'x-encave-cave': caveA },
    body: JSON.stringify({ identityId, version: 1 }),
  });
  const outcomes = await Promise.all([
    revoke(alice, aliceSnapshot, dianeId), revoke(diane, dianeSnapshot, aliceId),
  ]);
  assert.equal(outcomes.filter(r => r.status === 200).length, 1);
  assert.equal(outcomes.filter(r => r.status === 403).length, 1);
  assert.equal((await h.owner.query("SELECT count(*)::integer AS count FROM members WHERE cave_id=$1 AND role='admin' AND revoked_at IS NULL", [caveA])).rows[0].count, 1);
});
