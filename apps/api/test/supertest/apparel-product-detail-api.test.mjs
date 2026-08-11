import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const productId = '11111111-1111-4111-8111-111111111111';
const supplierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const categoryId = '22222222-2222-4222-8222-222222222222';

const config = () =>
  loadRuntimeConfig({
    NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
    DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
  });
const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));

const field = (
  key,
  label,
  detailModuleKey,
  { specification = false, type = 'TEXT' } = {},
) => ({
  key, label, type, required: true, unit: null, enumValues: [],
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false, specification, detailModuleKey,
});

const template = () => ({
  profile: 'APPAREL',
  fieldSchema: { schemaVersion: '1.0', fields: [
    field('fabric', '面料', 'materials'),
    field('lining', '里料', 'materials'),
    field('fit', '版型', 'size-assistant'),
    field('execution-standard', '执行标准', 'materials'),
    field('care-instructions', '洗护方式', 'care-instructions'),
    field('size-chart', '尺码表', 'size-assistant', { type: 'RICH_TEXT' }),
    field('color', '颜色', 'specifications', { specification: true }),
    field('size', '尺码', 'specifications', { specification: true }),
  ] },
  skuDimensions: { dimensions: [
    { key: 'color', label: '颜色', fieldKey: 'color' },
    { key: 'size', label: '尺码', fieldKey: 'size' },
  ] },
  qualificationRules: { rules: [] },
  detailModules: { modules: [
    { key: 'size-assistant', title: '尺码助手', kind: 'FIELDS', sortWeight: 10 },
    { key: 'materials', title: '材质说明', kind: 'FIELDS', sortWeight: 20 },
    { key: 'care-instructions', title: '洗护说明', kind: 'FIELDS', sortWeight: 30 },
    { key: 'specifications', title: '颜色与尺码', kind: 'FIELDS', sortWeight: 40 },
    { key: 'apparel-after-sales', title: '试穿与退换说明', kind: 'AFTER_SALE', sortWeight: 50 },
  ] },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理；退换商品须保持未洗涤、未污损且不影响二次销售。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'PRODUCT_PHOTO'],
  },
});

const source = (overrides = {}) => ({
  productId, supplierId, categoryId, templateVersion: 1, name: '数据库名称不应覆盖审核快照',
  saleStatus: 'ACTIVE', isRetailEnabled: true,
  detailSnapshot: {
    name: '通勤棉衬衫', brand: '福礼团严选',
    attributes: {
      fabric: '棉 95%、氨纶 5%', lining: '棉 100%', fit: '常规版型',
      'execution-standard': 'GB/T 2660-2017',
      'care-instructions': '冷水轻柔洗涤，不可漂白，悬挂晾干',
      'size-chart': 'M：胸围100cm/衣长68cm；L：胸围104cm/衣长70cm',
    },
    qualificationSnapshot: { references: ['object://private/not-public'] },
    approvedSupplyPrice: 6900,
  },
  template: template(),
  skus: [
    {
      skuId: '33333333-3333-4333-8333-333333333333', status: 'ACTIVE',
      retailSalePrice: 9900, approvedSupplyPrice: 6900, attributes: { color: '暖红', size: 'M' },
    },
    {
      skuId: '44444444-4444-4444-8444-444444444444', status: 'ACTIVE',
      retailSalePrice: 10000, approvedSupplyPrice: 7000, attributes: { color: '暖红', size: 'L' },
    },
  ],
  ...overrides,
});

const createFixture = async (detail = source()) => {
  const app = await createApplication({
    config: config(), probes: probes(), logger: false,
    catalogRepository: {
      isActiveSupplierSource: async () => true,
      findSellableRetailProducts: async () => ({ total: 0, items: [] }),
      findSellableProductDetail: async (requestedId) => requestedId === productId ? detail : null,
    },
  });
  await app.init();
  return app;
};

describe('P0-015 public apparel product detail API', () => {
  it('returns size, material, care, color-size SKUs and company return rules through a public whitelist', async () => {
    const app = await createFixture();
    try {
      const response = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`).expect(200);
      expect(response.headers['cache-control']).toContain('public');
      expect(response.body).toMatchObject({
        productId, supplierId, categoryId, templateVersion: 1, templateProfile: 'APPAREL',
        name: '通勤棉衬衫', brand: '福礼团严选', sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED', retailSalePrice: 9900,
      });
      expect(response.body.detailModules.flatMap(({ fields }) => fields.map(({ key }) => key))).toEqual([
        'fit', 'size-chart', 'fabric', 'lining', 'execution-standard', 'care-instructions',
      ]);
      expect(response.body.skus.map(({ specifications }) => specifications.map(({ key }) => key))).toEqual([
        ['color', 'size'], ['color', 'size'],
      ]);
      expect(response.body.detailModules.at(-1)).toMatchObject({
        key: 'apparel-after-sales', kind: 'AFTER_SALE', fields: [],
        notice: expect.stringContaining('江苏福礼团供应链科技有限公司'),
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private|settlement|approval/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-015-02 rejects a duplicate persisted color-size matrix instead of exposing it', async () => {
    const detail = source();
    detail.skus[1].attributes = { color: ' 暖红 ', size: 'ｍ' };
    const app = await createFixture(detail);
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/products/${productId}`)
        .set('x-request-id', 'apparel-duplicate-sku')
        .expect(422);
      expect(response.body).toMatchObject({
        code: 'SKU_DIMENSION_DUPLICATE', requestId: 'apparel-duplicate-sku',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-015-03 keeps the bound version-one apparel snapshot stable', async () => {
    const detail = source();
    const app = await createFixture(detail);
    try {
      const before = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`);
      const later = template();
      later.afterSaleRules.notice = '由江苏福礼团供应链科技有限公司统一受理；后续版本退换口径。';
      expect(later).not.toEqual(detail.template);
      const after = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`);
      expect(after.body).toEqual(before.body);
      expect(after.body.templateVersion).toBe(1);
    } finally {
      await app.close();
    }
  });
});
