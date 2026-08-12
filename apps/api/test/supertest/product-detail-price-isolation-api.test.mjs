import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const productId = '21111111-1111-4111-8111-111111111111';
const supplierId = '2aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
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

const field = (key, label, detailModuleKey, specification = false) => ({
  key,
  label,
  type: 'TEXT',
  required: true,
  unit: null,
  enumValues: [],
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false,
  specification,
  detailModuleKey,
});

const template = {
  profile: 'FOOD',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      field('ingredients', '配料表', 'ingredients-nutrition'),
      field('nutrition-facts', '营养成分', 'ingredients-nutrition'),
      field('production-license', '生产许可', 'production-information'),
      field('shelf-life', '保质期', 'production-information'),
      field('storage-method', '储存方式', 'consumption-storage'),
      field('allergens', '过敏原', 'consumption-storage'),
      field('flavor', '口味', 'specifications', true),
      field('net-content', '净含量', 'specifications', true),
      field('package-count', '包装数', 'specifications', true),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'flavor', label: '口味', fieldKey: 'flavor' },
      { key: 'net-content', label: '净含量', fieldKey: 'net-content' },
      { key: 'package-count', label: '包装数', fieldKey: 'package-count' },
    ],
  },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [
      { key: 'ingredients-nutrition', title: '配料与营养', kind: 'FIELDS', sortWeight: 10 },
      { key: 'production-information', title: '生产信息', kind: 'FIELDS', sortWeight: 20 },
      { key: 'consumption-storage', title: '食用和储存提示', kind: 'FIELDS', sortWeight: 30 },
      { key: 'specifications', title: '规格参数', kind: 'FIELDS', sortWeight: 40 },
      { key: 'food-safety-warning', title: '食品安全提示', kind: 'NOTICE', sortWeight: 50 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '公司统一售后',
    evidenceRequirements: [],
  },
};

const detail = {
  productId,
  supplierId,
  categoryId,
  templateVersion: 1,
  name: '企业采购测试商品',
  saleStatus: 'ACTIVE',
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  detailSnapshot: {
    schemaVersion: '1.0',
    name: '企业采购测试商品',
    brand: '福礼团',
    attributes: {
      ingredients: '大米',
      'nutrition-facts': '每100克能量1450千焦',
      'production-license': 'SC100000000001',
      'shelf-life': '12个月',
      'storage-method': '阴凉干燥处保存',
      allergens: '无',
    },
  },
  template,
  skus: [
    {
      skuId: '23333333-3333-4333-8333-333333333333',
      status: 'ACTIVE',
      retailSalePrice: 6990,
      enterpriseSalePrice: 6190,
      approvedSupplyPrice: 5000,
      supplyPriceSnapshot: 4900,
      grossMargin: 1190,
      attributes: { flavor: '原味', 'net-content': '5千克', 'package-count': '1袋' },
    },
  ],
};

const createFixture = async ({ authenticated = true, product = detail } = {}) => {
  const app = await createApplication({
    config: config(),
    probes: probes(),
    catalogRepository: {
      isActiveSupplierSource: async () => true,
      findSellableRetailProducts: async () => ({ total: 0, items: [] }),
      findSellableProductDetail: async (requestedId) =>
        requestedId === productId ? product : null,
    },
    enterpriseCatalogViewerResolver: {
      resolve: async (cookieHeader) =>
        authenticated && cookieHeader === '__Host-fulishe-enterprise-portal=test-session'
          ? { enterpriseId: 'enterprise-test', status: 'ACTIVE' }
          : null,
    },
    logger: false,
  });
  await app.init();
  return app;
};

describe('P0-021 product detail price isolation API', () => {
  it('keeps the retail response public and returns only the retail selling price', async () => {
    const app = await createFixture();
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/products/${productId}`)
        .expect(200);
      expect(response.headers['cache-control']).toContain('public');
      expect(response.body).toMatchObject({ retailSalePrice: 6990 });
      expect(JSON.stringify(response.body)).not.toMatch(
        /enterpriseSalePrice|approvedSupplyPrice|supplyPrice|grossMargin|supplierPayable/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('returns only the enterprise selling price from the authenticated private route', async () => {
    const app = await createFixture();
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/enterprise/catalog/products/${productId}`)
        .set('Cookie', '__Host-fulishe-enterprise-portal=test-session')
        .expect(200);
      expect(response.headers['cache-control']).toMatch(/private/iu);
      expect(response.headers['cache-control']).toMatch(/no-store/iu);
      expect(response.body).toMatchObject({ enterpriseSalePrice: 6190 });
      expect(JSON.stringify(response.body)).not.toMatch(
        /retailSalePrice|approvedSupplyPrice|supplyPrice|grossMargin|supplierPayable/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-021-04 denies the enterprise route without a verified session', async () => {
    const app = await createFixture({ authenticated: false });
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/enterprise/catalog/products/${productId}`)
        .set('x-request-id', 'enterprise-catalog-auth-required')
        .expect(401);
      expect(response.headers['cache-control']).toMatch(/private/iu);
      expect(response.headers['cache-control']).toMatch(/no-store/iu);
      expect(response.body).toMatchObject({
        code: 'AUTHENTICATION_REQUIRED',
        requestId: 'enterprise-catalog-auth-required',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-021-05 rejects a retail-only product from the enterprise route', async () => {
    const app = await createFixture({
      product: { ...detail, isEnterpriseProcurementEnabled: false },
    });
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/enterprise/catalog/products/${productId}`)
        .set('Cookie', '__Host-fulishe-enterprise-portal=test-session')
        .expect(409);
      expect(response.body).toMatchObject({ code: 'PRODUCT_NOT_SALEABLE' });
      expect(JSON.stringify(response.body)).not.toMatch(/retailSalePrice|enterpriseSalePrice/iu);
    } finally {
      await app.close();
    }
  });
});
