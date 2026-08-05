import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const config = () =>
  loadRuntimeConfig({
    NODE_ENV: 'test',
    API_HOST: '127.0.0.1',
    API_PORT: '3000',
    DATABASE_URL:
      'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
    INFRA_HEALTH_TIMEOUT_MS: '50',
  });

const probes = () =>
  ['database', 'redis', 'queue'].map((name) => ({
    name,
    check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
  }));

const createTestApplication = async () => {
  const app = await createApplication({
    config: config(),
    probes: probes(),
    merchantRepository: {
      findCustomerFacingCompanies: async () => [],
    },
    logger: false,
  });
  await app.init();
  return app;
};

describe('P0-002 forbidden API surface', () => {
  it.each([
    ['POST', '/v1/franchisees/registrations'],
    ['POST', '/v1/regional-revenue-shares'],
    ['GET', '/v1/franchise-contracts'],
  ])('%s %s is not registered', async (method, path) => {
    const app = await createTestApplication();
    try {
      const response = await request(app.getHttpServer())[method.toLowerCase()](path)
        .set('x-request-id', `p0-002-${method.toLowerCase()}`)
        .expect(404);

      expect(response.body).toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
        path,
      });
    } finally {
      await app.close();
    }
  });

  it('keeps forbidden capability paths out of deterministic OpenAPI', async () => {
    const document = JSON.parse(
      await readFile(
        new URL('../../../../packages/contracts/openapi.json', import.meta.url),
        'utf8',
      ),
    );
    expect(Object.keys(document.paths).join('\n')).not.toMatch(
      /franchise|regional[-_/]?revenue[-_/]?share|jiameng/iu,
    );
  });
});
