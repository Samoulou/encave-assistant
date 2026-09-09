import type { Pool } from 'pg';
import { caseIdentity } from '@encave/contracts';
import { AccessError, inCave, validId, type CommandContext } from '@encave/tenancy';

export class CaseStore {
  readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }
  async read(context: CommandContext, id: unknown) {
    if (!validId(id)) throw new AccessError(404, 'inquiry_unavailable');
    return inCave(this.pool, context, 'read', async (db, session) => {
      const inquiry = (await db.query('SELECT * FROM inquiries WHERE cave_id=$1 AND id=$2', [session.active_cave_id,id])).rows[0];
      if (!inquiry) throw new AccessError(404, 'inquiry_unavailable');
      const identity = caseIdentity.parse({ id: inquiry.id, caveId: inquiry.cave_id, state: inquiry.state, version: inquiry.version });
      const history: Record<string, unknown[]> = {};
      const truncated: string[] = [];
      // Fixed, source-owned table names; no caller-controlled SQL identifier.
      for (const table of ['messages','proposals','proposal_versions','acceptances','proposal_approvals','bookings','actions']) {
        const rows = (await db.query(`SELECT * FROM ${table} WHERE cave_id=$1 AND inquiry_id=$2 ORDER BY created_at,id LIMIT 201`, [session.active_cave_id,id])).rows;
        if (rows.length > 200) truncated.push(table);
        history[table] = rows.slice(0,200);
      }
      return { ...identity, localReference:inquiry.local_reference, channel:inquiry.channel, contactName:inquiry.contact_name,
        contactEmail:inquiry.contact_email, subject:inquiry.subject, createdAt:inquiry.created_at, updatedAt:inquiry.updated_at,
        history, truncated };
    });
  }
}
