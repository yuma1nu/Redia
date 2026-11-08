import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataPaths } from '../src/main/paths.ts';
import { validateEmptyRequest } from '../src/shared/api.ts';

test('development, production and test storage cannot share their default paths', () => {
  const base = process.cwd();
  const development = dataPaths(base, 'development');
  const production = dataPaths(base, 'production');
  const testing = dataPaths(base, 'test', `${base}/test-artifacts/isolated`);
  assert.notEqual(development.root, production.root);
  assert.notEqual(development.database, testing.database);
  assert.throws(() => dataPaths(base, 'test'));
  assert.throws(() => dataPaths(base, 'test', 'relative'));
  assert.throws(() => dataPaths('relative', 'production'));
});

test('the app-info IPC contract rejects injected payloads', () => {
  assert.doesNotThrow(() => validateEmptyRequest([]));
  for (const payload of [undefined, null, {}, 'path', ['command']]) {
    assert.throws(() => validateEmptyRequest([payload]));
  }
});
