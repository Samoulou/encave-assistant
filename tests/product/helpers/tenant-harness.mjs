import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityHarness, HttpBrowser } from './identity-harness.mjs';
import { launch, stopProcess, until } from '../../../packages/tooling/src/processes.ts';

export { HttpBrowser };
export async function tenantHarness(options = {}) {
  const h = await identityHarness(options);
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const local = resolve(root, '.local'); await mkdir(local, { recursive: true });
  const directory = await mkdtemp(join(local, 'tenant-test-'));
  const file = join(directory, 'worker.json');
  await writeFile(file, JSON.stringify({ database: h.applicationConfig }), { mode: 0o600, flag: 'wx' });
  const workers = [];
  return { ...h,
    startWorker: async () => {
      const worker = launch(process.execPath, ['apps/worker/dist/index.js'], { cwd: root, env: { ...process.env, ENCAVE_WORKER_CONFIG: file } }); workers.push(worker);
      await until(async () => worker.output().includes('"mode":"team_exports"'), worker, 15_000); return worker;
    },
    stopWorker: stopProcess,
    stop: async () => {
      for (const worker of workers) await stopProcess(worker);
      await h.stop();
      const owned = resolve(directory);
      if (!owned.startsWith(local + sep) || !owned.slice(local.length + 1).startsWith('tenant-test-')) throw new Error('Unexpected test cleanup path');
      await rm(owned, { recursive: true, force: true });
    },
  };
}
export async function logged(h, account) {
  const browser = new HttpBrowser(h.appOrigin);
  const result = await browser.login(account);
  if (result.location !== h.appOrigin + '/espace') throw new Error('Synthetic login failed');
  return browser;
}
export async function eventually(assertion, timeout = 8000) {
  const deadline = performance.now() + timeout; let last;
  do {
    try { await assertion(); return; } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 50));
  } while (performance.now() < deadline);
  throw last;
}
