import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { failureLocations } from '../../../packages/tooling/src/test-diagnostics.ts';

test('failure diagnostics expose source coordinates without assertion values or external URLs', () => {
  const source = fileURLToPath(import.meta.url);
  const result = failureLocations({ stack: `Private assertion contents\n    at test (${source}:14:6)`, cause: { stack: `https://provider.example/callback?code=private\n    at https://untrusted.example/page:12:3\n    at inspect (${import.meta.url}:25:4)` } });
  assert.deepEqual(result, ['tests/product/unit/test-diagnostics.test.mjs:14:6', 'tests/product/unit/test-diagnostics.test.mjs:25:4']);
  assert.deepEqual(failureLocations({ message: 'private', actual: 'private', expected: 'private' }), []);
  assert.ok(failureLocations(new Error('Private assertion contents')).some(location => location.startsWith('tests/product/unit/test-diagnostics.test.mjs:')));
});

test('failure diagnostics refuse fake source URLs, function names, missing files and paths outside the repository', () => {
  const fakeFrames = [
    'https://untrusted.example/tests/private-token:12:3',
    'tests/private-token:12:3',
    `https://untrusted.example/tests/private-token:12:3 (node:internal/test:12:3)`,
    `file://untrusted.example/tests/private-token.mjs:12:3`,
    `${import.meta.url}?token=private:12:3`,
    `${new URL('./missing-file.test.mjs', import.meta.url)}:12:3`,
    `${new URL('../../../../outside.test.mjs', import.meta.url)}:12:3`,
    `${new URL('../../../packages/tooling/src', import.meta.url)}:12:3`,
    `${new URL('../../../package.json', import.meta.url)}:12:3`,
  ];
  assert.deepEqual(failureLocations({ stack: fakeFrames.map(frame => '    at ' + frame).join('\n') }), []);
  assert.deepEqual(failureLocations({ stack: `    at tests/private-token:12:3 (${import.meta.url}:32:4)` }), ['tests/product/unit/test-diagnostics.test.mjs:32:4']);
});
