import { foundationScope } from '@encave/domain';
import { technicalHealthSchema } from '@encave/contracts';
import { availableProviderCapabilities } from '@encave/connectors';

if (availableProviderCapabilities.length) throw new Error('Foundation requires inactive providers');
const heartbeat = setInterval(() => {}, 60_000);
console.log(JSON.stringify(technicalHealthSchema.parse({
  service: 'worker', status: 'ready', mode: foundationScope.mode,
  synthetic: foundationScope.synthetic, runId: process.env['FOUNDATION_RUN_ID'] ?? 'local',
})));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => clearInterval(heartbeat));
}
