import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const baseline = {
  openapi: '3.0.0',
  info: { title: 'oasdiff fixture', version: '1.0.0' },
  paths: {
    '/health/live': {
      get: {
        operationId: 'health.getLiveness',
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  },
};

const runGate = (base, revision, cacheDirectory) =>
  spawnSync(
    'node',
    [
      './scripts/check-openapi-breaking.mjs',
      '--base',
      base,
      '--revision',
      revision,
      '--cache-dir',
      cacheDirectory,
    ],
    { cwd: repoRoot, encoding: 'utf8', env: process.env },
  );

test('NEG-M1-047-03 pinned oasdiff 1.17.0 accepts compatibility and blocks endpoint removal', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'fulishe-oasdiff-'));
  const cacheDirectory = path.join(repoRoot, '.cache', 'oasdiff');
  const basePath = path.join(fixtureRoot, 'base.json');
  const samePath = path.join(fixtureRoot, 'same.json');
  const breakingPath = path.join(fixtureRoot, 'breaking.json');
  writeFileSync(basePath, JSON.stringify(baseline), 'utf8');
  writeFileSync(samePath, JSON.stringify(baseline), 'utf8');
  writeFileSync(
    breakingPath,
    JSON.stringify({ ...baseline, paths: {} }),
    'utf8',
  );

  const compatible = runGate(basePath, samePath, cacheDirectory);
  assert.equal(
    compatible.status,
    0,
    `compatible gate failed\nstdout:\n${compatible.stdout}\nstderr:\n${compatible.stderr}`,
  );
  assert.match(`${compatible.stdout}\n${compatible.stderr}`, /oasdiff 1\.17\.0/u);

  const breaking = runGate(basePath, breakingPath, cacheDirectory);
  assert.notEqual(breaking.status, 0);
  assert.match(`${breaking.stdout}\n${breaking.stderr}`, /breaking|removed/u);
});
