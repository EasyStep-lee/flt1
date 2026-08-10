import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const supplierA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const supplierB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const productA = '11111111-1111-4111-8111-111111111111';
const productB = '22222222-2222-4222-8222-222222222222';

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
  productId: productA,
  supplierId: supplierA,
  name: '有机大米礼盒',
  saleStatus: 'ACTIVE',
  isRetailEnabled: true,
  retailSalePrice: 6990,
  activeSkuCount: 1,
  ...overrides,
});
const createTestApplication = async ({ active = true, page } = {}) => {
  const catalogRepository = {
    isActiveSupplierSource: async () => active,
    findSellableRetailProducts: async () =>
      page ?? { total: 1, items: [sellableProduct()] },
  };
  const app = await createApplication({
    config: config(),
    probes: probes(),
    catalogRepository,
    logger: false,
  });
  await app.init();
  return app;
};

describe('P0-010 public catalog API', () => {
  it('returns only same-source company-shelf products with a public DTO whitelist', async () => {
    const app = await createTestApplication();
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/suppliers/${supplierA}/products?page=1&pageSize=20`)
        .expect(200);

      expect(response.body).toEqual({
        supplierId: supplierA,
        sourceLabel: '该供应来源的更多商品',
        sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED',
        page: 1,
        pageSize: 20,
        total: 1,
        items: [
          {
            productId: productA,
            name: '有机大米礼盒',
            retailSalePrice: 6990,
            activeSkuCount: 1,
          },
        ],
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /approvedSupplyPrice|supplyPrice|supplierPayment|settlement|storefront|storeCart|storeCoupon|phone|creditCode/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-010-01 rejects a repository supplier-scope escape', async () => {
    const app = await createTestApplication({
      page: {
        total: 2,
        items: [sellableProduct(), sellableProduct({ productId: productB, supplierId: supplierB })],
      },
    });
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/suppliers/${supplierA}/products`)
        .set('x-request-id', 'neg-m2-010-01')
        .expect(403);
      expect(response.body).toMatchObject({
        code: 'SUPPLIER_SCOPE_FORBIDDEN',
        requestId: 'neg-m2-010-01',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-010-02 rejects a non-saleable repository candidate', async () => {
    const app = await createTestApplication({
      page: {
        total: 1,
        items: [sellableProduct({ saleStatus: 'OFF_SHELF', activeSkuCount: 0 })],
      },
    });
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/suppliers/${supplierA}/products`)
        .set('x-request-id', 'neg-m2-010-02')
        .expect(409);
      expect(response.body).toMatchObject({
        code: 'PRODUCT_NOT_SALEABLE',
        requestId: 'neg-m2-010-02',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-010-03 rejects supplier-store semantics before querying products', async () => {
    const app = await createTestApplication();
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/suppliers/${supplierA}/products?storefrontId=forbidden`)
        .set('x-request-id', 'neg-m2-010-03')
        .expect(400);
      expect(response.body).toMatchObject({
        code: 'FORBIDDEN_CAPABILITY',
        requestId: 'neg-m2-010-03',
      });
    } finally {
      await app.close();
    }
  });

  it('returns SUPPLIER_NOT_ACTIVE without substituting another source', async () => {
    const app = await createTestApplication({ active: false });
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/suppliers/${supplierA}/products`)
        .set('x-request-id', 'supplier-not-active')
        .expect(404);
      expect(response.body).toMatchObject({
        code: 'SUPPLIER_NOT_ACTIVE',
        requestId: 'supplier-not-active',
      });
    } finally {
      await app.close();
    }
  });

  it('supports current-product exclusion and an honest empty result', async () => {
    const app = await createTestApplication({ page: { total: 0, items: [] } });
    try {
      const response = await request(app.getHttpServer())
        .get(
          `/v1/catalog/suppliers/${supplierA}/products?excludeProductId=${productA}`,
        )
        .expect(200);
      expect(response.body).toMatchObject({
        supplierId: supplierA,
        total: 0,
        items: [],
      });
    } finally {
      await app.close();
    }
  });
});
