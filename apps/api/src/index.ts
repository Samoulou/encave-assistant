import { createServer } from 'node:http';
import { foundationScope } from '@encave/domain';
import { technicalHealthSchema } from '@encave/contracts';
import { availableProviderCapabilities } from '@encave/connectors';
import { identityRuntime } from './identity-runtime.ts';

const port = Number(process.env['PORT'] ?? 3001);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
if (availableProviderCapabilities.length) throw new Error('Foundation requires inactive providers');
const health = technicalHealthSchema.parse({
  service: 'api', status: 'ready', mode: foundationScope.mode,
  synthetic: foundationScope.synthetic, runId: process.env['FOUNDATION_RUN_ID'] ?? 'local',
});
let identity: Awaited<ReturnType<typeof identityRuntime>> | undefined;
try { identity = process.env['ENCAVE_IDENTITY_CONFIG'] ? await identityRuntime(process.env['ENCAVE_IDENTITY_CONFIG']) : undefined; }
catch { console.error('Identity startup failed: configuration, database and least-privilege role must be valid.'); process.exit(1); }
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200).end(JSON.stringify(health));
  } else if (request.url?.startsWith('/api/') && identity) {
    void identity.handler(request, response);
  } else if (request.url?.startsWith('/api/')) {
    response.writeHead(503).end(JSON.stringify({ error: 'identity_not_configured' }));
  } else {
    response.writeHead(404).end(JSON.stringify({ error: 'not_found' }));
  }
});
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify(health)));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { server.close(); server.closeAllConnections(); void identity?.stop(); });
}
