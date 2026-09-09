import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import pg from 'pg';
import { catalogDefinition,catalogHarness,catalogBrowser,catalogCommand,catalogRead,approvedOffer } from '../helpers/catalog-harness.mjs';
import { migrateDatabase } from '../../../packages/tooling/src/migrations.ts';
import { localDatabaseConfig } from '../../../packages/tooling/src/database.ts';
import { createIdentityTestDatabase,caveA,caveB } from '../../../packages/tooling/src/identity-test-database.ts';

test('HTTP catalog publication preserves exact explicit data, actor approval and idempotent creation',async t=>{
  const h=await catalogHarness(t),browser=await catalogBrowser(h),data=catalogDefinition(),key=randomUUID();
  const created=await catalogCommand(browser,'',{definition:data},key);assert.equal(created.status,201);assert.equal(created.body.enabled,false);
  assert.deepEqual(await catalogCommand(browser,'',{definition:data},key),created);
  assert.equal((await catalogCommand(browser,'',{definition:{...data,title:'Autre titre fictif'}},key)).status,409);
  let items=(await catalogRead(browser)).body.items;assert.equal(items.length,1);assert.deepEqual(items[0].blockers,['offer_disabled','offer_unpublished']);
  const published=await catalogCommand(browser,'/'+created.body.id+'/publish',{expectedVersion:1,versionId:created.body.versionId});assert.equal(published.status,200);assert.equal(published.body.enabled,false);
  assert.equal((await catalogCommand(browser,'/'+created.body.id+'/enable',{expectedVersion:2,enabled:true})).status,200);
  const read=await catalogRead(browser,'/'+created.body.id);assert.equal(read.status,200);assert.equal(read.body.version,3);
  assert.deepEqual(read.body.versions[0].definition,data);assert.ok(read.body.versions[0].approvedAt);
  assert.equal(read.body.versions[0].approvedBy,h.people.find(person=>person.subject==='alice').id);
  items=(await catalogRead(browser,'?eligible=true')).body.items;assert.equal(items.length,1);assert.equal(items[0].definition.amountMinor,3950);
  assert.equal((await catalogCommand(browser,'/'+created.body.id+'/select',{versionId:created.body.versionId})).status,200);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM proposals')).rows[0].n,0);
});

test('approved missing prices block automatic selection while explicit free CHF offers remain eligible',async t=>{
  const h=await catalogHarness(t),browser=await catalogBrowser(h);
  const missing=await approvedOffer(browser,catalogDefinition({amountMinor:null}));
  const refused=await catalogCommand(browser,'/'+missing.id+'/select',{versionId:missing.versionId});assert.equal(refused.status,409);assert.deepEqual(refused.body.blockers,['price_missing']);
  const free=await approvedOffer(browser,catalogDefinition({amountMinor:0}));
  const selected=await catalogCommand(browser,'/'+free.id+'/select',{versionId:free.versionId});assert.equal(selected.status,200);assert.equal(selected.body.definition.amountMinor,0);
  assert.deepEqual((await catalogRead(browser,'?eligible=true')).body.items.map(item=>item.id),[free.id]);
  assert.equal((await catalogCommand(browser,'/'+missing.id+'/select',{versionId:missing.versionId,amountMinor:10,currency:'CHF'})).status,400);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM proposals')).rows[0].n,0);
});

test('catalog HTTP enforces roles, session cave, CSRF, origin and foreign version references',async t=>{
  const h=await catalogHarness(t),alice=await catalogBrowser(h),bruno=await catalogBrowser(h,'bruno'),claire=await catalogBrowser(h,'claire'),data=catalogDefinition();
  for(const browser of [bruno,claire]) assert.equal((await catalogCommand(browser,'',{definition:data})).status,403);
  assert.equal((await catalogCommand(alice,'',{definition:data},randomUUID(),{'x-csrf-token':''})).status,403);
  assert.equal((await catalogCommand(alice,'',{definition:data},randomUUID(),{origin:'https://foreign.example'})).status,403);
  assert.equal((await catalogCommand(alice,'',{definition:data,caveId:caveB,approvedBy:'alice'})).status,400);
  const a=await approvedOffer(alice);
  assert.equal((await catalogCommand(claire,'/'+a.id+'/select',{versionId:a.versionId})).status,403);
  assert.equal((await catalogRead(claire,'/'+a.id)).status,200);
  assert.equal((await alice.command('/api/caves/switch',{caveId:caveB})).status,200);
  const b=await approvedOffer(alice);
  assert.equal((await catalogRead(alice,'/'+a.id)).status,404);
  assert.equal((await alice.command('/api/caves/switch',{caveId:caveA})).status,200);
  assert.equal((await catalogRead(alice,'/'+b.id)).status,404);
  assert.equal((await catalogCommand(alice,'/'+b.id+'/enable',{enabled:false,expectedVersion:3})).status,404);
  assert.equal((await catalogCommand(alice,'/'+a.id+'/publish',{versionId:b.versionId,expectedVersion:3})).status,404);
  assert.equal((await catalogCommand(alice,'/'+a.id+'/select',{versionId:b.versionId})).status,409);
  assert.equal((await catalogCommand(alice,'/'+a.id+'/enable',{expectedVersion:3,enabled:false},randomUUID(),{'x-encave-cave':caveB})).status,409);
  assert.equal((await catalogRead(alice,'/'+a.id+'?before=0')).status,400);
  assert.equal((await catalogRead(alice,'?eligible=false')).status,400);
});

test('manual categories and missing, expired or future sources stay outside automatic candidates',async t=>{
  const h=await catalogHarness(t),browser=await catalogBrowser(h),now=Date.now();
  const cases=[
    [catalogDefinition({source:null}),'source_missing'],
    [catalogDefinition({},now-2*365*86400000),'source_not_current'],
    [catalogDefinition({},now+2*86400000),'source_not_current'],
    [catalogDefinition({category:'room_quote',durationMode:'variable',durationMinutes:null,amountMinor:null}),'manual_offer_required'],
    [catalogDefinition({category:'event_info',officialUrl:'https://events.example/official-fiction'}),'manual_offer_required'],
    [catalogDefinition({maximumParticipants:null}),'capacity_unknown'],
    [catalogDefinition({taxMode:'unknown',taxRateBasisPoints:null,taxLabel:null}),'tax_rule_unknown'],
  ];
  for(const [data,reason] of cases) {
    const offer=await approvedOffer(browser,data),selected=await catalogCommand(browser,'/'+offer.id+'/select',{versionId:offer.versionId});
    assert.equal(selected.status,409);assert.ok(selected.body.blockers.includes(reason));
  }
  assert.deepEqual((await catalogRead(browser,'?eligible=true')).body.items,[]);
});

test('catalog migration upgrades the explicit v4 target without changing historical data or baseline semantics',async t=>{
  const h=await createIdentityTestDatabase('https://issuer.test.example');let pool;
  t.after(async()=>{if(pool)await pool.end();await h.cleanup();});
  const schema='catalog_migration_'+randomBytes(8).toString('hex');await h.owner.query(`CREATE SCHEMA ${schema}`);
  pool=new pg.Pool({...await localDatabaseConfig(),database:h.applicationConfig.database,options:`-c search_path=${schema}`});
  assert.deepEqual(await migrateDatabase(pool,{targetVersion:4}),[1,2,3,4]);
  await pool.query('INSERT INTO caves(id,name) VALUES($1,$2)',[caveA,'Cave migrée fictive']);
  assert.deepEqual(await migrateDatabase(pool,{targetVersion:5}),[5]);assert.deepEqual(await migrateDatabase(pool),[]);
  assert.deepEqual(await migrateDatabase(pool,{targetVersion:5}),[]);
  assert.equal((await pool.query('SELECT name FROM caves WHERE id=$1',[caveA])).rows[0].name,'Cave migrée fictive');
  for(const table of ['catalog_offers','catalog_offer_versions','catalog_approvals','catalog_commands']) assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0);
});
