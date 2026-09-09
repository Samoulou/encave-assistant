import { randomUUID,createHash } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { configurePublicFormSchema,publicSubmissionSchema,publicFormDefinitionSchema,manualFieldMessages,type PublicFormDefinition } from '@encave/contracts';
import { inCave,transaction,lockCave,checkCsrf,validId,AccessError,type CommandContext } from '@encave/tenancy';
import { opaqueToken,tokenHash } from './identity-security.ts';
import { ManualValidationError } from './manual-inquiry-store.ts';
type Form={cave_id:string;id:string;current_version:number;name:string;enabled:boolean;definition:PublicFormDefinition};
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export class PublicFormError extends AccessError {
  retryAfter:number|null;notCreated:boolean;
  constructor(status:number,code:string,retryAfter:number|null=null,notCreated=false){super(status,code);this.retryAfter=retryAfter;this.notCreated=notCreated;}
}
export class PublicFormStore {
  readonly pool:Pool;readonly appOrigin:string;
  constructor(pool:Pool,appOrigin:string){this.pool=pool;this.appOrigin=appOrigin;}
  private link(id:string){const url=this.appOrigin+'/formulaire/'+id;return{url,html:`<a href="${url}">Demander une visite</a>`};}
  async configure(context:CommandContext,input:unknown,key:unknown){
    if(!validId(key))throw new AccessError(400,'invalid_idempotency_key');const p=configurePublicFormSchema.safeParse(input);if(!p.success)throw new AccessError(400,'invalid_form_configuration');
    return inCave(this.pool,context,'read',async(db,s,member)=>{checkCsrf(s,context.csrf);if(member.role!=='admin')throw new AccessError(403,'role_forbidden');
      const d=p.data,hash=sha(d),cave=s.active_cave_id,actor=s.identity_id,old=(await db.query('SELECT * FROM public_form_commands WHERE cave_id=$1 AND actor_id=$2 AND request_key=$3',[cave,actor,key])).rows[0];
      if(old){if(old.payload_hash!==hash)throw new AccessError(409,'idempotency_conflict');return{id:old.form_id,version:old.version,...this.link(old.form_id)};}
      const head=(await db.query('SELECT * FROM public_forms WHERE cave_id=$1',[cave])).rows[0];if((head?.current_version??0)!==d.expectedVersion||d.expectedVersion>=10000)throw new AccessError(409,'form_changed');
      const id=head?.id??randomUUID(),version=d.expectedVersion+1;
      if(!head)await db.query('INSERT INTO public_forms(cave_id,id,current_version) VALUES($1,$2,$3)',[cave,id,version]);
      await db.query('INSERT INTO public_form_versions(cave_id,form_id,number,enabled,definition,created_by) VALUES($1,$2,$3,$4,$5,$6)',[cave,id,version,d.enabled,d.definition,actor]);
      if(head)await db.query('UPDATE public_forms SET current_version=$1 WHERE cave_id=$2 AND id=$3',[version,cave,id]);
      await db.query('INSERT INTO public_form_commands(cave_id,actor_id,request_key,form_id,version,payload_hash) VALUES($1,$2,$3,$4,$5,$6)',[cave,actor,key,id,version,hash]);return{id,version,...this.link(id)};
    });
  }
  async configuration(context:CommandContext){return inCave(this.pool,context,'read',async(db,s)=>{const row=(await db.query('SELECT f.id,f.current_version,v.enabled,v.definition FROM public_forms f JOIN public_form_versions v ON(v.cave_id,v.form_id,v.number)=(f.cave_id,f.id,f.current_version) WHERE f.cave_id=$1',[s.active_cave_id])).rows[0];return row?{id:row.id,version:row.current_version,enabled:row.enabled,definition:row.definition,...this.link(row.id)}:null;});}
  private async publicTransaction<T>(id:unknown,fn:(db:PoolClient,f:Form)=>Promise<T>):Promise<T>{
    if(!validId(id))throw new AccessError(404,'form_unavailable');
    return transaction(this.pool,async db=>{
      const found=(await db.query('SELECT cave_id FROM public_forms WHERE id=$1',[id])).rows[0];if(!found)throw new AccessError(404,'form_unavailable');
      await lockCave(db,found.cave_id);
      const f=(await db.query('SELECT f.*,c.name,v.enabled,v.definition FROM public_forms f JOIN caves c ON c.id=f.cave_id JOIN public_form_versions v ON(v.cave_id,v.form_id,v.number)=(f.cave_id,f.id,f.current_version) WHERE f.id=$1 AND f.cave_id=$2',[id,found.cave_id])).rows[0];
      if(!f?.enabled)throw new AccessError(404,'form_unavailable');f.definition=publicFormDefinitionSchema.parse(f.definition);return fn(db,f);
    });
  }
  private async rate(db:PoolClient,f:Form,kind:string,limit:number,seconds:number){
    const row=(await db.query('SELECT used,expires_at>now() AS active,GREATEST(1,ceil(extract(epoch from expires_at-now())))::int AS remaining FROM public_form_rates WHERE cave_id=$1 AND form_id=$2 AND kind=$3',[f.cave_id,f.id,kind])).rows[0];
    if(row?.active&&row.used>=limit)throw new PublicFormError(429,'rate_limited',row.remaining);
    await db.query(`INSERT INTO public_form_rates(cave_id,form_id,kind,used,expires_at) VALUES($1,$2,$3,1,now()+$4*interval '1 second')
      ON CONFLICT(cave_id,form_id,kind) DO UPDATE SET used=CASE WHEN public_form_rates.expires_at>now() THEN public_form_rates.used+1 ELSE 1 END,
      expires_at=CASE WHEN public_form_rates.expires_at>now() THEN public_form_rates.expires_at ELSE now()+$4*interval '1 second' END`,[f.cave_id,f.id,kind,seconds]);
  }
  async issue(id:unknown){return this.publicTransaction(id,async(db,f)=>{
    await this.rate(db,f,'challenge',f.definition.challengeLimitPerMinute,60);
    await db.query(`DELETE FROM public_form_challenges WHERE(cave_id,form_id,token_hash) IN(SELECT c.cave_id,c.form_id,c.token_hash FROM public_form_challenges c WHERE c.cave_id=$1 AND c.form_id=$2 AND c.expires_at<now() AND NOT EXISTS(SELECT 1 FROM public_form_intakes i WHERE(i.cave_id,i.form_id,i.token_hash)=(c.cave_id,c.form_id,c.token_hash)) LIMIT 200)`,[f.cave_id,f.id]);
    const count=(await db.query('SELECT count(*)::int n FROM public_form_challenges c WHERE cave_id=$1 AND form_id=$2 AND expires_at>now()',[f.cave_id,f.id])).rows[0].n;if(count>=10000)throw new PublicFormError(429,'rate_limited',60);
    const challenge=opaqueToken();await db.query("INSERT INTO public_form_challenges(cave_id,form_id,version,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+$5*interval '1 second')",[f.cave_id,f.id,f.current_version,tokenHash(challenge),f.definition.challengeTtlSeconds]);
    return{formId:f.id,caveName:f.name,intro:f.definition.intro,version:f.current_version,challenge,minimumDelayMs:f.definition.minimumDelayMs,expiresInSeconds:f.definition.challengeTtlSeconds};
  });}
  // Charge attempts in a separate committed transaction before parsing the body.
  // A validation failure or business rollback must not refund its abuse quota.
  async chargeSubmission(id:unknown,origin:unknown){if(origin!==this.appOrigin)throw new AccessError(403,'origin_forbidden');return this.publicTransaction(id,async(db,f)=>{await this.rate(db,f,'minute',f.definition.attemptLimitPerMinute,60);await this.rate(db,f,'hour',f.definition.attemptLimitPerHour,3600);});}
  async submit(id:unknown,input:unknown){return this.publicTransaction(id,async(db,f)=>{
    const parsed=publicSubmissionSchema.safeParse(input);if(!parsed.success){const fields:Record<string,string>={};for(const issue of parsed.error.issues){const key=String(issue.path[0]==='inquiry'?issue.path[1]:issue.path[0]??'form');fields[key]=key==='need'?'Décrivez votre besoin (4 000 caractères maximum).':manualFieldMessages[key]??'Le formulaire doit être rechargé avant un nouvel essai.';}
      if(fields['contactEmail']&&!(input as any)?.inquiry?.contactEmail&&!(input as any)?.inquiry?.contactPhone)fields['contactEmail']='Indiquez au moins un e-mail ou un téléphone pour recevoir une réponse.';throw new ManualValidationError(fields);}
    const p=parsed.data,d=p.inquiry,hash=sha(d),token=tokenHash(p.challenge);
    const previous=(await db.query('SELECT p.*,i.local_reference FROM public_form_intakes p JOIN inquiries i ON(i.cave_id,i.id)=(p.cave_id,p.inquiry_id) WHERE p.cave_id=$1 AND p.form_id=$2 AND p.request_key=$3',[f.cave_id,f.id,p.requestKey])).rows[0];
    if(previous){if(previous.payload_hash!==hash||previous.token_hash!==token||p.website!=='')throw new AccessError(409,'submission_conflict');return{received:true,reference:previous.local_reference,caveName:f.name};}
    const challenge=(await db.query('SELECT *,expires_at>now() AS active,extract(epoch FROM(now()-issued_at))*1000 AS age_ms FROM public_form_challenges WHERE cave_id=$1 AND form_id=$2 AND token_hash=$3',[f.cave_id,f.id,token])).rows[0];
    // The durable lookup above and this absence are observed under the same cave
    // lock. Cleanup cannot remove a challenge referenced by an accepted intake.
    if(!challenge)throw new PublicFormError(400,'invalid_challenge',null,true);
    if((await db.query('SELECT 1 FROM public_form_intakes WHERE cave_id=$1 AND form_id=$2 AND token_hash=$3',[f.cave_id,f.id,token])).rowCount)throw new AccessError(409,'challenge_used');
    if(p.website!=='')throw new PublicFormError(400,'submission_rejected',null,true);
    if(!challenge.active)throw new PublicFormError(410,'challenge_expired',null,true);
    if(challenge.version!==f.current_version)throw new PublicFormError(409,'form_changed',null,true);
    if(Number(challenge.age_ms)<f.definition.minimumDelayMs)throw new PublicFormError(429,'too_fast',Math.ceil((f.definition.minimumDelayMs-Number(challenge.age_ms))/1000),true);
    const inquiry=randomUUID(),message=randomUUID(),reference='D-'+inquiry,subject=Array.from(d.need).slice(0,240).join('');
    await db.query("INSERT INTO inquiries(cave_id,id,local_reference,channel,contact_name,contact_email,subject) VALUES($1,$2,$3,'form',$4,$5,$6)",[f.cave_id,inquiry,reference,d.contactName,d.contactEmail,subject]);
    await db.query("INSERT INTO messages(cave_id,inquiry_id,id,direction,channel,body,author_observed,occurred_at) VALUES($1,$2,$3,'inbound','form',$4,$5,now())",[f.cave_id,inquiry,message,d.need,d.contactName]);
    await db.query('INSERT INTO public_form_intakes(cave_id,inquiry_id,form_id,form_version,message_id,token_hash,request_key,payload_hash,contact_phone,requested_date,participants,budget_minor,budget_basis) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[f.cave_id,inquiry,f.id,challenge.version,message,token,p.requestKey,hash,d.contactPhone,d.requestedDate,d.participants,d.budgetMinor,d.budgetBasis]);
    return{received:true,reference,caveName:f.name};
  });}
}
