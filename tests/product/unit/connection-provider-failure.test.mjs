import test from 'node:test';
import assert from 'node:assert/strict';
import { ServerError } from '@azure/msal-node';
import { providerFailure } from '@encave/connectors';

test('EA-13 R3: MSAL errorNo is normalized without disclosing provider diagnostics',()=>{
 for(const code of ['90094','90093',90094,90093]){const failure=providerFailure(new ServerError('consent_required','synthetic-correlation','synthetic private diagnostic','',code));assert.equal(failure.code,'admin_consent_required');assert.equal(failure.message.includes('private'),false);}
 for(const error of [null,{}, {errorNo:'90094-suffix'}, {errorNo:{toString(){return '90094';}}},{errorCodes:'90094'}])assert.equal(providerFailure(error).code,'provider_unavailable');
 assert.equal(providerFailure({errorCode:'consent_required'}).code,'interaction_required');
});
