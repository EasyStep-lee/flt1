import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const productId = '11111111-1111-4111-8111-111111111111';
const supplierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const categoryId = '22222222-2222-4222-8222-222222222222';

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

const sellableProduct = (overrides = {}) => ({
  productId,
  supplierId,
  categoryId,
  name: '员工关怀礼盒',
  saleStatus: 'ACTIVE',
  isRetailEnabled: true,
  retailSalePrice: 12800,
  activeSkuCount: 2,
  media: [{ url: 'https://cdn.example.test/catalog/gift-box.webp', alt: '员工关怀礼盒' }],
  ...overrides,
});

const createFixture = async (page = { total: 1, items: [sellableProduct()] }) => {
  const app = await createApplication({
    config: config(),
    probes: probes(),
    catalogRepository: {
      isActiveSupplierSource: async () => true,
      findSellableProductDetail: async () => null,
      findSellableRetailProducts: async () => page,
      findSellableRetailCatalogProducts: async () => page,
      findSellableEnterpriseProducts: async () => ({ total: 0, items: [] }),
    },
    logger: false,
  });
  await app.init();
  return app;
};

describe('P0-020 public consumer home catalog', () => {
  it('returns a guest-safe company shelf without enterprise or supply-price fields', async () => {
    const app = await createFixture();
    try {
      const response = await request(app.getHttpServer())
        .get('/v1/catalog/products?page=1&pageSize=20')
        .expect(200);

      expect(response.headers['cache-control']).toMatch(/public/iu);
      expect(response.body).toEqual({
        sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED',
        region: { code: null, label: '请选择配送区域', status: 'UNSELECTED' },
        page: 1,
        pageSize: 20,
        total: 1,
        items: [
          {
            productId,
            supplierId,
            categoryId,
            name: '员工关怀礼盒',
            retailSalePrice: 12800,
            activeSkuCount: 2,
            media: [
              {
                url: 'https://cdn.example.test/catalog/gift-box.webp',
                alt: '员工关怀礼盒',
              },
            ],
          },
        ],
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /enterprise|supplyPrice|approvedSupplyPrice|supplierPayable|settlement|margin|buyerId|companyId/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('keeps an honest empty shelf and rejects unsupported or client-owned scope', async () => {
    const app = await createFixture({ total: 0, items: [] });
    try {
      await request(app.getHttpServer())
        .get('/v1/catalog/products?page=1&pageSize=20')
        .expect(200)
        .expect(({ body }) => expect(body).toMatchObject({ total: 0, items: [] }));

      await request(app.getHttpServer())
        .get('/v1/catalog/products?regionCode=client-owned')
        .set('x-request-id', 'neg-m3-p020-region')
        .expect(422)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            code: 'REGION_UNAVAILABLE',
            requestId: 'neg-m3-p020-region',
          }),
        );

      await request(app.getHttpServer())
        .get('/v1/catalog/products?enterpriseId=forbidden')
        .set('x-request-id', 'neg-m3-p020-enterprise')
        .expect(422)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            code: 'VALIDATION_FAILED',
            requestId: 'neg-m3-p020-enterprise',
          }),
        );
    } finally {
      await app.close();
    }
  });

  it('fails closed when a repository candidate is not retail-saleable', async () => {
    const app = await createFixture({
      total: 1,
      items: [sellableProduct({ saleStatus: 'OFF_SHELF', activeSkuCount: 0 })],
    });
    try {
      await request(app.getHttpServer())
        .get('/v1/catalog/products')
        .set('x-request-id', 'neg-m3-p020-state')
        .expect(409)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            code: 'PRODUCT_NOT_SALEABLE',
            requestId: 'neg-m3-p020-state',
          }),
        );
    } finally {
      await app.close();
    }
  });
});
