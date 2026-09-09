import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';
import { localDatabaseConfig } from '../../../packages/tooling/src/database.ts';
import { migrateDatabase } from '../../../packages/tooling/src/migrations.ts';
import { seedCaseFixtures } from '../../../packages/tooling/src/case-fixtures.ts';
import { identityHarness, HttpBrowser } from '../helpers/identity-harness.mjs';

async function schemaPool(fixture) {
  const schema = 'migration_test_' + randomBytes(8).toString('hex');
  await fixture.owner.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ ...await localDatabaseConfig(), database:fixture.applicationConfig.database, options:`-c search_path=${schema}` });
  return pool;
}
async function oldMigrations(pool) {
  for (const name of ['001_identity.sql','002_team_exports.sql']) await pool.query(await readFile(new URL('../../../migrations/'+name, import.meta.url),'utf8'));
}

test('fresh migrations are serialized and replay leaves empty business tables without fixtures', async t => {
  const fixture = await createIdentityTestDatabase('https://issuer.test.example');
  const pools = []; t.after(async () => { for (const pool of pools) await pool.end(); await fixture.cleanup(); });
  const schema = 'fresh_' + randomBytes(8).toString('hex'); await fixture.owner.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ ...await localDatabaseConfig(), database:fixture.applicationConfig.database, options:`-c search_path=${schema}` }); pools.push(pool);
  const results = await Promise.all([migrateDatabase(pool),migrateDatabase(pool)]);
  assert.deepEqual(results.map(row => row.length).sort(), [0,3]);
  assert.deepEqual(await migrateDatabase(pool), []);
  for (const table of ['inquiries','messages','proposals','proposal_versions','acceptances','proposal_approvals','bookings','actions']) assert.equal((await pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0);
});

test('upgrade preserves existing rows and failed migration rolls back every new table and version', async t => {
  const fixture = await createIdentityTestDatabase('https://issuer.test.example');
  const pools = []; t.after(async () => { for (const pool of pools) await pool.end(); await fixture.cleanup(); });
  const upgrade = await schemaPool(fixture); pools.push(upgrade); await oldMigrations(upgrade);
  await upgrade.query("INSERT INTO caves(id,name) VALUES('11111111-1111-4111-8111-111111111111','Existing synthetic cave')");
  assert.deepEqual(await migrateDatabase(upgrade), [3]);
  assert.equal((await upgrade.query('SELECT name FROM caves')).rows[0].name, 'Existing synthetic cave');
  const broken = await schemaPool(fixture); pools.push(broken); await oldMigrations(broken);
  await broken.query('CREATE TABLE actions(sentinel integer); INSERT INTO actions VALUES(42)');
  await assert.rejects(migrateDatabase(broken), { code:'42P07' });
  assert.deepEqual((await broken.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(row => row.version), [1,2]);
  assert.equal((await broken.query("SELECT to_regclass('inquiries') AS relation")).rows[0].relation, null);
  assert.equal((await broken.query('SELECT sentinel FROM actions')).rows[0].sentinel, 42);
});

test('synthetic case fixtures are guarded, replayable and observable through authenticated scoped API', async t => {
  const h = await identityHarness(); t.after(() => h.stop());
  assert.equal((await h.pool.query('SELECT count(*)::int AS count FROM inquiries')).rows[0].count, 0);
  await assert.rejects(seedCaseFixtures({ ...h, fixtureScope:{} }), /owned synthetic/);
  const cases = await seedCaseFixtures(h); assert.deepEqual(await seedCaseFixtures(h), cases);
  const alice = new HttpBrowser(h.appOrigin); await alice.login('alice');
  const [a,b] = cases;
  let response = await alice.request('/api/inquiries/'+a.inquiryId,{headers:{'x-encave-cave':a.caveId}});
  assert.equal(response.status,200); const record = await response.json();
  assert.equal(record.caveId,a.caveId); assert.equal(record.history.actions[0].state,'planned');
  assert.equal(record.history.proposal_versions[0].terms_hash,a.termsHash); assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await alice.request('/api/inquiries/'+b.inquiryId,{headers:{'x-encave-cave':a.caveId}})).status,404);
  assert.equal((await alice.command('/api/caves/switch',{caveId:b.caveId})).status,200);
  response = await alice.request('/api/inquiries/'+b.inquiryId,{headers:{'x-encave-cave':b.caveId}});
  assert.equal((await response.json()).subject,'Dégustation fictive B');
  assert.equal((await alice.request('/api/inquiries/'+a.inquiryId,{headers:{'x-encave-cave':b.caveId}})).status,404);
});

test('a real SQL connection lost at unlock is released and the migration pool can close', async t => {
  const fixture = await createIdentityTestDatabase('https://issuer.test.example');
  const pool = new pg.Pool({ ...await localDatabaseConfig(), database:fixture.applicationConfig.database,max:1 });
  t.after(async()=>{await pool.end();await fixture.cleanup();});
  const connect = pool.connect.bind(pool);
  let interrupted = false;
  pool.connect = async()=>{
    const client = await connect(),query = client.query.bind(client);
    client.on('error',()=>{}); // Expected connection termination in this owned fixture.
    client.query=(sql,...params)=>{
      if(typeof sql==='string'&&sql.includes('pg_advisory_unlock')) {
        interrupted=true;
        return query('SELECT pg_terminate_backend(pg_backend_pid())');
      }
      return query(sql,...params);
    };
    return client;
  };
  await assert.rejects(migrateDatabase(pool),{code:'57P01'});
  assert.equal(interrupted,true); assert.equal(pool.totalCount,0); assert.equal(pool.waitingCount,0);
});
