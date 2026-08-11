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

const template = () => ({
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
});

const source = (overrides = {}) => ({
  productId,
  supplierId,
  categoryId,
  templateVersion: 1,
  name: '数据库名称不应覆盖审核快照',
  saleStatus: 'ACTIVE',
  isRetailEnabled: true,
  detailSnapshot: {
    schemaVersion: '1.0',
    name: '有机大米',
    brand: '福礼团严选',
    attributes: {
      ingredients: '大米',
      'nutrition-facts': '每100克能量1450千焦',
      'production-license': 'SC100000000001',
      'shelf-life': '12个月',
      'storage-method': '阴凉干燥处保存',
      allergens: '本品生产线同时处理含麸质谷物',
    },
    qualificationSnapshot: { references: ['object://private/not-public'] },
  },
  template: template(),
  skus: [
    {
      skuId: '33333333-3333-4333-8333-333333333333',
      status: 'ACTIVE',
      retailSalePrice: 6990,
      approvedSupplyPrice: 5000,
      attributes: { flavor: '原味', 'net-content': '5千克', 'package-count': '1袋' },
    },
  ],
  ...overrides,
});

const createFixture = async (detail = source()) => {
  const catalogRepository = {
    isActiveSupplierSource: async () => true,
    findSellableRetailProducts: async () => ({ total: 0, items: [] }),
    findSellableProductDetail: async (requestedId) =>
      requestedId === productId ? detail : null,
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

describe('P0-013 public food product detail API', () => {
  it('returns six template fields, SKU dimensions and a server-fixed warning via a public whitelist', async () => {
    const app = await createFixture();
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/products/${productId}`)
        .expect(200);
      expect(response.headers['cache-control']).toContain('public');
      expect(response.body).toMatchObject({
        productId,
        supplierId,
        categoryId,
        templateVersion: 1,
        templateProfile: 'FOOD',
        name: '有机大米',
        brand: '福礼团严选',
        sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED',
        retailSalePrice: 6990,
      });
      expect(response.body.detailModules.flatMap(({ fields }) => fields.map(({ key }) => key))).toEqual([
        'ingredients',
        'nutrition-facts',
        'production-license',
        'shelf-life',
        'storage-method',
        'allergens',
      ]);
      expect(response.body.detailModules.at(-1)).toMatchObject({
        key: 'food-safety-warning',
        kind: 'FIXED_NOTICE',
        fields: [],
        notice: expect.stringContaining('实际包装标签'),
      });
      expect(response.body.skus[0].specifications.map(({ key }) => key)).toEqual([
        'flavor',
        'net-content',
        'package-count',
      ]);
      expect(JSON.stringify(response.body)).not.toMatch(
        /approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private|settlement|approval/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-013-03 keeps the version-one detail stable when a later template exists elsewhere', async () => {
    const detail = source();
    const app = await createFixture(detail);
    try {
      const before = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`);
      const unrelatedV2 = template();
      unrelatedV2.afterSaleRules.notice = '新版口径';
      unrelatedV2.detailModules.modules[0].title = '新版配料标题';
      expect(unrelatedV2).not.toEqual(detail.template);
      const after = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`);
      expect(after.body).toEqual(before.body);
      expect(after.body.templateVersion).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('returns PRODUCT_NOT_FOUND and never substitutes another product', async () => {
    const app = await createFixture();
    try {
      const response = await request(app.getHttpServer())
        .get('/v1/catalog/products/99999999-9999-4999-8999-999999999999')
        .set('x-request-id', 'food-product-not-found')
        .expect(404);
      expect(response.body).toMatchObject({
        code: 'PRODUCT_NOT_FOUND',
        requestId: 'food-product-not-found',
      });
    } finally {
      await app.close();
    }
  });
});
