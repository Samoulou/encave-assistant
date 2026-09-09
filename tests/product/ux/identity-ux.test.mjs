import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityHarness, HttpBrowser } from '../helpers/identity-harness.mjs';
import { loginPage, teamReady } from '../helpers/browser-actions.mjs';
import { zoomBrowser } from '../helpers/ux-browser.mjs';
import { caveA, caveB } from '../../../packages/tooling/src/identity-test-database.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const runDirectory = join(root, '.local/ux/EA-05', `${Date.now()}-${randomBytes(3).toString('hex')}`);
await mkdir(runDirectory, { recursive: true });
const evidence = { note: 'Actual browser captures on synthetic identities; test verdict is reported separately by node:test.', captures: [], measurements: [] };
async function capture(name, page, bytes, details = {}) {
  assert.equal(Boolean(new URL(page.url()).hash), false, 'No bearer fragment in captured page');
  const path = join(runDirectory, name + '.png');
  if (bytes) await writeFile(path, bytes);
  else await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  evidence.captures.push({ name, path, sha256: createHash('sha256').update(await readFile(path)).digest('hex'), viewport: page.viewportSize(), ...details });
}

async function captureZoom(name, page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await page.evaluate(() => scrollTo(0, 0));
    for (let index = 0; index < 24; index++) {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const metrics = await page.evaluate(() => ({ scrollY, innerWidth, innerHeight, height: document.documentElement.scrollHeight, devicePixelRatio }));
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      await capture(`${name}-view-${index + 1}`, page, Buffer.from(shot.data, 'base64'), { method: 'CDP visible viewport, no clip; overlapping vertical scroll', ...metrics });
      if (metrics.scrollY + metrics.innerHeight >= metrics.height - 1) return;
      await page.evaluate(() => scrollBy(0, Math.floor(innerHeight * .9)));
    }
    assert.fail('Zoom capture did not reach the bottom within 24 views');
  } finally { await cdp.detach(); await page.evaluate(() => scrollTo(0, 0)); }
}
after(async () => {
  await writeFile(join(runDirectory, 'manifest.json'), JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(join(root, '.local/ux/EA-05/latest.json'), JSON.stringify({ directory: runDirectory, verdict: 'see_test_log' }) + '\n');
  console.log(`UX captures: ${evidence.captures.length}; manifest ${join(runDirectory, 'manifest.json')}`);
});

async function tabTo(page, locator) {
  for (let index = 0; index < 40; index++) {
    if (await locator.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  assert.fail('Essential control not reached by Tab within bounded traversal');
}

async function inspectLayout(page, label) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const controls = [...document.querySelectorAll('button,input,select,a.button,nav a')].filter(el => {
      const r = el.getBoundingClientRect(); return r.width && r.height && getComputedStyle(el).visibility !== 'hidden';
    }).map(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
    const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = color => rgb(color).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const background = element => {
      for (let current = element; current; current = current.parentElement) {
        const c = getComputedStyle(current).backgroundColor;
        if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      }
      return 'rgb(255,255,255)';
    };
    const pairs = [...document.querySelectorAll('h1,h2,h3,p,label,strong,.role-badge,.button,.member-identity span,nav a')]
      .filter(el => el.getBoundingClientRect().height && !el.closest('dialog:not([open])'))
      .map(el => contrast(getComputedStyle(el).color, background(el)));
    const borders = [...document.querySelectorAll('input,select')].map(el => contrast(getComputedStyle(el).borderTopColor, background(el)));
    return { width, scrollWidth: document.documentElement.scrollWidth, controls, minimumTextContrast: Math.min(...pairs), minimumFieldContrast: Math.min(...borders) };
  });
  assert.ok(result.scrollWidth <= result.width + 1, label + ': horizontal overflow');
  for (const control of result.controls) {
    assert.ok(control.width >= 43.9 && control.height >= 43.9, label + ': target below 44px');
    assert.ok(control.left >= -1 && control.right <= result.width + 1, label + ': control outside layout');
  }
  assert.ok(result.minimumTextContrast >= 4.5, label + ': text contrast');
  assert.ok(result.minimumFieldContrast >= 3, label + ': field contrast');
  evidence.measurements.push({ label, ...result });
}

test('real responsive renderings, contrast and browser zoom preserve usable controls', async t => {
  const h = await identityHarness({ web: true }); t.after(() => h.stop());
  const browser = await zoomBrowser(); t.after(() => browser.stop());
  const page = browser.context.pages()[0];
  await loginPage(page, h.appOrigin); await teamReady(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await inspectLayout(page, `workspace-${width}`); await capture(`workspace-${width}`, page);
  }
  assert.equal(await browser.zoom(page, 2), 2);
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(720);
  await inspectLayout(page, 'browser-zoom-200'); await captureZoom('browser-zoom-200', page);
  assert.equal(await browser.zoom(page, 1), 1);
  await page.setViewportSize({ width: 1280, height: 1000 });
  assert.ok(Math.abs((await browser.zoom(page, 4)) - 4) <= Number.EPSILON * 4);
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(320);
  await inspectLayout(page, 'browser-zoom-400'); await captureZoom('browser-zoom-400', page);
  await browser.zoom(page, 1);
});

test('invitation states and recovery after cave revocation are visually reviewable', async t => {
  const h = await identityHarness({ web: true }); t.after(() => h.stop());
  const admin = new HttpBrowser(h.appOrigin); await admin.login('alice');
  const invitation = await (await admin.command('/api/invitations', { email: 'diane@cave-test.example', role: 'reader' })).json();
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(h.appOrigin + '/invitation#' + invitation.token);
  await expect(page.getByRole('link', { name: 'Se connecter', exact: true })).toBeVisible();
  await capture('invitation-login-required-mobile', page);
  await loginPage(page, h.appOrigin, 'Diane Blanc');
  let release; const waiting = new Promise(resolve => { release = resolve; });
  await page.route('**/api/invitations/preview', async route => { await waiting; await route.continue(); });
  await page.goto(h.appOrigin + '/invitation');
  await expect(page.getByRole('status')).toContainText('Vérification'); await capture('invitation-loading-mobile', page);
  release(); await expect(page.getByRole('heading', { name: 'Cave des Roches — test' })).toBeVisible();
  await page.unroute('**/api/invitations/preview');
  await capture('invitation-preview-mobile', page);
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture('invitation-preview-desktop', page);
  await page.getByRole('button', { name: 'Accepter l’invitation' }).click();
  await expect(page.getByRole('heading', { name: 'Vous faites partie de l’équipe' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); await capture('invitation-success-mobile', page);
  await loginPage(page, h.appOrigin); await teamReady(page);
  await page.getByRole('button', { name: 'Révoquer l’accès de Bruno Favre' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await capture('revoke-dialog-mobile', page);
  await page.keyboard.press('Escape');
  const brunoId = h.people.find(person => person.subject === 'bruno').id;
  const aliceId = h.people.find(person => person.subject === 'alice').id;
  await h.owner.query("UPDATE members SET role='admin' WHERE cave_id=$1 AND identity_id=$2", [caveA, brunoId]);
  const bruno = new HttpBrowser(h.appOrigin); await bruno.login('bruno');
  assert.equal((await bruno.command('/api/members/revoke', { identityId: aliceId, version: 1 })).status, 200);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Votre accès à cette cave a été révoqué' })).toBeVisible();
  await capture('revoked-with-remaining-cave-mobile', page);
  await page.getByLabel('Changer de cave', { exact: true }).selectOption(caveB); await teamReady(page);
  await capture('remaining-cave-recovered-mobile', page);
});

test('keyboard, focus, sensitive dialogue and genuine error states are visible', async t => {
  const h = await identityHarness({ web: true }); t.after(() => h.stop());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); await loginPage(page, h.appOrigin); await teamReady(page);
  await tabTo(page, page.getByLabel('Adresse e-mail', { exact: true }));
  assert.equal(await page.getByLabel('Adresse e-mail', { exact: true }).evaluate(el => getComputedStyle(el).outlineWidth), '3px');
  await page.keyboard.type('adresse-invalide');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  const summary = page.getByRole('alert').filter({ hasText: 'Vérifiez l’invitation' });
  await expect(summary).toBeFocused();
  await expect(page.getByLabel('Adresse e-mail', { exact: true })).toHaveValue('adresse-invalide');
  await expect(page.getByLabel('Adresse e-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await capture('invitation-error-keyboard', page);
  const revoke = page.getByRole('button', { name: 'Révoquer l’accès de Bruno Favre' });
  await tabTo(page, revoke); await page.keyboard.press('Enter');
  const modal = page.getByRole('dialog'); await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(modal.getByRole('button', { name: 'Confirmer la révocation' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(modal.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await capture('revoke-dialog-keyboard', page);
  await page.keyboard.press('Escape'); await expect(modal).not.toBeVisible(); await expect(revoke).toBeFocused();
  await page.getByLabel('Changer de cave', { exact: true }).selectOption(caveB);
  await expect(modal.getByRole('heading', { name: 'Changer de cave ?' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByLabel('Adresse e-mail', { exact: true })).toHaveValue('adresse-invalide');
  await page.reload(); await teamReady(page);
  await page.route('**/api/team', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'service_unavailable' }) }));
  await page.reload(); await expect(page.getByRole('main').getByRole('alert')).toContainText('Votre espace est indisponible');
  await capture('team-transport-error', page); await page.unroute('**/api/team');
  let releaseLoading; const waiting = new Promise(resolve => { releaseLoading = resolve; });
  await page.route('**/api/team', async route => { await waiting; await route.continue(); });
  await page.reload(); await expect(page.getByRole('status')).toContainText('Chargement');
  await capture('team-loading', page); releaseLoading(); await teamReady(page); await page.unroute('**/api/team');
  await page.setViewportSize({ width: 390, height: 844 });
  await loginPage(page, h.appOrigin, 'Claire Rey'); await teamReady(page);
  await capture('reader-access-mobile', page);
  await loginPage(page, h.appOrigin, 'Diane Blanc');
  await expect(page.getByRole('heading', { name: 'Votre compte n’est lié à aucune cave' })).toBeVisible();
  await capture('no-cave-mobile', page);
  await page.goto(h.appOrigin + '/invitation');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Cette invitation est indisponible');
  await capture('invalid-invitation-mobile', page);
  await h.owner.query("UPDATE app_sessions SET expires_at=now()-interval '1 second'");
  await page.goto(h.appOrigin + '/espace');
  await expect(page.getByRole('status')).toContainText('Votre session a expiré');
  await capture('expired-session-mobile', page);
  h.identity.controls.tokenFault = 'nonce';
  await page.getByRole('link', { name: 'Se connecter', exact: true }).click();
  await page.getByRole('button', { name: 'Alice Martin' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('La connexion n’a pas abouti');
  await capture('login-error-mobile', page);
  await page.goto(h.appOrigin + '/connexion'); await capture('login-normal-mobile', page);
});
