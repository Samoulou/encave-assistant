import { foundationScope } from '@encave/domain';
import { technicalHealthSchema } from '@encave/contracts';
import { availableProviderCapabilities } from '@encave/connectors';
import { exportRuntime } from './export-runtime.ts';

if (availableProviderCapabilities.length) throw new Error('Foundation requires inactive providers');
if (process.env['ENCAVE_WORKER_CONFIG']) {
  try {
    const runtime = await exportRuntime(process.env['ENCAVE_WORKER_CONFIG']);
    console.log(JSON.stringify({ service: 'worker', status: 'ready', mode: 'team_exports' }));
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void runtime.stop(); });
    await runtime.completion;
  } catch { console.error('Export worker startup failed: configuration, database and role must be valid.'); process.exitCode = 1; }
} else {
  const heartbeat = setInterval(() => {}, 60_000);
  console.log(JSON.stringify(technicalHealthSchema.parse({
    service: 'worker', status: 'ready', mode: foundationScope.mode,
    synthetic: foundationScope.synthetic, runId: process.env['FOUNDATION_RUN_ID'] ?? 'local',
  })));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => clearInterval(heartbeat));
}
