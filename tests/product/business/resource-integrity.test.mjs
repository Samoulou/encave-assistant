import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resourceScenario,resourceDefinition,previewBody,resourceCommand,resourceRead,activeResource,catalogBrowser } from '../helpers/resource-harness.mjs';
import { caveA,caveB } from '../../../packages/tooling/src/identity-test-database.ts';

test('concurrent resource and plan revisions preserve prior definitions and force stale preview conflicts',async t=>{
  const h=await resourceScenario(t),second=await catalogBrowser(h),id=h.resource.id;
  const responses=await Promise.all([resourceCommand(h.browser,'/api/resources/'+id+'/versions',{expectedVersion:2,definition:resourceDefinition({name:'Salle fictive A'})}),resourceCommand(second,'/api/resources/'+id+'/versions',{expectedVersion:2,definition:resourceDefinition({name:'Salle fictive B'})})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  const history=(await resourceRead(h.browser,'/api/resources/'+id)).body;assert.equal(history.version,3);assert.equal(history.versions.length,2);assert.equal(history.versions[1].definition.name,'Salle fictive de recette');
  assert.equal((await resourceCommand(h.browser,'/api/catalog/versions/'+h.offer.versionId+'/occupation',previewBody(h))).body.error,'configuration_changed');
  const path='/api/catalog/versions/'+h.offer.versionId+'/resources';
  const plans=await Promise.all([10,15].map(beforeMinutes=>resourceCommand(h.browser,path,{expectedVersion:1,anchorResourceId:id,rules:[{resourceId:id,beforeMinutes,afterMinutes:5}]})));
  assert.deepEqual(plans.map(r=>r.status).sort(),[200,409]);
  assert.equal((await h.pool.query('SELECT before_minutes FROM resource_plan_rules WHERE plan_id=$1',[h.plan.planId])).rows[0].before_minutes,30);
  h.resource.version=3;assert.equal((await resourceCommand(h.browser,'/api/catalog/versions/'+h.offer.versionId+'/occupation',previewBody(h))).body.error,'configuration_changed');
  assert.equal((await resourceRead(h.browser,path)).body.version,2);
});

test('multi-resource preview uses one instant across zones and never omits a resource with missing configuration',async t=>{
  const h=await resourceScenario(t),other=await activeResource(h.browser,resourceDefinition({name:'Équipe fictive à New York',kind:'team',timeZone:'America/New_York'}));
  const configured=await resourceCommand(h.browser,'/api/catalog/versions/'+h.offer.versionId+'/resources',{expectedVersion:1,anchorResourceId:h.resource.id,rules:[{resourceId:h.resource.id,beforeMinutes:30,afterMinutes:20},{resourceId:other.id,beforeMinutes:10,afterMinutes:10}]});assert.equal(configured.status,200);
  const body=previewBody(h,{expectedPlanVersion:2,expectedResources:[{id:h.resource.id,version:2},{id:other.id,version:2}]});
  const path='/api/catalog/versions/'+h.offer.versionId+'/occupation',result=await resourceCommand(h.browser,path,body);assert.equal(result.status,200);assert.equal(result.body.resources.length,2);
  const first=result.body.resources.find(row=>row.id===h.resource.id),team=result.body.resources.find(row=>row.id===other.id);
  assert.equal(first.start.utc,team.start.utc);assert.equal(team.start.local,'2026-09-09T04:00');assert.equal(team.occupiedStart.utc,'2026-09-09T07:50:00.000Z');
  await h.owner.query('UPDATE resources SET current_version_id=NULL WHERE cave_id=$1 AND id=$2',[caveA,other.id]);
  assert.equal((await resourceCommand(h.browser,path,body)).status,503);assert.equal((await resourceRead(h.browser,'/api/resources')).status,503);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM bookings')).rows[0].n,0);
});

test('resource SQL enforces cave ownership, exact configuration links, anchor membership and append-only history',async t=>{
  const h=await resourceScenario(t),other=await activeResource(h.browser),actor=h.people.find(person=>person.subject==='alice').id;
  await assert.rejects(h.pool.query('UPDATE resources SET current_version_id=$1 WHERE cave_id=$2 AND id=$3',[other.currentVersionId,caveA,h.resource.id]),{code:'23503'});
  await assert.rejects(h.pool.query('INSERT INTO resource_plan_rules(cave_id,plan_id,resource_id,before_minutes,after_minutes) VALUES($1,$2,$3,0,0)',[caveB,h.plan.planId,h.resource.id]),{code:'23503'});
  const db=await h.pool.connect();try {
    await db.query('BEGIN');
    await db.query('INSERT INTO resource_plans(cave_id,offer_version_id,id,number,anchor_resource_id,resource_ids,created_by) VALUES($1,$2,$3,2,$4,$5,$6)',[caveA,h.offer.versionId,randomUUID(),other.id,[other.id],actor]);
    await assert.rejects(db.query('COMMIT'),{code:'23503'});await db.query('ROLLBACK');
  } finally {db.release();}
  for(const table of ['resource_versions','resource_plans','resource_plan_rules','resource_commands']) {
    const field=table==='resource_plan_rules'?'before_minutes':'created_at',value=table==='resource_plan_rules'?'0':'now()';
    await assert.rejects(h.pool.query(`UPDATE ${table} SET ${field}=${value}`),{code:'42501'});
    await assert.rejects(h.pool.query(`DELETE FROM ${table}`),{code:'42501'});
    await assert.rejects(h.owner.query(`UPDATE ${table} SET ${field}=${value}`),{code:'23514'});
    await assert.rejects(h.owner.query(`DELETE FROM ${table}`),{code:'23514'});
  }
  const closed=await resourceCommand(h.browser,'/api/resources/'+h.resource.id+'/closures',{expectedVersion:2,startLocal:'2026-09-10T09:00',endLocal:'2026-09-10T10:00',startOffset:null,endOffset:null,reason:'Fermeture fictive protégée'});assert.equal(closed.status,201);
  await assert.rejects(h.pool.query('UPDATE resource_closures SET starts_at=now()'),{code:'42501'});
  await assert.rejects(h.owner.query('UPDATE resource_closures SET starts_at=now()'),{code:'23514'});
  await assert.rejects(h.owner.query('DELETE FROM resource_closures'),{code:'23514'});
});

test('plan journal failure rolls back all new rules and command replay rechecks a demoted admin',async t=>{
  const h=await resourceScenario(t),key=randomUUID(),body={definition:resourceDefinition({kind:'equipment',name:'Équipement fictif'})};
  const created=await resourceCommand(h.browser,'/api/resources',body,key);assert.equal(created.status,201);assert.deepEqual(await resourceCommand(h.browser,'/api/resources',body,key),created);
  const actor=h.people.find(person=>person.subject==='alice').id;await h.owner.query("UPDATE members SET role='reader',version=version+1 WHERE cave_id=$1 AND identity_id=$2",[caveA,actor]);
  assert.equal((await resourceCommand(h.browser,'/api/resources',body,key)).status,403);
  await h.owner.query("UPDATE members SET role='admin',version=version+1 WHERE cave_id=$1 AND identity_id=$2",[caveA,actor]);
  const role=h.applicationConfig.user;assert.match(role,/^encave_identity_app_[a-f0-9]{16}$/);await h.owner.query(`REVOKE INSERT ON resource_commands FROM "${role}"`);
  const failed=await resourceCommand(h.browser,'/api/catalog/versions/'+h.offer.versionId+'/resources',{expectedVersion:1,anchorResourceId:h.resource.id,rules:[{resourceId:h.resource.id,beforeMinutes:1,afterMinutes:2},{resourceId:created.body.id,beforeMinutes:3,afterMinutes:4}]});assert.equal(failed.status,503);
  const plan=(await resourceRead(h.browser,'/api/catalog/versions/'+h.offer.versionId+'/resources')).body;assert.equal(plan.version,1);assert.equal(plan.resources.length,1);assert.equal(plan.resources[0].beforeMinutes,30);
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM resource_plans')).rows[0].n,1);
});

test('application SQL cannot append resources to a published or replaced immutable plan',async t=>{
  const h=await resourceScenario(t),other=await activeResource(h.browser);
  const append=plan=>h.pool.query('INSERT INTO resource_plan_rules(cave_id,plan_id,resource_id,before_minutes,after_minutes) VALUES($1,$2,$3,0,0)',[caveA,plan,other.id]);
  await assert.rejects(append(h.plan.planId),{code:'23514'});
  const next=await resourceCommand(h.browser,'/api/catalog/versions/'+h.offer.versionId+'/resources',{expectedVersion:1,anchorResourceId:h.resource.id,rules:[{resourceId:h.resource.id,beforeMinutes:10,afterMinutes:10}]});assert.equal(next.status,200);
  await assert.rejects(append(h.plan.planId),{code:'23514'});await assert.rejects(append(next.body.planId),{code:'23514'});
  for(const id of [h.plan.planId,next.body.planId])assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM resource_plan_rules WHERE plan_id=$1',[id])).rows[0].n,1);
});

test('a resource plan cannot commit an incomplete declared composition even when its anchor exists',async t=>{
  const h=await resourceScenario(t),other=await activeResource(h.browser),actor=h.people.find(person=>person.subject==='alice').id,plan=randomUUID();
  const db=await h.pool.connect();try {
    await db.query('BEGIN');
    await db.query('INSERT INTO resource_plans(cave_id,offer_version_id,id,number,anchor_resource_id,resource_ids,created_by) VALUES($1,$2,$3,2,$4,$5,$6)',[caveA,h.offer.versionId,plan,h.resource.id,[h.resource.id,other.id],actor]);
    await db.query('INSERT INTO resource_plan_rules(cave_id,plan_id,resource_id,before_minutes,after_minutes) VALUES($1,$2,$3,0,0)',[caveA,plan,h.resource.id]);
    await assert.rejects(db.query('COMMIT'),{code:'23514'});await db.query('ROLLBACK');
  } finally {db.release();}
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM resource_plans WHERE id=$1',[plan])).rows[0].n,0);
});
