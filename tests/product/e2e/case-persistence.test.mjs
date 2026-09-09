import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { seedCaseFixtures } from '../../../packages/tooling/src/case-fixtures.ts';
import { caseHarness } from '../helpers/case-harness.mjs';
import { loginPage } from '../helpers/browser-actions.mjs';

const read = (page,id,cave) => page.evaluate(async({id,cave})=>{
  const response=await fetch('/api/inquiries/'+id,{headers:{'x-encave-cave':cave},cache:'no-store'});
  return {status:response.status,body:await response.json()};
},{id,cave});

test('browser reads the persisted case unchanged after page reload and a real API process restart',async t=>{
  const h=await caseHarness(); let browser; t.after(async()=>{if(browser) await browser.close();await h.stop();});
  const [a]=await seedCaseFixtures(h); browser=await chromium.launch(); const page=await browser.newPage();
  await loginPage(page,h.appOrigin); const initial=await read(page,a.inquiryId,a.caveId);
  assert.equal(initial.status,200); assert.equal(initial.body.localReference,'DEMO-001');
  for(const table of ['messages','proposals','proposal_versions','acceptances','proposal_approvals','bookings','actions']) assert.equal(initial.body.history[table].length,1,table);
  assert.equal(initial.body.history.bookings[0].state,'preparing'); assert.equal(initial.body.history.actions[0].state,'planned');
  assert.equal(initial.body.history.proposal_versions[0].terms_hash,initial.body.history.acceptances[0].terms_hash);
  await page.reload(); assert.deepEqual(await read(page,a.inquiryId,a.caveId),initial);
  assert.notEqual(await h.restartApi(),h.firstPid);
  await page.reload(); assert.deepEqual(await read(page,a.inquiryId,a.caveId),initial);
});

test('browser role and active cave bound case reads and no creation endpoint is exposed by schema fixtures',async t=>{
  const h=await caseHarness(); let browser;t.after(async()=>{if(browser) await browser.close();await h.stop();});
  const [a,b]=await seedCaseFixtures(h); browser=await chromium.launch(); const page=await browser.newPage();
  assert.equal((await page.request.get(h.appOrigin+'/api/inquiries/'+a.inquiryId,{headers:{'x-encave-cave':a.caveId}})).status(),401);
  await loginPage(page,h.appOrigin); assert.equal((await read(page,b.inquiryId,a.caveId)).status,404);
  await page.getByLabel('Changer de cave',{exact:true}).selectOption(b.caveId);
  await page.waitForFunction(async()=>{const s=await(await fetch('/api/session')).json();return s.activeCave?.name.includes('Lac');});
  assert.equal((await read(page,a.inquiryId,b.caveId)).status,404); assert.equal((await read(page,b.inquiryId,a.caveId)).status,409);
  assert.equal((await read(page,b.inquiryId,b.caveId)).body.subject,'Dégustation fictive B');
  await loginPage(page,h.appOrigin,'Claire Rey'); assert.equal((await read(page,a.inquiryId,a.caveId)).status,200);
  const refused=await page.evaluate(async()=>{const s=await(await fetch('/api/session')).json();return(await fetch('/api/inquiries',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':s.csrf,'x-encave-cave':s.activeCave.id},body:'{}'})).status;});
  assert.equal(refused,404); assert.equal((await h.pool.query('SELECT count(*)::int AS count FROM inquiries')).rows[0].count,2);
});
