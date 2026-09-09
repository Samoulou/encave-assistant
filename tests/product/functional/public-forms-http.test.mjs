import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import pg from 'pg';
import { publicHarness,configureForm,formDefinition,challenge,submitPublic,publicInput } from '../helpers/public-form-harness.mjs';
import { manualRead } from '../helpers/manual-harness.mjs';
import { HttpBrowser } from '../helpers/identity-harness.mjs';
import { caveA,caveB,createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';
import { migrateDatabase } from '../../../packages/tooling/src/migrations.ts';
import { localDatabaseConfig } from '../../../packages/tooling/src/database.ts';
test('public submission without an account creates atomic visitor provenance and returns only an acknowledgement',async t=>{
 const h=await publicHarness(t),c=(await challenge(h)).body,key=randomUUID(),input=publicInput({contactEmail:null,contactPhone:'+41 21 555 01 02',requestedDate:'2026-10-15',participants:12,budgetMinor:12000,budgetBasis:'person'}),r=await submitPublic(h,c,input,{requestKey:key});assert.equal(r.status,201);assert.deepEqual(Object.keys(r.body).sort(),['caveName','received','reference']);assert.equal(r.body.received,true);
 const list=(await manualRead(h.browser)).body;assert.equal(list.total,1);const d=(await manualRead(h.browser,'/'+list.items[0].id+'/dossier')).body;assert.equal(d.origin,'form');assert.equal(d.actorId,null);assert.equal(d.actorName,null);assert.equal(d.channel,'form');assert.equal(d.contactPhone,input.contactPhone);assert.equal(d.requestedDate,input.requestedDate);assert.equal(d.participants,12);assert.equal(d.budgetMinor,12000);assert.equal(d.messages[0].direction,'inbound');assert.equal(d.messages[0].body,input.need);assert.equal(d.localReference,r.body.reference);
 assert.equal((await fetch(h.appOrigin+'/api/inquiries/'+d.id+'/dossier')).status,401);assert.deepEqual(await submitPublic(h,c,input,{requestKey:key}),r);for(const table of ['inquiries','messages','public_form_intakes'])assert.equal((await h.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,1);for(const table of ['actions','bookings','proposals'])assert.equal((await h.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0);
});
test('admin configuration is versioned and cave-bound while public routing ignores staff session and cave headers',async t=>{
 const h=await publicHarness(t);for(const person of ['bruno','claire']){const b=new HttpBrowser(h.appOrigin);await b.login(person);assert.equal((await configureForm(b)).status,403);}assert.equal((await configureForm(h.browser)).status,409);const a=(await challenge(h)).body;
 await h.browser.command('/api/caves/switch',{caveId:caveB});const b=await configureForm(h.browser);assert.equal(b.status,200);assert.notEqual(b.body.id,h.form.id);const cb=(await challenge(h,b.body.id)).body;
 assert.equal((await submitPublic(h,cb)).status,400);assert.equal((await submitPublic(h,a,publicInput({caveId:caveB}))).status,400);
 const r=await h.browser.command('/api/public/forms/'+h.form.id,{challenge:a.challenge,requestKey:randomUUID(),website:'',inquiry:publicInput()},{'x-encave-cave':caveB});assert.equal(r.status,201);assert.equal((await manualRead(h.browser)).body.total,0);await h.browser.command('/api/caves/switch',{caveId:caveA});assert.equal((await manualRead(h.browser)).body.total,1);
 const key=randomUUID(),cfg={expectedVersion:1,enabled:false,definition:formDefinition()};const disabled=await configureForm(h.browser,cfg,key);assert.equal(disabled.status,200);assert.deepEqual(await configureForm(h.browser,cfg,key),disabled);assert.equal((await challenge(h)).status,404);assert.equal((await submitPublic(h,a)).status,404);assert.equal((await challenge(h,randomUUID())).status,404);
});
test('HTTP size limits and committed SQL quotas include malformed attempts and ignore forged forwarded addresses',async t=>{
 const h=await publicHarness(t,{attemptLimitPerMinute:4}),c=(await challenge(h)).body;assert.equal((await submitPublic(h,c,publicInput(),{},h.form.id,{origin:'https://foreign.example'})).status,403);
 assert.equal((await submitPublic(h,c,publicInput({need:'é'.repeat(20000)}))).status,413);
 for(const payload of ['{','[]','null']){const r=await fetch(h.appOrigin+'/api/public/forms/'+h.form.id,{method:'POST',headers:{origin:h.appOrigin,'content-type':'application/json','x-forwarded-for':randomUUID()},body:payload});assert.equal(r.status,400);}
 const limited=await submitPublic(h,c);assert.equal(limited.status,429);assert.equal(limited.body.error,'rate_limited');assert.ok(Number(limited.retryAfter)>0);assert.equal((await h.pool.query("SELECT used FROM public_form_rates WHERE kind='minute'")).rows[0].used,4);assert.equal((await h.pool.query('SELECT count(*)::int n FROM inquiries')).rows[0].n,0);
 await h.owner.query("UPDATE public_form_rates SET expires_at=now()-interval '1 second'");assert.equal((await submitPublic(h,c)).status,201);
});
test('challenge quotas, timing, honeypot, expiration and configuration changes reject without partial intake',async t=>{
 const h=await publicHarness(t,{minimumDelayMs:10000,challengeLimitPerMinute:3}),c=(await challenge(h,h.form.id,{age:false})).body;
 let r=await submitPublic(h,c);assert.equal(r.body.error,'too_fast');assert.equal(r.body.notCreated,true);assert.ok(Number(r.retryAfter)>0);await h.owner.query("UPDATE public_form_challenges SET issued_at=issued_at-interval '20 seconds'");assert.equal((await submitPublic(h,c,publicInput(),{website:'spam.example'})).body.error,'submission_rejected');
 await h.owner.query("UPDATE public_form_challenges SET issued_at=now()-interval '30 minutes',expires_at=now()-interval '1 second'");assert.equal((await submitPublic(h,c)).body.error,'challenge_expired');
 const fresh=(await challenge(h)).body;await configureForm(h.browser,{expectedVersion:1,enabled:true,definition:formDefinition()});assert.equal((await submitPublic(h,fresh)).body.error,'form_changed');
 await challenge(h);await configureForm(h.browser,{expectedVersion:2,enabled:true,definition:formDefinition({challengeLimitPerMinute:3})});assert.equal((await challenge(h)).status,429);assert.equal((await h.pool.query('SELECT count(*)::int n FROM inquiries')).rows[0].n,0);
});
test('public migration upgrades v7 with existing inquiries and retains the published v3 default',async t=>{
 const h=await createIdentityTestDatabase('https://issuer.test.example');let pool;t.after(async()=>{if(pool)await pool.end();await h.cleanup();});const schema='public_'+randomBytes(8).toString('hex');await h.owner.query(`CREATE SCHEMA ${schema}`);pool=new pg.Pool({...await localDatabaseConfig(),database:h.applicationConfig.database,options:`-c search_path=${schema}`});await migrateDatabase(pool,{targetVersion:7});await pool.query('INSERT INTO caves(id,name) VALUES($1,$2)',[caveA,'Cave fictive']);const id=randomUUID();await pool.query("INSERT INTO inquiries(cave_id,id,local_reference,channel,contact_name,subject) VALUES($1,$2,'OLD','manual','Client fictif','Conservé')",[caveA,id]);assert.deepEqual(await migrateDatabase(pool,{targetVersion:8}),[8]);assert.deepEqual(await migrateDatabase(pool,{targetVersion:8}),[]);assert.deepEqual(await migrateDatabase(pool),[]);assert.equal((await pool.query('SELECT subject FROM inquiries WHERE id=$1',[id])).rows[0].subject,'Conservé');assert.equal((await pool.query('SELECT count(*)::int n FROM public_forms')).rows[0].n,0);
});
