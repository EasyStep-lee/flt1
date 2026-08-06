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

describe('P0-047 runtime response whitelist', () => {
  it('NEG-M1-047-01 maps a tainted merchant entity to the exact public DTO', async () => {
    const app = await createApplication({
      config: config(),
      probes: probes(),
      merchantRepository: {
        findCustomerFacingCompanies: async () => [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            legalName: '江苏福礼团供应链科技有限公司',
            platformName: '福礼社',
            status: 'ACTIVE',
            supplyPrice: 899,
            approvedSupplyPrice: 799,
            supplyPriceSnapshot: { amount: 799 },
            supplierPayableAmount: 700,
            grossMargin: 99,
          },
        ],
      },
      logger: false,
    });
    await app.init();

    try {
      const response = await request(app.getHttpServer())
        .get('/v1/public/merchant-profile')
        .expect(200);
      expect(response.body).toEqual({
        legalName: '江苏福礼团供应链科技有限公司',
        platformName: '福礼社',
        subjects: {
          paymentPayee: '江苏福礼团供应链科技有限公司',
          refundOperator: '江苏福礼团供应链科技有限公司',
          seller: '江苏福礼团供应链科技有限公司',
        },
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /supplyPrice|approvedSupplyPrice|supplyPriceSnapshot|supplierPayable|grossMargin/u,
      );
    } finally {
      await app.close();
    }
  });
});
