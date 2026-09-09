import { createHash,randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { manualInquirySchema,manualFieldMessages,inquiryListSchema } from '@encave/contracts';
import { AccessError,inCave,checkCsrf,validId,type CommandContext } from '@encave/tenancy';

export class ManualValidationError extends AccessError {
  readonly fields:Record<string,string>;
  constructor(fields:Record<string,string>){super(400,'invalid_inquiry');this.fields=fields;}
}
const queueSql=`WITH dossier AS (
 SELECT i.*,n.origin,n.actor_name,n.actor_id,n.contact_phone,n.requested_date::text,n.participants,n.budget_minor,n.budget_basis,n.message_id,
 CASE WHEN i.state='archived' THEN 'archived'
 WHEN EXISTS(SELECT 1 FROM actions a WHERE a.cave_id=i.cave_id AND a.inquiry_id=i.id AND a.state IN ('failed','uncertain'))
   OR EXISTS(SELECT 1 FROM bookings b WHERE b.cave_id=i.cave_id AND b.inquiry_id=i.id AND b.state='reconciliation_required') THEN 'recovery'
 WHEN EXISTS(SELECT 1 FROM bookings b WHERE b.cave_id=i.cave_id AND b.inquiry_id=i.id AND b.state='confirmed') THEN 'booked'
 WHEN EXISTS(SELECT 1 FROM proposal_versions p WHERE p.cave_id=i.cave_id AND p.inquiry_id=i.id AND p.state='accepted') THEN 'reserve'
 WHEN i.state='waiting_customer' THEN 'waiting' ELSE 'to_process' END AS bucket
 FROM inquiries i LEFT JOIN inquiry_intakes n ON n.cave_id=i.cave_id AND n.inquiry_id=i.id WHERE i.cave_id=$1
)`;
const nextActions:Record<string,string>={recovery:'Vérifier le résultat',reserve:'Examiner l’accord reçu',to_process:'Qualifier la demande',waiting:'Attendre les précisions du client',booked:'Consulter la réservation',archived:'Consulter le dossier archivé'};
const rowResult=(r:Record<string,any>)=>({id:r.id,caveId:r.cave_id,localReference:r.local_reference,contactName:r.contact_name,contactEmail:r.contact_email,
  contactPhone:r.contact_phone??null,subject:r.subject,channel:r.channel,state:r.state,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at,
  origin:r.origin??null,actorName:r.actor_name??null,actorId:r.actor_id??null,requestedDate:r.requested_date??null,participants:r.participants??null,
  budgetMinor:r.budget_minor??null,budgetBasis:r.budget_basis??null,currency:'CHF',sourceMessageId:r.message_id??null,
  bucket:r.bucket,nextAction:nextActions[r.bucket]??'Examiner le dossier',responsible:null});

export class ManualInquiryStore {
  readonly pool:Pool;
  constructor(pool:Pool){this.pool=pool;}
  async create(context:CommandContext,input:unknown,key:unknown){
    if(!validId(key))throw new AccessError(400,'invalid_idempotency_key');
    return inCave(this.pool,context,'read',async(db,s,member)=>{
      checkCsrf(s,context.csrf);if(member.role==='reader')throw new AccessError(403,'role_forbidden');
      const parsed=manualInquirySchema.safeParse(input);
      if(!parsed.success){const fields:Record<string,string>={};for(const issue of parsed.error.issues){const field=String(issue.path[0]??'form');fields[field]=manualFieldMessages[field]??'Les champs reçus ne correspondent pas au formulaire.';}
        if(fields['contactEmail']&&(input as any)?.contactEmail===null&&(input as any)?.contactPhone===null)fields['contactEmail']='Indiquez au moins un e-mail ou un téléphone pour répondre.';
        throw new ManualValidationError(fields);}
      const d=parsed.data,cave=s.active_cave_id,actor=s.identity_id,hash=createHash('sha256').update(JSON.stringify(d)).digest('hex');
      const previous=(await db.query('SELECT payload_hash,inquiry_id FROM inquiry_commands WHERE cave_id=$1 AND actor_id=$2 AND request_key=$3',[cave,actor,key])).rows[0];
      if(previous){if(previous.payload_hash!==hash)throw new AccessError(409,'idempotency_conflict');return{id:previous.inquiry_id,caveId:cave};}
      const id=randomUUID(),message=randomUUID(),actorName=(await db.query('SELECT display_name FROM identities WHERE id=$1',[actor])).rows[0].display_name;
      await db.query(`INSERT INTO inquiries(cave_id,id,local_reference,channel,contact_name,contact_email,subject,created_by) VALUES($1,$2,$3,'manual',$4,$5,$6,$7)`,[cave,id,'D-'+id,d.contactName,d.contactEmail,d.subject,actor]);
      await db.query(`INSERT INTO messages(cave_id,inquiry_id,id,direction,channel,body,author_observed,occurred_at,created_by) VALUES($1,$2,$3,'internal','manual',$4,$5,now(),$6)`,[cave,id,message,d.note,actorName,actor]);
      await db.query(`INSERT INTO inquiry_intakes(cave_id,inquiry_id,message_id,actor_id,actor_name,origin,contact_phone,requested_date,participants,budget_minor,budget_basis) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[cave,id,message,actor,actorName,d.origin,d.contactPhone,d.requestedDate,d.participants,d.budgetMinor,d.budgetBasis]);
      await db.query('INSERT INTO inquiry_commands(cave_id,actor_id,request_key,inquiry_id,payload_hash) VALUES($1,$2,$3,$4,$5)',[cave,actor,key,id,hash]);
      return{id,caveId:cave};
    });
  }
  async list(context:CommandContext,input:unknown){
    const parsed=inquiryListSchema.safeParse(input);if(!parsed.success)throw new AccessError(400,'invalid_list_query');const p=parsed.data;
    return inCave(this.pool,context,'read',async(db,s)=>{
      const where="strpos(lower(concat_ws(' ',contact_name,contact_email,contact_phone,subject,local_reference)),lower($2))>0";
      const counts=(await db.query(queueSql+` SELECT bucket,count(*)::int AS total FROM dossier WHERE ${where} GROUP BY bucket`,[s.active_cave_id,p.q])).rows;
      const totals:Record<string,number>={all:0,to_process:0,waiting:0,reserve:0,recovery:0,booked:0,archived:0};
      for(const r of counts){totals[r.bucket]=r.total;totals['all']!+=r.total;}
      const order={priority:"CASE bucket WHEN 'recovery' THEN 0 WHEN 'reserve' THEN 1 WHEN 'to_process' THEN 2 WHEN 'waiting' THEN 3 WHEN 'booked' THEN 4 ELSE 5 END,requested_date NULLS LAST,created_at,id",oldest:'created_at,id',newest:'created_at DESC,id'}[p.sort];
      const rows=(await db.query(queueSql+` SELECT * FROM dossier WHERE ${where} AND ($3='all' OR bucket=$3) ORDER BY ${order} LIMIT 50 OFFSET $4`,[s.active_cave_id,p.q,p.filter,(p.page-1)*50])).rows;
      return{caveId:s.active_cave_id,items:rows.map(rowResult),counts:totals,total:totals[p.filter],page:p.page,pageSize:50};
    });
  }
  async detail(context:CommandContext,id:unknown){
    if(!validId(id))throw new AccessError(404,'inquiry_unavailable');
    return inCave(this.pool,context,'read',async(db,s)=>{
      const r=(await db.query(queueSql+' SELECT * FROM dossier WHERE id=$2',[s.active_cave_id,id])).rows[0];
      if(!r)throw new AccessError(404,'inquiry_unavailable');
      const messages=(await db.query('SELECT id,direction,channel,body,author_observed,occurred_at,created_by FROM messages WHERE cave_id=$1 AND inquiry_id=$2 ORDER BY created_at,id LIMIT 201',[s.active_cave_id,id])).rows;
      const events=(await db.query("SELECT from_state,to_state,from_version,to_version,created_at FROM workflow_events WHERE cave_id=$1 AND record_kind='inquiry' AND record_id=$2 ORDER BY created_at,id LIMIT 201",[s.active_cave_id,id])).rows;
      return{...rowResult(r),messages:messages.slice(0,200),events:events.slice(0,200),truncated:messages.length>200||events.length>200};
    });
  }
}
