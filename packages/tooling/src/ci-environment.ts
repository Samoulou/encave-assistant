import { mkdir, writeFile, lstat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSql } from './database.ts';
import { command } from './processes.ts';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../../../', import.meta.url));
export const postgresImage = 'postgres:17.11@sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675';

// Deliberately public fixture credentials, only for the disposable CI service.
// No production credentials or arbitrary connection URL are accepted here.
export function ciDatabaseConfig(env: NodeJS.ProcessEnv) {
  if (env['CI'] !== 'true' || env['GITHUB_ACTIONS'] !== 'true' || env['ENCAVE_RUNTIME_ENVIRONMENT'] !== 'test') {
    throw new Error('Database preparation is restricted to the isolated GitHub test job');
  }
  const run = env['GITHUB_RUN_ID'];
  const attempt = env['GITHUB_RUN_ATTEMPT'];
  if (!run || !attempt || !/^\d{1,20}$/.test(run) || !/^\d{1,6}$/.test(attempt)) {
    throw new Error('A valid CI run and attempt are required');
  }
  return {
    host: '127.0.0.1', port: 55432, user: 'encave_dev', database: 'encave_foundation_test',
    password: `encave-ci-fixture-${run}-${attempt}-isolated-tests`,
  };
}

export async function writeCiDatabase(base: string, env: NodeJS.ProcessEnv): Promise<void> {
  const config = ciDatabaseConfig(env);
  const local = join(base, '.local');
  await mkdir(local, { recursive: true });
  if ((await lstat(local)).isSymbolicLink()) throw new Error('A linked local directory is not permitted');
  // A rerun must use a fresh checkout; never replace an existing local cluster config.
  await writeFile(join(local, 'database.json'), JSON.stringify(config), { flag: 'wx', mode: 0o600 });
}

export async function startCiDatabase(base: string, env: NodeJS.ProcessEnv, run: typeof command = command, verify: () => Promise<void> = checkSql): Promise<void> {
  const config = ciDatabaseConfig(env);
  await writeCiDatabase(base, env);
  const envFile = join(base, '.local/ci-postgres.env');
  await writeFile(envFile, `POSTGRES_USER=${config.user}\nPOSTGRES_DB=${config.database}\nPOSTGRES_PASSWORD=${config.password}\nPOSTGRES_INITDB_ARGS=--auth-host=scram-sha-256\n`, { flag: 'wx', mode: 0o600 });
  let containerId: string | undefined;
  try {
    await run('docker', ['pull', postgresImage], { quiet: true, timeoutMs: 300_000 });
    const output = (await run('docker', ['create', '--rm', '--label', 'encave.role=ci-fixture', '--publish', '127.0.0.1:55432:5432', '--env-file', envFile, postgresImage], { quiet: true, timeoutMs: 300_000 })).trim();
    if (!/^[a-f0-9]{64}$/.test(output)) throw new Error('No verified container identifier');
    containerId = output;
    await run('docker', ['start', containerId], { quiet: true, timeoutMs: 30_000 });
    const deadline = performance.now() + 30_000;
    for (;;) {
      try { await verify(); break; }
      catch (error) { if (performance.now() >= deadline) throw error; await delay(500); }
    }
    await writeFile(join(base, '.local/ci-postgres.id'), containerId, { flag: 'wx', mode: 0o600 });
    // Hosted GitHub runners are disposable VMs: this database exists only for the job.
  } catch (error) {
    if (containerId) await run('docker', ['rm', '--force', containerId], { quiet: true, timeoutMs: 30_000 });
    throw error;
  } finally { await unlink(envFile); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await startCiDatabase(root, process.env);
    console.log('CI database ready: isolated loopback fixture container, real SQL verified');
  } catch {
    console.error('CI database preparation failed; no existing configuration was replaced');
    process.exitCode = 1;
  }
}
