import { createHash,randomUUID } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { localInstant,localDescription,occupationWindow,resourceWindowBlockers } from '@encave/domain';
import { resourceDefinitionSchema,resourceCreateSchema,resourceReviseSchema,resourceEnableSchema,resourceClosureSchema,resourceClosureCancelSchema,resourcePlanSchema,occupationPreviewSchema,type ResourceDefinition } from '@encave/contracts';
import { AccessError,inCave,checkCsrf,validId,type CommandContext } from '@encave/tenancy';

type Row=Record<string,unknown>;
type Operation='create'|'revise'|'enable'|'close'|'cancel_closure'|'plan';
const resourceDefinition=(row:Row):ResourceDefinition=>resourceDefinitionSchema.parse({schemaVersion:row['schema_version'],name:row['name'],kind:row['kind'],timeZone:row['time_zone'],hoursMode:row['hours_mode'],weeklyHours:row['weekly_hours'],sourceTruth:row['source_truth'],sourcePolicy:row['source_policy']});
const resourceResult=(row:Row)=>({id:row['id'],caveId:row['cave_id'],enabled:row['enabled'],version:row['version'],latestNumber:row['latest_number'],currentVersionId:row['current_version_id']});
const unavailable=()=>new AccessError(404,'resource_unavailable');
function requireId(id:unknown):asserts id is string {if(!validId(id))throw unavailable();}
async function insertDefinition(db:PoolClient,cave:string,id:string,number:number,actor:string,data:ResourceDefinition) {
  const versionId=randomUUID();
  await db.query(`INSERT INTO resource_versions(cave_id,resource_id,id,number,schema_version,name,kind,time_zone,hours_mode,weekly_hours,source_truth,source_policy,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[cave,id,versionId,number,data.schemaVersion,data.name,data.kind,data.timeZone,data.hoursMode,JSON.stringify(data.weeklyHours),data.sourceTruth,data.sourcePolicy,actor]);
  return versionId;
}
async function loadPlan(db:PoolClient,cave:string,offerVersion:string) {
  const head=(await db.query(`SELECT h.version,p.* FROM resource_plan_heads h JOIN resource_plans p ON p.cave_id=h.cave_id AND p.id=h.current_plan_id
    WHERE h.cave_id=$1 AND h.offer_version_id=$2`,[cave,offerVersion])).rows[0];
  if(!head)throw new AccessError(409,'resource_plan_missing');
  const rows=(await db.query(`SELECT rr.*,r.version AS resource_version,r.enabled,v.* FROM resource_plan_rules rr
    JOIN resources r ON r.cave_id=rr.cave_id AND r.id=rr.resource_id
    LEFT JOIN resource_versions v ON v.cave_id=r.cave_id AND v.id=r.current_version_id
    WHERE rr.cave_id=$1 AND rr.plan_id=$2 ORDER BY rr.resource_id LIMIT 21`,[cave,head.id])).rows;
  if(rows.length<1 || rows.length>20 || rows.some(row=>!row.id) || !rows.some(row=>row.resource_id===head.anchor_resource_id))throw new AccessError(503,'resource_plan_incomplete');
  return {head,rows};
}

export class ResourceStore {
  readonly pool:Pool;
  constructor(pool:Pool){this.pool=pool;}
  async write(context:CommandContext,operation:Operation,target:string|null,input:unknown,key:unknown,closureId:string|null=null) {
    if(target!==null)requireId(target);if(closureId!==null)requireId(closureId);
    if(!validId(key))throw new AccessError(400,'invalid_idempotency_key');
    const schema={create:resourceCreateSchema,revise:resourceReviseSchema,enable:resourceEnableSchema,close:resourceClosureSchema,cancel_closure:resourceClosureCancelSchema,plan:resourcePlanSchema}[operation];
    const parsed=schema.safeParse(input);if(!parsed.success)throw new AccessError(400,'invalid_resource_configuration');
    const data=parsed.data,hash=createHash('sha256').update(JSON.stringify({operation,target,closureId,data})).digest('hex');
    return inCave(this.pool,context,'read',async(db,session,member)=>{
      checkCsrf(session,context.csrf);if(member.role!=='admin')throw new AccessError(403,'role_forbidden');
      const cave=session.active_cave_id,actor=session.identity_id;
      const previous=(await db.query('SELECT payload_hash,result FROM resource_commands WHERE cave_id=$1 AND actor_id=$2 AND request_key=$3',[cave,actor,key])).rows[0];
      if(previous){if(previous.payload_hash!==hash)throw new AccessError(409,'idempotency_conflict');return previous.result;}
      let resourceId:string|null=null,offerVersionId:string|null=null,result:Row;
      if(operation==='plan') {
        const value=resourcePlanSchema.parse(data);requireId(target);offerVersionId=target;
        if(!(await db.query('SELECT 1 FROM catalog_offer_versions WHERE cave_id=$1 AND id=$2',[cave,target])).rowCount)throw new AccessError(404,'offer_unavailable');
        const current=(await db.query('SELECT * FROM resource_plan_heads WHERE cave_id=$1 AND offer_version_id=$2 FOR UPDATE',[cave,target])).rows[0];
        if((current?.version??0)!==value.expectedVersion)throw new AccessError(409,'version_conflict');
        if((current?.version??0)>=10000)throw new AccessError(409,'resource_version_limit');
        for(const rule of value.rules)if(!(await db.query('SELECT 1 FROM resources WHERE cave_id=$1 AND id=$2',[cave,rule.resourceId])).rowCount)throw unavailable();
        const version=(current?.version??0)+1,planId=randomUUID();
        if(!current)await db.query('INSERT INTO resource_plan_heads(cave_id,offer_version_id,version) VALUES($1,$2,$3)',[cave,target,version]);
        await db.query('INSERT INTO resource_plans(cave_id,offer_version_id,id,number,anchor_resource_id,resource_ids,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[cave,target,planId,version,value.anchorResourceId,value.rules.map(rule=>rule.resourceId),actor]);
        for(const rule of value.rules)await db.query('INSERT INTO resource_plan_rules(cave_id,plan_id,resource_id,before_minutes,after_minutes) VALUES($1,$2,$3,$4,$5)',[cave,planId,rule.resourceId,rule.beforeMinutes,rule.afterMinutes]);
        await db.query('UPDATE resource_plan_heads SET version=$1,current_plan_id=$2 WHERE cave_id=$3 AND offer_version_id=$4',[version,planId,cave,target]);
        result={offerVersionId:target,planId,version,anchorResourceId:value.anchorResourceId};
      } else {
        let resource;
        let changedClosure:string|null=null;
        if(operation==='create') {
          const value=resourceCreateSchema.parse(data);
          if((await db.query('SELECT count(*)::int AS n FROM resources WHERE cave_id=$1',[cave])).rows[0].n>=500)throw new AccessError(409,'resource_limit');
          resourceId=randomUUID();
          await db.query('INSERT INTO resources(cave_id,id,created_by) VALUES($1,$2,$3)',[cave,resourceId,actor]);
          const versionId=await insertDefinition(db,cave,resourceId,1,actor,value.definition);
          resource=(await db.query('UPDATE resources SET current_version_id=$1 WHERE cave_id=$2 AND id=$3 RETURNING *',[versionId,cave,resourceId])).rows[0];
        } else {
          requireId(target);resourceId=target;
          resource=(await db.query('SELECT * FROM resources WHERE cave_id=$1 AND id=$2 FOR UPDATE',[cave,target])).rows[0];
          if(!resource)throw unavailable();
          if(!('expectedVersion' in data)||data.expectedVersion!==resource.version)throw new AccessError(409,'version_conflict');
          if(resource.version===2147483647)throw new AccessError(409,'version_exhausted');
          if(operation==='revise') {
            const value=resourceReviseSchema.parse(data);
            if(resource.latest_number>=10000)throw new AccessError(409,'resource_version_limit');
            const versionId=await insertDefinition(db,cave,target,resource.latest_number+1,actor,value.definition);
            await db.query('UPDATE resources SET current_version_id=$1,latest_number=latest_number+1 WHERE cave_id=$2 AND id=$3',[versionId,cave,target]);
          } else if(operation==='enable') {
            const value=resourceEnableSchema.parse(data);
            if(resource.enabled===value.enabled)throw new AccessError(409,'state_unchanged');
            await db.query('UPDATE resources SET enabled=$1 WHERE cave_id=$2 AND id=$3',[value.enabled,cave,target]);
          } else if(operation==='close') {
            const value=resourceClosureSchema.parse(data);
            const version=(await db.query('SELECT * FROM resource_versions WHERE cave_id=$1 AND id=$2',[cave,resource.current_version_id])).rows[0];
            const configuration=resourceDefinition(version),start=localInstant(value.startLocal,configuration.timeZone,value.startOffset),end=localInstant(value.endLocal,configuration.timeZone,value.endOffset);
            if(end<=start||end-start>366*86400000)throw new AccessError(400,'invalid_closure_interval');
            if((await db.query('SELECT count(*)::int AS n FROM resource_closures WHERE cave_id=$1 AND resource_id=$2 AND cancelled_at IS NULL',[cave,target])).rows[0].n>=500)throw new AccessError(409,'closure_limit');
            changedClosure=randomUUID();
            await db.query(`INSERT INTO resource_closures(cave_id,resource_id,id,starts_at,ends_at,time_zone,start_local,end_local,start_offset,end_offset,reason,created_by)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[cave,target,changedClosure,new Date(start),new Date(end),configuration.timeZone,value.startLocal,value.endLocal,localDescription(start,configuration.timeZone).offset,localDescription(end,configuration.timeZone).offset,value.reason,actor]);
          } else {
            requireId(closureId);
            const closure=(await db.query('SELECT * FROM resource_closures WHERE cave_id=$1 AND resource_id=$2 AND id=$3',[cave,target,closureId])).rows[0];
            if(!closure)throw unavailable();if(closure.cancelled_at)throw new AccessError(409,'closure_already_cancelled');
            await db.query('UPDATE resource_closures SET cancelled_by=$1,cancelled_at=now() WHERE cave_id=$2 AND resource_id=$3 AND id=$4',[actor,cave,target,closureId]);changedClosure=closureId;
          }
          resource=(await db.query('UPDATE resources SET version=version+1,updated_at=now() WHERE cave_id=$1 AND id=$2 RETURNING *',[cave,target])).rows[0];
        }
        result={...resourceResult(resource),closureId:changedClosure};
      }
      await db.query('INSERT INTO resource_commands(cave_id,actor_id,request_key,resource_id,offer_version_id,operation,payload_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[cave,actor,key,resourceId,offerVersionId,operation,hash,result]);
      return result;
    });
  }

  async list(context:CommandContext) {
    return inCave(this.pool,context,'read',async(db,session)=>{
      const rows=(await db.query(`SELECT r.*,row_to_json(v) AS definition FROM resources r LEFT JOIN resource_versions v ON v.cave_id=r.cave_id AND v.id=r.current_version_id
        WHERE r.cave_id=$1 ORDER BY r.created_at,r.id LIMIT 501`,[session.active_cave_id])).rows;
      if(rows.length>500)throw new AccessError(503,'resource_limit_exceeded');
      if(rows.some(row=>!row.definition))throw new AccessError(503,'resource_configuration_missing');
      return {items:rows.map(row=>({...resourceResult(row),definition:resourceDefinition(row.definition)}))};
    });
  }
  async read(context:CommandContext,id:string,before=10001) {
    requireId(id);if(!Number.isInteger(before)||before<1||before>10001)throw new AccessError(400,'invalid_cursor');
    return inCave(this.pool,context,'read',async(db,session)=>{
      const cave=session.active_cave_id,row=(await db.query('SELECT * FROM resources WHERE cave_id=$1 AND id=$2',[cave,id])).rows[0];if(!row)throw unavailable();
      const versions=(await db.query('SELECT * FROM resource_versions WHERE cave_id=$1 AND resource_id=$2 AND number<$3 ORDER BY number DESC LIMIT 51',[cave,id,before])).rows;
      const closures=(await db.query('SELECT * FROM resource_closures WHERE cave_id=$1 AND resource_id=$2 AND cancelled_at IS NULL ORDER BY starts_at,id LIMIT 501',[cave,id])).rows;
      if(closures.length>500)throw new AccessError(503,'closure_limit_exceeded');
      return {...resourceResult(row),versions:versions.slice(0,50).map(v=>({id:v.id,number:v.number,definition:resourceDefinition(v),createdBy:v.created_by,createdAt:v.created_at})),nextBeforeNumber:versions.length>50?versions[49].number:null,closures};
    });
  }
  async plan(context:CommandContext,offerVersion:string) {
    requireId(offerVersion);
    return inCave(this.pool,context,'read',async(db,session)=>{
      if(!(await db.query('SELECT 1 FROM catalog_offer_versions WHERE cave_id=$1 AND id=$2',[session.active_cave_id,offerVersion])).rowCount)throw new AccessError(404,'offer_unavailable');
      const {head,rows}=await loadPlan(db,session.active_cave_id,offerVersion);
      return {offerVersionId:offerVersion,planId:head.id,version:head.version,anchorResourceId:head.anchor_resource_id,
        resources:rows.map(row=>({id:row.resource_id,version:row.resource_version,enabled:row.enabled,definition:resourceDefinition(row),beforeMinutes:row.before_minutes,afterMinutes:row.after_minutes}))};
    });
  }
  async preview(context:CommandContext,offerVersion:string,input:unknown) {
    requireId(offerVersion);const parsed=occupationPreviewSchema.safeParse(input);if(!parsed.success)throw new AccessError(400,'invalid_request');
    const value=parsed.data;
    return inCave(this.pool,context,'read',async(db,session,member)=>{
      checkCsrf(session,context.csrf);if(member.role==='reader')throw new AccessError(403,'role_forbidden');
      const cave=session.active_cave_id;
      const catalog=(await db.query(`SELECT v.*,o.enabled,o.published_version_id FROM catalog_offer_versions v JOIN catalog_offers o ON o.cave_id=v.cave_id AND o.id=v.offer_id
        WHERE v.cave_id=$1 AND v.id=$2`,[cave,offerVersion])).rows[0];
      if(!catalog)throw new AccessError(404,'offer_unavailable');
      if(!catalog.enabled || catalog.published_version_id!==offerVersion)throw new AccessError(409,'offer_unavailable_for_planning');
      if(catalog.category==='event_info')throw new AccessError(409,'manual_offer_required');
      let duration:number;
      if(catalog.category==='activity_fixed') {
        if(value.durationMinutes!==null)throw new AccessError(400,'catalog_duration_authoritative');
        if(catalog.duration_mode!=='fixed'||catalog.duration_minutes===null)throw new AccessError(409,'duration_unknown');duration=catalog.duration_minutes;
      } else {if(value.durationMinutes===null)throw new AccessError(409,'duration_required');duration=value.durationMinutes;}
      const {head,rows}=await loadPlan(db,cave,offerVersion);
      if(head.version!==value.expectedPlanVersion || rows.length!==value.expectedResources.length || rows.some(row=>!value.expectedResources.some(expected=>expected.id===row.resource_id&&expected.version===row.resource_version)))throw new AccessError(409,'configuration_changed');
      const anchor=rows.find(row=>row.resource_id===head.anchor_resource_id)!;
      const start=localInstant(value.startLocal,resourceDefinition(anchor).timeZone,value.startOffset);
      const resources=[];
      for(const row of rows) {
        const rules=resourceDefinition(row),window=occupationWindow(start,duration,row.before_minutes,row.after_minutes);
        const closures=(await db.query(`SELECT starts_at,ends_at FROM resource_closures WHERE cave_id=$1 AND resource_id=$2 AND cancelled_at IS NULL
          AND starts_at<$4 AND ends_at>$3 LIMIT 501`,[cave,row.resource_id,new Date(window.occupiedStart),new Date(window.occupiedEnd)])).rows;
        if(closures.length>500)throw new AccessError(503,'closure_limit_exceeded');
        const blockers=resourceWindowBlockers(window.occupiedStart,window.occupiedEnd,rules,row.enabled,closures.map(c=>({start:c.starts_at.valueOf(),end:c.ends_at.valueOf()})));
        resources.push({id:row.resource_id,version:row.resource_version,configurationId:row.id,name:rules.name,sourceTruth:rules.sourceTruth,sourcePolicy:rules.sourcePolicy,
          beforeMinutes:row.before_minutes,afterMinutes:row.after_minutes,start:localDescription(window.start,rules.timeZone),end:localDescription(window.end,rules.timeZone),
          occupiedStart:localDescription(window.occupiedStart,rules.timeZone),occupiedEnd:localDescription(window.occupiedEnd,rules.timeZone),blockers});
      }
      return {offerVersionId:offerVersion,planId:head.id,planVersion:head.version,durationMinutes:duration,rulesSatisfied:resources.every(resource=>resource.blockers.length===0),
        availabilityVerified:false,bookingAllowed:false,resources};
    });
  }
}
