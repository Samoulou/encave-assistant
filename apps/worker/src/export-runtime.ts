import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { requireApplicationRole, runNextExport } from '@encave/tenancy';

export async function exportRuntime(file: string) {
  const config = JSON.parse(await readFile(file, 'utf8')) as { database: pg.PoolConfig };
  const pool = new pg.Pool({ ...config.database, max: 2, application_name: 'encave-team-export-worker', connectionTimeoutMillis: 5000 });
  try {
    await requireApplicationRole(pool);
    await pool.query('SELECT id FROM team_export_jobs LIMIT 0');
  } catch (error) { await pool.end(); throw error; }
  let stopped = false;
  const work = (async () => {
    let failures = 0;
    while (!stopped) {
      try {
        const worked = await runNextExport(pool); failures = 0;
        if (!worked) await delay(500);
      } catch {
        if (++failures >= 3) { console.error('Export worker stopped after repeated database failures.'); process.exitCode = 1; break; }
        console.error('Export work rolled back; bounded retry pending.'); await delay(500);
      }
    }
  })();
  const completion = work.finally(() => pool.end());
  return { stop: async () => { stopped = true; await completion; }, completion };
}
