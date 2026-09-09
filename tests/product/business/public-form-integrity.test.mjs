import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { publicHarness,challenge,submitPublic,publicInput,configureForm,formDefinition } from '../helpers/public-form-harness.mjs';
test('concurrent public replays and nonce reuse commit exactly one intake and immutable source',async t=>{
 const h=await publicHarness(t),c=(await challenge(h)).body,key=randomUUID();const results=await Promise.all(Array.from({length:8},()=>submitPublic(h,c,publicInput(),{requestKey:key})));for(const r of results)assert.deepEqual(r,results[0]);assert.equal(results[0].status,201);
 assert.equal((await submitPublic(h,c)).body.error,'challenge_used');assert.equal((await submitPublic(h,c,publicInput({need:'Autre besoin'}),{requestKey:key})).body.error,'submission_conflict');assert.equal((await h.pool.query('SELECT count(*)::int n FROM inquiries')).rows[0].n,1);
 for(const table of ['public_form_intakes','public_form_versions','public_form_commands']){await assert.rejects(h.owner.query(`DELETE FROM ${table}`),e=>e.code==='23514');}
 await h.owner.query("UPDATE public_form_challenges SET issued_at=now()-interval '1 hour',expires_at=now()-interval '1 minute'");await configureForm(h.browser,{expectedVersion:1,definition:formDefinition()});assert.deepEqual(await submitPublic(h,c,publicInput(),{requestKey:key}),results[0]);await challenge(h);assert.equal((await h.pool.query('SELECT count(*)::int n FROM public_form_challenges WHERE token_hash IN(SELECT token_hash FROM public_form_intakes)')).rows[0].n,1);
});
test('failure at final provenance insert rolls back inquiry and message but does not refund quota',async t=>{
 const h=await publicHarness(t),c=(await challenge(h)).body,key=randomUUID();await h.owner.query("CREATE FUNCTION reject_public_intake() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic rollback'; END $$; CREATE TRIGGER reject_public_intake BEFORE INSERT ON public_form_intakes FOR EACH ROW EXECUTE FUNCTION reject_public_intake()");assert.equal((await submitPublic(h,c,publicInput(),{requestKey:key})).status,503);for(const table of ['inquiries','messages','public_form_intakes'])assert.equal((await h.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0);assert.equal((await h.pool.query("SELECT used FROM public_form_rates WHERE kind='minute'")).rows[0].used,1);await h.owner.query('DROP TRIGGER reject_public_intake ON public_form_intakes');assert.equal((await submitPublic(h,c,publicInput(),{requestKey:key})).status,201);
});
test('parallel submissions cannot exceed SQL hour limits and configuration races have one winner',async t=>{
 const h=await publicHarness(t,{attemptLimitPerHour:2}),c=await Promise.all(Array.from({length:4},()=>challenge(h)));const results=await Promise.all(c.map(x=>submitPublic(h,x.body)));assert.equal(results.filter(r=>r.status===201).length,2);assert.equal(results.filter(r=>r.status===429).length,2);assert.equal((await h.pool.query('SELECT count(*)::int n FROM inquiries')).rows[0].n,2);
 const edits=await Promise.all([configureForm(h.browser,{expectedVersion:1,enabled:false}),configureForm(h.browser,{expectedVersion:1,definition:formDefinition({intro:'Nouvelle introduction'})})]);assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);assert.equal((await h.pool.query('SELECT count(*)::int n FROM public_form_versions')).rows[0].n,2);
});
