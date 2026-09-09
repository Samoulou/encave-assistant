import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { tenantHarness } from '../helpers/tenant-harness.mjs';
import { loginPage, teamReady } from '../helpers/browser-actions.mjs';
import { caveA, caveB } from '../../../packages/tooling/src/identity-test-database.ts';

test('browser creates a durable export, reloads and downloads only its active cave', async t => {
  const h = await tenantHarness({ web: true }); t.after(() => h.stop());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); await loginPage(page, h.appOrigin); await teamReady(page);
  const panel = page.getByRole('region', { name: 'Exporter l’équipe', exact: true });
  await expect(panel.getByText('Aucun export pour cette cave.')).toBeVisible();
  await panel.getByRole('button', { name: 'Préparer un export CSV' }).click();
  await expect(panel.getByText('Préparation en attente', { exact: true })).toBeVisible();
  await page.reload(); await teamReady(page);
  await expect(panel.getByText('Préparation en attente', { exact: true })).toBeVisible();
  await h.startWorker(); await expect(panel.getByText('Prêt à télécharger', { exact: true })).toBeVisible();
  const exportId = await panel.locator('[data-export-id]').first().getAttribute('data-export-id');
  const downloadPromise = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Télécharger le CSV' }).click();
  const download = await downloadPromise; const csvA = await readFile(await download.path(), 'utf8');
  assert.equal(download.suggestedFilename(), `equipe-${exportId}.csv`); assert.ok(csvA.includes('Bruno Favre')); assert.ok(!csvA.includes('Émile Girard'));
  await page.getByLabel('Changer de cave', { exact: true }).selectOption(caveB); await teamReady(page);
  await expect(panel.getByText('Aucun export pour cette cave.')).toBeVisible();
  assert.equal((await page.request.get(h.appOrigin + `/api/team/exports/${exportId}/download`, { headers: { 'x-encave-cave': caveB } })).status(), 404);
  await panel.getByRole('button', { name: 'Préparer un export CSV' }).click();
  await expect(panel.getByText('Prêt à télécharger', { exact: true })).toBeVisible();
  const secondDownload = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Télécharger le CSV' }).click();
  const csvB = await readFile(await (await secondDownload).path(), 'utf8');
  assert.ok(csvB.includes('Émile Girard')); assert.ok(!csvB.includes('Bruno Favre'));
});

test('a late export response and download from the former cave are discarded after switching', async t => {
  const h = await tenantHarness({ web: true }); t.after(() => h.stop()); await h.startWorker();
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); await loginPage(page, h.appOrigin); await teamReady(page);
  const panel = page.getByRole('region', { name: 'Exporter l’équipe', exact: true });
  await panel.getByRole('button', { name: 'Préparer un export CSV' }).click();
  await expect(panel.getByRole('button', { name: 'Télécharger le CSV' })).toBeVisible();
  let release, held; const waiting = new Promise(resolve => { release = resolve; }), fetched = new Promise(resolve => { held = resolve; });
  await page.route('**/api/team/exports/*/download', async route => { const response = await route.fetch(); held(); await waiting; await route.fulfill({ response }); });
  const downloads = []; page.on('download', event => downloads.push(event));
  await panel.getByRole('button', { name: 'Télécharger le CSV' }).click(); await fetched;
  await page.getByLabel('Changer de cave', { exact: true }).selectOption(caveB); await teamReady(page);
  await expect(panel.getByText('Aucun export pour cette cave.')).toBeVisible();
  release(); await page.unrouteAll({ behavior: 'wait' });
  assert.equal(downloads.length, 0);
  assert.equal((await page.request.get(h.appOrigin + '/api/team/exports', { headers: { 'x-encave-cave': caveA } })).status(), 409);
  await loginPage(page, h.appOrigin, 'Claire Rey'); await teamReady(page);
  await expect(page.getByRole('region', { name: 'Exporter l’équipe' })).toHaveCount(0);
});

test('an old list response cannot erase a newer request and a download expiry changes the visible state', async t => {
  const h = await tenantHarness({ web: true }); t.after(() => h.stop()); const worker = await h.startWorker();
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); await loginPage(page, h.appOrigin); await teamReady(page);
  const panel = page.getByRole('region', { name: 'Exporter l’équipe' });
  await panel.getByRole('button', { name: 'Préparer un export CSV' }).click();
  await expect(panel.getByText('Prêt à télécharger', { exact: true })).toBeVisible(); await h.stopWorker(worker);
  let release, held, intercepted = false;
  const waiting = new Promise(resolve => { release = resolve; }), fetched = new Promise(resolve => { held = resolve; });
  await page.route('**/api/team/exports', async route => {
    if (route.request().method() !== 'GET' || intercepted) { await route.continue(); return; }
    intercepted = true; const response = await route.fetch(); held(); await waiting; await route.fulfill({ response });
  });
  await fetched;
  await panel.getByRole('button', { name: 'Préparer un export CSV' }).click();
  await expect(panel.getByText('Préparation en attente', { exact: true })).toBeVisible();
  release(); await page.unrouteAll({ behavior: 'wait' });
  await expect(panel.locator('[data-export-id]')).toHaveCount(2);
  await expect(panel.getByText('Préparation en attente', { exact: true })).toBeVisible();
  // Hold list polling so the click itself, rather than a later refresh, proves 410 recovery.
  let unblock; const blocked = new Promise(resolve => { unblock = resolve; });
  await page.route('**/api/team/exports', async route => { await blocked; await route.continue(); });
  await h.owner.query("UPDATE team_exports SET expires_at=now()-interval '1 second' WHERE state='ready'");
  await panel.getByRole('button', { name: 'Télécharger le CSV' }).click();
  await expect(panel.getByText('Fichier expiré', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Télécharger le CSV' })).toHaveCount(0);
  unblock(); await page.unrouteAll({ behavior: 'wait' });
});
