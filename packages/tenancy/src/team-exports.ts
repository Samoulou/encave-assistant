import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { renderTeamCsv, type ExportMember } from '@encave/domain';
import { AccessError, inCave, lockCave, membership, transaction, validId, type CommandContext } from './access.ts';

type ExportRow = { id: string; cave_id: string; requested_by: string; membership_version: number; state: 'pending' | 'ready' | 'refused' | 'failed'; content: string | null; error_code: string | null; expires_at: Date; created_at: Date };
const publicExport = (row: ExportRow) => ({ id: row.id, caveId: row.cave_id, state: row.expires_at.getTime() <= Date.now() ? 'expired' : row.state, error: row.error_code, createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString() });

export class TeamExports {
  constructor(public pool: Pool, public retentionSeconds = 3600) {
    if (!Number.isInteger(retentionSeconds) || retentionSeconds < 60 || retentionSeconds > 86400) throw new Error('Invalid export retention');
  }
  async create(context: CommandContext, requestKey: unknown) {
    if (!validId(requestKey)) throw new AccessError(400, 'invalid_idempotency_key');
    return inCave(this.pool, context, 'export', async (db, session, member) => {
      const existing = await db.query<ExportRow>('SELECT * FROM team_exports WHERE cave_id=$1 AND requested_by=$2 AND request_key=$3', [session.active_cave_id, session.identity_id, requestKey]);
      if (existing.rows[0]) return publicExport(existing.rows[0]);
      const id = randomUUID();
      const created = await db.query<ExportRow>(`INSERT INTO team_exports(cave_id,id,requested_by,membership_version,request_key,expires_at)
        VALUES($1,$2,$3,$4,$5,now()+$6*interval '1 second') RETURNING *`, [session.active_cave_id, id, session.identity_id, member.version, requestKey, this.retentionSeconds]);
      await db.query('INSERT INTO team_export_jobs(id,cave_id,export_id,requested_by,membership_version) VALUES($1,$2,$3,$4,$5)', [randomUUID(), session.active_cave_id, id, session.identity_id, member.version]);
      return publicExport(created.rows[0]!);
    });
  }
  async list(context: CommandContext) {
    return inCave(this.pool, context, 'read', async (db, session, member) => {
      if (member.role !== 'admin') throw new AccessError(403, 'role_forbidden');
      const rows = await db.query<ExportRow>('SELECT * FROM team_exports WHERE cave_id=$1 AND requested_by=$2 ORDER BY created_at DESC,id LIMIT 10', [session.active_cave_id, session.identity_id]);
      return { caveId: session.active_cave_id, exports: rows.rows.map(row => publicExport(row.membership_version === member.version ? row : { ...row, state: 'refused', error_code: 'access_changed' })) };
    });
  }
  async get(context: CommandContext, id: unknown, download = false) {
    if (!validId(id)) throw new AccessError(404, 'export_unavailable');
    return inCave(this.pool, context, 'read', async (db, session, member) => {
      if (member.role !== 'admin') throw new AccessError(403, 'role_forbidden');
      const result = await db.query<ExportRow>('SELECT * FROM team_exports WHERE cave_id=$1 AND id=$2 AND requested_by=$3', [session.active_cave_id, id, session.identity_id]);
      const row = result.rows[0];
      if (!row) throw new AccessError(404, 'export_unavailable');
      if (row.membership_version !== member.version) throw new AccessError(403, 'access_revoked');
      if (row.expires_at.getTime() <= Date.now()) throw new AccessError(410, 'export_expired');
      if (!download) return publicExport(row);
      if (row.state !== 'ready' || row.content === null) throw new AccessError(409, 'export_not_ready');
      return { content: row.content, filename: `equipe-${row.id}.csv` };
    });
  }
}

export type ExportTask = { jobId: string; caveId: string; exportId: string };
async function execute(db: PoolClient, task: ExportTask) {
  if (!validId(task.jobId) || !validId(task.caveId) || !validId(task.exportId)) throw new AccessError(403, 'task_scope_forbidden');
  const job = (await db.query('SELECT * FROM team_export_jobs WHERE id=$1 FOR UPDATE', [task.jobId])).rows[0];
  if (!job || job.cave_id !== task.caveId || job.export_id !== task.exportId) throw new AccessError(403, 'task_scope_forbidden');
  if (job.state === 'done') return false;
  await lockCave(db, job.cave_id);
  const row = (await db.query<ExportRow>(`SELECT * FROM team_exports WHERE cave_id=$1 AND id=$2 AND requested_by=$3 AND membership_version=$4 FOR UPDATE`, [job.cave_id, job.export_id, job.requested_by, job.membership_version])).rows[0];
  if (!row) throw new AccessError(403, 'task_scope_forbidden');
  const member = await membership(db, job.cave_id, job.requested_by);
  let state = 'ready', code: string | null = null, content: string | null = null;
  if (!member || member.role !== 'admin' || member.version !== job.membership_version) { state = 'refused'; code = 'access_changed'; }
  else if (row.expires_at.getTime() <= Date.now()) { state = 'refused'; code = 'export_expired'; }
  else {
    const members = await db.query<ExportMember>(`SELECT i.display_name AS name,i.email,m.role,m.revoked_at IS NOT NULL AS revoked
      FROM members m JOIN identities i ON i.id=m.identity_id WHERE m.cave_id=$1 ORDER BY i.display_name,i.id LIMIT 5001`, [job.cave_id]);
    if (members.rows.length > 5000) { state = 'failed'; code = 'export_limit'; }
    else {
      content = renderTeamCsv(member.name, members.rows);
      if (Buffer.byteLength(content) > 1048576) { state = 'failed'; code = 'export_limit'; content = null; }
    }
  }
  await db.query('UPDATE team_exports SET state=$1,error_code=$2,content=$3,finished_at=now() WHERE cave_id=$4 AND id=$5', [state, code, content, job.cave_id, job.export_id]);
  await db.query("UPDATE team_export_jobs SET state='done',completed_at=now() WHERE id=$1 AND cave_id=$2", [job.id, job.cave_id]);
  return true;
}

// A task envelope is only a locator. Every authoritative field and permission is
// reloaded from durable rows; foreign envelope values are refused, never adopted.
export async function executeExportTask(pool: Pool, task: ExportTask) { return transaction(pool, db => execute(db, task)); }

export async function runNextExport(pool: Pool): Promise<boolean> {
  return transaction(pool, async db => {
    await db.query('UPDATE team_exports SET content=NULL WHERE expires_at<=now() AND content IS NOT NULL');
    const job = (await db.query("SELECT id,cave_id,export_id FROM team_export_jobs WHERE state='pending' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];
    return job ? execute(db, { jobId: job.id, caveId: job.cave_id, exportId: job.export_id }) : false;
  });
}
