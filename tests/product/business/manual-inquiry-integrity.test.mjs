import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { manualHarness,manualCreate,manualRead,manualInput,seedQueue } from '../helpers/manual-harness.mjs';
import { HttpBrowser } from '../helpers/identity-harness.mjs';
import { caveA,caveB } from '../../../packages/tooling/src/identity-test-database.ts';
import { seedCaseFixtures } from '../../../packages/tooling/src/case-fixtures.ts';

test('concurrent manual commands share one creation and revoked roles cannot replay it',async t=>{
  const h=await manualHarness(t),other=new HttpBrowser(h.appOrigin);await other.login('alice');const key=randomUUID(),responses=await Promise.all([manualCreate(h.browser,manualInput(),key),manualCreate(other,manualInput(),key)]);assert.equal(responses[0].status,201);assert.deepEqual(responses[0],responses[1]);
  const actor=(await h.browser.session()).body.identity.id;await h.owner.query("UPDATE members SET role='reader' WHERE cave_id=$1 AND identity_id=$2",[caveA,actor]);assert.equal((await manualCreate(other,manualInput(),key)).status,403);assert.equal((await h.pool.query('SELECT count(*)::int n FROM inquiries')).rows[0].n,1);
});
test('manual source and command relations reject cross-cave SQL and stay immutable for the owner',async t=>{
  const h=await manualHarness(t),a=await manualCreate(h.browser);await h.browser.command('/api/caves/switch',{caveId:caveB});const b=await manualCreate(h.browser),row=(await h.pool.query('SELECT * FROM inquiry_intakes WHERE inquiry_id=$1',[a.body.id])).rows[0];
  await assert.rejects(h.pool.query('INSERT INTO inquiry_commands(cave_id,actor_id,request_key,inquiry_id,payload_hash) VALUES($1,$2,$3,$4,$5)',[caveB,row.actor_id,randomUUID(),a.body.id,'0'.repeat(64)]),{code:'23503'});
  await assert.rejects(h.pool.query('INSERT INTO inquiry_intakes(cave_id,inquiry_id,message_id,actor_id,actor_name,origin) VALUES($1,$2,$3,$4,$5,$6)',[caveB,randomUUID(),row.message_id,row.actor_id,row.actor_name,'phone']),{code:'23503'});
  for(const pool of [h.pool,h.owner]){await assert.rejects(pool.query("UPDATE inquiry_intakes SET origin='other' WHERE inquiry_id=$1",[a.body.id]));await assert.rejects(pool.query('DELETE FROM inquiry_commands WHERE inquiry_id=$1',[a.body.id]));}
  assert.equal((await manualRead(h.browser,'/'+b.body.id+'/dossier')).body.origin,'phone');
});
test('a failed manual journal insertion rolls back dossier message and provenance then permits a clean retry',async t=>{
  const h=await manualHarness(t),key=randomUUID();await h.owner.query("CREATE FUNCTION reject_manual_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_manual_fixture BEFORE INSERT ON inquiry_commands FOR EACH ROW EXECUTE FUNCTION reject_manual_fixture()");
  assert.equal((await manualCreate(h.browser,manualInput(),key)).status,503);for(const table of ['inquiries','messages','inquiry_intakes','inquiry_commands'])assert.equal((await h.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0);
  await h.owner.query('DROP TRIGGER reject_manual_fixture ON inquiry_commands');assert.equal((await manualCreate(h.browser,manualInput(),key)).status,201);
});
test('queue intervention order uses actual recovery booking agreement and waiting records, then desired date and age',async t=>{
  const h=await manualHarness(t),ids=await seedQueue(h.browser,20);const [a]=await seedCaseFixtures(h);await h.owner.query("UPDATE actions SET state='uncertain' WHERE cave_id=$1 AND id=$2",[caveA,a.actionId]);
  let r=(await manualRead(h.browser,'?filter=all')).body;assert.equal(r.total,21);assert.equal(r.items[0].id,a.inquiryId);assert.equal(r.items[0].bucket,'recovery');assert.equal(r.items[1].id,ids[0]);assert.equal(r.items[2].id,ids[3]);
  await h.owner.query("UPDATE actions SET state='succeeded' WHERE id=$1",[a.actionId]);r=(await manualRead(h.browser,'?filter=all')).body;assert.equal(r.items[0].bucket,'reserve');
  await h.owner.query("UPDATE bookings SET state='confirmed' WHERE id=$1",[a.bookingId]);assert.equal((await manualRead(h.browser,'?filter=booked')).body.items[0].id,a.inquiryId);
  await h.owner.query("UPDATE inquiries SET state='waiting_customer' WHERE id=$1",[ids[1]]);assert.equal((await manualRead(h.browser,'?filter=waiting')).body.items[0].id,ids[1]);await h.owner.query("UPDATE inquiries SET state='archived' WHERE id=$1",[a.inquiryId]);assert.equal((await manualRead(h.browser,'?filter=archived')).body.items[0].id,a.inquiryId);
});
