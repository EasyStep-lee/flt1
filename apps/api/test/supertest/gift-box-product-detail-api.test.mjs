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
  profile: 'GIFT_BOX',
  fieldSchema: { schemaVersion: '1.0', fields: [
    field('bundle-items', '组合清单', 'bundle-list', { type: 'BUNDLE_ITEMS' }),
    field('packaging', '包装说明', 'customization'),
    field('customization', '定制项', 'customization'),
    field('delivery-cycle', '交付周期', 'customization'),
    field('welfare-scenario', '福利场景', 'welfare-scenario'),
    field('package', '套餐', 'specifications', { specification: true }),
    field('tier', '档位', 'specifications', { specification: true }),
    field('custom-version', '定制版本', 'specifications', { specification: true }),
  ] },
  skuDimensions: { dimensions: [
    { key: 'package', label: '套餐', fieldKey: 'package' },
    { key: 'tier', label: '档位', fieldKey: 'tier' },
    { key: 'custom-version', label: '定制版本', fieldKey: 'custom-version' },
  ] },
  qualificationRules: { rules: [] },
  detailModules: { modules: [
    { key: 'bundle-list', title: '组合清单', kind: 'FIELDS', sortWeight: 10 },
    { key: 'welfare-scenario', title: '福利场景', kind: 'FIELDS', sortWeight: 20 },
    { key: 'customization', title: '定制说明', kind: 'FIELDS', sortWeight: 30 },
    { key: 'specifications', title: '套餐规格', kind: 'FIELDS', sortWeight: 40 },
    { key: 'gift-box-after-sales', title: '统一售后口径', kind: 'AFTER_SALE', sortWeight: 50 },
  ] },
  afterSaleRules: {
    returnPolicy: 'COMPANY_STANDARD',
    notice: '由江苏福礼团供应链科技有限公司统一受理礼盒售后。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'PRODUCT_PHOTO'],
  },
});

const source = () => ({
  productId, supplierId, categoryId, templateVersion: 1, name: '数据库名称不应覆盖审核快照',
  saleStatus: 'ACTIVE', isRetailEnabled: true,
  detailSnapshot: {
    name: '员工关怀礼盒', brand: '福礼团',
    attributes: {
      'bundle-items': [
        {
          supplierProductId: '33333333-3333-4333-8333-333333333333',
          name: '有机大米', quantity: 2, specification: '2.5kg/袋', minimumExpiryDays: 180,
        },
        { name: '坚果组合', quantity: 1, specification: '750g/盒', minimumExpiryDays: 120 },
      ],
      packaging: '节庆礼盒与手提袋',
      customization: '支持企业贺卡，不支持改写商品标签',
      'delivery-cycle': '确认定制稿后 7 个工作日',
      'welfare-scenario': '企业节日福利与员工慰问',
    },
    qualificationSnapshot: { references: ['object://private/not-public'] },
    approvedSupplyPrice: 18800,
  },
  template: template(),
  skus: [
    {
      skuId: '44444444-4444-4444-8444-444444444444', status: 'ACTIVE',
      retailSalePrice: 26800, approvedSupplyPrice: 18800,
      attributes: { package: '经典套餐', tier: 'A档', 'custom-version': '标准版' },
    },
  ],
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

describe('P0-017 public gift-box product detail API', () => {
  it('returns child name, quantity, specification and minimum expiry through a public whitelist', async () => {
    const detail = source();
    const app = await createFixture(detail);
    try {
      const before = await request(app.getHttpServer())
        .get(`/v1/catalog/products/${productId}`)
        .expect(200);
      expect(before.headers['cache-control']).toContain('public');
      expect(before.body).toMatchObject({
        productId, supplierId, categoryId, templateVersion: 1, templateProfile: 'GIFT_BOX',
        name: '员工关怀礼盒', brand: '福礼团',
        sellerName: '江苏福礼团供应链科技有限公司', checkoutMode: 'COMPANY_UNIFIED',
        retailSalePrice: 26800,
        bundleItems: [
          { name: '有机大米', quantity: 2, specification: '2.5kg/袋', minimumExpiryDays: 180 },
          { name: '坚果组合', quantity: 1, specification: '750g/盒', minimumExpiryDays: 120 },
        ],
      });
      expect(before.body.skus[0].specifications.map(({ key }) => key)).toEqual([
        'package', 'tier', 'custom-version',
      ]);
      expect(JSON.stringify(before.body)).not.toMatch(
        /supplierProductId|approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private|settlement|approval/iu,
      );

      const laterChildDraft = { name: '后续子商品改名' };
      expect(laterChildDraft.name).not.toBe(before.body.bundleItems[0].name);
      const after = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`).expect(200);
      expect(after.body).toEqual(before.body);
    } finally {
      await app.close();
    }
  });

  it('rejects an invalid persisted item instead of exposing a partial combination', async () => {
    const detail = source();
    detail.detailSnapshot.attributes['bundle-items'][0].minimumExpiryDays = 0;
    const app = await createFixture(detail);
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/products/${productId}`)
        .set('x-request-id', 'gift-box-invalid-item')
        .expect(422);
      expect(response.body).toMatchObject({
        code: 'BUNDLE_SCHEMA_INVALID', requestId: 'gift-box-invalid-item',
      });
    } finally {
      await app.close();
    }
  });
});
