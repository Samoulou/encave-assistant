import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from 'node:test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const names = ['unit', 'functional', 'business', 'e2e', 'evals'];

async function discover(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) files.push(...await discover(join(directory, entry.name)));
    else if (entry.isFile() && /\.test\.(mjs|js|ts)$/.test(entry.name)) files.push(join(directory, entry.name));
  }
  return files.sort();
}

export async function runNodeSuite(directory: string): Promise<void> {
  const files = await discover(directory).catch(() => { throw new Error('NON CONFIGURE: suite directory absent or unreadable'); });
  if (!files.length) throw new Error('NON CONFIGURE: suite empty');
  const stream = run({ files, timeout: 60_000, isolation: 'process' });
  let realPassed = 0;
  let failed = false;
  let summaries = 0;
  for await (const event of stream) {
    if (event.type === 'test:summary') {
      // Per-file counts exclude Node's synthetic success for loading an empty file.
      if (event.data.file) {
        realPassed += event.data.counts.passed;
        summaries++;
      }
      if (!event.data.success || event.data.counts.failed || event.data.counts.cancelled) failed = true;
    }
    if (event.type === 'test:fail') failed = true;
    if (event.type === 'test:pass' || event.type === 'test:fail') {
      console.log(`${event.type}: ${event.data.name}`);
    }
  }
  if (failed || summaries !== files.length || realPassed === 0) {
    throw new Error('Suite failed, incomplete, empty or entirely skipped/TODO');
  }
  console.log(`Suite passed: ${realPassed} tests; ${summaries} files`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const suite = process.argv[2];
    if (!suite || !names.includes(suite)) throw new Error('Unknown suite');
    if (suite === 'evals') throw new Error('NON CONFIGURE: actual model evaluation runner and annotated corpus required');
    await runNodeSuite(join(root, 'tests/product', suite));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Suite failed');
    process.exitCode = 1;
  }
}
