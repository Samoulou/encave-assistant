import { createHash } from 'node:crypto';
import { assertOwnedTestDatabase, caveA, caveB, type createIdentityTestDatabase } from './identity-test-database.ts';

type Fixture = Awaited<ReturnType<typeof createIdentityTestDatabase>>;
export function fixtureId(cave: string, name: string): string {
  const hash = createHash('sha256').update('EnCave synthetic case fixture:' + cave + ':' + name).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
}

// Capability comes only from the guarded database factory and expires on cleanup.
// Application runtimes never import or call this module.
export async function seedCaseFixtures(fixture: Fixture) {
  assertOwnedTestDatabase(fixture);
  const actual = (await fixture.pool.query('SELECT current_database() AS name')).rows[0].name;
  if (actual !== fixture.applicationConfig.database || !/^encave_identity_test_[a-f0-9]{16}$/.test(actual)) throw new Error('Fixture database mismatch');
  const db = await fixture.pool.connect();
  const cases = [];
  try {
    await db.query('BEGIN');
    for (const cave of [caveA, caveB]) {
      const actor = fixture.people.find(person => person.subject === 'alice')!.id;
      const id = (name: string) => fixtureId(cave, name);
      await db.query(`INSERT INTO inquiries(cave_id,id,local_reference,channel,contact_name,contact_email,subject,created_by)
        VALUES($1,$2,'DEMO-001','manual','Camille Exemple','camille@visiteur.example',$3,$4) ON CONFLICT DO NOTHING`, [cave,id('inquiry'),cave===caveA?'Dégustation fictive A':'Dégustation fictive B',actor]);
      await db.query(`INSERT INTO messages(cave_id,inquiry_id,id,direction,channel,body,author_observed,occurred_at,created_by)
        VALUES($1,$2,$3,'inbound','manual',$4,'Camille Exemple — fictif',now(),$5) ON CONFLICT DO NOTHING`, [cave,id('inquiry'),id('message'),'Message fictif pour '+(cave===caveA?'la cave A':'la cave B'),actor]);
      await db.query(`INSERT INTO proposals(cave_id,inquiry_id,id,created_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [cave,id('inquiry'),id('proposal'),actor]);
      const snapshot = { fixture: true, description: 'Dégustation fictive, aucun catalogue approuvé connecté', partySize: 10, currency: 'CHF', totalMinor: 30000, taxPolicy: 'Fixture uniquement, aucune politique réelle établie', terms: 'Conditions synthétiques pour les tests, aucun engagement.' };
      await db.query(`INSERT INTO proposal_versions(cave_id,inquiry_id,proposal_id,id,number,state,snapshot,terms_hash,valid_until,created_by)
        VALUES($1,$2,$3,$4,1,'accepted',$5,'',now()+interval '7 days',$6) ON CONFLICT DO NOTHING`, [cave,id('inquiry'),id('proposal'),id('version'),snapshot,actor]);
      const hash = (await db.query('SELECT terms_hash FROM proposal_versions WHERE cave_id=$1 AND id=$2',[cave,id('version')])).rows[0].terms_hash;
      await db.query(`INSERT INTO acceptances(cave_id,inquiry_id,proposal_version_id,terms_hash,id,source_kind,source_message_id,proof_reference,respondent_observed,accepted_at,recorded_by)
        VALUES($1,$2,$3,$4,$5,'message',$6,'fixture-only:simulated-acceptance','Camille Exemple — fictif',now(),$7) ON CONFLICT DO NOTHING`, [cave,id('inquiry'),id('version'),hash,id('acceptance'),id('message'),actor]);
      await db.query(`INSERT INTO proposal_approvals(cave_id,inquiry_id,proposal_version_id,terms_hash,id,scope,acceptance_id,actor_id,valid_until)
        VALUES($1,$2,$3,$4,$5,'book_confirm',$6,$7,now()+interval '1 day') ON CONFLICT DO NOTHING`, [cave,id('inquiry'),id('version'),hash,id('approval'),id('acceptance'),actor]);
      await db.query(`INSERT INTO bookings(cave_id,inquiry_id,proposal_version_id,terms_hash,acceptance_id,booking_approval_id,id,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`, [cave,id('inquiry'),id('version'),hash,id('acceptance'),id('approval'),id('booking'),actor]);
      await db.query(`INSERT INTO actions(cave_id,inquiry_id,id,proposal_version_id,booking_id,kind,idempotency_key,requested_by)
        VALUES($1,$2,$3,$4,$5,'fixture_no_external_effect','fixture:DEMO-001',$6) ON CONFLICT DO NOTHING`, [cave,id('inquiry'),id('action'),id('version'),id('booking'),actor]);
      cases.push({ caveId:cave, inquiryId:id('inquiry'), messageId:id('message'), proposalId:id('proposal'), versionId:id('version'), acceptanceId:id('acceptance'), approvalId:id('approval'), bookingId:id('booking'), actionId:id('action'), termsHash:hash, actorId:actor });
    }
    await db.query('COMMIT'); return cases;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
