import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { caseHarness } from '../helpers/case-harness.mjs';
import { loginPage } from '../helpers/browser-actions.mjs';
import { seedCaseFixtures } from '../../../packages/tooling/src/case-fixtures.ts';

const transition=(page,id,payload,key)=>page.evaluate(async({id,payload,key})=>{
  const session=await(await fetch('/api/session')).json();
  const response=await fetch('/api/inquiries/'+id+'/state',{method:'POST',headers:{'content-type':'application/json','x-encave-cave':session.activeCave.id,'x-csrf-token':session.csrf,'idempotency-key':key},body:JSON.stringify(payload)});
  return {status:response.status,body:await response.json()};
},{id,payload,key});
const record=(page,id,cave)=>page.evaluate(async({id,cave})=>await(await fetch('/api/inquiries/'+id,{headers:{'x-encave-cave':cave},cache:'no-store'})).json(),{id,cave});

test('two browser sessions observe one committed version, a stale conflict, reload persistence and safe replay',async t=>{
  const h=await caseHarness();let browser;t.after(async()=>{if(browser)await browser.close();await h.stop();});
  const [a]=await seedCaseFixtures(h);browser=await chromium.launch();
  const alice=await browser.newPage(),bruno=await browser.newPage();
  await loginPage(alice,h.appOrigin);await loginPage(bruno,h.appOrigin,'Bruno Favre');
  assert.equal((await record(alice,a.inquiryId,a.caveId)).version,1);assert.equal((await record(bruno,a.inquiryId,a.caveId)).version,1);
  const commands=[{page:alice,payload:{state:'qualifying',expectedVersion:1},key:randomUUID()},{page:bruno,payload:{state:'archived',expectedVersion:1},key:randomUUID()}];
  const results=await Promise.all(commands.map(c=>transition(c.page,a.inquiryId,c.payload,c.key)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(results.find(r=>r.status===409).body.error,'version_conflict');
  const winner=results.findIndex(r=>r.status===200);
  await alice.reload();await bruno.reload();
  for(const page of [alice,bruno]){const current=await record(page,a.inquiryId,a.caveId);assert.equal(current.version,2);assert.equal(current.state,results[winner].body.state);}
  assert.deepEqual(await transition(commands[winner].page,a.inquiryId,commands[winner].payload,commands[winner].key),results[winner]);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM workflow_events')).rows[0].n,1);
});

test('reader and foreign-case browser commands cannot change versions or create events',async t=>{
  const h=await caseHarness();let browser;t.after(async()=>{if(browser)await browser.close();await h.stop();});
  const [a,b]=await seedCaseFixtures(h);browser=await chromium.launch();const page=await browser.newPage();
  await loginPage(page,h.appOrigin,'Claire Rey');
  assert.equal((await transition(page,a.inquiryId,{state:'qualifying',expectedVersion:1},randomUUID())).status,403);
  await loginPage(page,h.appOrigin);
  assert.equal((await transition(page,b.inquiryId,{state:'qualifying',expectedVersion:1},randomUUID())).status,404);
  await page.reload();assert.equal((await record(page,a.inquiryId,a.caveId)).version,1);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM workflow_events')).rows[0].n,0);
});
