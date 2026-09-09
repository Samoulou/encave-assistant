import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { workflowHarness,loginWorkflow } from '../helpers/workflow-harness.mjs';

test('two authorized sessions competing on one version commit one transition and one historical event',async t=>{
  const h=await workflowHarness(t),[a]=h.cases,alice=await loginWorkflow(h),bruno=await loginWorkflow(h,'bruno');
  const path='/api/inquiries/'+a.inquiryId+'/state';
  const responses=await Promise.all([alice.browser.command(path,{state:'qualifying',expectedVersion:1},{'idempotency-key':randomUUID()}),bruno.browser.command(path,{state:'archived',expectedVersion:1},{'idempotency-key':randomUUID()})]);
  assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  const failed=responses.find(response=>response.status===409);assert.equal((await failed.json()).error,'version_conflict');
  const events=(await h.pool.query('SELECT * FROM workflow_events')).rows;assert.equal(events.length,1);assert.equal(events[0].from_version,1);assert.equal(events[0].to_version,2);
  assert.equal((await h.pool.query('SELECT version FROM inquiries WHERE cave_id=$1 AND id=$2',[a.caveId,a.inquiryId])).rows[0].version,2);
});

test('independent aggregate transitions preserve terms and refuse commercial or provider shortcuts',async t=>{
  const h=await workflowHarness(t),[a]=h.cases,{context}=await loginWorkflow(h);
  const draftId=randomUUID();
  await h.pool.query(`INSERT INTO proposal_versions(cave_id,inquiry_id,proposal_id,id,number,state,snapshot,terms_hash,valid_until,created_by)
    SELECT cave_id,inquiry_id,proposal_id,$1,2,'draft',snapshot,'',valid_until,created_by FROM proposal_versions WHERE cave_id=$2 AND id=$3`,[draftId,a.caveId,a.versionId]);
  const apply=(kind,id,state,expectedVersion=1)=>h.workflow.transition(context,kind,id,{state,expectedVersion},randomUUID());
  assert.equal((await apply('proposal',draftId,'pending_approval')).version,2);
  await assert.rejects(apply('proposal',draftId,'approved',2),{status:409,code:'workflow_required'});
  await assert.rejects(apply('booking',a.bookingId,'sync_pending'),{status:409,code:'workflow_required'});
  await assert.rejects(apply('action',a.actionId,'running'),{status:409,code:'workflow_required'});
  assert.equal((await apply('booking',a.bookingId,'cancelled')).version,2);
  assert.equal((await apply('action',a.actionId,'abandoned')).version,2);
  assert.equal((await h.pool.query('SELECT state,version FROM inquiries WHERE cave_id=$1 AND id=$2',[a.caveId,a.inquiryId])).rows[0].version,1);
  const version=(await h.pool.query('SELECT terms_hash,sealed_at FROM proposal_versions WHERE cave_id=$1 AND id=$2',[a.caveId,draftId])).rows[0];
  assert.equal(version.terms_hash,a.termsHash);assert.ok(version.sealed_at);
  for(const [kind,id,state] of [['proposal',draftId,'approved'],['booking',a.bookingId,'confirmed'],['action',a.actionId,'running']]) await assert.rejects(apply(kind,id,state,1),{status:409,code:'version_conflict'});
});

test('a failure to append history rolls back both the state update and idempotency result',async t=>{
  const h=await workflowHarness(t),[a]=h.cases,{browser}=await loginWorkflow(h);
  const role=h.applicationConfig.user;assert.match(role,/^encave_identity_app_[a-f0-9]{16}$/);
  await h.owner.query(`REVOKE INSERT ON workflow_events FROM "${role}"`);
  const response=await browser.command('/api/inquiries/'+a.inquiryId+'/state',{state:'qualifying',expectedVersion:1},{'idempotency-key':randomUUID()});
  assert.equal(response.status,503);
  assert.deepEqual((await h.pool.query('SELECT state,version FROM inquiries WHERE cave_id=$1 AND id=$2',[a.caveId,a.inquiryId])).rows[0],{state:'received',version:1});
  for(const table of ['workflow_commands','workflow_events']) assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0);
});

test('application SQL role rejects cross-cave and mismatched history references and cannot rewrite journals',async t=>{
  const h=await workflowHarness(t),[a,b]=h.cases,{browser}=await loginWorkflow(h);
  const actor=h.people.find(person=>person.subject==='alice').id,key=randomUUID();
  assert.equal((await browser.command('/api/inquiries/'+a.inquiryId+'/state',{state:'qualifying',expectedVersion:1},{'idempotency-key':key})).status,200);
  const insertCommand=`INSERT INTO workflow_commands(cave_id,actor_id,request_key,record_kind,record_id,payload_hash,result_state,result_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`;
  for(const [kind,id] of [['inquiry',b.inquiryId],['proposal',b.versionId],['booking',b.bookingId],['action',b.actionId]]) {
    await assert.rejects(h.pool.query(insertCommand,[a.caveId,actor,randomUUID(),kind,id,'a'.repeat(64),'qualifying',2]),{code:'23503'});
  }
  const insertEvent=`INSERT INTO workflow_events(id,cave_id,actor_id,request_key,record_kind,record_id,from_state,to_state,from_version,to_version) VALUES($1,$2,$3,$4,'inquiry',$5,$6,$7,$8,$9)`;
  await assert.rejects(h.pool.query(insertEvent,[randomUUID(),b.caveId,actor,key,a.inquiryId,'received','qualifying',1,2]),{code:'23503'});
  await assert.rejects(h.pool.query(insertEvent,[randomUUID(),a.caveId,actor,key,a.inquiryId,'qualifying','ready',2,3]),{code:'23503'});
  const db=await h.pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(insertCommand,[a.caveId,actor,randomUUID(),'inquiry',a.inquiryId,'b'.repeat(64),'ready',3]);
    await assert.rejects(db.query(insertEvent,[randomUUID(),a.caveId,actor,key,a.inquiryId,'qualifying','ready',2,3]),{code:'23503'});
    await db.query('ROLLBACK');
  } finally {db.release();}
  for(const table of ['workflow_commands','workflow_events']) {
    await assert.rejects(h.pool.query(`UPDATE ${table} SET created_at=now()`),{code:'42501'});
    await assert.rejects(h.pool.query(`DELETE FROM ${table}`),{code:'42501'});
    assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,1);
  }
  assert.deepEqual((await h.pool.query('SELECT state,version FROM inquiries WHERE cave_id=$1 AND id=$2',[a.caveId,a.inquiryId])).rows[0],{state:'qualifying',version:2});
});
