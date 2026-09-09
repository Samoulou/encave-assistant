import test from 'node:test';
import assert from 'node:assert/strict';
import { identityHarness, HttpBrowser } from '../helpers/identity-harness.mjs';

test('OIDC HTTP callback creates a persistent session and rejects replay, forged cookies and logout reuse', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  const browser = new HttpBrowser(h.appOrigin);
  assert.equal((await browser.session()).status, 401);
  const result = await browser.login('alice');
  assert.equal(result.location, h.appOrigin + '/espace');
  const authorization = new URL(result.authorization);
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(authorization.searchParams.get('nonce')); assert.ok(authorization.searchParams.get('state'));
  const session = await browser.session();
  assert.equal(session.status, 200); assert.equal(session.body.identity.email, 'alice@cave-test.example');
  assert.equal(session.body.activeCave.role, 'admin');
  assert.equal((await browser.session()).body.identity.id, session.body.identity.id);
  const savedCookie = browser.cookies.get(new URL(h.appOrigin).host).get('encave_session');
  assert.equal((await h.owner.query('SELECT count(*)::integer AS count FROM app_sessions')).rows[0].count, 1);
  const replay = await browser.request(result.callback);
  assert.equal(replay.headers.get('location'), h.appOrigin + '/connexion?erreur=connexion');
  assert.equal((await browser.command('/api/auth/logout', {})).status, 200);
  browser.cookies.get(new URL(h.appOrigin).host).set('encave_session', savedCookie);
  assert.equal((await browser.session()).status, 401);
  browser.cookies.get(new URL(h.appOrigin).host).set('encave_session', 'a'.repeat(43));
  assert.equal((await browser.session()).status, 401);
});

test('signed token protocol faults never establish an application session', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  for (const fault of ['signature', 'issuer', 'audience', 'nonce', 'expired', 'unverified_email']) {
    h.identity.controls.tokenFault = fault;
    const browser = new HttpBrowser(h.appOrigin);
    const result = await browser.login('alice');
    assert.equal(result.location, h.appOrigin + '/connexion?erreur=connexion', fault);
    assert.equal((await browser.session()).status, 401, fault);
  }
  assert.equal((await h.owner.query('SELECT count(*)::integer AS count FROM app_sessions')).rows[0].count, 0);
});

test('mutations reject foreign origins, missing CSRF and unauthorized caves', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  const browser = new HttpBrowser(h.appOrigin); await browser.login('claire');
  assert.equal((await browser.command('/api/invitations', { email: 'diane@cave-test.example', role: 'admin' })).status, 403);
  assert.equal((await browser.command('/api/auth/logout', {}, { origin: 'https://attacker.example' })).status, 403);
  assert.equal((await browser.command('/api/auth/logout', {}, { 'x-csrf-token': '' })).status, 403);
  assert.equal((await browser.command('/api/caves/switch', { caveId: '22222222-2222-4222-8222-222222222222' })).status, 403);
  assert.equal((await browser.session()).status, 200);
  const privileges = (await h.pool.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
  assert.deepEqual(privileges, { rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false });
  await assert.rejects(h.pool.query("UPDATE caves SET name='Unauthorized'"), { code: '42501' });
  await assert.rejects(h.pool.query('CREATE TABLE unauthorized_table(id int)'), { code: '42501' });
});

test('a substituted authorization state and an expired server session are refused', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  const browser = new HttpBrowser(h.appOrigin);
  const refused = await browser.login('alice', value => { const url = new URL(value); url.searchParams.set('state', 'b'.repeat(43)); return url.href; });
  assert.equal(refused.location, h.appOrigin + '/connexion?erreur=connexion');
  assert.equal((await browser.session()).status, 401);
  assert.equal((await browser.login('alice')).location, h.appOrigin + '/espace');
  await h.owner.query("UPDATE app_sessions SET expires_at=now()-interval '1 second'");
  assert.equal((await browser.session()).status, 401);
});
