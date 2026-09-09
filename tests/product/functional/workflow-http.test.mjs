import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import pg from 'pg';
import { workflowHarness,loginWorkflow } from '../helpers/workflow-harness.mjs';
import { migrateDatabase } from '../../../packages/tooling/src/migrations.ts';
import { localDatabaseConfig } from '../../../packages/tooling/src/database.ts';
import { createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';

test('HTTP transitions persist one increment and replay exactly while stale or changed requests conflict',async t=>{
  const h=await workflowHarness(t),[a]=h.cases,{browser}=await loginWorkflow(h);
  const path='/api/inquiries/'+a.inquiryId+'/state',payload={state:'qualifying',expectedVersion:1},key=randomUUID();
  let response=await browser.command(path,payload,{'idempotency-key':key});assert.equal(response.status,200);const first=await response.json();
  assert.equal(first.version,2);assert.equal(first.state,'qualifying');
  assert.deepEqual(await(await browser.command(path,payload,{'idempotency-key':key})).json(),first);
  response=await browser.command(path,{state:'ready',expectedVersion:2},{'idempotency-key':key});assert.equal(response.status,409);assert.equal((await response.json()).error,'idempotency_conflict');
  response=await browser.command(path,{state:'ready',expectedVersion:1},{'idempotency-key':randomUUID()});assert.equal(response.status,409);assert.equal((await response.json()).error,'version_conflict');
  response=await browser.command(path,{state:'processed',expectedVersion:2},{'idempotency-key':randomUUID()});assert.equal(response.status,409);assert.equal((await response.json()).error,'transition_forbidden');
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM workflow_events')).rows[0].n,1);
  assert.equal((await browser.command(path,{state:'ready',expectedVersion:2},{'idempotency-key':randomUUID()})).status,200);
  assert.equal((await h.pool.query('SELECT version FROM inquiries WHERE cave_id=$1 AND id=$2',[a.caveId,a.inquiryId])).rows[0].version,3);
});

test('HTTP roles, CSRF, origin, cave and command shape are authoritative and refusals leave no history',async t=>{
  const h=await workflowHarness(t),[a,b]=h.cases,alice=await loginWorkflow(h),claire=await loginWorkflow(h,'claire');
  const path='/api/inquiries/'+a.inquiryId+'/state',valid={state:'qualifying',expectedVersion:1};
  const post=(body,headers={})=>alice.browser.command(path,body,{'idempotency-key':randomUUID(),...headers});
  assert.equal((await claire.browser.command(path,valid,{'idempotency-key':randomUUID()})).status,403);
  assert.equal((await post(valid,{'x-csrf-token':''})).status,403);
  assert.equal((await post(valid,{origin:'https://foreign.example'})).status,403);
  assert.equal((await post(valid,{'x-encave-cave':b.caveId})).status,409);
  assert.equal((await alice.browser.command('/api/inquiries/'+b.inquiryId+'/state',valid,{'idempotency-key':randomUUID()})).status,404);
  for(const version of [null,0,-1,1.5,2147483648,'1']) assert.equal((await post({...valid,expectedVersion:version})).status,400);
  assert.equal((await post({...valid,caveId:b.caveId,role:'admin',providerSucceeded:true})).status,400);
  assert.equal((await post(valid,{'idempotency-key':'bad'})).status,400);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM workflow_events')).rows[0].n,0);
});

test('explicit migration target adds workflow tables and preserves the published v3 baseline without downgrade',async t=>{
  const h=await createIdentityTestDatabase('https://issuer.test.example');let pool;
  t.after(async()=>{if(pool)await pool.end();await h.cleanup();});
  const schema='workflow_migration_'+randomBytes(8).toString('hex');await h.owner.query(`CREATE SCHEMA ${schema}`);
  pool=new pg.Pool({...await localDatabaseConfig(),database:h.applicationConfig.database,options:`-c search_path=${schema}`});
  assert.deepEqual(await migrateDatabase(pool),[1,2,3]);
  assert.equal((await pool.query("SELECT to_regclass('workflow_events') AS relation")).rows[0].relation,null);
  assert.deepEqual(await migrateDatabase(pool,{targetVersion:4}),[4]);
  assert.deepEqual(await migrateDatabase(pool),[]);assert.deepEqual(await migrateDatabase(pool,{targetVersion:4}),[]);
  assert.equal((await pool.query('SELECT max(version) AS version FROM schema_migrations')).rows[0].version,4);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM workflow_events')).rows[0].n,0);
  await assert.rejects(migrateDatabase(pool,{targetVersion:99}),/Unsupported migration target/);
});

test('successful commands cannot be replayed after actual cave switch, reader demotion or membership revocation',async t=>{
  for(const change of ['cave','reader','revoked']) {
    const h=await workflowHarness(t),[a,b]=h.cases,{browser,context}=await loginWorkflow(h);
    const path='/api/inquiries/'+a.inquiryId+'/state',payload={state:'qualifying',expectedVersion:1},key=randomUUID();
    assert.equal((await browser.command(path,payload,{'idempotency-key':key})).status,200);
    const alice=h.people.find(person=>person.subject==='alice');
    if(change==='cave') assert.equal((await browser.command('/api/caves/switch',{caveId:b.caveId})).status,200);
    if(change==='reader') await h.owner.query("UPDATE members SET role='reader',version=version+1 WHERE cave_id=$1 AND identity_id=$2",[a.caveId,alice.id]);
    if(change==='revoked') {
      const bruno=h.people.find(person=>person.subject==='bruno');
      await h.owner.query("UPDATE members SET role='admin',version=version+1 WHERE cave_id=$1 AND identity_id=$2",[a.caveId,bruno.id]);
      const admin=await loginWorkflow(h,'bruno');
      assert.equal((await admin.browser.command('/api/members/revoke',{identityId:alice.id,version:1})).status,200);
    }
    const response=await browser.request(path,{method:'POST',headers:{origin:h.appOrigin,'content-type':'application/json','x-csrf-token':context.csrf,'x-encave-cave':a.caveId,'idempotency-key':key},body:JSON.stringify(payload)});
    assert.equal(response.status,change==='cave'?409:403);
    assert.equal((await response.json()).error,change==='cave'?'cave_changed':change==='reader'?'role_forbidden':'access_revoked');
    assert.equal((await h.pool.query('SELECT version FROM inquiries WHERE cave_id=$1 AND id=$2',[a.caveId,a.inquiryId])).rows[0].version,2);
    for(const table of ['workflow_commands','workflow_events']) assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,1);
  }
});

test('concurrent replay of one command returns one stored result and exhausted versions refuse mutation',async t=>{
  const h=await workflowHarness(t),[a]=h.cases,{browser}=await loginWorkflow(h);
  const path='/api/inquiries/'+a.inquiryId+'/state',payload={state:'qualifying',expectedVersion:1},key=randomUUID();
  const responses=await Promise.all([browser.command(path,payload,{'idempotency-key':key}),browser.command(path,payload,{'idempotency-key':key})]);
  assert.deepEqual(responses.map(response=>response.status),[200,200]);
  assert.deepEqual(await responses[0].json(),await responses[1].json());
  await h.owner.query('UPDATE inquiries SET version=2147483647 WHERE cave_id=$1 AND id=$2',[a.caveId,a.inquiryId]);
  const response=await browser.command(path,{state:'ready',expectedVersion:2147483647},{'idempotency-key':randomUUID()});
  assert.equal(response.status,409);assert.equal((await response.json()).error,'version_exhausted');
  assert.deepEqual((await h.pool.query('SELECT state,version FROM inquiries WHERE cave_id=$1 AND id=$2',[a.caveId,a.inquiryId])).rows[0],{state:'qualifying',version:2147483647});
  for(const table of ['workflow_commands','workflow_events']) assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,1);
});
