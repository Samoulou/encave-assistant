import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { launch, command, stopProcess, until, type ManagedProcess } from './processes.ts';
import { checkSql } from './database.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
export const requiredWorkspaces = ['packages/domain', 'packages/contracts', 'packages/connectors', 'packages/tooling', 'apps/api', 'apps/worker', 'apps/web'];

export async function checkWorkspaceSources(base: string): Promise<void> {
  for (const path of requiredWorkspaces) {
    const manifest = JSON.parse(await readFile(join(base, path, 'package.json'), 'utf8'));
    if (!manifest.private || !manifest.name?.startsWith('@encave/')) throw new Error('Invalid private workspace');
    await access(join(base, path, 'tsconfig.json'));
    const source = join(base, path, path === 'apps/web' ? 'app' : 'src');
    if (!(await readdir(source)).some(f => /\.tsx?$/.test(f))) throw new Error(`Missing TypeScript source: ${path}`);
    // Existing build output must never stand in for a deleted entry point.
    const entries = path === 'apps/web' ? ['page.tsx', 'layout.tsx'] : path === 'packages/tooling' ? ['foundation.ts', 'database.ts', 'suites.ts', 'processes.ts'] : ['index.ts'];
    for (const entry of entries) await access(join(source, entry));
  }
}

async function freePort(): Promise<number> {
  const server = createServer();
  return new Promise((resolvePort, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') { server.close(); reject(new Error('No port')); return; }
      server.close(error => error ? reject(error) : resolvePort(address.port));
    });
  });
}

export async function httpReady(url: string, validate: (body: string) => boolean): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000), redirect: 'error' });
    return response.status === 200 && validate(await response.text());
  } catch { return false; }
}

export async function verifyRuntime(): Promise<void> {
  const processes: ManagedProcess[] = [];
  const runId = randomUUID();
  const apiPort = await freePort();
  let webPort = await freePort();
  while (webPort === apiPort) webPort = await freePort();
  const env = { ...process.env, FOUNDATION_RUN_ID: runId, NEXT_TELEMETRY_DISABLED: '1' };
  try {
    const api = launch(process.execPath, ['apps/api/dist/index.js'], { cwd: root, env: { ...env, PORT: String(apiPort) } });
    processes.push(api);
    const worker = launch(process.execPath, ['apps/worker/dist/index.js'], { cwd: root, env });
    processes.push(worker);
    const web = launch(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(webPort)], { cwd: join(root, 'apps/web'), env });
    processes.push(web);
    await until(async () => httpReady(`http://127.0.0.1:${apiPort}/health`, body => {
      const result = JSON.parse(body);
      return result.runId === runId && result.service === 'api' && result.status === 'ready' && result.synthetic === true;
    }), api, 30_000);
    console.log('API: live HTTP health response matched this run');
    await until(async () => worker.output().split(/\r?\n/).some(line => {
      try { const result = JSON.parse(line); return result.runId === runId && result.service === 'worker' && result.status === 'ready' && result.synthetic === true; } catch { return false; }
    }), worker, 30_000);
    console.log('Worker: readiness signal matched this run');
    await until(async () => httpReady(`http://127.0.0.1:${webPort}/`, body => body.includes('Le point de départ de votre assistant') && body.includes('données synthétiques')), web, 45_000);
    console.log('Web: compiled page returned HTTP 200 and expected local content');
    await checkSql();
    if (processes.some(p => p.exited())) throw new Error('Service exited during runtime checks');
  } finally {
    const results = await Promise.allSettled(processes.map(stopProcess));
    if (results.some(r => r.status === 'rejected')) throw new Error('Runtime process cleanup failed');
    console.log('Runtime processes stopped');
  }
}

export async function foundation(): Promise<void> {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Node 24 required');
  await checkWorkspaceSources(root);
  await command(process.execPath, ['node_modules/typescript/bin/tsc', '-b', '--force'], { cwd: root });
  await command(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'build'], { cwd: join(root, 'apps/web'), env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, timeoutMs: 300_000 });
  await command(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'apps/web/tsconfig.json', '--noEmit'], { cwd: root });
  for (const path of requiredWorkspaces) {
    await access(join(root, path, path === 'apps/web' ? '.next/BUILD_ID' : path === 'packages/tooling' ? 'dist/foundation.js' : 'dist/index.js'));
  }
  await verifyRuntime();
  console.log('FOUNDATION PASS: compilation, web, API, worker, SQL. No product suite was executed.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await foundation(); } catch (error) { console.error('FOUNDATION FAILED:', error instanceof Error ? error.message : 'unknown failure'); process.exitCode = 1; }
}
