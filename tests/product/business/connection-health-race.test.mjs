import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionHarness,HttpBrowser,connectAccount,selectConnection,operateConnection,listConnections,caveA } from '../helpers/connection-harness.mjs';

test('EA-13 R2: an obsolete failed health check cannot overwrite a newer success or suspend jobs',async()=>{
 const f=await connectionHarness();let release;const originalFetch=globalThis.fetch;
 try{const a=new HttpBrowser(f.appOrigin);await a.login('alice');let row=await selectConnection(a,await connectAccount(f,a));await operateConnection(a,row,'activate');row=(await listConnections(a)).body.items[0];
  let reached,heldOnce=false;const entered=new Promise(r=>reached=r),held=new Promise(r=>release=r);f.microsoft.controls.graphMode='rate';
  globalThis.fetch=async(...args)=>{const response=await originalFetch(...args);if(String(args[0]).startsWith(f.microsoft.settings.fixtureOrigin+'/graph/v1.0/me?')&&!heldOnce){heldOnce=true;assert.equal(response.status,429);reached();await held;}return response;};
  const earlier=operateConnection(a,row,'inspect');await entered;f.microsoft.controls.graphMode='valid';assert.equal((await operateConnection(a,row,'inspect')).status,200);const newer=(await listConnections(a)).body.items[0];assert.equal(newer.status,'active');
  const credential=(await f.owner.query('SELECT ciphertext FROM provider_credentials WHERE connection_id=$1',[row.id])).rows[0].ciphertext;
  release();assert.equal((await earlier).status,429);const final=(await listConnections(a)).body.items[0];assert.equal(final.status,'active');assert.equal(final.version,newer.version);assert.equal(final.lastError,null);assert.equal((await f.owner.query('SELECT ciphertext FROM provider_credentials WHERE connection_id=$1',[row.id])).rows[0].ciphertext,credential);
  const resources=await f.connectionStore.runDiscoveryJob({caveId:caveA,connectionId:row.id,authorizationVersion:final.authorizationVersion});assert.equal(resources.resources.length,2);
 }finally{globalThis.fetch=originalFetch;release?.();await f.stop();}
});
