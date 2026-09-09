import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { command } from './processes.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
try {
  await command(process.execPath, ['node_modules/typescript/bin/tsc', '-b', '--force'], { cwd: root });
  await command(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'build'], { cwd: join(root, 'apps/web'), env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, timeoutMs: 300_000 });
} catch { console.error('Product build failed; browser tests were not started.'); process.exitCode = 1; }
