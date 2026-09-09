import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { catalogBlockers } from '@encave/domain';
import { catalogDefinitionSchema, catalogCreateSchema, catalogReviseSchema, catalogPublishSchema, catalogEnableSchema, catalogSelectSchema, type CatalogDefinition } from '@encave/contracts';
import { AccessError, inCave, checkCsrf, validId, type CommandContext } from '@encave/tenancy';

type Row = Record<string, unknown>;
const definition = (row: Row): CatalogDefinition => catalogDefinitionSchema.parse({
  schemaVersion: row['schema_version'], title: row['title'], category: row['category'],
  minimumParticipants: row['minimum_participants'], maximumParticipants: row['maximum_participants'],
  durationMode: row['duration_mode'], durationMinutes: row['duration_minutes'],
  amountMinor: row['amount_minor'], currency: row['currency'], priceUnit: row['price_unit'],
  taxMode: row['tax_mode'], taxRateBasisPoints: row['tax_rate_basis_points'], taxLabel: row['tax_label'], conditions: row['conditions'],
  source: row['source_reference'] === null ? null : { label: row['source_label'], reference: row['source_reference'],
    verifiedAt: (row['source_verified_at'] as Date).toISOString(), validUntil: (row['source_valid_until'] as Date).toISOString() },
  officialUrl: row['official_url'],
});
const offerResult = (row: Row) => ({ id: row['id'], caveId: row['cave_id'], enabled: row['enabled'], version: row['version'], latestNumber: row['latest_number'], publishedVersionId: row['published_version_id'] });
const unavailable = () => new AccessError(404, 'offer_unavailable');
function requireId(id: unknown): asserts id is string { if (!validId(id)) throw unavailable(); }

async function insertVersion(db: PoolClient, cave: string, offer: string, number: number, actor: string, data: CatalogDefinition) {
  const id = randomUUID();
  const values = [cave, offer, id, number, data.schemaVersion, data.title, data.category,
    data.minimumParticipants, data.maximumParticipants, data.durationMode, data.durationMinutes,
    data.amountMinor, data.currency, data.priceUnit, data.taxMode, data.taxRateBasisPoints, data.taxLabel, data.conditions,
    data.source?.label ?? null, data.source?.reference ?? null, data.source?.verifiedAt ?? null, data.source?.validUntil ?? null, data.officialUrl, actor];
  await db.query(`INSERT INTO catalog_offer_versions(cave_id,offer_id,id,number,schema_version,title,category,minimum_participants,maximum_participants,
    duration_mode,duration_minutes,amount_minor,currency,price_unit,tax_mode,tax_rate_basis_points,tax_label,conditions,
    source_label,source_reference,source_verified_at,source_valid_until,official_url,created_by) VALUES(${values.map((_,i) => '$' + (i+1)).join(',')})`, values);
  return id;
}

export class CatalogStore {
  readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  private async mutation(context: CommandContext, operation: 'create'|'revise'|'publish'|'enable', id: string|null, input: unknown, requestKey: unknown) {
    if (!validId(requestKey)) throw new AccessError(400, 'invalid_idempotency_key');
    if (id !== null) requireId(id);
    const schema = { create: catalogCreateSchema, revise: catalogReviseSchema, publish: catalogPublishSchema, enable: catalogEnableSchema }[operation];
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new AccessError(400, 'invalid_catalog_definition');
    const value = parsed.data;
    const newDefinition = 'definition' in value ? catalogDefinitionSchema.parse(value.definition) : null;
    const hash = createHash('sha256').update(JSON.stringify({operation,id,value})).digest('hex');
    return inCave(this.pool, context, 'read', async (db, session, member) => {
      checkCsrf(session, context.csrf);
      if (member.role !== 'admin') throw new AccessError(403, 'role_forbidden');
      const cave = session.active_cave_id, actor = session.identity_id;
      const previous = (await db.query('SELECT payload_hash,result FROM catalog_commands WHERE cave_id=$1 AND actor_id=$2 AND request_key=$3', [cave,actor,requestKey])).rows[0];
      if (previous) {
        if (previous.payload_hash !== hash) throw new AccessError(409, 'idempotency_conflict');
        return previous.result;
      }
      let offer;
      let versionId: string|null = null;
      if (operation === 'create' && newDefinition) {
        const count = (await db.query('SELECT count(*)::int AS n FROM catalog_offers WHERE cave_id=$1', [cave])).rows[0].n;
        if (count >= 500) throw new AccessError(409, 'catalog_limit');
        id = randomUUID();
        offer = (await db.query('INSERT INTO catalog_offers(cave_id,id,created_by) VALUES($1,$2,$3) RETURNING *', [cave,id,actor])).rows[0];
        versionId = await insertVersion(db,cave,id,1,actor,newDefinition);
      } else {
        offer = (await db.query('SELECT * FROM catalog_offers WHERE cave_id=$1 AND id=$2 FOR UPDATE', [cave,id])).rows[0];
        if (!offer) throw unavailable();
        if (!('expectedVersion' in value) || value.expectedVersion !== offer.version) throw new AccessError(409, 'version_conflict');
        if (offer.version === 2147483647) throw new AccessError(409, 'version_exhausted');
        if (operation === 'revise' && newDefinition) {
          if (offer.latest_number >= 10000) throw new AccessError(409, 'catalog_version_limit');
          versionId = await insertVersion(db,cave,offer.id,offer.latest_number+1,actor,newDefinition);
          await db.query('UPDATE catalog_offers SET latest_number=latest_number+1 WHERE cave_id=$1 AND id=$2', [cave,id]);
        } else if (operation === 'publish' && 'versionId' in value) {
          const version = (await db.query('SELECT id,number FROM catalog_offer_versions WHERE cave_id=$1 AND offer_id=$2 AND id=$3', [cave,id,value.versionId])).rows[0];
          if (!version) throw unavailable();
          if (version.number !== offer.latest_number || offer.published_version_id === version.id) throw new AccessError(409, 'offer_version_changed');
          await db.query('INSERT INTO catalog_approvals(cave_id,offer_id,version_id,approved_by) VALUES($1,$2,$3,$4)', [cave,id,version.id,actor]);
          await db.query('UPDATE catalog_offers SET published_version_id=$1 WHERE cave_id=$2 AND id=$3', [version.id,cave,id]);
          versionId = version.id;
        } else if (operation === 'enable' && 'enabled' in value) {
          if (offer.enabled === value.enabled) throw new AccessError(409, 'state_unchanged');
          await db.query('UPDATE catalog_offers SET enabled=$1 WHERE cave_id=$2 AND id=$3', [value.enabled,cave,id]);
        } else throw new AccessError(400, 'invalid_request');
        offer = (await db.query('UPDATE catalog_offers SET version=version+1,updated_at=now() WHERE cave_id=$1 AND id=$2 RETURNING *', [cave,id])).rows[0];
      }
      const result = {...offerResult(offer),versionId};
      await db.query('INSERT INTO catalog_commands(cave_id,actor_id,request_key,offer_id,operation,payload_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7)', [cave,actor,requestKey,id,operation,hash,result]);
      return result;
    });
  }

  create(context: CommandContext, input: unknown, requestKey: unknown) { return this.mutation(context,'create',null,input,requestKey); }
  revise(context: CommandContext, id: string, input: unknown, requestKey: unknown) { return this.mutation(context,'revise',id,input,requestKey); }
  publish(context: CommandContext, id: string, input: unknown, requestKey: unknown) { return this.mutation(context,'publish',id,input,requestKey); }
  enable(context: CommandContext, id: string, input: unknown, requestKey: unknown) { return this.mutation(context,'enable',id,input,requestKey); }

  async list(context: CommandContext, eligibleOnly = false) {
    return inCave(this.pool,context,'read',async (db,session) => {
      const offers = (await db.query(`SELECT o.*,row_to_json(v) AS published,clock_timestamp() AS checked_at FROM catalog_offers o
        LEFT JOIN catalog_offer_versions v ON v.cave_id=o.cave_id AND v.id=o.published_version_id
        WHERE o.cave_id=$1 ORDER BY o.created_at,o.id LIMIT 501`, [session.active_cave_id])).rows;
      if (offers.length > 500) throw new AccessError(503,'catalog_limit_exceeded');
      const items = offers.map(offer => {
        // JSON timestamps are strings; the row mapper consumes Date values.
        const v = offer.published;
        if (v?.source_reference !== null && v) { v.source_verified_at = new Date(v.source_verified_at); v.source_valid_until = new Date(v.source_valid_until); }
        const data = v ? definition(v) : null;
        const blockers = catalogBlockers(data,offer.enabled,offer.checked_at.valueOf());
        return {...offerResult(offer),definition:data,blockers,eligible:blockers.length === 0};
      });
      return { items: eligibleOnly ? items.filter(item => item.eligible) : items };
    });
  }

  async read(context: CommandContext, id: string, beforeNumber = 10001) {
    requireId(id);
    if (!Number.isInteger(beforeNumber) || beforeNumber < 1 || beforeNumber > 10001) throw new AccessError(400,'invalid_cursor');
    return inCave(this.pool,context,'read',async (db,session) => {
      const cave = session.active_cave_id;
      const offer = (await db.query('SELECT * FROM catalog_offers WHERE cave_id=$1 AND id=$2', [cave,id])).rows[0];
      if (!offer) throw unavailable();
      const rows = (await db.query(`SELECT v.*,a.approved_by,a.approved_at FROM catalog_offer_versions v
        LEFT JOIN catalog_approvals a ON a.cave_id=v.cave_id AND a.offer_id=v.offer_id AND a.version_id=v.id
        WHERE v.cave_id=$1 AND v.offer_id=$2 AND v.number<$3 ORDER BY v.number DESC LIMIT 51`, [cave,id,beforeNumber])).rows;
      const versions = rows.slice(0,50).map(row => ({id:row.id,number:row.number,definition:definition(row),createdBy:row.created_by,createdAt:row.created_at,approvedBy:row.approved_by,approvedAt:row.approved_at}));
      return {...offerResult(offer),versions,nextBeforeNumber:rows.length>50 ? versions.at(-1)!.number : null};
    });
  }

  async select(context: CommandContext, id: string, input: unknown) {
    requireId(id); const parsed = catalogSelectSchema.safeParse(input);
    if (!parsed.success) throw new AccessError(400,'invalid_request');
    return inCave(this.pool,context,'read',async (db,session,member) => {
      checkCsrf(session,context.csrf);
      if (member.role === 'reader') throw new AccessError(403,'role_forbidden');
      const cave = session.active_cave_id;
      const offer = (await db.query('SELECT *,clock_timestamp() AS checked_at FROM catalog_offers WHERE cave_id=$1 AND id=$2', [cave,id])).rows[0];
      if (!offer) throw unavailable();
      if (offer.published_version_id !== parsed.data.versionId) throw new AccessError(409,'offer_version_changed');
      const version = (await db.query('SELECT * FROM catalog_offer_versions WHERE cave_id=$1 AND offer_id=$2 AND id=$3', [cave,id,offer.published_version_id])).rows[0];
      const data = version ? definition(version) : null;
      const blockers = catalogBlockers(data,offer.enabled,offer.checked_at.valueOf());
      if (blockers.length) return {eligible:false,blockers};
      return {eligible:true,offerId:id,versionId:version.id,number:version.number,definition:data,checkedAt:offer.checked_at};
    });
  }
}
