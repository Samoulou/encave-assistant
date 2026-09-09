import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { catalogDefinition,catalogHarness,catalogBrowser,catalogCommand,catalogRead,approvedOffer } from '../helpers/catalog-harness.mjs';
import { seedCaseFixtures } from '../../../packages/tooling/src/case-fixtures.ts';
import { caveA,caveB } from '../../../packages/tooling/src/identity-test-database.ts';

test('concurrent catalog revisions produce one new version and stale publication cannot replace the approved version',async t=>{
  const h=await catalogHarness(t),first=await catalogBrowser(h),second=await catalogBrowser(h),offer=await approvedOffer(first);
  const responses=await Promise.all([catalogCommand(first,'/'+offer.id+'/versions',{expectedVersion:3,definition:catalogDefinition({amountMinor:4050})}),
    catalogCommand(second,'/'+offer.id+'/versions',{expectedVersion:3,definition:catalogDefinition({amountMinor:4150})})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);assert.equal(responses.find(r=>r.status===409).body.error,'version_conflict');
  const newer=responses.find(r=>r.status===201).body;
  assert.equal((await catalogCommand(first,'/'+offer.id+'/publish',{expectedVersion:3,versionId:newer.versionId})).status,409);
  assert.equal((await catalogCommand(first,'/'+offer.id+'/publish',{expectedVersion:4,versionId:offer.versionId})).status,409);
  assert.equal((await catalogCommand(first,'/'+offer.id+'/publish',{expectedVersion:4,versionId:newer.versionId})).status,200);
  const history=(await catalogRead(first,'/'+offer.id)).body;assert.equal(history.versions.length,2);assert.equal(history.versions[1].definition.amountMinor,3950);
  assert.equal((await catalogCommand(first,'/'+offer.id+'/select',{versionId:offer.versionId})).body.error,'offer_version_changed');
  assert.equal((await catalogCommand(first,'/'+offer.id+'/select',{versionId:newer.versionId})).status,200);
  const before=(await catalogRead(first,'/'+offer.id+'?before=2')).body;assert.equal(before.versions.length,1);assert.equal(before.versions[0].id,offer.versionId);
});

test('disabling immediately excludes new selection and later publication preserves both disabled state and existing proposal terms',async t=>{
  const h=await catalogHarness(t),browser=await catalogBrowser(h),other=await catalogBrowser(h),[a]=await seedCaseFixtures(h),offer=await approvedOffer(browser);
  const original=(await h.pool.query('SELECT snapshot,terms_hash,sealed_at FROM proposal_versions WHERE cave_id=$1 AND id=$2',[a.caveId,a.versionId])).rows[0];
  assert.equal((await catalogCommand(browser,'/'+offer.id+'/select',{versionId:offer.versionId})).status,200);
  const key=randomUUID(),payload={expectedVersion:3,enabled:false};
  const disabled=await catalogCommand(other,'/'+offer.id+'/enable',payload,key);assert.equal(disabled.status,200);
  assert.deepEqual(await catalogCommand(other,'/'+offer.id+'/enable',payload,key),disabled);
  assert.deepEqual((await catalogCommand(browser,'/'+offer.id+'/select',{versionId:offer.versionId})).body.blockers,['offer_disabled']);
  assert.deepEqual((await catalogRead(browser,'?eligible=true')).body.items,[]);
  const next=await catalogCommand(browser,'/'+offer.id+'/versions',{expectedVersion:4,definition:catalogDefinition({amountMinor:4950})});assert.equal(next.status,201);
  const published=await catalogCommand(browser,'/'+offer.id+'/publish',{expectedVersion:5,versionId:next.body.versionId});assert.equal(published.status,200);assert.equal(published.body.enabled,false);
  assert.equal((await catalogCommand(browser,'/'+offer.id+'/select',{versionId:next.body.versionId})).status,409);
  assert.equal((await catalogCommand(browser,'/'+offer.id+'/enable',{expectedVersion:6,enabled:true})).status,200);
  assert.equal((await catalogCommand(browser,'/'+offer.id+'/select',{versionId:next.body.versionId})).status,200);
  assert.deepEqual((await h.pool.query('SELECT snapshot,terms_hash,sealed_at FROM proposal_versions WHERE cave_id=$1 AND id=$2',[a.caveId,a.versionId])).rows[0],original);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM catalog_approvals WHERE offer_id=$1',[offer.id])).rows[0].n,2);
});

test('catalog SQL relations reject cross-cave or wrong-offer references and version approval command histories are immutable',async t=>{
  const h=await catalogHarness(t),browser=await catalogBrowser(h),one=await approvedOffer(browser),two=await approvedOffer(browser);
  const actor=h.people.find(person=>person.subject==='alice').id;
  await assert.rejects(h.pool.query('INSERT INTO catalog_approvals(cave_id,offer_id,version_id,approved_by) VALUES($1,$2,$3,$4)',[caveB,one.id,one.versionId,actor]),{code:'23503'});
  await assert.rejects(h.pool.query('INSERT INTO catalog_approvals(cave_id,offer_id,version_id,approved_by) VALUES($1,$2,$3,$4)',[caveA,one.id,two.versionId,actor]),{code:'23503'});
  await assert.rejects(h.pool.query('UPDATE catalog_offers SET published_version_id=$1 WHERE cave_id=$2 AND id=$3',[two.versionId,caveA,one.id]),{code:'23503'});
  await assert.rejects(h.pool.query("INSERT INTO catalog_commands(cave_id,actor_id,request_key,offer_id,operation,payload_hash,result) VALUES($1,$2,$3,$4,'create',$5,'{}')",[caveB,actor,randomUUID(),one.id,'a'.repeat(64)]),{code:'23503'});
  for(const table of ['catalog_offer_versions','catalog_approvals','catalog_commands']) {
    const before=(await h.pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
    for(const sql of [`UPDATE ${table} SET ${table==='catalog_approvals'?'approved_at':'created_at'}=now()`,`DELETE FROM ${table}`]) {
      await assert.rejects(h.pool.query(sql),{code:'42501'});await assert.rejects(h.owner.query(sql),{code:'23514'});
    }
    assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,before);
  }
  assert.equal((await catalogRead(browser,'/'+one.id)).body.publishedVersionId,one.versionId);
});

test('catalog command journal failure rolls back a complete creation and replay always rechecks current rights',async t=>{
  const h=await catalogHarness(t),browser=await catalogBrowser(h),key=randomUUID(),data={definition:catalogDefinition()};
  const created=await catalogCommand(browser,'',data,key);assert.equal(created.status,201);
  const actor=h.people.find(person=>person.subject==='alice').id;
  await h.owner.query("UPDATE members SET role='reader',version=version+1 WHERE cave_id=$1 AND identity_id=$2",[caveA,actor]);
  assert.equal((await catalogCommand(browser,'',data,key)).status,403);
  await h.owner.query("UPDATE members SET role='admin',version=version+1 WHERE cave_id=$1 AND identity_id=$2",[caveA,actor]);
  const role=h.applicationConfig.user;assert.match(role,/^encave_identity_app_[a-f0-9]{16}$/);
  await h.owner.query(`REVOKE INSERT ON catalog_commands FROM "${role}"`);
  assert.equal((await catalogCommand(browser,'',data)).status,503);
  for(const table of ['catalog_offers','catalog_offer_versions','catalog_commands']) assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,1);
});

test('a concurrent selection waits behind an in-flight disable and rereads its committed flag before returning',async t=>{
  const h=await catalogHarness(t),admin=await catalogBrowser(h),operator=await catalogBrowser(h,'bruno'),offer=await approvedOffer(admin);
  const blocker=await h.owner.connect();let disabling,selecting,released=false;
  const waitForBlockedOn=async pid=>{
    const deadline=performance.now()+4000;
    while(performance.now()<deadline) {
      const rows=(await h.owner.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid))",[pid])).rows;
      if(rows.length) return rows[0].pid;
      await delay(20);
    }
    assert.fail('Expected SQL request did not wait on the observed backend');
  };
  try {
    await blocker.query('BEGIN');const ownerPid=(await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await blocker.query('SELECT id FROM catalog_offers WHERE cave_id=$1 AND id=$2 FOR UPDATE',[caveA,offer.id]);
    disabling=catalogCommand(admin,'/'+offer.id+'/enable',{expectedVersion:3,enabled:false});
    const disablingPid=await waitForBlockedOn(ownerPid);
    selecting=catalogCommand(operator,'/'+offer.id+'/select',{versionId:offer.versionId});
    const selectingPid=await waitForBlockedOn(disablingPid);assert.notEqual(selectingPid,disablingPid);
    await blocker.query('COMMIT');released=true;
    const [disabled,selection]=await Promise.all([disabling,selecting]);
    assert.equal(disabled.status,200);assert.equal(selection.status,409);assert.deepEqual(selection.body.blockers,['offer_disabled']);
    assert.deepEqual((await catalogRead(operator,'?eligible=true')).body.items,[]);
    assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM proposals')).rows[0].n,0);
  } finally {
    try {if(!released)await blocker.query('ROLLBACK');} finally {blocker.release();}
    await Promise.allSettled([disabling,selecting].filter(Boolean));
  }
});
