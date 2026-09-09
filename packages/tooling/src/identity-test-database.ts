import pg from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { localDatabaseConfig } from './database.ts';
import { migrateDatabase, migrationFiles } from './migrations.ts';

const ownedFixtures = new WeakMap<object, { pool: pg.Pool; owner: pg.Pool }>();
export function assertOwnedTestDatabase(value: { fixtureScope: object; pool: pg.Pool; owner: pg.Pool }) {
  const owned = ownedFixtures.get(value.fixtureScope);
  if (!owned || owned.pool !== value.pool || owned.owner !== value.owner) throw new Error('Only an owned synthetic test database is permitted');
}

export const caveA = '11111111-1111-4111-8111-111111111111';
export const caveB = '22222222-2222-4222-8222-222222222222';
export const fixturePeople = [
  { subject: 'alice', email: 'alice@cave-test.example', name: 'Alice Martin', memberships: [[caveA, 'admin'], [caveB, 'admin']] },
  { subject: 'bruno', email: 'bruno@cave-test.example', name: 'Bruno Favre', memberships: [[caveA, 'operator']] },
  { subject: 'claire', email: 'claire@cave-test.example', name: 'Claire Rey', memberships: [[caveA, 'reader']] },
  { subject: 'diane', email: 'diane@cave-test.example', name: 'Diane Blanc', memberships: [] },
  { subject: 'emile', email: 'emile@cave-test.example', name: 'Émile Girard', memberships: [[caveB, 'admin']] },
] as const;

// The foundation connection is accepted only through its existing loopback guard.
// Each invocation owns a fresh database and login; nothing existing is overwritten.
export async function createIdentityTestDatabase(issuer: string) {
  const foundation = await localDatabaseConfig();
  const suffix = randomBytes(8).toString('hex');
  const database = 'encave_identity_test_' + suffix;
  const user = 'encave_identity_app_' + suffix;
  const password = randomBytes(32).toString('hex');
  if (!/^encave_identity_test_[a-f0-9]{16}$/.test(database) || !/^encave_identity_app_[a-f0-9]{16}$/.test(user)) throw new Error('Invalid isolated fixture names');
  const admin = new pg.Client({ ...foundation, database: 'postgres', connectionTimeoutMillis: 5000 });
  await admin.connect();
  let createdDatabase = false; let createdRole = false;
  const applicationConfig = { host: foundation.host, port: foundation.port, database, user, password };
  const pool = new pg.Pool({ ...applicationConfig, max: 12, connectionTimeoutMillis: 5000 });
  const owner = new pg.Pool({ ...foundation, database, max: 2, connectionTimeoutMillis: 5000 });
  const fixtureScope = Object.freeze({});
  const cleanup = async () => {
    ownedFixtures.delete(fixtureScope);
    try {
      await pool.end(); await owner.end();
      if (createdDatabase) {
        // Pool shutdown can resolve before PostgreSQL has observed the socket close.
        // Do not terminate a backend while its client is still draining messages.
        const deadline = performance.now() + 5000;
        while ((await admin.query('SELECT 1 FROM pg_stat_activity WHERE datname=$1 LIMIT 1', [database])).rowCount) {
          if (performance.now() >= deadline) throw new Error('Owned fixture connections did not close; database retained');
          await delay(25);
        }
        await admin.query(`DROP DATABASE "${database}"`);
      }
      if (createdRole) await admin.query(`DROP ROLE "${user}"`);
    } finally { await admin.end(); }
  };
  try {
    await admin.query(`CREATE ROLE "${user}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${password}'`);
    createdRole = true;
    await admin.query(`CREATE DATABASE "${database}"`); createdDatabase = true;
    await owner.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
    await migrateDatabase(owner, { targetVersion: migrationFiles.length });
    await owner.query(`GRANT CONNECT ON DATABASE "${database}" TO "${user}"`);
    await owner.query(`GRANT USAGE ON SCHEMA public TO "${user}"`);
    await owner.query(`GRANT SELECT ON caves,members,identities,app_sessions,login_attempts,invitations TO "${user}"`);
    await owner.query(`GRANT INSERT,UPDATE ON identities,members,app_sessions,invitations TO "${user}"`);
    await owner.query(`GRANT INSERT,DELETE ON login_attempts TO "${user}"`);
    await owner.query(`GRANT DELETE ON app_sessions TO "${user}"`);
    await owner.query(`GRANT INSERT ON identity_audit TO "${user}"`);
    await owner.query(`GRANT SELECT,INSERT,UPDATE ON team_exports,team_export_jobs TO "${user}"`);
    await owner.query(`GRANT SELECT,INSERT ON inquiries,messages,proposals,proposal_versions,acceptances,proposal_approvals,bookings,actions TO "${user}"`);
    await owner.query(`GRANT UPDATE ON inquiries,actions TO "${user}"`);
    await owner.query(`GRANT UPDATE(state,version,updated_at,snapshot,valid_until) ON proposal_versions TO "${user}"`);
    await owner.query(`GRANT UPDATE(state,version,updated_at) ON bookings TO "${user}"`);
    await owner.query(`GRANT SELECT,INSERT ON workflow_commands,workflow_events TO "${user}"`);
    await owner.query(`GRANT SELECT,INSERT ON catalog_offers,catalog_offer_versions,catalog_approvals,catalog_commands TO "${user}"`);
    await owner.query(`GRANT UPDATE(enabled,version,latest_number,published_version_id,updated_at) ON catalog_offers TO "${user}"`);
    await owner.query(`GRANT SELECT,INSERT ON resources,resource_versions,resource_closures,resource_plan_heads,resource_plans,resource_plan_rules,resource_commands TO "${user}"`);
    await owner.query(`GRANT UPDATE(enabled,version,latest_number,current_version_id,updated_at) ON resources TO "${user}"`);
    await owner.query(`GRANT UPDATE(version,current_plan_id) ON resource_plan_heads TO "${user}"`);
    await owner.query(`GRANT UPDATE(cancelled_by,cancelled_at) ON resource_closures TO "${user}"`);
    await owner.query(`GRANT SELECT,INSERT ON inquiry_intakes,inquiry_commands TO "${user}"`);
    await owner.query('INSERT INTO caves(id,name) VALUES($1,$2),($3,$4)', [caveA, 'Cave des Roches — test', caveB, 'Cave du Lac — test']);
    const people = [];
    for (const person of fixturePeople) {
      const id = randomUUID();
      await owner.query('INSERT INTO identities(id,issuer,subject,email,display_name) VALUES($1,$2,$3,$4,$5)', [id, issuer, person.subject, person.email, person.name]);
      for (const [cave, role] of person.memberships) await owner.query('INSERT INTO members(cave_id,identity_id,role) VALUES($1,$2,$3)', [cave, id, role]);
      people.push({ ...person, id });
    }
    ownedFixtures.set(fixtureScope, { pool, owner });
    return { pool, owner, people, applicationConfig, fixtureScope, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
