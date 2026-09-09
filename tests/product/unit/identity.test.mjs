import test from 'node:test';
import assert from 'node:assert/strict';
import { isRole, mayManageTeam, mayRevoke, normalizeInvitationEmail } from '../../../packages/domain/src/identity.ts';
import { opaqueToken, tokenHash, validToken, openFlow, sealFlow, readCookie } from '../../../apps/api/src/identity-security.ts';
import { validateOidcSettings } from '../../../apps/api/src/identity-oidc.ts';

test('role decisions allow consultation and reserve team mutations to administrators', () => {
  for (const role of ['admin', 'operator', 'reader']) {
    assert.equal(isRole(role), true); assert.equal(mayManageTeam(role, 'read'), true);
    for (const action of ['invite', 'revoke']) assert.equal(mayManageTeam(role, action), role === 'admin');
  }
  for (const role of ['', 'owner', null, ['admin']]) assert.equal(isRole(role), false);
  assert.equal(mayRevoke('admin', 1), false); assert.equal(mayRevoke('admin', 2), true);
  assert.equal(mayRevoke('reader', 1), true);
});

test('invitation email validation is deterministic and rejects malformed input', () => {
  assert.equal(normalizeInvitationEmail(' Alice@Cave-Test.Example '), 'alice@cave-test.example');
  for (const value of [undefined, 'missing-at', 'a@', 'a\nb@example.com', 'x'.repeat(255) + '@example.com']) assert.throws(() => normalizeInvitationEmail(value));
});

test('opaque tokens, duplicate-cookie refusal and authenticated encryption protect browser flows', () => {
  const verifier = opaqueToken(), nonce = opaqueToken(), key = 'a'.repeat(64);
  assert.equal(validToken(verifier), true); assert.notEqual(verifier, opaqueToken()); assert.equal(tokenHash(verifier).length, 64);
  const sealed = sealFlow({ verifier, nonce }, key);
  assert.deepEqual(openFlow(sealed, key), { verifier, nonce });
  assert.throws(() => openFlow(sealed, 'b'.repeat(64)));
  const tampered = Buffer.from(sealed, 'base64url'); tampered[29] ^= 1;
  assert.throws(() => openFlow(tampered.toString('base64url'), key));
  assert.equal(readCookie('sid=one; sid=two', 'sid'), ''); assert.equal(readCookie('other=x; sid=value', 'sid'), 'value');
});

test('OIDC settings restrict insecure transport to explicit loopback development', () => {
  const settings = { issuer: 'http://127.0.0.1:4000', appOrigin: 'http://127.0.0.1:3000', clientId: 'fixture', clientSecret: 'public-fixture', encryptionKey: 'a'.repeat(64), environment: 'test' };
  assert.doesNotThrow(() => validateOidcSettings(settings));
  for (const patch of [{ environment: 'production' }, { issuer: 'http://provider.example' }, { appOrigin: 'http://127.0.0.1:3000/path' }, { issuer: 'https://user:pass@provider.example' }, { encryptionKey: 'short' }]) assert.throws(() => validateOidcSettings({ ...settings, ...patch }));
  assert.doesNotThrow(() => validateOidcSettings({ ...settings, environment: 'production', issuer: 'https://identity.example/realm', appOrigin: 'https://app.example' }));
});
