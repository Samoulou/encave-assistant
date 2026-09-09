import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium,expect } from '@playwright/test';
import { caseHarness } from '../helpers/case-harness.mjs';
import { loginPage } from '../helpers/browser-actions.mjs';
import { fillManual } from '../helpers/manual-harness.mjs';
import { caveA } from '../../../packages/tooling/src/identity-test-database.ts';

test('a real authorization refusal cannot discard the key of a creation whose success response was lost',async t=>{
  const h=await caseHarness();let browser;t.after(async()=>{if(browser)await browser.close();await h.stop();});browser=await chromium.launch();const page=await browser.newPage();await loginPage(page,h.appOrigin);await page.goto(h.appOrigin+'/demandes?nouvelle=1');await fillManual(page);
  const keys=[];page.on('request',r=>{if(new URL(r.url()).pathname==='/api/inquiries/manual')keys.push(r.headers()['idempotency-key']);});let first=true;
  await page.route('**/api/inquiries/manual',async route=>{if(first){first=false;const result=await route.fetch();assert.equal(result.status(),201);await route.abort('failed');}else await route.continue();});
  await page.getByRole('button',{name:'Enregistrer la demande',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('L’enregistrement n’est pas confirmé');assert.equal((await h.pool.query('SELECT count(*)::int n FROM inquiries')).rows[0].n,1);
  await h.owner.query("UPDATE members SET role='reader' WHERE cave_id=$1 AND identity_id=(SELECT id FROM identities WHERE subject='alice')",[caveA]);
  const refused=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/inquiries/manual'&&r.status()===403);await page.getByRole('button',{name:'Vérifier l’enregistrement',exact:true}).click();await refused;await expect(page.getByRole('main').getByRole('alert')).toContainText('Votre rôle ne permet pas cette action.');
  await expect(page.getByRole('button',{name:'Vérifier l’enregistrement',exact:true})).toBeVisible();await expect(page.getByLabel('Nom du client',{exact:true})).toBeDisabled();
  await h.owner.query("UPDATE members SET role='admin' WHERE cave_id=$1 AND identity_id=(SELECT id FROM identities WHERE subject='alice')",[caveA]);await page.reload();await expect(page.getByRole('button',{name:'Vérifier l’enregistrement',exact:true})).toBeVisible();await page.getByRole('button',{name:'Vérifier l’enregistrement',exact:true}).click();await expect(page.getByRole('heading',{name:'Camille Fictive',exact:true})).toBeVisible();
  assert.equal(keys.length,3);assert.ok(keys[0]);assert.deepEqual(keys,[keys[0],keys[0],keys[0]]);assert.equal((await h.pool.query('SELECT count(*)::int n FROM inquiries')).rows[0].n,1);assert.equal((await h.pool.query('SELECT count(*)::int n FROM inquiry_commands')).rows[0].n,1);
});
