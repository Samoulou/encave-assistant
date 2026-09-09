import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';

export const migrationFiles = ['001_identity.sql', '002_team_exports.sql', '003_case_core.sql'] as const;

// One owned SQL connection holds the session lock across per-file transactions.
// Existing 001/002 remain byte-for-byte unchanged; 001 needs an outer transaction.
export async function migrateDatabase(pool: Pool): Promise<number[]> {
  const db = await pool.connect();
  const applied: number[] = [];
  let locked = false;
  try {
    await db.query("SELECT pg_advisory_lock(hashtextextended('encave:schema:migrations',0))"); locked = true;
    const exists = (await db.query("SELECT to_regclass('schema_migrations') AS relation")).rows[0].relation;
    const versions: number[] = exists ? (await db.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(row => row.version) : [];
    if (versions.length > migrationFiles.length || versions.some((version, i) => version !== i + 1)) throw new Error('Unsupported migration history');
    for (let index = versions.length; index < migrationFiles.length; index++) {
      const sql = await readFile(new URL('../../../migrations/' + migrationFiles[index], import.meta.url), 'utf8');
      try {
        await db.query(index === 0 ? 'BEGIN;\n' + sql + '\nCOMMIT;' : sql);
        applied.push(index + 1);
      } catch (error) { await db.query('ROLLBACK'); throw error; }
    }
    return applied;
  } finally {
    let broken = false;
    try {
      if (locked) await db.query("SELECT pg_advisory_unlock(hashtextextended('encave:schema:migrations',0))");
    } catch (error) { broken = true; throw error; }
    finally { db.release(broken); }
  }
}
