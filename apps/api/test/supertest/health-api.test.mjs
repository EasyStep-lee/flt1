import { describe, expect, it } from 'vitest';
import request from 'supertest';

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

const createTestApplication = async (probes) => {
  const app = await createApplication({
    config: testConfig(),
    probes,
    logger: false,
  });
  await app.init();
  return app;
};

const healthyProbes = () =>
  ['database', 'redis', 'queue'].map((name) => ({
    name,
    check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
  }));

describe('foundation API through Supertest', () => {
  it('serves liveness and readiness without opening a network port', async () => {
    const app = await createTestApplication(healthyProbes());
    try {
      const live = await request(app.getHttpServer())
        .get('/health/live')
        .set('x-request-id', 'supertest-request-0001')
        .expect(200);
      expect(live.headers['x-request-id']).toBe('supertest-request-0001');
      expect(live.body).toEqual({ status: 'UP', service: 'fulishe-api' });

      const ready = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);
      expect(ready.body.status).toBe('UP');
      expect(Object.keys(ready.body.checks)).toEqual([
        'database',
        'redis',
        'queue',
      ]);
    } finally {
      await app.close();
    }
  });

  it('returns the stable safe error contract for an unknown route', async () => {
    const app = await createTestApplication(healthyProbes());
    try {
      const response = await request(app.getHttpServer())
        .get('/missing')
        .set('x-request-id', 'supertest-request-0002')
        .expect(404);
      expect(response.headers['x-request-id']).toBe('supertest-request-0002');
      expect(response.body).toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
        requestId: 'supertest-request-0002',
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /Cannot GET|stack|password|development-only/i,
      );
    } finally {
      await app.close();
    }
  });

  it('reports a dependency outage as 503 without leaking configuration', async () => {
    const probes = healthyProbes();
    probes[0] = {
      name: 'database',
      check: async () => ({
        status: 'DOWN',
        code: 'DATABASE_UNAVAILABLE',
        latencyMs: 1,
      }),
    };
    const app = await createTestApplication(probes);
    try {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);
      expect(response.body.status).toBe('DOWN');
      expect(response.body.checks.database.code).toBe('DATABASE_UNAVAILABLE');
      expect(JSON.stringify(response.body)).not.toMatch(
        /password|development-only/i,
      );
    } finally {
      await app.close();
    }
  });
});
