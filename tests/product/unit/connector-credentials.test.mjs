import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { CredentialCipher,validateMicrosoftSettings } from '@encave/connectors';
import { beginConnectionSchema,selectConnectionResourcesSchema } from '@encave/contracts';
test('credential envelopes authenticate cave connection purpose and key version without plaintext',()=>{
 const cipher=new CredentialCipher(randomBytes(32).toString('hex')),scope={caveId:randomUUID(),connectionId:randomUUID(),purpose:'credentials:1'},secret=randomBytes(32).toString('base64url'),sealed=cipher.seal({secret},scope);assert.equal(sealed.includes(secret),false);assert.equal(cipher.open(sealed,scope).secret===secret,true);for(const patch of [{caveId:randomUUID()},{connectionId:randomUUID()},{purpose:'flow'}])assert.throws(()=>cipher.open(sealed,{...scope,...patch}));assert.throws(()=>cipher.open(sealed.slice(0,-20)+'x'.repeat(20),scope));assert.throws(()=>new CredentialCipher(randomBytes(32).toString('hex')).open(sealed,scope));assert.throws(()=>new CredentialCipher(randomBytes(32).toString('hex'),'v2').open(sealed,scope));
});
test('synthetic transport is refused outside test and public connection commands reject foreign authority fields',()=>{
 const config={clientId:randomUUID(),clientSecret:'synthetic-only',encryptionKey:randomBytes(32).toString('hex'),keyVersion:'v1',fixtureOrigin:'http://127.0.0.1:12345'};assert.doesNotThrow(()=>validateMicrosoftSettings(config,'test'));for(const environment of ['development','preproduction','production'])assert.throws(()=>validateMicrosoftSettings(config,environment));assert.throws(()=>validateMicrosoftSettings({...config,fixtureOrigin:'http://external.example'},'test'));assert.equal(beginConnectionSchema.safeParse({provider:'microsoft365',connectionId:null,expectedVersion:0,label:'Essai',caveId:randomUUID()}).success,false);assert.equal(selectConnectionResourcesSchema.safeParse({expectedVersion:1,mailboxId:null,calendarId:null}).success,false);
});
