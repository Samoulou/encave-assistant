import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import pg from 'pg';
import { resourceScenario,previewBody,resourceCommand,resourceRead,resourceDefinition,activeResource,catalogBrowser,catalogDefinition } from '../helpers/resource-harness.mjs';
import { createIdentityTestDatabase,caveA,caveB } from '../../../packages/tooling/src/identity-test-database.ts';
import { localDatabaseConfig } from '../../../packages/tooling/src/database.ts';
import { migrateDatabase } from '../../../packages/tooling/src/migrations.ts';

test('resource HTTP persists margins, closure instants and cancellation while stale configurations conflict',async t=>{
  const h=await resourceScenario(t),path='/api/catalog/versions/'+h.offer.versionId+'/occupation';
  let result=await resourceCommand(h.browser,path,previewBody(h));assert.equal(result.status,200);assert.equal(result.body.availabilityVerified,false);assert.equal(result.body.bookingAllowed,false);
  assert.equal(result.body.resources[0].occupiedStart.utc,'2026-09-09T07:30:00.000Z');assert.equal(result.body.resources[0].occupiedEnd.utc,'2026-09-09T09:50:00.000Z');
  const closed=await resourceCommand(h.browser,'/api/resources/'+h.resource.id+'/closures',{expectedVersion:2,startLocal:'2026-09-09T09:40',endLocal:'2026-09-09T09:50',startOffset:null,endOffset:null,reason:'Fermeture fictive pendant la préparation'});assert.equal(closed.status,201);
  assert.equal((await resourceCommand(h.browser,path,previewBody(h))).body.error,'configuration_changed');
  h.resource.version=3;result=await resourceCommand(h.browser,path,previewBody(h));assert.equal(result.status,409);assert.ok(result.body.resources[0].blockers.includes('resource_closed'));
  const read=await resourceRead(h.browser,'/api/resources/'+h.resource.id);assert.equal(read.status,200);assert.equal(read.body.closures[0].starts_at,'2026-09-09T07:40:00.000Z');
  assert.equal((await resourceCommand(h.browser,'/api/resources/'+h.resource.id+'/closures/'+closed.body.closureId+'/cancel',{expectedVersion:3})).status,200);
  h.resource.version=4;assert.equal((await resourceCommand(h.browser,path,previewBody(h))).status,200);
  const history=(await h.pool.query('SELECT * FROM resource_closures')).rows[0];assert.ok(history.cancelled_at);assert.equal(history.reason,'Fermeture fictive pendant la préparation');
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM bookings')).rows[0].n,0);
});

test('resource HTTP rejects ambiguous or missing local hours and retains elapsed time across DST',async t=>{
  const h=await resourceScenario(t),path='/api/catalog/versions/'+h.offer.versionId+'/occupation';
  for(const startLocal of ['2026-03-29T02:30','2026-10-25T02:30']) assert.equal((await resourceCommand(h.browser,path,previewBody(h,{startLocal}))).body.error,'invalid_local_time');
  const early=await resourceCommand(h.browser,path,previewBody(h,{startLocal:'2026-10-25T02:30',startOffset:'+02:00'}));
  const late=await resourceCommand(h.browser,path,previewBody(h,{startLocal:'2026-10-25T02:30',startOffset:'+01:00'}));
  assert.equal(early.status,200);assert.equal(late.status,200);
  assert.equal(Date.parse(late.body.resources[0].start.utc)-Date.parse(early.body.resources[0].start.utc),3600000);
  assert.equal(early.body.resources[0].end.local,'2026-10-25T03:00');
  assert.equal((await resourceCommand(h.browser,path,previewBody(h,{startOffset:'+01:00'}))).status,400);
  assert.equal((await resourceCommand(h.browser,path,previewBody(h,{durationMinutes:120}))).body.error,'catalog_duration_authoritative');
  const invalid=await resourceCommand(h.browser,'/api/resources/'+h.resource.id+'/closures',{expectedVersion:2,startLocal:'2026-03-29T02:30',endLocal:'2026-03-29T04:30',startOffset:null,endOffset:null,reason:'Heure inexistante fictive'});assert.equal(invalid.status,400);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM resource_closures')).rows[0].n,0);
});

test('variable room duration remains explicit and external or unknown sources never claim verified availability',async t=>{
  const h=await resourceScenario(t,{offer:catalogDefinition({category:'room_quote',durationMode:'variable',durationMinutes:null,amountMinor:null}),resource:resourceDefinition({sourceTruth:'microsoft_resource',sourcePolicy:'Ressource Microsoft fictive, aucune capacité qualifiée'})});
  const path='/api/catalog/versions/'+h.offer.versionId+'/occupation';
  assert.equal((await resourceCommand(h.browser,path,previewBody(h))).body.error,'duration_required');
  const result=await resourceCommand(h.browser,path,previewBody(h,{durationMinutes:180}));assert.equal(result.status,409);assert.equal(result.body.durationMinutes,180);
  assert.deepEqual(result.body.resources[0].blockers,['external_verification_required']);assert.equal(result.body.availabilityVerified,false);
  assert.equal(Date.parse(result.body.resources[0].end.utc)-Date.parse(result.body.resources[0].start.utc),180*60000);
  const revised=await resourceCommand(h.browser,'/api/resources/'+h.resource.id+'/versions',{expectedVersion:2,definition:resourceDefinition({sourceTruth:'unknown',sourcePolicy:null,hoursMode:'unknown'})});assert.equal(revised.status,201);
  h.resource.version=3;const unknown=await resourceCommand(h.browser,path,previewBody(h,{durationMinutes:180}));assert.equal(unknown.status,409);assert.deepEqual(unknown.body.resources[0].blockers,['hours_unknown','source_unknown']);
});

test('resource API checks admin role, reader preview, cave, origin, CSRF and exact plan references',async t=>{
  const h=await resourceScenario(t),operator=await catalogBrowser(h,'bruno'),reader=await catalogBrowser(h,'claire');
  for(const browser of [operator,reader])assert.equal((await resourceCommand(browser,'/api/resources',{definition:resourceDefinition()})).status,403);
  assert.equal((await resourceCommand(reader,'/api/catalog/versions/'+h.offer.versionId+'/occupation',previewBody(h))).status,403);
  assert.equal((await resourceRead(reader,'/api/resources/'+h.resource.id)).status,200);
  assert.equal((await resourceCommand(h.browser,'/api/resources',{definition:resourceDefinition()},randomUUID(),{'x-csrf-token':''})).status,403);
  assert.equal((await resourceCommand(h.browser,'/api/resources',{definition:resourceDefinition()},randomUUID(),{origin:'https://foreign.example'})).status,403);
  assert.equal((await h.browser.command('/api/caves/switch',{caveId:caveB})).status,200);const foreign=await activeResource(h.browser);
  assert.equal((await resourceRead(h.browser,'/api/resources/'+h.resource.id)).status,404);
  assert.equal((await h.browser.command('/api/caves/switch',{caveId:caveA})).status,200);
  assert.equal((await resourceCommand(h.browser,'/api/catalog/versions/'+h.offer.versionId+'/resources',{expectedVersion:1,anchorResourceId:foreign.id,rules:[{resourceId:foreign.id,beforeMinutes:0,afterMinutes:0}]})).status,404);
  assert.equal((await resourceCommand(h.browser,'/api/resources/'+foreign.id+'/enable',{expectedVersion:2,enabled:false})).status,404);
  assert.equal((await resourceCommand(h.browser,'/api/catalog/versions/'+h.offer.versionId+'/occupation',{...previewBody(h),timeZone:'UTC',sourceTruth:'internal_controlled',caveId:caveB})).status,400);
  assert.equal((await resourceRead(h.browser,'/api/resources/'+h.resource.id+'?before=0')).status,400);
});

test('resource migration adds empty scoped configuration tables while preserving v5 data',async t=>{
  const h=await createIdentityTestDatabase('https://issuer.test.example');let pool;t.after(async()=>{if(pool)await pool.end();await h.cleanup();});
  const schema='resource_migration_'+randomBytes(8).toString('hex');await h.owner.query(`CREATE SCHEMA ${schema}`);
  pool=new pg.Pool({...await localDatabaseConfig(),database:h.applicationConfig.database,options:`-c search_path=${schema}`});
  assert.deepEqual(await migrateDatabase(pool,{targetVersion:5}),[1,2,3,4,5]);await pool.query('INSERT INTO caves(id,name) VALUES($1,$2)',[caveA,'Cave ressource fictive']);
  assert.deepEqual(await migrateDatabase(pool,{targetVersion:6}),[6]);assert.deepEqual(await migrateDatabase(pool,{targetVersion:6}),[]);assert.deepEqual(await migrateDatabase(pool),[]);
  assert.equal((await pool.query('SELECT name FROM caves WHERE id=$1',[caveA])).rows[0].name,'Cave ressource fictive');
  for(const table of ['resources','resource_versions','resource_closures','resource_plan_heads','resource_plans','resource_plan_rules','resource_commands'])assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0);
});
