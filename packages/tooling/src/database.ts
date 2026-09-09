import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { command } from './processes.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const local = join(root, '.local');
const data = join(local, 'pgdata');
const configFile = join(local, 'database.json');
type LocalDatabase = { host: string; port: number; user: string; password: string; database: string };
const binary = (name: string) => process.env['PG_BIN']
  ? join(process.env['PG_BIN'], name + (process.platform === 'win32' ? '.exe' : '')) : name;
const exists = async (path: string) => access(path).then(() => true, () => false);

export async function localDatabaseConfig(): Promise<LocalDatabase> {
  if (!(await exists(configFile))) throw new Error('Local database missing: run npm run db:start with PG_BIN configured');
  const value: unknown = JSON.parse(await readFile(configFile, 'utf8'));
  if (!value || typeof value !== 'object') throw new Error('Invalid local database configuration');
  const c = value as LocalDatabase;
  if (c.host !== '127.0.0.1' || c.database !== 'encave_foundation_test' || c.user !== 'encave_dev' || c.port !== 55432 || typeof c.password !== 'string' || c.password.length < 32) {
    throw new Error('Only the isolated foundation database is permitted');
  }
  return c;
}

export async function checkSql(): Promise<void> {
  const client = new pg.Client({ ...await localDatabaseConfig(), connectionTimeoutMillis: 3_000, query_timeout: 3_000 });
  try {
    await client.connect();
    const result = await client.query('SELECT current_database() AS database, $1::integer + $2::integer AS answer', [19, 23]);
    if (result.rows[0]?.database !== 'encave_foundation_test' || result.rows[0]?.answer !== 42) throw new Error('Unexpected SQL result');
    console.log('SQL: connected to isolated encave_foundation_test; parameterized query returned 42');
  } finally { await client.end(); }
}

async function start(): Promise<void> {
  await mkdir(local, { recursive: true });
  // Never overwrite an existing cluster or credentials.
  if (!(await exists(configFile))) {
    if (await exists(data)) throw new Error('Existing cluster without managed configuration; inspect locally, do not overwrite');
    const config: LocalDatabase = { host: '127.0.0.1', port: 55432, user: 'encave_dev', password: randomBytes(32).toString('hex'), database: 'encave_foundation_test' };
    const passwordFile = join(local, 'init-password');
    await writeFile(passwordFile, config.password, { mode: 0o600, flag: 'wx' });
    try {
      await command(binary('initdb'), ['-D', data, '-U', config.user, '--pwfile', passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C'], { quiet: true });
      await writeFile(configFile, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
    } finally { await unlink(passwordFile); }
  }
  const config = await localDatabaseConfig();
  if (!(await exists(join(data, 'postmaster.pid')))) {
    // The persistent server must not inherit Node's captured pipes on Windows.
    await command(binary('pg_ctl'), ['-D', data, '-l', join(local, 'postgres.log'), '-o', '-h 127.0.0.1 -p 55432', '-w', '-t', '30', 'start'], { quiet: true, discardOutput: true, timeoutMs: 40_000 });
  }
  const admin = new pg.Client({ ...config, database: 'postgres', connectionTimeoutMillis: 3_000, query_timeout: 3_000 });
  try {
    await admin.connect();
    const db = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database]);
    if (!db.rowCount) await admin.query('CREATE DATABASE encave_foundation_test');
  } finally { await admin.end(); }
  await checkSql();
  console.log('PostgreSQL ready on 127.0.0.1:55432. Stop with npm run db:stop.');
}

async function stop(): Promise<void> {
  if (!(await exists(join(data, 'postmaster.pid')))) { console.log('Local PostgreSQL already stopped'); return; }
  await command(binary('pg_ctl'), ['-D', data, '-m', 'fast', '-w', '-t', '30', 'stop'], { quiet: true, timeoutMs: 40_000 });
  console.log('Local PostgreSQL stopped; synthetic data retained.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'start') await start();
    else if (process.argv[2] === 'stop') await stop();
    else throw new Error('Expected start or stop');
  } catch {
    console.error('Local PostgreSQL command failed. Check PG_BIN, port 55432 and local PostgreSQL log; never share credentials.');
    process.exitCode = 1;
  }
}
