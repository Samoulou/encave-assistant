import { createServer } from 'node:http';
import { createServer as tcpServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fixtureProvider } from '../../../packages/tooling/identity-fixture-provider.mjs';
import { createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';
import { IdentityStore } from '../../../apps/api/src/identity-store.ts';
import { createIdentityHandler } from '../../../apps/api/src/identity-http.ts';
import { launch, stopProcess, until } from '../../../packages/tooling/src/processes.ts';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export async function freePort() {
  const server = tcpServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

export async function identityHarness({ web = false } = {}) {
  const apiPort = await freePort();
  const webPort = web ? await freePort() : apiPort;
  const providerPort = await freePort();
  const appOrigin = `http://127.0.0.1:${webPort}`;
  const apiOrigin = `http://127.0.0.1:${apiPort}`;
  const identity = await fixtureProvider(providerPort, appOrigin);
  let database; let api; let webProcess;
  try {
    database = await createIdentityTestDatabase(identity.issuer);
    const settings = { issuer: identity.issuer, clientId: 'encave-test', clientSecret: 'public-fixture-client-credential', appOrigin, encryptionKey: randomBytes(32).toString('hex'), environment: 'test' };
    const store = new IdentityStore(database.pool);
    const handler = createIdentityHandler(store, settings);
    api = createServer((request, response) => { void handler(request, response); });
    await new Promise((resolve, reject) => { api.once('error', reject); api.listen(apiPort, '127.0.0.1', resolve); });
    if (web) {
      const root = fileURLToPath(new URL('../../../', import.meta.url));
      // Three levels from tests/product/helpers is the repository root.
      webProcess = launch(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(webPort)], {
        cwd: join(root, 'apps/web'), env: { ...process.env, ENCAVE_API_ORIGIN: apiOrigin, NEXT_TELEMETRY_DISABLED: '1' },
      });
      await until(async () => { try { return (await fetch(appOrigin + '/connexion')).status === 200; } catch { return false; } }, webProcess, 30_000);
    }
    return { ...database, store, identity, settings, appOrigin, apiOrigin,
      stop: async () => {
        if (webProcess) await stopProcess(webProcess);
        api.closeAllConnections(); await new Promise(resolve => api.close(resolve));
        await identity.stop(); await database.cleanup();
      },
    };
  } catch (error) {
    if (webProcess) await stopProcess(webProcess);
    if (api) { api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
    await identity.stop(); if (database) await database.cleanup();
    throw error;
  }
}

// Executes real HTTP OIDC redirects and cookies without shortcutting the callback.
export class HttpBrowser {
  cookies = new Map();
  origin;
  constructor(origin) { this.origin = origin; }
  async request(url, options = {}) {
    const target = new URL(url, this.origin);
    const jar = this.cookies.get(target.host) ?? new Map();
    const headers = { ...options.headers, cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') };
    const response = await fetch(target, { ...options, headers, redirect: 'manual', signal: AbortSignal.timeout(8000) });
    for (const set of response.headers.getSetCookie()) { const [pair] = set.split(';'); const eq = pair.indexOf('='); jar.set(pair.slice(0, eq), pair.slice(eq + 1)); }
    this.cookies.set(target.host, jar);
    return response;
  }
  async follow(response) {
    for (let i = 0; i < 12 && response.status >= 300 && response.status < 400; i++) response = await this.request(new URL(response.headers.get('location'), response.url).href);
    return response;
  }
  async login(subject, mutateAuthorization = value => value) {
    const start = await this.request('/api/auth/start');
    const authorization = start.headers.get('location');
    if (!authorization) throw new Error('Login did not redirect');
    let response = await this.follow(await this.request(mutateAuthorization(authorization)));
    if (response.status !== 200 || !(await response.text()).includes('Identités de test')) throw new Error('Test identity form missing');
    const interaction = response.url;
    response = await this.request(interaction, { method: 'POST', headers: { origin: new URL(interaction).origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ account: subject }) });
    let callback = '';
    for (let i = 0; i < 12 && response.status >= 300 && response.status < 400; i++) {
      const location = new URL(response.headers.get('location'), response.url).href;
      if (location.includes('/api/auth/callback?')) callback = location;
      if (location === this.origin + '/espace' || location.includes('/connexion?')) return { callback, location, authorization };
      response = await this.request(location);
    }
    throw new Error('OIDC login did not finish');
  }
  async session() { const response = await this.request('/api/session'); return { status: response.status, body: await response.json() }; }
  async command(path, body, override = {}) {
    const session = await this.session();
    return this.request(path, { method: 'POST', headers: { origin: this.origin, 'content-type': 'application/json', 'x-csrf-token': session.body.csrf ?? '', 'x-encave-cave': session.body.activeCave?.id ?? '', ...override }, body: JSON.stringify(body) });
  }
}
