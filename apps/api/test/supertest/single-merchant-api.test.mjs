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

const company = {
  legalName: '江苏福礼团供应链科技有限公司',
  platformName: '福礼社',
  status: 'ACTIVE',
};

const createTestApplication = async (companies = [company]) => {
  const app = await createApplication({
    config: config(),
    probes: probes(),
    merchantRepository: {
      findCustomerFacingCompanies: async () => companies,
    },
    logger: false,
  });
  await app.init();
  return app;
};

describe('P0-001 public merchant profile API', () => {
  it('returns only the company as seller, payment payee and refund operator', async () => {
    const app = await createTestApplication();
    try {
      const response = await request(app.getHttpServer())
        .get('/v1/public/merchant-profile')
        .expect(200);

      expect(response.body).toEqual({
        platformName: '福礼社',
        legalName: '江苏福礼团供应链科技有限公司',
        subjects: {
          seller: '江苏福礼团供应链科技有限公司',
          paymentPayee: '江苏福礼团供应链科技有限公司',
          refundOperator: '江苏福礼团供应链科技有限公司',
        },
      });
      expect(response.headers['cache-control']).toMatch(/public/u);
      expect(JSON.stringify(response.body)).not.toMatch(
        /companyId|supplierId|wechatPayConfigRef|status/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('NEG-M1-001-01 returns SELLER_IDENTITY_FORBIDDEN for seller tampering', async () => {
    const app = await createTestApplication();
    try {
      const response = await request(app.getHttpServer())
        .get('/v1/public/merchant-profile?sellerId=supplier-controlled')
        .set('x-request-id', 'neg-m1-001-01')
        .expect(400);
      expect(response.body).toMatchObject({
        code: 'SELLER_IDENTITY_FORBIDDEN',
        requestId: 'neg-m1-001-01',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M1-001-02 returns PAYEE_FORBIDDEN for a supplier payee', async () => {
    const app = await createTestApplication();
    try {
      const response = await request(app.getHttpServer())
        .get('/v1/public/merchant-profile?payeeId=supplier-payment-account')
        .set('x-request-id', 'neg-m1-001-02')
        .expect(400);
      expect(response.body).toMatchObject({
        code: 'PAYEE_FORBIDDEN',
        requestId: 'neg-m1-001-02',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M1-001-03 returns SINGLE_MERCHANT_VIOLATION for multiple companies', async () => {
    const app = await createTestApplication([company, { ...company }]);
    try {
      const response = await request(app.getHttpServer())
        .get('/v1/public/merchant-profile')
        .set('x-request-id', 'neg-m1-001-03')
        .expect(409);
      expect(response.body).toMatchObject({
        code: 'SINGLE_MERCHANT_VIOLATION',
        requestId: 'neg-m1-001-03',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-009-01 rejects a supplier storefront selector', async () => {
    const app = await createTestApplication();
    try {
      const response = await request(app.getHttpServer())
        .get('/v1/public/merchant-profile?storefrontId=supplier-storefront')
        .set('x-request-id', 'neg-m2-009-01')
        .expect(400);
      expect(response.body).toMatchObject({
        code: 'FORBIDDEN_CAPABILITY',
        requestId: 'neg-m2-009-01',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-009-02 rejects a supplier payment account selector', async () => {
    const app = await createTestApplication();
    try {
      const response = await request(app.getHttpServer())
        .get(
          '/v1/public/merchant-profile?supplierPaymentAccountId=supplier-payment-account',
        )
        .set('x-request-id', 'neg-m2-009-02')
        .expect(400);
      expect(response.body).toMatchObject({
        code: 'FORBIDDEN_CAPABILITY',
        requestId: 'neg-m2-009-02',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-009-03 rejects supplier-store cart ownership', async () => {
    const app = await createTestApplication();
    try {
      const response = await request(app.getHttpServer())
        .get('/v1/public/merchant-profile?storeCartId=supplier-store-cart')
        .set('x-request-id', 'neg-m2-009-03')
        .expect(400);
      expect(response.body).toMatchObject({
        code: 'FORBIDDEN_CAPABILITY',
        requestId: 'neg-m2-009-03',
      });
    } finally {
      await app.close();
    }
  });
});
