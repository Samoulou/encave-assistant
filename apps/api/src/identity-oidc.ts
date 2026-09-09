import * as oidc from 'openid-client';
import { normalizeInvitationEmail } from '@encave/domain';
import { IdentityError, opaqueToken, tokenHash, validToken, openFlow, sealFlow } from './identity-security.ts';
import type { IdentityStore } from './identity-store.ts';

export type OidcSettings = {
  issuer: string; clientId: string; clientSecret: string; appOrigin: string;
  encryptionKey: string; environment: 'test' | 'development' | 'production' | 'preproduction';
};

export function validateOidcSettings(settings: OidcSettings): void {
  const issuer = new URL(settings.issuer);
  const origin = new URL(settings.appOrigin);
  if (!['test', 'development', 'production', 'preproduction'].includes(settings.environment)) throw new Error('Invalid environment');
  for (const url of [issuer, origin]) {
    if (url.username || url.password || url.search || url.hash) throw new Error('Invalid OIDC URL');
    const local = ['test', 'development'].includes(settings.environment) && url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('HTTPS required');
  }
  if (origin.origin !== settings.appOrigin || !/^[a-f0-9]{64}$/i.test(settings.encryptionKey) || !settings.clientId || !settings.clientSecret) throw new Error('Invalid OIDC configuration');
}

export class IdentityOidc {
  settings: OidcSettings;
  store: IdentityStore;
  configuration: Promise<oidc.Configuration> | undefined;
  constructor(settings: OidcSettings, store: IdentityStore) { validateOidcSettings(settings); this.settings = settings; this.store = store; }

  async config() {
    if (!this.configuration) {
      const executions = [oidc.enableNonRepudiationChecks];
      if (new URL(this.settings.issuer).protocol === 'http:') executions.push(oidc.allowInsecureRequests);
      this.configuration = oidc.discovery(new URL(this.settings.issuer), this.settings.clientId,
        { id_token_signed_response_alg: 'RS256' }, oidc.ClientSecretBasic(this.settings.clientSecret),
        { execute: executions, timeout: 5 }).catch(error => { this.configuration = undefined; throw error; });
    }
    return this.configuration;
  }

  async begin() {
    const config = await this.config();
    const state = opaqueToken(); const browser = opaqueToken();
    const verifier = oidc.randomPKCECodeVerifier(); const nonce = oidc.randomNonce();
    await this.store.pool.query('DELETE FROM login_attempts WHERE expires_at<=now()');
    await this.store.pool.query("INSERT INTO login_attempts(state_hash,browser_hash,encrypted_flow,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')", [tokenHash(state), tokenHash(browser), sealFlow({ verifier, nonce }, this.settings.encryptionKey)]);
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.settings.appOrigin + '/api/auth/callback', scope: 'openid email profile',
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256',
      state, nonce, prompt: 'login',
      claims: JSON.stringify({ id_token: { email: { essential: true }, email_verified: { essential: true }, name: null } }),
    });
    return { browser, url: url.href };
  }

  async finish(url: URL, browser: string): Promise<string> {
    const state = url.searchParams.get('state');
    if (!validToken(state) || !validToken(browser)) throw new IdentityError(400, 'login_failed');
    const result = await this.store.pool.query('DELETE FROM login_attempts WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING encrypted_flow', [tokenHash(state), tokenHash(browser)]);
    if (!result.rows[0]) throw new IdentityError(400, 'login_failed');
    const flow = openFlow(result.rows[0].encrypted_flow, this.settings.encryptionKey);
    const tokens = await oidc.authorizationCodeGrant(await this.config(), url, { pkceCodeVerifier: flow.verifier, expectedNonce: flow.nonce, expectedState: state, idTokenExpected: true });
    const claims = tokens.claims();
    if (!claims || claims.email_verified !== true || typeof claims.sub !== 'string' || !claims.sub.length || claims.sub.length > 255 || typeof claims.exp !== 'number') throw new IdentityError(400, 'login_failed');
    const email = normalizeInvitationEmail(claims.email);
    const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 160) : email;
    // No provider role, organization or token is forwarded to the browser or domain.
    return this.store.createSession({ issuer: this.settings.issuer, subject: claims.sub, email, name, expiresAt: claims.exp * 1000 });
  }
}
