import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RuntimeConfigError,
  loadRuntimeConfig,
} from '../../dist/config/runtime-config.js';
import { HealthService } from '../../dist/health/health.service.js';
import {
  DEFAULT_FOUNDATION_POLICY,
  createBoundedRetryStrategy,
} from '../../dist/infrastructure/foundation-policy.js';

const validEnvironment = () => ({
  NODE_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  DATABASE_URL:
    'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
});

test('runtime configuration rejects missing infrastructure without leaking values', () => {
  const environment = validEnvironment();
  delete environment.REDIS_URL;
  environment.DATABASE_URL =
    'mysql://fulishe:must-not-appear@127.0.0.1:3306/fulishe';

  assert.throws(
    () => loadRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof RuntimeConfigError);
      assert.equal(error.code, 'CONFIG_MISSING');
      assert.match(error.message, /REDIS_URL/);
      assert.doesNotMatch(error.message, /must-not-appear/);
      return true;
    },
  );
});

test('runtime configuration only accepts MySQL and Redis URLs', () => {
  const environment = validEnvironment();
  environment.REDIS_URL = 'https://user:must-not-appear@example.invalid/cache';

  assert.throws(
    () => loadRuntimeConfig(environment),
    (error) => {
      assert.ok(error instanceof RuntimeConfigError);
      assert.equal(error.code, 'CONFIG_INVALID');
      assert.match(error.message, /REDIS_URL/);
      assert.doesNotMatch(error.message, /must-not-appear/);
      return true;
    },
  );
});

test('foundation retry policy is bounded and deterministic', () => {
  assert.deepEqual(DEFAULT_FOUNDATION_POLICY, {
    connectTimeoutMs: 3_000,
    healthProbeTimeoutMs: 1_500,
    maxRetries: 3,
    retryBaseDelayMs: 250,
    retryMaxDelayMs: 1_000,
    queue: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });

  const retry = createBoundedRetryStrategy({
    maxRetries: 3,
    retryBaseDelayMs: 250,
    retryMaxDelayMs: 1_000,
  });
  assert.equal(retry(1), 250);
  assert.equal(retry(2), 500);
  assert.equal(retry(3), 1_000);
  assert.equal(retry(4), null);
});

test('readiness reports dependency failures without exposing thrown secrets', async () => {
  const probes = [
    {
      name: 'database',
      check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
    },
    {
      name: 'redis',
      check: async () => {
        throw new Error('redis://:must-not-appear@127.0.0.1:6379');
      },
    },
    {
      name: 'queue',
      check: async () => ({ status: 'UP', code: 'OK', latencyMs: 2 }),
    },
  ];
  const service = new HealthService(probes, 50);

  const report = await service.getReadiness();

  assert.equal(report.status, 'DOWN');
  assert.equal(report.checks.database.status, 'UP');
  assert.equal(report.checks.redis.status, 'DOWN');
  assert.equal(report.checks.redis.code, 'PROBE_FAILED');
  assert.doesNotMatch(JSON.stringify(report), /must-not-appear/);
});

test('readiness enforces the probe timeout boundary', async () => {
  const service = new HealthService(
    [
      {
        name: 'database',
        check: async () => new Promise(() => undefined),
      },
    ],
    20,
  );

  const startedAt = Date.now();
  const report = await service.getReadiness();

  assert.equal(report.status, 'DOWN');
  assert.equal(report.checks.database.code, 'PROBE_TIMEOUT');
  assert.ok(Date.now() - startedAt < 500);
});
