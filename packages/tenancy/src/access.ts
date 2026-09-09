import { createHash, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { mayManageTeam, type Role } from '@encave/domain';

export class AccessError extends Error {
  status: number; code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
export type Session = { token_hash: string; identity_id: string; active_cave_id: string | null; csrf_token: string; email: string; display_name: string };
export type CommandContext = { token: string; csrf: string; expectedCave: string };
export type Member = { role: Role; name: string; version: number };
export type CaveAction = 'read' | 'invite' | 'revoke' | 'export';
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

export async function transaction<T>(pool: Pool, operation: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN'); await db.query("SET LOCAL statement_timeout='5000ms'");
    const result = await operation(db); await db.query('COMMIT'); return result;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}

export async function withSession<T>(pool: Pool, token: string, operation: (db: PoolClient, session: Session) => Promise<T>): Promise<T> {
  if (!validToken(token)) throw new AccessError(401, 'session_required');
  return transaction(pool, async db => {
    const result = await db.query<Session>(`SELECT s.*,i.email,i.display_name FROM app_sessions s
      JOIN identities i ON i.id=s.identity_id WHERE s.token_hash=$1 AND s.expires_at>now() FOR UPDATE OF s`, [createHash('sha256').update(token).digest('hex')]);
    if (!result.rows[0]) throw new AccessError(401, 'session_required');
    return operation(db, result.rows[0]);
  });
}

export function checkCsrf(session: Session, token: string) {
  if (!validToken(token) || !validToken(session.csrf_token) || !timingSafeEqual(Buffer.from(token), Buffer.from(session.csrf_token))) throw new AccessError(403, 'csrf_invalid');
}

export async function lockCave(db: PoolClient, cave: string) {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [cave]);
}

export async function membership(db: PoolClient, cave: string | null, identity: string): Promise<Member | undefined> {
  return (await db.query<Member>(`SELECT m.role,m.version,c.name FROM members m JOIN caves c ON c.id=m.cave_id
    WHERE m.cave_id=$1 AND m.identity_id=$2 AND m.revoked_at IS NULL`, [cave, identity])).rows[0];
}

export async function inCave<T>(pool: Pool, context: CommandContext, action: CaveAction,
  operation: (db: PoolClient, session: Session & { active_cave_id: string }, member: Member) => Promise<T>): Promise<T> {
  return withSession(pool, context.token, async (db, session) => {
    if (action !== 'read') checkCsrf(session, context.csrf);
    const cave = session.active_cave_id;
    if (!cave || cave !== context.expectedCave) throw new AccessError(409, 'cave_changed');
    await lockCave(db, cave);
    const member = await membership(db, cave, session.identity_id);
    if (!member) throw new AccessError(403, 'access_revoked');
    if (action === 'export' ? member.role !== 'admin' : !mayManageTeam(member.role, action)) throw new AccessError(403, 'role_forbidden');
    return operation(db, { ...session, active_cave_id: cave }, member);
  });
}

export async function requireApplicationRole(pool: Pool) {
  const role = (await pool.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
  if (!role || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole) throw new Error('Application database role has excessive privileges');
}
