import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { InMemoryCategoryRepository } from '../../dist/categories/in-memory-category.repository.js';
import { InMemoryCategoryTemplateRepository } from '../../dist/category-templates/in-memory-category-template.repository.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemorySupplierProductRepository } from '../../dist/supplier-products/in-memory-supplier-product.repository.js';
import { SupplierProductService } from '../../dist/supplier-products/supplier-product.service.js';

const company = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  legalName: '江苏福礼团供应链科技有限公司',
  platformName: '福礼社',
  status: 'ACTIVE',
};
const supplierA = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  companyId: company.id,
  status: 'ACTIVE',
};
const supplierB = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  companyId: company.id,
  status: 'ACTIVE',
};
const categoryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const productId = '21111111-1111-4111-8111-111111111111';
const skuId = '23333333-3333-4333-8333-333333333333';
const media = [{ url: 'https://cdn.example.test/catalog/rice.webp', alt: '大米礼盒' }];

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

const unifiedDetail = {
  productId,
  supplierId: supplierA.id,
  categoryId,
  templateVersion: 1,
  name: '共用大米礼盒',
  saleStatus: 'ACTIVE',
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  detailSnapshot: {
    schemaVersion: '1.0',
    name: '共用大米礼盒',
    brand: '福礼优选',
    media,
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
      skuId,
      status: 'ACTIVE',
      retailSalePrice: 6990,
      enterpriseSalePrice: 6190,
      attributes: { flavor: '原味', 'net-content': '5千克', 'package-count': '1袋' },
    },
  ],
};

const createCatalogFixture = async ({ candidate = unifiedDetail, authenticated = true } = {}) => {
  const app = await createApplication({
    config: config(),
    probes: probes(),
    catalogRepository: {
      isActiveSupplierSource: async () => true,
      findSellableRetailProducts: async () => ({ total: 0, items: [] }),
      findSellableProductDetail: async (requestedId) =>
        requestedId === productId ? unifiedDetail : null,
      findSellableEnterpriseProducts: async () => ({ total: 1, items: [candidate] }),
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

const createSupplierFixture = async () => {
  const audit = new InMemoryAuditLogRepository();
  const categories = new InMemoryCategoryRepository({
    auditLogRepository: audit,
    companies: [company],
    suppliers: [supplierA, supplierB],
  });
  const root = await categories.seedForTest({
    companyId: company.id,
    parentId: null,
    name: '食品饮料',
    level: 1,
    sortWeight: 1,
  });
  const middle = await categories.seedForTest({
    companyId: company.id,
    parentId: root.id,
    name: '粮油米面',
    level: 2,
    sortWeight: 1,
  });
  const leaf = await categories.seedForTest({
    id: categoryId,
    companyId: company.id,
    parentId: middle.id,
    name: '大米',
    level: 3,
    sortWeight: 1,
  });
  const templates = new InMemoryCategoryTemplateRepository({
    auditLogRepository: audit,
    categoryRepository: categories,
  });
  await templates.seedPublishedForTest({ companyId: company.id, categoryId: leaf.id });
  const repository = new InMemorySupplierProductRepository({
    companies: [company],
    suppliers: [supplierA, supplierB],
  });
  const actorRef = { supplierId: supplierA.id };
  const app = await createApplication({
    config: config(),
    probes: probes(),
    auditLogRepository: audit,
    categoryRepository: categories,
    categoryTemplateRepository: templates,
    supplierProductRepository: repository,
    supplierProductActorResolver: {
      resolve: async () => ({
        role: 'SUPPLIER_PRODUCT',
        supplierId: actorRef.supplierId,
        identityId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        functionalAccountId: '11111111-1111-4111-8111-111111111111',
      }),
    },
    logger: false,
  });
  await app.init();
  const service = app.get(SupplierProductService);
  const created = await request(app.getHttpServer())
    .post('/v1/supplier/products')
    .set('Idempotency-Key', 'm2p061-create')
    .send({
      categoryId,
      templateVersion: 1,
      name: '共用渠道商品',
      brand: '福礼优选',
      attributes: { schemaVersion: '1.0', material: { description: '大米' } },
      qualificationReferences: ['object://supplier-product/license-061'],
      isRetailEnabled: true,
      isEnterpriseProcurementEnabled: true,
      enterpriseMinOrderQty: 10,
      enterprisePackageMultiple: 5,
      preparationMinutes: 30,
      skus: [{ supplierSkuCode: 'P061-SKU', attributes: { weight: '5kg' }, initialStock: 100 }],
    })
    .expect(201);
  await repository.markApprovedForTest({
    supplierProductId: created.body.id,
    materialVersion: 2,
    prices: [{
      supplierSkuCode: 'P061-SKU',
      requestedSupplyPrice: 5000,
      requestedRetailSalePrice: 6990,
      requestedEnterpriseSalePrice: 6190,
    }],
  });
  const materialized = await service.materializeApprovedProduct({
    supplierProductId: created.body.id,
    materialVersion: 2,
    priceVersion: 1,
    idempotencyKey: 'm2p061-materialize',
    detailSnapshot: { schemaVersion: '1.0', name: '共用渠道商品', media, sections: [] },
    afterSaleSnapshot: { schemaVersion: '1.0', policy: 'company-unified' },
    deliveryRuleId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  });
  if (materialized.kind !== 'OK') throw new Error('TEST_MATERIALIZE_FAILED');
  return { actorRef, app, materialized, repository, supplierProductId: created.body.id };
};

describe('P0-061 shared catalog resources and enterprise flag', () => {
  it('NEG-M2-061-01/02 lists only ACTIVE enterprise-enabled unified Product/Sku resources', async () => {
    const app = await createCatalogFixture();
    try {
      const [retail, enterprise] = await Promise.all([
        request(app.getHttpServer()).get(`/v1/catalog/products/${productId}`).expect(200),
        request(app.getHttpServer())
          .get('/v1/enterprise/catalog/products?page=1&pageSize=20')
          .set('Cookie', '__Host-fulishe-enterprise-portal=test-session')
          .expect(200),
      ]);
      expect(enterprise.headers['cache-control']).toMatch(/private.*no-store/iu);
      expect(enterprise.headers['x-robots-tag']).toMatch(/noindex/iu);
      expect(enterprise.body.items).toHaveLength(1);
      const item = enterprise.body.items[0];
      expect(item).toMatchObject({
        productId: retail.body.productId,
        supplierId: retail.body.supplierId,
        categoryId: retail.body.categoryId,
        templateVersion: retail.body.templateVersion,
        skuIds: retail.body.skus.map(({ skuId: id }) => id),
        media,
        enterpriseSalePrice: 6190,
      });
      expect(JSON.stringify(enterprise.body)).not.toMatch(
        /retailSalePrice|approvedSupplyPrice|supplyPrice|grossMargin|supplierPayable|inventoryBalance/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('rejects unauthenticated, client-owned and disabled enterprise shelf candidates', async () => {
    const unauthenticated = await createCatalogFixture({ authenticated: false });
    const disabled = await createCatalogFixture({
      candidate: { ...unifiedDetail, isEnterpriseProcurementEnabled: false },
    });
    try {
      await request(unauthenticated.getHttpServer())
        .get('/v1/enterprise/catalog/products')
        .expect(401)
        .expect(({ body }) => expect(body.code).toBe('AUTHENTICATION_REQUIRED'));
      await request(disabled.getHttpServer())
        .get('/v1/enterprise/catalog/products?enterpriseId=client-owned')
        .set('Cookie', '__Host-fulishe-enterprise-portal=test-session')
        .expect(422)
        .expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
      await request(disabled.getHttpServer())
        .get('/v1/enterprise/catalog/products')
        .set('Cookie', '__Host-fulishe-enterprise-portal=test-session')
        .expect(409)
        .expect(({ body }) => expect(body.code).toBe('PRODUCT_NOT_SALEABLE'));
    } finally {
      await Promise.all([unauthenticated.close(), disabled.close()]);
    }
  });

  it('NEG-M2-061-03 changes an ACTIVE flag idempotently and keeps prior history immutable', async () => {
    const fixture = await createSupplierFixture();
    try {
      const url = `/v1/supplier/products/${fixture.supplierProductId}/channel-visibility`;
      const body = {
        version: 3,
        isRetailEnabled: true,
        isEnterpriseProcurementEnabled: false,
        enterpriseMinOrderQty: 0,
        enterprisePackageMultiple: 0,
        reason: '暂停企业渠道，历史订单快照保持不变',
      };
      const first = await request(fixture.app.getHttpServer())
        .patch(url)
        .set('Idempotency-Key', 'm2p061-channel-change')
        .send(body)
        .expect(200);
      const replay = await request(fixture.app.getHttpServer())
        .patch(url)
        .set('Idempotency-Key', 'm2p061-channel-change')
        .send(body)
        .expect(200);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body).toEqual(first.body);
      expect(first.body).toMatchObject({
        supplierProductId: fixture.supplierProductId,
        productId: fixture.materialized.productId,
        isEnterpriseProcurementEnabled: false,
      });

      const history = await request(fixture.app.getHttpServer())
        .get(`${url}-history`)
        .expect(200);
      expect(history.body.items).toHaveLength(2);
      expect(history.body.items.map(({ event }) => event)).toEqual(['INITIAL', 'CHANGE']);
      expect(history.body.items[0]).toMatchObject({
        before: { isEnterpriseProcurementEnabled: true },
        after: { isEnterpriseProcurementEnabled: true },
      });
      expect(history.body.items[1]).toMatchObject({
        before: { isEnterpriseProcurementEnabled: true },
        after: { isEnterpriseProcurementEnabled: false },
      });
      expect(await fixture.repository.countProducts()).toBe(1);
      expect(await fixture.repository.countSkus()).toBe(1);

      await request(fixture.app.getHttpServer())
        .patch(url)
        .set('Idempotency-Key', 'm2p061-channel-change')
        .send({ ...body, reason: '相同业务键不得承载不同请求' })
        .expect(409)
        .expect(({ body: error }) => expect(error.code).toBe('IDEMPOTENCY_CONFLICT'));

      fixture.actorRef.supplierId = supplierB.id;
      await request(fixture.app.getHttpServer())
        .get(`${url}-history`)
        .expect(404);
    } finally {
      await fixture.app.close();
    }
  });
});
