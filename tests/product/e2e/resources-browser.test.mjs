import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { caseHarness } from '../helpers/case-harness.mjs';
import { loginPage } from '../helpers/browser-actions.mjs';
import { resourceDefinition,catalogDefinition } from '../helpers/resource-harness.mjs';
import { caveB } from '../../../packages/tooling/src/identity-test-database.ts';

const request=(page,path,body)=>page.evaluate(async({path,body,key})=>{
  const session=await(await fetch('/api/session')).json();
  const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-encave-cave':session.activeCave.id,'x-csrf-token':session.csrf,'idempotency-key':key},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json()};
},{path,body,key:randomUUID()});
async function setup(page,sourceTruth='internal_controlled') {
  const resource=await request(page,'/api/resources',{definition:resourceDefinition({sourceTruth})});assert.equal(resource.status,201);
  const id=resource.body.id;assert.equal((await request(page,'/api/resources/'+id+'/enable',{expectedVersion:1,enabled:true})).status,200);
  const offer=await request(page,'/api/catalog/offers',{definition:catalogDefinition()});assert.equal(offer.status,201);
  const versionId=offer.body.versionId;assert.equal((await request(page,'/api/catalog/offers/'+offer.body.id+'/publish',{expectedVersion:1,versionId})).status,200);
  assert.equal((await request(page,'/api/catalog/offers/'+offer.body.id+'/enable',{expectedVersion:2,enabled:true})).status,200);
  assert.equal((await request(page,'/api/catalog/versions/'+versionId+'/resources',{expectedVersion:0,anchorResourceId:id,rules:[{resourceId:id,beforeMinutes:30,afterMinutes:20}]})).status,200);
  return {id,versionId,body:{expectedPlanVersion:1,expectedResources:[{id,version:2}],startLocal:'2026-09-09T10:00',startOffset:null,durationMinutes:null}};
}

test('browser resource margins persist through API restart and a closure from another session invalidates old preview',async t=>{
  const h=await caseHarness();let browser;t.after(async()=>{if(browser)await browser.close();await h.stop();});
  browser=await chromium.launch();const alice=await browser.newPage(),other=await browser.newPage();await loginPage(alice,h.appOrigin);await loginPage(other,h.appOrigin);
  const data=await setup(alice),path='/api/catalog/versions/'+data.versionId+'/occupation';
  const initial=await request(alice,path,data.body);assert.equal(initial.status,200);assert.equal(initial.body.resources[0].occupiedStart.utc,'2026-09-09T07:30:00.000Z');
  assert.notEqual(await h.restartApi(),h.firstPid);await alice.reload();assert.deepEqual(await request(alice,path,data.body),initial);
  assert.equal((await request(other,'/api/resources/'+data.id+'/closures',{expectedVersion:2,startLocal:'2026-09-09T09:40',endLocal:'2026-09-09T09:50',startOffset:null,endOffset:null,reason:'Fermeture fictive concurrente'})).status,201);
  assert.equal((await request(alice,path,data.body)).body.error,'configuration_changed');data.body.expectedResources[0].version=3;
  const closed=await request(alice,path,data.body);assert.equal(closed.status,409);assert.deepEqual(closed.body.resources[0].blockers,['resource_closed']);assert.equal(closed.body.bookingAllowed,false);
});

test('browser DST ambiguity and unverified Microsoft resource remain explicit and foreign cave cannot read configuration',async t=>{
  const h=await caseHarness();let browser;t.after(async()=>{if(browser)await browser.close();await h.stop();});
  browser=await chromium.launch();const page=await browser.newPage();await loginPage(page,h.appOrigin);
  const data=await setup(page,'microsoft_resource'),path='/api/catalog/versions/'+data.versionId+'/occupation';
  assert.equal((await request(page,path,{...data.body,startLocal:'2026-10-25T02:30'})).body.error,'invalid_local_time');
  const result=await request(page,path,{...data.body,startLocal:'2026-10-25T02:30',startOffset:'+02:00'});assert.equal(result.status,409);assert.equal(result.body.resources[0].start.utc,'2026-10-25T00:30:00.000Z');
  assert.deepEqual(result.body.resources[0].blockers,['external_verification_required']);assert.equal(result.body.availabilityVerified,false);
  assert.equal((await request(page,'/api/caves/switch',{caveId:caveB})).status,200);assert.equal((await request(page,'/api/resources/'+data.id)).status,404);assert.equal((await request(page,path,data.body)).status,404);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM bookings')).rows[0].n,0);
});
