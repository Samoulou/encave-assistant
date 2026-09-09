import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { IdentityStore } from './identity-store.ts';
import { createIdentityHandler } from './identity-http.ts';
import { validateOidcSettings, type OidcSettings } from './identity-oidc.ts';
import { requireApplicationRole } from '@encave/tenancy';

export async function identityRuntime(file: string) {
  const config = JSON.parse(await readFile(file, 'utf8')) as { oidc: OidcSettings; database: pg.PoolConfig; exports?: { retentionSeconds: number } };
  validateOidcSettings(config.oidc);
  const pool = new pg.Pool({ ...config.database, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10_000 });
  try {
    await requireApplicationRole(pool);
    return { handler: createIdentityHandler(new IdentityStore(pool), config.oidc, config.exports ? { exportRetentionSeconds: config.exports.retentionSeconds } : {}), stop: () => pool.end() };
  } catch (error) { await pool.end(); throw error; }
}
