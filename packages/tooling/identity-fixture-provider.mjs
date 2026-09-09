import Provider from 'oidc-provider';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { generateKeyPair, exportJWK, decodeJwt, SignJWT } from 'jose';
import { fixturePeople } from './src/identity-test-database.ts';

// Test fixture only: deliberately synthetic account selection, never production authentication.
export async function fixtureProvider(port, appOrigin) {
  const issuer = `http://127.0.0.1:${port}`;
  if (new URL(appOrigin).hostname !== '127.0.0.1') throw new Error('Fixture accepts loopback only');
  const pair = await generateKeyPair('RS256', { extractable: true });
  const alien = await generateKeyPair('RS256', { extractable: true });
  const key = { ...await exportJWK(pair.privateKey), kid: 'synthetic-key', use: 'sig', alg: 'RS256' };
  const controls = { tokenFault: '', delayMs: 0 };
  const provider = new Provider(issuer, {
    clients: [{ client_id: 'encave-test', client_secret: 'public-fixture-client-credential',
      redirect_uris: [appOrigin + '/api/auth/callback'], response_types: ['code'],
      grant_types: ['authorization_code'], token_endpoint_auth_method: 'client_secret_basic',
      id_token_signed_response_alg: 'RS256' }],
    cookies: { keys: [randomBytes(32).toString('hex')] },
    jwks: { keys: [key] },
    features: { devInteractions: { enabled: false }, claimsParameter: { enabled: true } },
    pkce: { required: () => true },
    claims: { openid: ['sub'], email: ['email', 'email_verified'], profile: ['name'] },
    findAccount: async (_ctx, sub) => {
      const person = fixturePeople.find(p => p.subject === sub);
      return person ? { accountId: sub, claims: async () => ({ sub, email: person.email, email_verified: true, name: person.name }) } : undefined;
    },
    renderError: async ctx => { ctx.type = 'html'; ctx.body = '<h1>Connexion de test refusée</h1>'; },
  });
  // Deliberate protocol faults are confined to this test provider, never application code.
  provider.use(async (ctx, next) => {
    await next();
    if (ctx.path === '/token' && ctx.body?.id_token && controls.tokenFault) {
      const fault = controls.tokenFault;
      const claims = decodeJwt(ctx.body.id_token);
      if (fault === 'nonce') claims.nonce = 'incorrect';
      if (fault === 'issuer') claims.iss = issuer + '/different';
      if (fault === 'audience') claims.aud = 'another-client';
      if (fault === 'expired') claims.exp = Math.floor(Date.now() / 1000) - 120;
      if (fault === 'unverified_email') claims.email_verified = false;
      ctx.body.id_token = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: key.kid }).sign(fault === 'signature' ? alien.privateKey : pair.privateKey);
    }
  });
  const callback = provider.callback();
  const server = createServer(async (request, response) => {
    try {
      if (request.url?.startsWith('/interaction/')) {
        const details = await provider.interactionDetails(request, response);
        response.setHeader('Cache-Control', 'no-store');
        if (details.prompt.name === 'consent') {
          const grant = new provider.Grant({ accountId: details.session.accountId, clientId: details.params.client_id });
          grant.addOIDCScope('openid email profile');
          if (details.prompt.details.missingOIDCClaims) grant.addOIDCClaims(details.prompt.details.missingOIDCClaims);
          await provider.interactionFinished(request, response, { consent: { grantId: await grant.save() } }); return;
        }
        if (request.method === 'POST') {
          if (request.headers.origin !== issuer) { response.writeHead(403).end(); return; }
          let raw = '';
          for await (const chunk of request) { raw += chunk; if (raw.length > 1024) throw new Error('Too large'); }
          const subject = new URLSearchParams(raw).get('account');
          if (!fixturePeople.some(p => p.subject === subject)) { response.writeHead(403).end(); return; }
          await provider.interactionFinished(request, response, { login: { accountId: subject } }, { mergeWithLastSubmission: false }); return;
        }
        if (controls.delayMs) await new Promise(resolve => setTimeout(resolve, controls.delayMs));
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'same-origin' });
        response.end(`<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width"><title>Identités de test</title><style>body{font:16px/1.5 system-ui;max-width:520px;margin:32px auto;padding:16px}button{display:block;min-height:44px;width:100%;margin:12px 0;font:inherit}</style><h1>Identités de test</h1><p>Comptes fictifs locaux. Aucun compte client connecté.</p><form method="post">${fixturePeople.map(p => `<button name="account" value="${p.subject}">${p.name}</button>`).join('')}</form></html>`); return;
      }
      callback(request, response);
    } catch { if (!response.headersSent) response.writeHead(400); response.end('Connexion de test refusée'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { issuer, controls, provider, stop: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
