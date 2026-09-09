import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { caseHarness } from '../helpers/case-harness.mjs';
import { loginPage } from '../helpers/browser-actions.mjs';
import { catalogDefinition } from '../helpers/catalog-harness.mjs';
import { caveA,caveB } from '../../../packages/tooling/src/identity-test-database.ts';

const request=(page,path,body)=>page.evaluate(async({path,body,key})=>{
  const session=await(await fetch('/api/session')).json();
  const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-encave-cave':session.activeCave.id,'x-csrf-token':session.csrf,'idempotency-key':key},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,body:await response.json()};
},{path,body,key:randomUUID()});
const command=(page,path,body)=>request(page,'/api/catalog/offers'+path,body);
async function publish(page,data) {
  const created=await command(page,'',{definition:data});assert.equal(created.status,201);
  const id=created.body.id,versionId=created.body.versionId;
  assert.equal((await command(page,'/'+id+'/publish',{expectedVersion:1,versionId})).status,200);
  assert.equal((await command(page,'/'+id+'/enable',{expectedVersion:2,enabled:true})).status,200);
  return {id,versionId};
}

test('browser catalog approval persists across a real API restart and another session disables its previous selection',async t=>{
  const h=await caseHarness();let browser;t.after(async()=>{if(browser)await browser.close();await h.stop();});
  browser=await chromium.launch();const alice=await browser.newPage(),other=await browser.newPage();
  await loginPage(alice,h.appOrigin);await loginPage(other,h.appOrigin);const data=catalogDefinition(),offer=await publish(alice,data);
  assert.equal((await command(alice,'/'+offer.id+'/select',{versionId:offer.versionId})).status,200);
  assert.notEqual(await h.restartApi(),h.firstPid);await alice.reload();
  const read=await command(alice,'/'+offer.id);assert.equal(read.status,200);assert.deepEqual(read.body.versions[0].definition,data);
  assert.equal((await command(other,'/'+offer.id+'/enable',{expectedVersion:3,enabled:false})).status,200);
  await alice.reload();const selected=await command(alice,'/'+offer.id+'/select',{versionId:offer.versionId});assert.equal(selected.status,409);assert.deepEqual(selected.body.blockers,['offer_disabled']);
  assert.deepEqual((await command(alice,'?eligible=true')).body.items,[]);
});

test('browser missing prices and foreign references are blocked and a reader cannot publish catalog offers',async t=>{
  const h=await caseHarness();let browser;t.after(async()=>{if(browser)await browser.close();await h.stop();});
  browser=await chromium.launch();const alice=await browser.newPage(),reader=await browser.newPage();
  await loginPage(alice,h.appOrigin);await loginPage(reader,h.appOrigin,'Claire Rey');
  const offer=await publish(alice,catalogDefinition({amountMinor:null}));
  assert.equal((await command(alice,'/'+offer.id+'/select',{versionId:offer.versionId})).status,409);
  assert.equal((await command(reader,'',{definition:catalogDefinition()})).status,403);
  assert.equal((await request(alice,'/api/caves/switch',{caveId:caveB})).status,200);
  assert.equal((await command(alice,'/'+offer.id)).status,404);
  assert.equal((await command(alice,'/'+offer.id+'/select',{versionId:offer.versionId})).status,404);
  assert.equal((await request(alice,'/api/caves/switch',{caveId:caveA})).status,200);
  await alice.reload();assert.equal((await command(alice,'/'+offer.id)).body.versions[0].definition.amountMinor,null);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM proposals')).rows[0].n,0);
});
