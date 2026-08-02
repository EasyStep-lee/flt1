import assert from 'node:assert/strict';
import test from 'node:test';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const testConfig = () =>
  loadRuntimeConfig({
    NODE_ENV: 'test',
    API_HOST: '127.0.0.1',
    API_PORT: '3000',
    DATABASE_URL:
      'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
    INFRA_HEALTH_TIMEOUT_MS: '50',
  });

const startTestApplication = async (probes) => {
  const app = await createApplication({
    config: testConfig(),
    probes,
    logger: false,
  });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  assert.equal(typeof address, 'object');
  return {
    app,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

test('liveness and readiness expose stable diagnostic contracts and requestId', async () => {
  const probes = ['database', 'redis', 'queue'].map((name) => ({
    name,
    check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
  }));
  const { app, baseUrl } = await startTestApplication(probes);

  try {
    const requestId = 'contract-request-0001';
    const liveResponse = await fetch(`${baseUrl}/health/live`, {
      headers: { 'x-request-id': requestId },
    });
    assert.equal(liveResponse.status, 200);
    assert.equal(liveResponse.headers.get('x-request-id'), requestId);
    assert.deepEqual(await liveResponse.json(), {
      status: 'UP',
      service: 'fulishe-api',
    });

    const readyResponse = await fetch(`${baseUrl}/health/ready`);
    assert.equal(readyResponse.status, 200);
    const readyBody = await readyResponse.json();
    assert.equal(readyBody.status, 'UP');
    assert.deepEqual(Object.keys(readyBody.checks), [
      'database',
      'redis',
      'queue',
    ]);

    const missingRequestId = 'contract-request-0002';
    const missingResponse = await fetch(`${baseUrl}/not-found`, {
      headers: { 'x-request-id': missingRequestId },
    });
    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.headers.get('x-request-id'), missingRequestId);
    const missingBody = await missingResponse.json();
    assert.equal(missingBody.code, 'RESOURCE_NOT_FOUND');
    assert.equal(missingBody.requestId, missingRequestId);
    assert.doesNotMatch(JSON.stringify(missingBody), /Cannot GET|stack|password/i);
  } finally {
    await app.close();
  }
});

test('readiness returns 503 and a safe code when one dependency is down', async () => {
  const probes = [
    {
      name: 'database',
      check: async () => ({ status: 'DOWN', code: 'DATABASE_UNAVAILABLE', latencyMs: 1 }),
    },
    {
      name: 'redis',
      check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
    },
    {
      name: 'queue',
      check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
    },
  ];
  const { app, baseUrl } = await startTestApplication(probes);

  try {
    const response = await fetch(`${baseUrl}/health/ready`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.status, 'DOWN');
    assert.equal(body.checks.database.code, 'DATABASE_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(body), /password|development-only/i);
  } finally {
    await app.close();
  }
});

test('application bootstrap fails fast when required configuration is absent', async () => {
  await assert.rejects(
    createApplication({ env: {}, logger: false }),
    (error) => {
      assert.equal(error.code, 'CONFIG_MISSING');
      assert.match(error.message, /DATABASE_URL/);
      assert.match(error.message, /REDIS_URL/);
      return true;
    },
  );
});
