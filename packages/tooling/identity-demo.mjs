import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureProvider } from './identity-fixture-provider.mjs';
import { createIdentityTestDatabase } from './src/identity-test-database.ts';
import { launch, stopProcess, until } from './src/processes.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const local = resolve(root, '.local');
let identity, database, directory;
const processes = [];
try {
  await mkdir(local, { recursive: true });
  identity = await fixtureProvider(4010, 'http://127.0.0.1:3000');
  database = await createIdentityTestDatabase(identity.issuer);
  directory = await mkdtemp(join(local, 'identity-demo-'));
  const file = join(directory, 'runtime.json');
  await writeFile(file, JSON.stringify({ database: database.applicationConfig, oidc: {
    issuer: identity.issuer, clientId: 'encave-test', clientSecret: 'public-fixture-client-credential',
    appOrigin: 'http://127.0.0.1:3000', encryptionKey: randomBytes(32).toString('hex'), environment: 'development',
  } }), { mode: 0o600, flag: 'wx' });
  const workerFile = join(directory, 'worker.json');
  await writeFile(workerFile, JSON.stringify({ database: database.applicationConfig }), { mode: 0o600, flag: 'wx' });
  const worker = launch(process.execPath, ['apps/worker/dist/index.js'], { cwd: root, env: { ...process.env, ENCAVE_WORKER_CONFIG: workerFile } }); processes.push(worker);
  await until(async () => worker.output().includes('"mode":"team_exports"'), worker, 15_000);
  const api = launch(process.execPath, ['apps/api/dist/index.js'], { cwd: root, env: { ...process.env, PORT: '3001', ENCAVE_IDENTITY_CONFIG: file } }); processes.push(api);
  await until(async () => { try { return (await fetch('http://127.0.0.1:3001/api/session')).status === 401; } catch { return false; } }, api, 15_000);
  const web = launch(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3000'], {
    cwd: join(root, 'apps/web'), env: { ...process.env, ENCAVE_API_ORIGIN: 'http://127.0.0.1:3001', NEXT_TELEMETRY_DISABLED: '1' },
  }); processes.push(web);
  await until(async () => { try { return (await fetch('http://127.0.0.1:3000/connexion')).status === 200; } catch { return false; } }, web, 30_000);
  console.log('Identity demo ready: http://127.0.0.1:3000/connexion');
  console.log('Team export worker ready with its database-only configuration.');
  console.log('Synthetic accounts only. PostgreSQL persists reloads; this disposable demo database is removed on normal exit. No Microsoft or production identity is connected.');
  if (!process.argv.includes('--verify')) await new Promise(resolveStop => {
    process.once('SIGINT', resolveStop); process.once('SIGTERM', resolveStop);
    for (const child of processes) void child.completion.then(resolveStop);
  });
} catch { console.error('Identity demo failed. Check isolated PostgreSQL, completed build and free loopback ports 3000/3001/4010.'); process.exitCode = 1; }
finally {
  for (const child of processes.reverse()) await stopProcess(child);
  if (identity) await identity.stop();
  if (database) await database.cleanup();
  if (directory) {
    const owned = resolve(directory);
    if (!owned.startsWith(local + sep) || !owned.slice(local.length + 1).startsWith('identity-demo-')) throw new Error('Unexpected cleanup path');
    await rm(owned, { recursive: true, force: true });
  }
  console.log('Identity demo processes and owned synthetic resources stopped.');
}
