import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import pg from 'pg';
import { localDatabaseConfig } from '../../../packages/tooling/src/database.ts';
import { createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';
import { migrateDatabase } from '../../../packages/tooling/src/migrations.ts';
test('EA-13 AC-01/03: additive migration9 preserves old inquiries and explicit historical target3',async t=>{
 const h=await createIdentityTestDatabase('https://issuer.test.example');let pool;t.after(async()=>{if(pool)await pool.end();await h.cleanup();});const schema='connection_'+randomBytes(8).toString('hex');await h.owner.query(`CREATE SCHEMA ${schema}`);pool=new pg.Pool({...await localDatabaseConfig(),database:h.applicationConfig.database,options:`-c search_path=${schema}`});await migrateDatabase(pool,{targetVersion:8});const cave=randomUUID(),id=randomUUID();await pool.query('INSERT INTO caves(id,name) VALUES($1,$2)',[cave,'Cave fictive']);await pool.query("INSERT INTO inquiries(cave_id,id,local_reference,channel,contact_name,subject) VALUES($1,$2,'OLD','manual','Client fictif','Conservé')",[cave,id]);assert.deepEqual(await migrateDatabase(pool,{targetVersion:9}),[9]);assert.deepEqual(await migrateDatabase(pool,{targetVersion:9}),[]);assert.deepEqual(await migrateDatabase(pool),[]);assert.equal((await pool.query('SELECT subject FROM inquiries WHERE id=$1',[id])).rows[0].subject,'Conservé');assert.equal((await pool.query('SELECT count(*)::int n FROM provider_connections')).rows[0].n,0);
});
