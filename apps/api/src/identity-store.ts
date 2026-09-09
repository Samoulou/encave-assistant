import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { isRole, mayRevoke, normalizeInvitationEmail } from '@encave/domain';
import { IdentityError, opaqueToken, tokenHash, validToken, validUuid } from './identity-security.ts';
import { transaction, withSession, membership, checkCsrf, inCave, type Session, type Member, type CommandContext } from '@encave/tenancy';

export type { CommandContext } from '@encave/tenancy';

export class IdentityStore {
  pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async transaction<T>(operation: (db: PoolClient) => Promise<T>): Promise<T> {
    return transaction(this.pool, operation);
  }

  async withSession<T>(token: string, operation: (db: PoolClient, session: Session) => Promise<T>): Promise<T> {
    return withSession(this.pool, token, operation);
  }

  async currentMember(db: PoolClient, session: Session): Promise<Member | undefined> {
    return membership(db, session.active_cave_id, session.identity_id);
  }

  async snapshot(token: string) {
    return this.withSession(token, async (db, session) => {
      const member = await this.currentMember(db, session);
      const caves = await db.query(`SELECT c.id,c.name,m.role FROM members m JOIN caves c ON c.id=m.cave_id
        WHERE m.identity_id=$1 AND m.revoked_at IS NULL ORDER BY c.name,c.id`, [session.identity_id]);
      return {
        identity: { id: session.identity_id, email: session.email, name: session.display_name },
        csrf: session.csrf_token, caves: caves.rows,
        activeCave: member ? { id: session.active_cave_id, name: member.name, role: member.role } : null,
        accessRevoked: session.active_cave_id !== null && !member,
      };
    });
  }

  checkCsrf(session: Session, value: string) {
    checkCsrf(session, value);
  }

  async inCave<T>(context: CommandContext, action: 'read' | 'invite' | 'revoke', operation: (db: PoolClient, session: Session, member: Member) => Promise<T>): Promise<T> {
    return inCave(this.pool, context, action, operation);
  }

  async switchCave(context: CommandContext, caveId: unknown) {
    if (!validUuid(caveId)) throw new IdentityError(400, 'invalid_cave');
    return this.withSession(context.token, async (db, session) => {
      this.checkCsrf(session, context.csrf);
      const found = await db.query('SELECT cave_id FROM members WHERE cave_id=$1 AND identity_id=$2 AND revoked_at IS NULL FOR SHARE', [caveId, session.identity_id]);
      if (!found.rowCount) throw new IdentityError(403, 'cave_forbidden');
      await db.query('UPDATE app_sessions SET active_cave_id=$1 WHERE token_hash=$2', [caveId, session.token_hash]);
    });
  }

  async team(context: CommandContext) {
    return this.inCave(context, 'read', async (db, session, member) => {
      const members = await db.query(`SELECT i.id,i.display_name AS name,i.email,m.role,m.revoked_at AS "revokedAt",m.version
        FROM members m JOIN identities i ON i.id=m.identity_id WHERE m.cave_id=$1 ORDER BY i.display_name,i.id`, [session.active_cave_id]);
      const invitations = member.role === 'admin' ? await db.query(`SELECT id,email,role,expires_at AS "expiresAt",accepted_at AS "acceptedAt",revoked_at AS "revokedAt"
        FROM invitations WHERE cave_id=$1 ORDER BY created_at DESC LIMIT 100`, [session.active_cave_id]) : { rows: [] };
      return { caveId: session.active_cave_id, members: members.rows, invitations: invitations.rows };
    });
  }

  async audit(db: PoolClient, cave: string, actor: string, action: string, subject: string) {
    await db.query('INSERT INTO identity_audit(id,cave_id,actor_id,action,subject_id) VALUES($1,$2,$3,$4,$5)', [randomUUID(), cave, actor, action, subject]);
  }

  async invite(context: CommandContext, emailValue: unknown, role: unknown) {
    let email: string;
    try { email = normalizeInvitationEmail(emailValue); } catch { throw new IdentityError(400, 'invalid_email'); }
    if (!isRole(role)) throw new IdentityError(400, 'invalid_role');
    return this.inCave(context, 'invite', async (db, session) => {
      const existing = await db.query(`SELECT 1 FROM members m JOIN identities i ON i.id=m.identity_id
        WHERE m.cave_id=$1 AND i.email=$2 AND m.revoked_at IS NULL`, [session.active_cave_id, email]);
      if (existing.rowCount) throw new IdentityError(409, 'already_member');
      await db.query('UPDATE invitations SET revoked_at=now() WHERE cave_id=$1 AND email=$2 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at<=now()', [session.active_cave_id, email]);
      const pending = await db.query('SELECT 1 FROM invitations WHERE cave_id=$1 AND email=$2 AND accepted_at IS NULL AND revoked_at IS NULL', [session.active_cave_id, email]);
      if (pending.rowCount) throw new IdentityError(409, 'invitation_pending');
      const id = randomUUID(); const token = opaqueToken();
      await db.query("INSERT INTO invitations(id,cave_id,invited_by,email,role,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '48 hours')", [id, session.active_cave_id, session.identity_id, email, role, tokenHash(token)]);
      await this.audit(db, session.active_cave_id!, session.identity_id, 'invite', id);
      return { id, token };
    });
  }

  async acceptInvitation(context: CommandContext, invitationToken: unknown) {
    if (!validToken(invitationToken)) throw new IdentityError(400, 'invitation_unavailable');
    return this.withSession(context.token, async (db, session) => {
      this.checkCsrf(session, context.csrf);
      // First identify its cave, then lock cave before invitation to match revocation order.
      const located = await db.query('SELECT cave_id FROM invitations WHERE token_hash=$1', [tokenHash(invitationToken)]);
      if (!located.rows[0]) throw new IdentityError(400, 'invitation_unavailable');
      const cave = located.rows[0].cave_id as string;
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [cave]);
      const result = await db.query(`SELECT * FROM invitations WHERE token_hash=$1 AND email=$2
        AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE`, [tokenHash(invitationToken), session.email]);
      const invitation = result.rows[0];
      if (!invitation) throw new IdentityError(400, 'invitation_unavailable');
      const active = await db.query('SELECT 1 FROM members WHERE cave_id=$1 AND identity_id=$2 AND revoked_at IS NULL', [cave, session.identity_id]);
      if (active.rowCount) throw new IdentityError(409, 'already_member');
      await db.query(`INSERT INTO members(cave_id,identity_id,role) VALUES($1,$2,$3)
        ON CONFLICT(cave_id,identity_id) DO UPDATE SET role=EXCLUDED.role,revoked_at=NULL,version=members.version+1`, [cave, session.identity_id, invitation.role]);
      await db.query('UPDATE invitations SET accepted_at=now() WHERE id=$1', [invitation.id]);
      await db.query('UPDATE app_sessions SET active_cave_id=$1 WHERE token_hash=$2', [cave, session.token_hash]);
      await this.audit(db, cave, session.identity_id, 'accept_invitation', invitation.id);
    });
  }

  async invitationPreview(context: CommandContext, invitationToken: unknown) {
    if (!validToken(invitationToken)) throw new IdentityError(400, 'invitation_unavailable');
    return this.withSession(context.token, async (db, session) => {
      this.checkCsrf(session, context.csrf);
      const result = await db.query(`SELECT c.name,i.role,i.email FROM invitations i JOIN caves c ON c.id=i.cave_id
        WHERE i.token_hash=$1 AND i.email=$2 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now()`, [tokenHash(invitationToken), session.email]);
      if (!result.rows[0]) throw new IdentityError(400, 'invitation_unavailable');
      return result.rows[0];
    });
  }

  async revokeMember(context: CommandContext, identityId: unknown, expectedVersion: unknown) {
    if (!validUuid(identityId) || !Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) throw new IdentityError(400, 'invalid_member');
    return this.inCave(context, 'revoke', async (db, session) => {
      const result = await db.query('SELECT role,version FROM members WHERE cave_id=$1 AND identity_id=$2 AND revoked_at IS NULL FOR UPDATE', [session.active_cave_id, identityId]);
      const target = result.rows[0];
      if (!target) throw new IdentityError(404, 'member_unavailable');
      if (target.version !== expectedVersion) throw new IdentityError(409, 'member_changed');
      const count = await db.query("SELECT count(*)::integer AS total FROM members WHERE cave_id=$1 AND role='admin' AND revoked_at IS NULL", [session.active_cave_id]);
      if (!mayRevoke(target.role, count.rows[0].total)) throw new IdentityError(409, 'last_administrator');
      await db.query('UPDATE members SET revoked_at=now(),version=version+1 WHERE cave_id=$1 AND identity_id=$2', [session.active_cave_id, identityId]);
      await db.query('UPDATE invitations SET revoked_at=now() WHERE cave_id=$1 AND invited_by=$2 AND accepted_at IS NULL AND revoked_at IS NULL', [session.active_cave_id, identityId]);
      await this.audit(db, session.active_cave_id!, session.identity_id, 'revoke_member', identityId);
    });
  }

  async revokeInvitation(context: CommandContext, id: unknown) {
    if (!validUuid(id)) throw new IdentityError(400, 'invitation_unavailable');
    return this.inCave(context, 'revoke', async (db, session) => {
      const result = await db.query('UPDATE invitations SET revoked_at=now() WHERE id=$1 AND cave_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id', [id, session.active_cave_id]);
      if (!result.rowCount) throw new IdentityError(404, 'invitation_unavailable');
      await this.audit(db, session.active_cave_id!, session.identity_id, 'revoke_invitation', id);
    });
  }

  async createSession(identity: { issuer: string; subject: string; email: string; name: string; expiresAt: number }) {
    return this.transaction(async db => {
      const result = await db.query(`INSERT INTO identities(id,issuer,subject,email,display_name) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(issuer,subject) DO UPDATE SET email=EXCLUDED.email,display_name=EXCLUDED.display_name RETURNING id`, [randomUUID(), identity.issuer, identity.subject, identity.email, identity.name]);
      const id = result.rows[0].id as string;
      const cave = await db.query('SELECT cave_id FROM members WHERE identity_id=$1 AND revoked_at IS NULL ORDER BY cave_id LIMIT 1', [id]);
      const token = opaqueToken();
      await db.query('INSERT INTO app_sessions(token_hash,identity_id,active_cave_id,csrf_token,expires_at) VALUES($1,$2,$3,$4,$5)', [tokenHash(token), id, cave.rows[0]?.cave_id ?? null, opaqueToken(), new Date(Math.min(identity.expiresAt, Date.now() + 8 * 3_600_000))]);
      return token;
    });
  }

  async logout(context: CommandContext) {
    return this.withSession(context.token, async (db, session) => {
      this.checkCsrf(session, context.csrf);
      await db.query('DELETE FROM app_sessions WHERE token_hash=$1', [session.token_hash]);
    });
  }
}
