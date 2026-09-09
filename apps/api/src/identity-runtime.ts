import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { IdentityStore } from './identity-store.ts';
import { createIdentityHandler } from './identity-http.ts';
import { validateOidcSettings, type OidcSettings } from './identity-oidc.ts';

export async function identityRuntime(file: string) {
  const config = JSON.parse(await readFile(file, 'utf8')) as { oidc: OidcSettings; database: pg.PoolConfig };
  validateOidcSettings(config.oidc);
  const pool = new pg.Pool({ ...config.database, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10_000 });
  try {
    const result = await pool.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user');
    const role = result.rows[0];
    if (!role || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole) throw new Error('Application database role has excessive privileges');
    return { handler: createIdentityHandler(new IdentityStore(pool), config.oidc), stop: () => pool.end() };
  } catch (error) { await pool.end(); throw error; }
}
