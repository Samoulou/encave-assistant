import { createHash,randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { allowedTransition,foundationTransition,recordKinds,type RecordKind } from '@encave/domain';
import { AccessError,inCave,checkCsrf,validId,type CommandContext } from '@encave/tenancy';

const tables: Record<RecordKind,string> = { inquiry:'inquiries',proposal:'proposal_versions',booking:'bookings',action:'actions' };
type Command = { state:string; expectedVersion:number };
function command(value: unknown): Command {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new AccessError(400,'invalid_request');
  const c=value as Record<string,unknown>;
  if (Object.keys(c).some(key=>!['state','expectedVersion'].includes(key)) || typeof c['state']!=='string' || c['state'].length<1 || c['state'].length>40 ||
    !Number.isInteger(c['expectedVersion']) || (c['expectedVersion'] as number)<1 || (c['expectedVersion'] as number)>2147483647) throw new AccessError(400,'invalid_request');
  return {state:c['state'],expectedVersion:c['expectedVersion'] as number};
}

export class WorkflowStore {
  readonly pool: Pool;
  constructor(pool: Pool) { this.pool=pool; }
  async transition(context: CommandContext,kind: RecordKind,id: unknown,input: unknown,requestKey: unknown) {
    if (!recordKinds.includes(kind) || !validId(id)) throw new AccessError(404,'record_unavailable');
    if (!validId(requestKey)) throw new AccessError(400,'invalid_idempotency_key');
    const value=command(input);
    const hash=createHash('sha256').update(JSON.stringify({kind,id,state:value.state,expectedVersion:value.expectedVersion})).digest('hex');
    return inCave(this.pool,context,'read',async(db,session,member)=>{
      // Read mode keeps the common scope resolver; this command then enforces CSRF and write role.
      checkCsrf(session,context.csrf);
      if (member.role==='reader') throw new AccessError(403,'role_forbidden');
      const previous=(await db.query('SELECT * FROM workflow_commands WHERE cave_id=$1 AND actor_id=$2 AND request_key=$3',[session.active_cave_id,session.identity_id,requestKey])).rows[0];
      if (previous) {
        if (previous.payload_hash!==hash) throw new AccessError(409,'idempotency_conflict');
        return {kind,id,caveId:session.active_cave_id,state:previous.result_state,version:previous.result_version};
      }
      const row=(await db.query(`SELECT * FROM ${tables[kind]} WHERE cave_id=$1 AND id=$2 FOR UPDATE`,[session.active_cave_id,id])).rows[0];
      if (!row) throw new AccessError(404,'record_unavailable');
      if (row.version!==value.expectedVersion) throw new AccessError(409,'version_conflict');
      if (row.version===2147483647) throw new AccessError(409,'version_exhausted');
      if (!allowedTransition(kind,row.state,value.state)) throw new AccessError(409,'transition_forbidden');
      if (!foundationTransition(kind,row.state,value.state)) throw new AccessError(409,'workflow_required');
      if (kind==='booking') {
        const allocations=(await db.query("SELECT to_regclass('resource_allocations') AS relation")).rows[0].relation;
        const effects=await db.query("SELECT 1 FROM actions WHERE cave_id=$1 AND booking_id=$2 AND (state NOT IN ('planned','abandoned') OR kind<>'fixture_no_external_effect') LIMIT 1",[session.active_cave_id,id]);
        if (allocations || effects.rowCount) throw new AccessError(409,'workflow_required');
      }
      const changed=await db.query(`UPDATE ${tables[kind]} SET state=$1,version=version+1,updated_at=now() WHERE cave_id=$2 AND id=$3 AND version=$4 RETURNING state,version`,[value.state,session.active_cave_id,id,value.expectedVersion]);
      if (!changed.rowCount) throw new AccessError(409,'version_conflict');
      const result=changed.rows[0];
      await db.query(`INSERT INTO workflow_commands(cave_id,actor_id,request_key,record_kind,record_id,payload_hash,result_state,result_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[session.active_cave_id,session.identity_id,requestKey,kind,id,hash,result.state,result.version]);
      await db.query(`INSERT INTO workflow_events(id,cave_id,actor_id,request_key,record_kind,record_id,from_state,to_state,from_version,to_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[randomUUID(),session.active_cave_id,session.identity_id,requestKey,kind,id,row.state,result.state,row.version,result.version]);
      return {kind,id,caveId:session.active_cave_id,state:result.state,version:result.version};
    });
  }
}
