import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ciDatabaseConfig, writeCiDatabase, startCiDatabase, postgresImage } from '../src/ci-environment.ts';
import { validateEnvironments } from '../src/environments.ts';

const ci = { CI: 'true', GITHUB_ACTIONS: 'true', ENCAVE_RUNTIME_ENVIRONMENT: 'test', GITHUB_RUN_ID: '123456789', GITHUB_RUN_ATTEMPT: '1' };
const plans = await Promise.all(['development', 'preproduction', 'production'].map(async name => JSON.parse(await readFile(new URL(`../../../ops/environments/${name}.json`, import.meta.url), 'utf8'))));

test('CI preparation refuses local, production and malformed run contexts before writing', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'encave-ci-refusal-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const env of [{}, { ...ci, CI: 'false' }, { ...ci, GITHUB_ACTIONS: 'false' }, { ...ci, ENCAVE_RUNTIME_ENVIRONMENT: 'production' }, { ...ci, GITHUB_RUN_ID: '../123' }, { ...ci, GITHUB_RUN_ATTEMPT: '' }]) {
    assert.throws(() => ciDatabaseConfig(env));
    await assert.rejects(writeCiDatabase(dir, env));
  }
  await assert.rejects(access(join(dir, '.local')));
});

test('CI fixture remains on loopback and cannot overwrite existing configuration', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'encave-ci-write-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeCiDatabase(dir, { ...ci, PGHOST: 'production.invalid', DATABASE_URL: 'postgres://production.invalid/private' });
  const file = join(dir, '.local/database.json');
  const initial = await readFile(file, 'utf8');
  const c = JSON.parse(initial);
  assert.equal(c.host, '127.0.0.1');
  assert.equal(c.port, 55432);
  assert.equal(c.database, 'encave_foundation_test');
  assert.equal(c.user, 'encave_dev');
  assert.equal(c.password.length >= 32, true);
  await assert.rejects(writeCiDatabase(dir, { ...ci, GITHUB_RUN_ATTEMPT: '2' }), { code: 'EEXIST' });
  assert.equal(await readFile(file, 'utf8'), initial);
});

test('three environment plans have independent resources and remain inactive', () => {
  assert.doesNotThrow(() => validateEnvironments(plans));
  assert.throws(() => validateEnvironments(plans.slice(1)));
  for (const field of ['resource_prefix', 'database_name', 'oidc_realm', 'credential_namespace', 'github_environment']) {
    const copy = structuredClone(plans);
    copy[2][field] = copy[1][field];
    assert.throws(() => validateEnvironments(copy));
  }
  for (const patch of [{ auto_release: true }, { external_effects_enabled: true }, { provisioning_state: 'ready' }, { region: 'unknown' }, { password: 'not-a-real-secret' }]) {
    const copy = structuredClone(plans);
    Object.assign(copy[2], patch);
    assert.throws(() => validateEnvironments(copy));
  }
});

test('container preparation requires SQL verification and uses the pinned loopback service', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'encave-ci-container-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  const id = 'a'.repeat(64);
  let verified = false;
  await startCiDatabase(dir, ci, async (exe, args) => {
    calls.push([exe, args]);
    return args[0] === 'create' ? id + '\n' : id;
  }, async () => { verified = true; });
  assert.equal(verified, true);
  assert.deepEqual(calls[0], ['docker', ['pull', postgresImage]]);
  assert.deepEqual(calls[1], ['docker', ['create', '--rm', '--label', 'encave.role=ci-fixture', '--publish', '127.0.0.1:55432:5432', '--env-file', join(dir, '.local/ci-postgres.env'), postgresImage]]);
  assert.deepEqual(calls[2], ['docker', ['start', id]]);
  assert.equal(await readFile(join(dir, '.local/ci-postgres.id'), 'utf8'), id);
  await assert.rejects(access(join(dir, '.local/ci-postgres.env')));
});

test('failed container start cleans up only its own verified identifier', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'encave-ci-cleanup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  const id = 'b'.repeat(64);
  await assert.rejects(startCiDatabase(dir, ci, async (exe, args) => {
    calls.push(args);
    if (args[0] === 'start') throw new Error('Injected start failure');
    return id;
  }, async () => assert.fail('SQL must not run after failed start')), /Injected start failure/);
  assert.deepEqual(calls.at(-1), ['rm', '--force', id]);
  await assert.rejects(access(join(dir, '.local/ci-postgres.id')));
  await assert.rejects(access(join(dir, '.local/ci-postgres.env')));
});
