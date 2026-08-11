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
  { enumValues = [], specification = false, type = 'TEXT' } = {},
) => ({
  key, label, type, required: true, unit: null, enumValues,
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false, specification, detailModuleKey,
});

const template = () => ({
  profile: 'FRESH',
  fieldSchema: { schemaVersion: '1.0', fields: [
    field('variety', '品种', 'origin-traceability'),
    field('grade', '等级', 'origin-traceability'),
    field('origin', '产地', 'origin-traceability'),
    field('harvest-slaughter-date', '采收/屠宰日期', 'freshness-storage', { type: 'DATE' }),
    field('freshness-period', '保鲜期', 'freshness-storage'),
    field('temperature-zone', '温区', 'freshness-storage', {
      type: 'ENUM', enumValues: ['AMBIENT', 'CHILLED', 'FROZEN'],
    }),
    field('weighing-rule', '称重规则', 'weighing-difference', {
      type: 'ENUM', enumValues: ['FIXED_WEIGHT', 'ACTUAL_WEIGHT'],
    }),
    field('weight-tier', '重量档', 'specifications', { specification: true }),
    field('specification', '规格', 'specifications', { specification: true }),
    field('processing-method', '处理方式', 'specifications', { specification: true }),
  ] },
  skuDimensions: { dimensions: [
    { key: 'weight-tier', label: '重量档', fieldKey: 'weight-tier' },
    { key: 'specification', label: '规格', fieldKey: 'specification' },
    { key: 'processing-method', label: '处理方式', fieldKey: 'processing-method' },
  ] },
  qualificationRules: { rules: [] },
  detailModules: { modules: [
    { key: 'origin-traceability', title: '产地溯源', kind: 'FIELDS', sortWeight: 10 },
    { key: 'freshness-storage', title: '保鲜与温区', kind: 'FIELDS', sortWeight: 20 },
    { key: 'weighing-difference', title: '称重差异', kind: 'FIELDS', sortWeight: 30 },
    { key: 'specifications', title: '规格参数', kind: 'FIELDS', sortWeight: 40 },
    { key: 'fresh-after-sales', title: '生鲜售后规则', kind: 'AFTER_SALE', sortWeight: 50 },
  ] },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理；称重差异按实际称重和已审核规则处理。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'WEIGHT_PHOTO'],
  },
});

const source = (overrides = {}) => ({
  productId, supplierId, categoryId, templateVersion: 1, name: '数据库名称不应覆盖审核快照',
  saleStatus: 'ACTIVE', isRetailEnabled: true,
  detailSnapshot: {
    name: '红颜草莓', brand: null,
    attributes: {
      variety: '红颜草莓', grade: '一级', origin: '江苏连云港',
      'harvest-slaughter-date': '2026-08-10', 'freshness-period': '0-4℃冷藏3天',
      'temperature-zone': 'CHILLED', 'weighing-rule': 'ACTUAL_WEIGHT',
    },
    qualificationSnapshot: { references: ['object://private/not-public'] },
    approvedSupplyPrice: 1290,
  },
  template: template(),
  skus: [{
    skuId: '33333333-3333-4333-8333-333333333333', status: 'ACTIVE',
    retailSalePrice: 1990, approvedSupplyPrice: 1290,
    attributes: { 'weight-tier': '500克档', specification: '篮装', 'processing-method': '原果' },
  }],
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

describe('P0-014 public fresh product detail API', () => {
  it('returns traceability, freshness, weighing, SKU and company after-sales modules via a public whitelist', async () => {
    const app = await createFixture();
    try {
      const response = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`).expect(200);
      expect(response.headers['cache-control']).toContain('public');
      expect(response.body).toMatchObject({
        productId, supplierId, categoryId, templateVersion: 1, templateProfile: 'FRESH',
        name: '红颜草莓', brand: null, sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED', retailSalePrice: 1990,
      });
      expect(response.body.detailModules.flatMap(({ fields }) => fields.map(({ key }) => key))).toEqual([
        'variety', 'grade', 'origin', 'harvest-slaughter-date', 'freshness-period',
        'temperature-zone', 'weighing-rule',
      ]);
      expect(response.body.detailModules[1].fields).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: 'temperature-zone', value: '冷藏' }),
      ]));
      expect(response.body.detailModules[2].fields).toContainEqual(
        expect.objectContaining({ key: 'weighing-rule', value: '按实际称重计价' }),
      );
      expect(response.body.detailModules.at(-1)).toMatchObject({
        key: 'fresh-after-sales', kind: 'AFTER_SALE', fields: [],
        notice: expect.stringContaining('江苏福礼团供应链科技有限公司'),
      });
      expect(response.body.skus[0].specifications.map(({ key }) => key)).toEqual([
        'weight-tier', 'specification', 'processing-method',
      ]);
      expect(JSON.stringify(response.body)).not.toMatch(
        /approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private|settlement|approval/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('NEG-M2-014-02 rejects an invalid persisted weighing rule instead of exposing it', async () => {
    const detail = source();
    detail.detailSnapshot.attributes['weighing-rule'] = 'SUPPLIER_FREE_TEXT';
    const app = await createFixture(detail);
    try {
      const response = await request(app.getHttpServer())
        .get(`/v1/catalog/products/${productId}`)
        .set('x-request-id', 'fresh-invalid-weighing')
        .expect(422);
      expect(response.body).toMatchObject({
        code: 'FRESH_WEIGHT_RULE_INVALID', requestId: 'fresh-invalid-weighing',
      });
    } finally {
      await app.close();
    }
  });

  it('keeps the bound version-one snapshot stable when a later template exists elsewhere', async () => {
    const detail = source();
    const app = await createFixture(detail);
    try {
      const before = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`);
      const later = template();
      later.afterSaleRules.notice = '由江苏福礼团供应链科技有限公司统一受理；后续版本口径。';
      expect(later).not.toEqual(detail.template);
      const after = await request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`);
      expect(after.body).toEqual(before.body);
      expect(after.body.templateVersion).toBe(1);
    } finally {
      await app.close();
    }
  });
});
