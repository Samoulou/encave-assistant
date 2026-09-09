import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connectionHarness,HttpBrowser,connectAccount,listConnections,selectConnection,operateConnection,beginConnection,caveA,caveB } from '../helpers/connection-harness.mjs';
test('EA-13 AC-01/03/04: session, cave, role, CSRF, OAuth and discovery remain scoped',async()=>{
 const f=await connectionHarness();try{const a=new HttpBrowser(f.appOrigin),reader=new HttpBrowser(f.appOrigin),b=new HttpBrowser(f.appOrigin);await a.login('alice');await reader.login('claire');await b.login('emile');
 assert.equal((await beginConnection(reader)).status,403);assert.equal((await a.command('/api/connections/microsoft/start',{provider:'microsoft365',connectionId:null,expectedVersion:0,label:'Test'},{'idempotency-key':randomUUID(),'x-csrf-token':'wrong'})).status,403);
 let row=await connectAccount(f,a);assert.equal(row.status,'selection_required');assert.equal(row.synthetic,true);assert.equal(row.resources.length,2);assert.equal((await listConnections(b)).body.items.length,0);
 assert.equal((await operateConnection(b,row,'inspect')).status,404);assert.equal((await operateConnection(a,row,'resources',{mailboxId:'arbitrary',calendarId:null})).status,400);
 row=await selectConnection(a,row);assert.equal(row.status,'unqualified');const key=randomUUID(),activation=await operateConnection(a,row,'activate',{},key);assert.equal(activation.status,200);assert.deepEqual(await operateConnection(a,row,'activate',{},key),activation);
 row=(await listConnections(a)).body.items[0];assert.equal(row.status,'active');assert.equal(row.capabilities.filter(x=>x.state==='available').length,1);assert.equal((await operateConnection(a,row,'inspect')).status,200);row=(await listConnections(a)).body.items[0];assert.equal(row.status,'active');
 const publicData=JSON.stringify((await listConnections(a)).body);for(const forbidden of ['accessToken','refreshToken','idToken','ciphertext','encrypted_flow','clientSecret',f.microsoft.settings.clientSecret])assert.equal(publicData.includes(forbidden),false);
 const stored=(await f.owner.query('SELECT ciphertext FROM provider_credentials WHERE cave_id=$1',[caveA])).rows;assert.equal(stored.length,1);assert.match(stored[0].ciphertext,/^v1\./);assert.equal(stored[0].ciphertext.includes('AccessToken'),false);
 await f.restartApi();assert.equal((await listConnections(a)).body.items[0].status,'active');
 }finally{await f.stop();}
});
test('EA-13 AC-03/04: state reuse, other session/cave, denial and reconnect identity',async()=>{
 const f=await connectionHarness();try{const a=new HttpBrowser(f.appOrigin),other=new HttpBrowser(f.appOrigin);await a.login('alice');await other.login('alice');
 const start=await beginConnection(a),callback=f.microsoft.approve(start.body.url,'a');assert.match((await other.request(callback)).headers.get('location'),/error=oauth_invalid/);assert.match((await a.request(callback)).headers.get('location'),/result=connected/);assert.match((await a.request(callback)).headers.get('location'),/error=oauth_invalid/);
 let row=(await listConnections(a)).body.items[0];const reconnect=await beginConnection(a,{id:row.id,version:row.version}),wrong=f.microsoft.approve(reconnect.body.url,'b');assert.match((await a.request(wrong)).headers.get('location'),/error=identity_mismatch/);row=(await listConnections(a)).body.items[0];assert.equal(row.identity.accountId,'aaaaaaaa-0000-4000-8000-000000000001');assert.equal(row.status,'reconnect_required');
 const denied=await beginConnection(a);assert.match((await a.request(f.microsoft.approve(denied.body.url,'a','access_denied'))).headers.get('location'),/error=consent_denied/);
 const admin=await beginConnection(a);assert.match((await a.request(f.microsoft.approve(admin.body.url,'a','admin_consent_required'))).headers.get('location'),/error=admin_consent_required/);
 const change=await beginConnection(a),changedCallback=f.microsoft.approve(change.body.url,'a');await a.command('/api/caves/switch',{caveId:caveB});assert.match((await a.request(changedCallback)).headers.get('location'),/error=/);assert.equal((await listConnections(a)).body.items.length,0);
 }finally{await f.stop();}
});
test('EA-13 AC-03/05: unreadable credentials and an expired start remain recoverable without duplicate connections',async()=>{
 const f=await connectionHarness();try{const a=new HttpBrowser(f.appOrigin);await a.login('alice');let row=await selectConnection(a,await connectAccount(f,a));const previous=row.authorizationVersion;await f.owner.query('UPDATE provider_credentials SET ciphertext=$1 WHERE cave_id=$2 AND connection_id=$3',['v1.'+'x'.repeat(64),caveA,row.id]);assert.equal((await operateConnection(a,row,'inspect')).body.error,'reconnect_required');row=(await listConnections(a)).body.items[0];assert.equal(row.authorizationVersion,previous+1);assert.equal(row.status,'reconnect_required');const healed=await connectAccount(f,a,'a',{id:row.id,version:row.version});assert.equal(healed.id,row.id);assert.equal(healed.status,'unqualified');assert.equal(healed.mailboxId,row.mailboxId);
 const start=await beginConnection(a);await f.owner.query("UPDATE provider_oauth_attempts SET expires_at=now()-interval '1 second' WHERE connection_id=$1",[start.body.id]);const retry=await beginConnection(a,{},start.key);assert.equal(retry.status,200);assert.equal(retry.body.requiresReconnect,true);assert.equal(retry.body.id,start.body.id);assert.equal((await listConnections(a)).body.items.length,2);
 }finally{await f.stop();}
});
