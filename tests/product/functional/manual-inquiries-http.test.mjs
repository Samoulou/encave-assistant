import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import pg from 'pg';
import { manualHarness,manualCreate,manualRead,manualInput,seedQueue } from '../helpers/manual-harness.mjs';
import { HttpBrowser } from '../helpers/identity-harness.mjs';
import { caveA,caveB,createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';
import { localDatabaseConfig } from '../../../packages/tooling/src/database.ts';
import { migrateDatabase } from '../../../packages/tooling/src/migrations.ts';

test('manual HTTP creation persists source actor and contact facts without sending or reserving',async t=>{
  const h=await manualHarness(t),s=(await h.browser.session()).body,key=randomUUID();
  const input=manualInput({contactEmail:null,contactPhone:'+41 21 555 01 02',origin:'in_person',requestedDate:'2026-10-12',participants:12,budgetMinor:15000,budgetBasis:'group'});
  const created=await manualCreate(h.browser,input,key);assert.equal(created.status,201);
  const d=await manualRead(h.browser,'/'+created.body.id+'/dossier');assert.equal(d.status,200);assert.equal(d.body.contactPhone,input.contactPhone);assert.equal(d.body.budgetBasis,'group');assert.equal(d.body.budgetMinor,15000);assert.equal(d.body.requestedDate,'2026-10-12');assert.equal(d.body.actorId,s.identity.id);assert.equal(d.body.actorName,s.identity.name);assert.equal(d.body.origin,'in_person');assert.equal(d.body.messages[0].body,input.note);assert.equal(d.body.messages[0].direction,'internal');assert.equal(d.body.sourceMessageId,d.body.messages[0].id);
  assert.deepEqual(await manualCreate(h.browser,input,key),created);assert.equal((await manualCreate(h.browser,{...input,subject:'Autre'},key)).status,409);
  for(const table of ['inquiries','messages','inquiry_intakes','inquiry_commands'])assert.equal((await h.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,1);
  for(const table of ['actions','bookings','proposals'])assert.equal((await h.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0);
});
test('manual HTTP validates fields and server authority before any partial write',async t=>{
  const h=await manualHarness(t);for(const input of [manualInput({contactName:''}),manualInput({contactEmail:null}),manualInput({requestedDate:'2026-02-30'}),manualInput({caveId:caveB}),manualInput({budgetMinor:15000}),manualInput({participants:0})]){const r=await manualCreate(h.browser,input);assert.equal(r.status,400);assert.ok(Object.keys(r.body.fields).length);}
  for(const headers of [{'x-csrf-token':''},{origin:'https://foreign.example'}])assert.equal((await manualCreate(h.browser,manualInput(),randomUUID(),headers)).status,403);
  assert.equal((await manualCreate(h.browser,manualInput(),randomUUID(),{'x-encave-cave':caveB})).status,409);
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM inquiries')).rows[0].n,0);
  const large=await manualCreate(h.browser,manualInput({note:'é'.repeat(20000)}));assert.equal(large.status,413);
});
test('manual list and dossier use current cave and roles with real totals, pagination and search',async t=>{
  const h=await manualHarness(t),ids=await seedQueue(h.browser,52);const reader=new HttpBrowser(h.appOrigin);await reader.login('claire');assert.equal((await manualCreate(reader)).status,403);assert.equal((await manualRead(reader,'/'+ids[0]+'/dossier')).status,200);
  let r=await manualRead(h.browser,'?filter=all&sort=oldest');assert.equal(r.body.total,52);assert.equal(r.body.items.length,50);assert.deepEqual(r.body.items.map(i=>i.id),ids.slice(0,50));
  r=await manualRead(h.browser,'?filter=all&sort=oldest&page=2');assert.deepEqual(r.body.items.map(i=>i.id),ids.slice(50));assert.equal((await manualRead(h.browser,'?q=Visiteur%20fictif%2052')).body.total,1);
  assert.equal((await manualRead(h.browser,'?q=%25')).body.total,0);assert.equal((await manualRead(h.browser,'?filter=all&cave='+caveB)).status,400);assert.equal((await manualRead(h.browser,'?page=1&page=2')).status,400);
  await h.browser.command('/api/caves/switch',{caveId:caveB});assert.equal((await manualRead(h.browser)).body.total,0);assert.equal((await manualRead(h.browser,'/'+ids[0]+'/dossier')).status,404);
  const other=await manualCreate(h.browser);assert.equal(other.status,201);await h.browser.command('/api/caves/switch',{caveId:caveA});assert.equal((await manualRead(h.browser,'/'+other.body.id+'/dossier')).status,404);
});
test('manual migration upgrades v6 without reinterpreting existing dossiers and preserves the v3 default',async t=>{
  const h=await createIdentityTestDatabase('https://issuer.test.example');let pool;t.after(async()=>{if(pool)await pool.end();await h.cleanup();});const schema='manual_'+randomBytes(8).toString('hex');await h.owner.query(`CREATE SCHEMA ${schema}`);pool=new pg.Pool({...await localDatabaseConfig(),database:h.applicationConfig.database,options:`-c search_path=${schema}`});
  assert.deepEqual(await migrateDatabase(pool,{targetVersion:6}),[1,2,3,4,5,6]);await pool.query('INSERT INTO caves(id,name) VALUES($1,$2)',[caveA,'Cave fictive']);const id=randomUUID();await pool.query("INSERT INTO inquiries(cave_id,id,local_reference,channel,contact_name,subject) VALUES($1,$2,'OLD','manual','Client fictif','Ancienne demande')",[caveA,id]);
  assert.deepEqual(await migrateDatabase(pool,{targetVersion:7}),[7]);assert.deepEqual(await migrateDatabase(pool,{targetVersion:7}),[]);assert.deepEqual(await migrateDatabase(pool),[]);assert.equal((await pool.query('SELECT subject FROM inquiries WHERE id=$1',[id])).rows[0].subject,'Ancienne demande');assert.equal((await pool.query('SELECT count(*)::int n FROM inquiry_intakes')).rows[0].n,0);
});
