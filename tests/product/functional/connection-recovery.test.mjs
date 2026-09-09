import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionHarness,HttpBrowser,beginConnection,listConnections,connectAccount,operateConnection } from '../helpers/connection-harness.mjs';

test('EA-13 R1: a new session recovers the original connection and cancels its old OAuth binding',async()=>{
 const f=await connectionHarness();try{
  const old=new HttpBrowser(f.appOrigin),fresh=new HttpBrowser(f.appOrigin);await old.login('alice');
  const start=await beginConnection(old),callback=f.microsoft.approve(start.body.url,'a');await fresh.login('alice');
  const recovered=await beginConnection(fresh,{},start.key);assert.equal(recovered.status,200);assert.equal(recovered.body.id,start.body.id);assert.equal(recovered.body.requiresReconnect,true);assert.equal(recovered.body.url,undefined);
  const row=(await listConnections(fresh)).body.items[0];assert.equal(row.status,'reconnect_required');assert.equal(row.authorizationVersion,2);
  assert.match((await old.request(callback)).headers.get('location'),/error=oauth_invalid/);
  assert.equal((await beginConnection(fresh,{},start.key)).body.requiresReconnect,true);
  const healed=await connectAccount(f,fresh,'a',{id:row.id,version:row.version});assert.equal(healed.id,start.body.id);assert.equal(healed.status,'selection_required');
  await beginConnection(fresh,{},start.key);assert.equal((await listConnections(fresh)).body.items[0].version,healed.version);assert.equal((await listConnections(fresh)).body.items.length,1);
 }finally{await f.stop();}
});

test('EA-13 R3: an actual MSAL refresh response requiring admin consent persists the correct safe health state',async()=>{
 const f=await connectionHarness();try{const a=new HttpBrowser(f.appOrigin);await a.login('alice');f.microsoft.controls.expiresIn=1;const row=await connectAccount(f,a);f.microsoft.controls.refreshMode='admin';
  const result=await operateConnection(a,row,'inspect');assert.equal(result.status,409);assert.equal(result.body.error,'admin_consent_required');assert.equal((await listConnections(a)).body.items[0].status,'admin_consent_required');assert.equal(JSON.stringify(result.body).includes('synthetic private diagnostic'),false);
 }finally{await f.stop();}
});
