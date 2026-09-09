import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { tenantHarness, logged } from '../helpers/tenant-harness.mjs';
import { loginPage, teamReady } from '../helpers/browser-actions.mjs';
import { caveA } from '../../../packages/tooling/src/identity-test-database.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = join(root, '.local/ux/EA-06', `${Date.now()}-${randomBytes(3).toString('hex')}`);
await mkdir(directory, { recursive: true });
const captures = [];
async function capture(page, name, serverState) {
  const path = join(directory, name + '.png'); await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  captures.push({ name, path, viewport: page.viewportSize(), serverState, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
}
after(async () => {
  await writeFile(join(directory, 'manifest.json'), JSON.stringify({ captures }, null, 2) + '\n');
  await writeFile(join(root, '.local/ux/EA-06/latest.json'), JSON.stringify({ directory, verdict: 'see_test_log' }) + '\n');
});
test('export states remain accessible and readable on mobile and desktop', async t => {
  const h = await tenantHarness({ web: true }); t.after(() => h.stop());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); await loginPage(page, h.appOrigin); await teamReady(page);
  const panel = page.getByRole('region', { name: 'Exporter l’équipe', exact: true });
  await expect(panel.getByText('Aucun export pour cette cave.')).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    const target = await panel.getByRole('button', { name: 'Préparer un export CSV' }).boundingBox();
    assert.ok(target.width >= 44 && target.height >= 44);
    await capture(page, `exports-empty-${width}`, 'Alice admin; empty exports, actual isolated SQL database.');
  }
  const button = panel.getByRole('button', { name: 'Préparer un export CSV' });
  await page.getByRole('link', { name: 'Aller au contenu' }).focus();
  for (let n = 0; n < 40 && !(await button.evaluate(el => el === document.activeElement)); n++) await page.keyboard.press('Tab');
  await expect(button).toBeFocused(); assert.equal(await button.evaluate(el => getComputedStyle(el).outlineWidth), '3px');
  await page.keyboard.press('Enter'); await expect(panel.getByText('Préparation en attente', { exact: true })).toBeVisible();
  await capture(page, 'exports-pending-desktop', 'Real persisted task; worker deliberately not started yet.');
  await h.startWorker(); await expect(panel.getByRole('button', { name: 'Télécharger le CSV' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'exports-ready-mobile', 'Actual worker wrote CSV and ready state in SQL.');
  await h.owner.query("UPDATE team_exports SET expires_at=now()-interval '1 second'");
  await page.reload(); await teamReady(page); await expect(panel.getByText('Fichier expiré', { exact: true })).toBeVisible();
  await capture(page, 'exports-expired-mobile', 'Fixture owner expired real export in SQL; download unavailable.');
  await page.route('**/api/team/exports', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'service_unavailable' }) }));
  await page.reload(); await teamReady(page); await expect(panel.getByRole('alert')).toBeVisible();
  await capture(page, 'exports-transport-error-mobile', '503 injected in browser transport for exports only.');
  await page.unroute('**/api/team/exports');
  let release; const waiting = new Promise(resolve => { release = resolve; });
  await page.route('**/api/team/exports', async route => { await waiting; await route.continue(); });
  await page.reload(); await expect(page.getByRole('heading', { name: 'Membres', exact: true })).toBeVisible(); await expect(panel.getByRole('status')).toContainText('Chargement de vos exports');
  await capture(page, 'exports-loading-mobile', 'Actual HTTP list request held before release.'); release(); await page.unrouteAll({ behavior: 'wait' });
});

test('an export refused after authorization changes has an explicit visible state', async t => {
  const h = await tenantHarness({ web: true }); t.after(() => h.stop());
  const alice = await logged(h, 'alice'), bruno = await logged(h, 'bruno');
  const aliceId = (await alice.session()).body.identity.id, brunoId = (await bruno.session()).body.identity.id;
  await h.owner.query("UPDATE members SET role='admin' WHERE cave_id=$1 AND identity_id=$2", [caveA, brunoId]);
  await alice.command('/api/team/exports', {}, { 'idempotency-key': randomUUID() });
  await bruno.command('/api/members/revoke', { identityId: aliceId, version: 1 });
  await h.startWorker();
  const invitation = await (await bruno.command('/api/invitations', { email: 'alice@cave-test.example', role: 'admin' })).json();
  await alice.command('/api/invitations/accept', { token: invitation.token });
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await loginPage(page, h.appOrigin); await teamReady(page);
  const panel = page.getByRole('region', { name: 'Exporter l’équipe' });
  await expect(panel.getByText('Export refusé', { exact: true })).toBeVisible();
  await capture(page, 'exports-access-changed-mobile', 'Real revocation and explicit re-invitation; earlier membership version no longer authorizes the export.');
});
