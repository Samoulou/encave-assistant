import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MicrosoftAdapter,microsoftDiscoveryScopes } from '@encave/connectors';
import { microsoftFixture,fixtureMicrosoftAccounts } from '../../../packages/tooling/microsoft-fixture.mjs';
import { freePort } from '../helpers/identity-harness.mjs';
const flow=()=>({state:randomBytes(32).toString('base64url'),verifier:randomBytes(32).toString('base64url'),nonce:randomBytes(32).toString('base64url')});
async function setup(t){const origin='http://127.0.0.1:'+await freePort(),fixture=await microsoftFixture(await freePort(),origin);t.after(()=>fixture.stop());return{fixture,adapter:new MicrosoftAdapter(fixture.settings,origin,'test')};}
async function connect(adapter,fixture,account='a'){const f=flow(),url=await adapter.authorization(f),callback=new URL(fixture.approve(url,account));return adapter.complete(callback.searchParams.get('code'),f);}
test('MSAL Code PKCE validates a synthetic Microsoft identity and discovers only its own mailbox and main calendar',async t=>{
 const {fixture,adapter}=await setup(t),result=await connect(adapter,fixture);assert.deepEqual(result.credentials.identity,fixtureMicrosoftAccounts.a);assert.equal(result.resources.length,2);assert.equal(result.resources.every(r=>r.ownerId===fixtureMicrosoftAccounts.a.accountId&&!r.writable),true);assert.equal(typeof result.credentials.cache,'string');assert.deepEqual(result.missing,[]);const inspected=await adapter.inspect(result.credentials);assert.deepEqual(inspected.resources,result.resources);assert.equal(adapter.capabilities(false,result.resources).some(c=>c.state==='available'),false);assert.equal(adapter.capabilities(true,result.resources).filter(c=>c.state==='available').length,1);assert.deepEqual(microsoftDiscoveryScopes,['User.Read','Mail.ReadBasic','Calendars.ReadBasic']);await assert.rejects(adapter.sendMessage(),e=>e.code==='not_supported');
});
test('synthetic provider adversarial identities, resource permissions, throttling and refresh refusal fail explicitly',async t=>{
 const {fixture,adapter}=await setup(t);for(const mode of ['nonce','issuer','audience','signature','personal','expired']){fixture.controls.idTokenMode=mode;await assert.rejects(connect(adapter,fixture),e=>['oauth_invalid','identity_mismatch'].includes(e.code));}fixture.controls.idTokenMode='valid';fixture.controls.graphMode='identity';await assert.rejects(connect(adapter,fixture),e=>e.code==='identity_mismatch');fixture.controls.graphMode='rate';await assert.rejects(connect(adapter,fixture),e=>e.code==='rate_limited'&&e.retryAfter===7);fixture.controls.graphMode='valid';fixture.controls.missing.add('mailbox');const partial=await connect(adapter,fixture,'b');assert.equal(partial.resources.length,1);assert.deepEqual(partial.missing,['mailbox']);fixture.controls.expiresIn=1;const expiring=await connect(adapter,fixture);fixture.controls.refreshMode='invalid';await assert.rejects(adapter.inspect(expiring.credentials),e=>e.code==='interaction_required');
});
test('Microsoft network timeout is bounded and returns a safe provider error',async t=>{
 const {fixture,adapter}=await setup(t);let release;const held=new Promise(r=>release=r);fixture.controls.beforeGraph=()=>held;try{await assert.rejects(connect(adapter,fixture),e=>e.code==='provider_unavailable');}finally{release();}
});
