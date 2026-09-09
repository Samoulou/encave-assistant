import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { command, launch, stopProcess, until } from '../src/processes.ts';
import { httpReady, checkWorkspaceSources, requiredWorkspaces } from '../src/foundation.ts';

const suiteModule = new URL('../src/suites.ts', import.meta.url).href;
async function temporary(t) {
  const path = await mkdtemp(join(tmpdir(), 'encave-tooling-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

// Each case invokes the real suite runner in a fresh process, on disposable files.
for (const [name, body, expected] of [
  ['directory absent', null, false],
  ['directory empty', undefined, false],
  ['file without tests', 'export const value = 1;', false],
  ['all skipped', "import test from 'node:test'; test.skip('not implemented', () => {});", false],
  ['all TODO', "import test from 'node:test'; test.todo('not implemented');", false],
  ['assertion failed', "import test from 'node:test'; import assert from 'node:assert/strict'; test('failure', () => assert.equal(1,2));", false],
  ['real assertion passed', "import test from 'node:test'; import assert from 'node:assert/strict'; test('sum', () => assert.equal(19+23,42));", true],
]) {
  test(`suite refuses missing evidence: ${name}`, async t => {
    const base = await temporary(t);
    const dir = join(base, 'suite');
    if (body !== null) await mkdir(dir);
    if (typeof body === 'string') await writeFile(join(dir, 'example.test.mjs'), body);
    const harness = join(base, 'run.mjs');
    await writeFile(harness, `import {runNodeSuite} from ${JSON.stringify(suiteModule)}; await runNodeSuite(${JSON.stringify(dir)});`);
    // This is a fresh runner, not a nested run() in this node:test child process.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [harness], { env, encoding: 'utf8', timeout: 15_000, windowsHide: true });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status === 0, expected, result.stdout + result.stderr);
  });
}

test('foundation refuses a missing workspace even when the others exist', async t => {
  const base = await temporary(t);
  for (const workspace of requiredWorkspaces.slice(0, -1)) {
    const dir = join(base, workspace);
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ private: true, name: '@encave/example' }));
    await writeFile(join(dir, 'tsconfig.json'), '{}');
    const entries = workspace === 'packages/tooling' ? ['foundation.ts', 'database.ts', 'suites.ts', 'processes.ts'] : ['index.ts'];
    for (const entry of entries) await writeFile(join(dir, 'src', entry), 'export const value = 1;');
  }
  await assert.rejects(checkWorkspaceSources(base), /apps[\\/]web/);
});

test('stale compiled files cannot replace a removed source entry', async t => {
  const base = await temporary(t);
  const dir = join(base, 'packages/domain');
  await mkdir(join(dir, 'src'), { recursive: true });
  await mkdir(join(dir, 'dist'));
  await writeFile(join(dir, 'package.json'), JSON.stringify({ private: true, name: '@encave/domain' }));
  await writeFile(join(dir, 'tsconfig.json'), '{}');
  await writeFile(join(dir, 'src/unrelated.ts'), 'export const value = 1;');
  await writeFile(join(dir, 'dist/index.js'), 'export const stale = true;');
  await assert.rejects(checkWorkspaceSources(base), /index.ts/);
});

test('foundation command rejects nonzero exit and compiler type errors', async t => {
  await assert.rejects(command(process.execPath, ['-e', 'process.exit(23)'], { quiet: true }), /23/);
  const dir = await temporary(t);
  const file = join(dir, 'broken.ts');
  await writeFile(file, "const value: number = 'wrong';");
  await assert.rejects(command(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--skipLibCheck', file], { quiet: true }), /exit code/);
});

test('HTTP 500 and unexpected content never satisfy readiness', async t => {
  const server = createServer((request, response) => response.writeHead(request.url === '/fail' ? 500 : 200).end('wrong'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await httpReady(url + '/fail', () => true), false);
  assert.equal(await httpReady(url, body => body === 'expected'), false);
});

test('absent worker signal times out and the launched process is stopped', async () => {
  const child = launch(process.execPath, ['-e', 'setInterval(()=>{},1000)']);
  try { await assert.rejects(until(async () => false, child, 150), /timed out/); }
  finally { await stopProcess(child); }
  assert.equal(child.exited(), true);
});

test('dead service is refused before readiness', async () => {
  const child = launch(process.execPath, ['-e', 'process.exit(1)']);
  await child.completion;
  await assert.rejects(until(async () => true, child, 500), /exited/);
});

test('timed out command terminates descendants before their effect', async t => {
  const base = await temporary(t);
  const marker = join(base, 'unwanted.txt');
  const descendant = join(base, 'descendant.mjs');
  const parent = join(base, 'parent.mjs');
  await writeFile(descendant, `import {writeFileSync} from 'node:fs'; setTimeout(()=>writeFileSync(${JSON.stringify(marker)},'unexpected'),1800);`);
  await writeFile(parent, `import {spawn} from 'node:child_process'; spawn(process.execPath,[${JSON.stringify(descendant)}],{stdio:'inherit',windowsHide:true}); setInterval(()=>{},1000);`);
  await assert.rejects(command(process.execPath, [parent], { quiet: true, timeoutMs: 400 }), /timed out/);
  await delay(2_000);
  assert.equal(await access(marker).then(() => true, () => false), false);
});
