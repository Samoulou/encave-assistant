import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';
import { seedCaseFixtures } from '../../../packages/tooling/src/case-fixtures.ts';

async function fixture(t) {
  const h = await createIdentityTestDatabase('https://issuer.test.example'); t.after(() => h.cleanup());
  return { ...h, cases:await seedCaseFixtures(h) };
}
async function clone(pool, table, source, overrides) {
  const record = { ...source, ...overrides }, names = Object.keys(record);
  return pool.query(`INSERT INTO ${table}(${names.join(',')}) VALUES(${names.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`, names.map(name=>record[name]));
}
const row = async (h, table, cave) => (await h.pool.query(`SELECT * FROM ${table} WHERE cave_id=$1 ORDER BY created_at,id LIMIT 1`,[cave])).rows[0];

test('actual application login rejects every cross-cave case reference without partial insertion', async t => {
  const h = await fixture(t); const [a,b] = h.cases;
  const role = (await h.pool.query('SELECT current_user AS name,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
  assert.equal(role.name,h.applicationConfig.user); assert.equal(role.rolsuper,false); assert.equal(role.rolbypassrls,false);
  for (const table of ['messages','proposals','proposal_versions','acceptances','proposal_approvals','bookings','actions']) {
    const source = await row(h,table,a.caveId);
    const before = (await h.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count;
    const overrides = { cave_id:b.caveId,id:randomUUID(),...(table==='actions'?{idempotency_key:'foreign:'+randomUUID()}:{}) };
    await assert.rejects(clone(h.pool,table,source,overrides),{code:'23503'},table);
    assert.equal((await h.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count,before,table);
  }
  const inquiry = await row(h,'inquiries',a.caveId);
  const bruno = h.people.find(person=>person.subject==='bruno').id;
  await assert.rejects(clone(h.pool,'inquiries',inquiry,{cave_id:b.caveId,id:randomUUID(),local_reference:'foreign-actor',created_by:bruno}),{code:'23503'});
});

test('proof messages, exact terms and booking actions cannot be mixed within the same cave', async t => {
  const h = await fixture(t); const [a] = h.cases;
  const inquiry = (await clone(h.pool,'inquiries',await row(h,'inquiries',a.caveId),{id:randomUUID(),local_reference:'DEMO-002'})).rows[0];
  const message = (await clone(h.pool,'messages',await row(h,'messages',a.caveId),{id:randomUUID(),inquiry_id:inquiry.id})).rows[0];
  const acceptance = await row(h,'acceptances',a.caveId);
  await assert.rejects(clone(h.pool,'acceptances',acceptance,{id:randomUUID(),source_message_id:message.id}),{code:'23503'});
  const version = (await clone(h.pool,'proposal_versions',await row(h,'proposal_versions',a.caveId),{id:randomUUID(),number:2,snapshot:{fixture:true,partySize:20},terms_hash:'0'.repeat(64)})).rows[0];
  assert.notEqual(version.terms_hash,'0'.repeat(64)); assert.notEqual(version.terms_hash,a.termsHash);
  await assert.rejects(clone(h.pool,'acceptances',acceptance,{id:randomUUID(),proposal_version_id:version.id}),{code:'23503'});
  await assert.rejects(clone(h.pool,'bookings',await row(h,'bookings',a.caveId),{id:randomUUID(),proposal_version_id:version.id,terms_hash:version.terms_hash}),{code:'23503'});
  await assert.rejects(clone(h.pool,'actions',await row(h,'actions',a.caveId),{id:randomUUID(),idempotency_key:'wrong-version',proposal_version_id:version.id}),{code:'23503'});
  assert.equal((await clone(h.pool,'acceptances',acceptance,{id:randomUUID(),proof_reference:'fixture-only:second-proof'})).rowCount,1);
});

test('sealed terms stay immutable even after a state rollback and recorded proofs are append-only for the app', async t => {
  const h = await fixture(t); const [a] = h.cases;
  await assert.rejects(h.pool.query('UPDATE proposal_versions SET snapshot=$1 WHERE cave_id=$2 AND id=$3',[{fixture:true,partySize:99},a.caveId,a.versionId]),{code:'23514'});
  await assert.rejects(h.pool.query("UPDATE proposal_versions SET valid_until=valid_until+interval '1 day' WHERE cave_id=$1 AND id=$2",[a.caveId,a.versionId]),{code:'23514'});
  await h.pool.query("UPDATE proposal_versions SET state='draft' WHERE cave_id=$1 AND id=$2",[a.caveId,a.versionId]);
  await assert.rejects(h.pool.query('UPDATE proposal_versions SET snapshot=$1 WHERE cave_id=$2 AND id=$3',[{fixture:true,partySize:99},a.caveId,a.versionId]),{code:'23514'});
  assert.equal((await h.pool.query('SELECT terms_hash FROM proposal_versions WHERE cave_id=$1 AND id=$2',[a.caveId,a.versionId])).rows[0].terms_hash,a.termsHash);
  for (const table of ['messages','acceptances','proposal_approvals']) await assert.rejects(h.pool.query(`DELETE FROM ${table} WHERE cave_id=$1`,[a.caveId]),{code:'42501'});
  await assert.rejects(h.pool.query('UPDATE acceptances SET respondent_observed=$1 WHERE cave_id=$2',['changed',a.caveId]),{code:'42501'});
  const draft = (await clone(h.pool,'proposal_versions',await row(h,'proposal_versions',a.caveId),{id:randomUUID(),number:2,sealed_at:null,state:'draft'})).rows[0];
  await assert.rejects(clone(h.pool,'acceptances',await row(h,'acceptances',a.caveId),{id:randomUUID(),proposal_version_id:draft.id}),{code:'23514'});
});

test('database constraints reject invalid states, empty terms, mismatched proof kinds and duplicate actions', async t => {
  const h = await fixture(t); const [a] = h.cases;
  for (const table of ['inquiries','proposal_versions','bookings','actions']) await assert.rejects(h.pool.query(`UPDATE ${table} SET state='invented' WHERE cave_id=$1`,[a.caveId]),{code:'23514'});
  await assert.rejects(clone(h.pool,'proposal_versions',await row(h,'proposal_versions',a.caveId),{id:randomUUID(),number:2,snapshot:{}}),{code:'23514'});
  await assert.rejects(clone(h.pool,'acceptances',await row(h,'acceptances',a.caveId),{id:randomUUID(),source_kind:'link'}),{code:'23514'});
  await assert.rejects(clone(h.pool,'actions',await row(h,'actions',a.caveId),{id:randomUUID()}),{code:'23505'});
  await assert.rejects(h.pool.query('ALTER TABLE proposal_versions DISABLE TRIGGER ALL'),{code:'42501'});
});
