import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { identityHarness, HttpBrowser } from '../helpers/identity-harness.mjs';
import { loginPage, teamReady } from '../helpers/browser-actions.mjs';
import { caveA, caveB } from '../../../packages/tooling/src/identity-test-database.ts';

test('browser invitation acceptance, reload and revocation use actual API and PostgreSQL', async t => {
  const h = await identityHarness({ web: true }); t.after(() => h.stop());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const admin = await browser.newContext(), guest = await browser.newContext();
  const page = await admin.newPage(), recipient = await guest.newPage();
  await loginPage(page, h.appOrigin); await teamReady(page);
  const cookie = (await admin.cookies()).find(c => c.name === 'encave_session');
  assert.equal(cookie.httpOnly, true); assert.equal(cookie.sameSite, 'Lax');
  assert.equal(await page.evaluate(() => document.cookie.includes('encave_session')), false);
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('diane@cave-test.example');
  const responsePromise = page.waitForResponse(r => r.url() === h.appOrigin + '/api/invitations' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Créer l’invitation', exact: true }).click();
  const invitation = await (await responsePromise).json(); assert.ok(invitation.token);
  await expect(page.getByRole('button', { name: 'Copier le lien d’invitation' })).toBeVisible();
  await loginPage(recipient, h.appOrigin, 'Diane Blanc');
  await expect(recipient.getByRole('heading', { name: 'Votre compte n’est lié à aucune cave' })).toBeVisible();
  await recipient.goto(h.appOrigin + '/invitation#' + invitation.token);
  await expect(recipient.getByRole('heading', { name: 'Cave des Roches — test' })).toBeVisible();
  await expect(recipient).toHaveURL(h.appOrigin + '/invitation');
  await recipient.getByRole('button', { name: 'Accepter l’invitation' }).click();
  await recipient.getByRole('link', { name: 'Ouvrir mon espace' }).click();
  await teamReady(recipient); await recipient.reload(); await teamReady(recipient);
  await expect(recipient.getByText('Votre accès est « Lecture ».', { exact: false })).toBeVisible();
  await expect(recipient.getByRole('button', { name: 'Créer l’invitation' })).toHaveCount(0);
  await page.reload(); await teamReady(page);
  await page.getByRole('button', { name: 'Révoquer l’accès de Diane Blanc' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer la révocation' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await recipient.reload();
  await expect(recipient.getByRole('heading', { name: 'Votre accès à cette cave a été révoqué' })).toBeVisible();
  assert.equal((await h.owner.query('SELECT role,revoked_at IS NOT NULL AS revoked FROM members WHERE cave_id=$1 AND identity_id=$2', [caveA, h.people.find(p => p.subject === 'diane').id])).rows[0].revoked, true);
});

test('two browser tabs change caves without rendering a late response from the previous cave', async t => {
  const h = await identityHarness({ web: true }); t.after(() => h.stop());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext(); const first = await context.newPage(), second = await context.newPage();
  await loginPage(first, h.appOrigin); await teamReady(first);
  await second.goto(h.appOrigin + '/espace'); await teamReady(second);
  let resolveHeld, releaseOld;
  const held = new Promise(resolve => { resolveHeld = resolve; });
  const release = new Promise(resolve => { releaseOld = resolve; });
  let intercepted = false;
  await first.route('**/api/team', async route => {
    if (intercepted) { await route.continue(); return; }
    intercepted = true; const response = await route.fetch(); resolveHeld(); await release; await route.fulfill({ response });
  });
  await first.reload(); await held;
  await second.getByLabel('Changer de cave', { exact: true }).selectOption(caveB);
  await expect(second.getByTestId('active-cave')).toHaveText('Cave du Lac — test'); await teamReady(second);
  await expect(first.getByTestId('active-cave')).toHaveText('Cave du Lac — test'); await teamReady(first);
  releaseOld();
  await expect(first.getByText('Bruno Favre', { exact: true })).toHaveCount(0);
  await expect(first.getByText('Émile Girard', { exact: true })).toBeVisible();
});

test('expired sessions and provider refusal have actual visible recovery states', async t => {
  const h = await identityHarness({ web: true }); t.after(() => h.stop());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage();
  await loginPage(page, h.appOrigin); await teamReady(page);
  await h.owner.query("UPDATE app_sessions SET expires_at=now()-interval '1 second'");
  await page.reload(); await expect(page).toHaveURL(h.appOrigin + '/connexion?session=expiree');
  await expect(page.getByRole('status')).toContainText('Votre session a expiré');
  h.identity.controls.tokenFault = 'nonce';
  await page.getByRole('link', { name: 'Se connecter', exact: true }).click();
  await page.getByRole('button', { name: 'Alice Martin' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('La connexion n’a pas abouti');
});

test('a revoked active cave leaves the one remaining authorized cave reachable', async t => {
  const h = await identityHarness({ web: true }); t.after(() => h.stop());
  const brunoId = h.people.find(person => person.subject === 'bruno').id;
  const aliceId = h.people.find(person => person.subject === 'alice').id;
  await h.owner.query("UPDATE members SET role='admin' WHERE cave_id=$1 AND identity_id=$2", [caveA, brunoId]);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); await loginPage(page, h.appOrigin); await teamReady(page);
  const bruno = new HttpBrowser(h.appOrigin); await bruno.login('bruno');
  assert.equal((await bruno.command('/api/members/revoke', { identityId: aliceId, version: 1 })).status, 200);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Votre accès à cette cave a été révoqué' })).toBeVisible();
  await page.getByLabel('Changer de cave', { exact: true }).selectOption(caveB); await teamReady(page);
  await expect(page.getByTestId('active-cave')).toHaveText('Cave du Lac — test');
  await expect(page.getByText('Émile Girard', { exact: true })).toBeVisible();
  await expect(page.getByText('Bruno Favre', { exact: true })).toHaveCount(0);
});

test('one browser cannot consume another browser login quota through the actual Next proxy', async t => {
  const h = await identityHarness({ web: true }); t.after(() => h.stop());
  const first = new HttpBrowser(h.appOrigin), second = new HttpBrowser(h.appOrigin);
  for (let index = 0; index < 40; index++) {
    const response = await first.request('/api/auth/start');
    assert.equal(new URL(response.headers.get('location')).origin, h.identity.issuer);
  }
  assert.equal((await first.request('/api/auth/start')).headers.get('location'), h.appOrigin + '/connexion?erreur=connexion');
  assert.equal((await second.login('alice')).location, h.appOrigin + '/espace');
  assert.equal((await second.session()).status, 200);
  assert.equal((await first.request('/api/auth/start', { headers: { 'x-forwarded-for': '198.51.100.10' } })).headers.get('location'), h.appOrigin + '/connexion?erreur=connexion');
});
