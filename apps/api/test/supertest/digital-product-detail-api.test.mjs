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
  profile: 'DIGITAL',
  fieldSchema: { schemaVersion: '1.0', fields: [
    field('dimensions', '尺寸', 'technical-parameters'),
    field('power', '功率', 'technical-parameters'),
    field('voltage', '电压', 'technical-parameters'),
    field('interfaces', '接口', 'technical-parameters'),
    field('energy-efficiency', '能效', 'energy-efficiency'),
    field('execution-standard', '执行标准', 'technical-parameters'),
    field('package-list', '包装清单', 'package-and-installation', { type: 'RICH_TEXT' }),
    field('installation-instructions', '安装说明', 'package-and-installation', { type: 'RICH_TEXT' }),
    field('warranty-period', '保修期', 'warranty'),
    field('color', '颜色', 'specifications', { specification: true }),
    field('capacity', '容量', 'specifications', { specification: true }),
    field('model', '型号', 'specifications', { specification: true }),
  ] },
  skuDimensions: { dimensions: [
    { key: 'color', label: '颜色', fieldKey: 'color' },
    { key: 'capacity', label: '容量', fieldKey: 'capacity' },
    { key: 'model', label: '型号', fieldKey: 'model' },
  ] },
  qualificationRules: { rules: [] },
  detailModules: { modules: [
    { key: 'technical-parameters', title: '规格参数', kind: 'FIELDS', sortWeight: 10 },
    { key: 'energy-efficiency', title: '能效信息', kind: 'FIELDS', sortWeight: 20 },
    { key: 'package-and-installation', title: '包装与安装', kind: 'FIELDS', sortWeight: 30 },
    { key: 'warranty', title: '保修信息', kind: 'FIELDS', sortWeight: 40 },
    { key: 'specifications', title: '型号规格', kind: 'FIELDS', sortWeight: 50 },
    { key: 'digital-after-sales', title: '安装与保修服务', kind: 'AFTER_SALE', sortWeight: 60 },
  ] },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理；安装与保修按已发布规则执行。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'PRODUCT_PHOTO'],
  },
});

const source = (overrides = {}) => ({
  productId, supplierId, categoryId, templateVersion: 1, name: '数据库名称不应覆盖审核快照',
  saleStatus: 'ACTIVE', isRetailEnabled: true,
  detailSnapshot: {
    name: '高效办公一体机', brand: '福礼团严选',
    attributes: {
      dimensions: '300mm × 200mm × 50mm', power: '65W', voltage: '220V',
      interfaces: 'USB-C、HDMI', 'energy-efficiency': '一级能效',
      'execution-standard': 'GB 4943.1-2022',
      'package-list': '主机×1、电源适配器×1、说明书×1',
      'installation-instructions': '接通电源后按说明书完成首次配置',
      'warranty-period': '整机一年',
    },
    qualificationSnapshot: { references: ['object://private/not-public'] },
    approvedSupplyPrice: 299900,
  },
  template: template(),
  skus: [
    {
      skuId: '33333333-3333-4333-8333-333333333333', status: 'ACTIVE',
      retailSalePrice: 399900, approvedSupplyPrice: 299900,
      attributes: { color: '白色', capacity: '256GB', model: 'FL-D1' },
    },
    {
      skuId: '44444444-4444-4444-8444-444444444444', status: 'ACTIVE',
      retailSalePrice: 409900, approvedSupplyPrice: 309900,
      attributes: { color: '黑色', capacity: '512GB', model: 'FL-D2' },
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

describe('P0-016 public digital product detail API', () => {
  it('returns models, parameters, energy, package and warranty through a public whitelist', async () => {
    const app = await createFixture();
    try {
      const response = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`).expect(200);
      expect(response.headers['cache-control']).toContain('public');
      expect(response.body).toMatchObject({
        productId, supplierId, categoryId, templateVersion: 1, templateProfile: 'DIGITAL',
        name: '高效办公一体机', brand: '福礼团严选', sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED', retailSalePrice: 399900,
      });
      expect(response.body.detailModules.flatMap(({ fields }) => fields.map(({ key }) => key))).toEqual([
        'dimensions', 'power', 'voltage', 'interfaces', 'execution-standard',
        'energy-efficiency', 'package-list', 'installation-instructions', 'warranty-period',
      ]);
      expect(response.body.skus.map(({ specifications }) => specifications.map(({ key }) => key))).toEqual([
        ['color', 'capacity', 'model'], ['color', 'capacity', 'model'],
      ]);
      expect(response.body.detailModules.at(-1)).toMatchObject({
        key: 'digital-after-sales', kind: 'AFTER_SALE', fields: [],
        notice: expect.stringContaining('江苏福礼团供应链科技有限公司'),
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private|settlement|approval/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-016-02 rejects a duplicate persisted model instead of exposing it', async () => {
    const detail = source();
    detail.skus[1].attributes = { color: '黑色', capacity: '512GB', model: ' fl-d1 ' };
    const app = await createFixture(detail);
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/products/${productId}`)
        .set('x-request-id', 'digital-duplicate-model')
        .expect(422);
      expect(response.body).toMatchObject({
        code: 'DIGITAL_MODEL_DUPLICATE', requestId: 'digital-duplicate-model',
      });
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-016-03 keeps the bound version-one digital snapshot stable', async () => {
    const detail = source();
    const app = await createFixture(detail);
    try {
      const before = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`);
      const later = template();
      later.afterSaleRules.notice = '由江苏福礼团供应链科技有限公司统一受理；后续版本保修口径。';
      expect(later).not.toEqual(detail.template);
      const after = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`);
      expect(after.body).toEqual(before.body);
      expect(after.body.templateVersion).toBe(1);
    } finally {
      await app.close();
    }
  });
});
