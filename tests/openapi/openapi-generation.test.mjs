import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const pnpm = 'pnpm';
const specPath = path.join(repoRoot, 'packages', 'contracts', 'openapi.json');
const typesPath = path.join(repoRoot, 'packages', 'contracts', 'types.ts');

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
    ...options,
  });

const assertSuccess = (result, label) => {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
};

const forbiddenResponseFields = new Set([
  'approvedSupplyPrice',
  'grossMargin',
  'grossMarginRate',
  'supplierPayable',
  'supplierPayableAmount',
  'supplyPrice',
  'supplyPriceSnapshot',
]);

const findForbiddenKeys = (value, location = '$') => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      findForbiddenKeys(entry, `${location}[${index}]`),
    );
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value).flatMap(([key, entry]) => {
    const current = `${location}.${key}`;
    const match = forbiddenResponseFields.has(key) ? [current] : [];
    return [...match, ...findForbiddenKeys(entry, current)];
  });
};

test('OpenAPI generation is byte-stable and ignores runtime infrastructure configuration', () => {
  const hostileRuntimeEnvironment = {
    ...process.env,
    APP_ENV: 'production',
    DATABASE_URL: 'not-a-runtime-url',
    NODE_ENV: 'production',
    REDIS_URL: 'not-a-runtime-url',
  };
  const first = run(pnpm, ['openapi:generate'], {
    env: hostileRuntimeEnvironment,
  });
  assertSuccess(first, 'first openapi:generate');
  const firstSpec = readFileSync(specPath);
  const firstTypes = readFileSync(typesPath);

  const second = run(pnpm, ['openapi:generate'], {
    env: hostileRuntimeEnvironment,
  });
  assertSuccess(second, 'second openapi:generate');
  assert.deepEqual(readFileSync(specPath), firstSpec);
  assert.deepEqual(readFileSync(typesPath), firstTypes);
  assert.equal(firstSpec.includes(Buffer.from('\r\n')), false, 'spec must use LF');
  assert.equal(firstTypes.includes(Buffer.from('\r\n')), false, 'types must use LF');
});

test('generated contract exposes only health DTOs and a safe error envelope', () => {
  const generated = run(pnpm, ['openapi:generate']);
  assertSuccess(generated, 'openapi:generate');

  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  assert.equal(spec.openapi, '3.0.0');
  assert.deepEqual(Object.keys(spec.paths), ['/health/live', '/health/ready']);
  assert.equal(spec.paths['/health/live'].get.operationId, 'health.getLiveness');
  assert.equal(spec.paths['/health/ready'].get.operationId, 'health.getReadiness');
  assert.deepEqual(
    Object.keys(spec.components.schemas),
    [
      'ApiErrorResponseDto',
      'FoundationDependencyCheckDto',
      'HealthLivenessDto',
      'HealthReadinessChecksDto',
      'HealthReadinessDto',
    ],
  );
  assert.deepEqual(findForbiddenKeys(spec), []);

  const generatedTypes = readFileSync(typesPath, 'utf8');
  assert.match(generatedTypes, /export interface paths/u);
  assert.match(generatedTypes, /"health\.getLiveness"/u);
  assert.match(generatedTypes, /ApiErrorResponseDto/u);
  assert.doesNotMatch(
    generatedTypes,
    /approvedSupplyPrice|grossMargin|supplierPayable|supplyPrice/u,
  );
});

test('openapi:check detects spec drift without rewriting the expected files', () => {
  const generated = run(pnpm, ['openapi:generate']);
  assertSuccess(generated, 'openapi:generate');

  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'fulishe-openapi-drift-'));
  const expectedSpec = path.join(fixtureRoot, 'openapi.json');
  const expectedTypes = path.join(fixtureRoot, 'types.ts');
  const mutated = JSON.parse(readFileSync(specPath, 'utf8'));
  mutated.info.title = 'unauthorized contract drift';
  writeFileSync(expectedSpec, `${JSON.stringify(mutated, null, 2)}\n`, 'utf8');
  writeFileSync(expectedTypes, readFileSync(typesPath));

  const drift = run('node', [
    './scripts/check-openapi-generated.mjs',
    '--expected-openapi',
    expectedSpec,
    '--expected-types',
    expectedTypes,
  ]);
  assert.notEqual(drift.status, 0);
  assert.match(`${drift.stdout}\n${drift.stderr}`, /OPENAPI_SPEC_DRIFT/u);
  assert.equal(JSON.parse(readFileSync(expectedSpec, 'utf8')).info.title, 'unauthorized contract drift');

  const clean = run(pnpm, ['openapi:check']);
  assertSuccess(clean, 'openapi:check');
});
