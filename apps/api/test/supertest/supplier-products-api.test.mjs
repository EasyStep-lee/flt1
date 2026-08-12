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
const deliveryRuleId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

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

const draftBody = (overrides = {}) => ({
  categoryId,
  templateVersion: 1,
  name: '有机大米礼盒',
  brand: '福礼优选',
  attributes: {
    schemaVersion: '1.0',
    material: { description: '东北粳米，5kg 礼盒装' },
  },
  qualificationReferences: ['object://supplier-product/license-001'],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  enterpriseMinOrderQty: 10,
  enterprisePackageMultiple: 5,
  preparationMinutes: 30,
  skus: [
    {
      supplierSkuCode: 'RICE-GIFT-5KG',
      attributes: { weight: '5kg' },
      initialStock: 100,
    },
  ],
  ...overrides,
});

const createFixture = async ({ safeDefault = false } = {}) => {
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
    ...(safeDefault
      ? {}
      : {
          supplierProductActorResolver: {
            resolve: async () => ({
              role: 'SUPPLIER_PRODUCT',
              supplierId: actorRef.supplierId,
              identityId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
              functionalAccountId: '11111111-1111-4111-8111-111111111111',
            }),
          },
        }),
    logger: false,
  });
  await app.init();
  return { actorRef, app, repository, service: app.get(SupplierProductService) };
};

const createDraft = (fixture, key = 'product-draft-create-0001', body = draftBody()) =>
  request(fixture.app.getHttpServer())
    .post('/v1/supplier/products')
    .set('Idempotency-Key', key)
    .send(body);

describe('P0-006 supplier and company product two-layer model', () => {
  it('defaults fixed functional sessions to deny and rejects client ownership or price fields', async () => {
    const denied = await createFixture({ safeDefault: true });
    try {
      const response = await createDraft(denied, 'product-safe-default-0001');
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
      expect(await denied.repository.countSupplierProducts()).toBe(0);
    } finally {
      await denied.app.close();
    }

    const fixture = await createFixture();
    try {
      for (const [key, body, expectedCode] of [
        [
          'product-owner-tamper-0001',
          draftBody({ supplierId: supplierB.id, companyId: company.id, status: 'ACTIVE' }),
          'SUPPLIER_SCOPE_FORBIDDEN',
        ],
        [
          'product-price-tamper-0001',
          draftBody({
            skus: [
              {
                supplierSkuCode: 'RICE-GIFT-5KG',
                attributes: { weight: '5kg' },
                initialStock: 100,
                requestedSupplyPrice: 5000,
              },
            ],
          }),
          'PRICE_FIELD_FORBIDDEN',
        ],
      ]) {
        const response = await createDraft(fixture, key, body);
        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({ code: expectedCode });
      }
      expect(await fixture.repository.countSupplierProducts()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('creates and replays a supplier-owned draft through a strict response whitelist', async () => {
    const fixture = await createFixture();
    try {
      const created = await createDraft(fixture);
      const replayed = await createDraft(fixture);

      expect(created.status).toBe(201);
      expect(created.headers['cache-control']).toContain('private');
      expect(created.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
        categoryId,
        templateVersion: 1,
        name: '有机大米礼盒',
        brand: '福礼优选',
        attributes: draftBody().attributes,
        qualificationReferenceCount: 1,
        qualificationValidUntil: null,
        isRetailEnabled: true,
        isEnterpriseProcurementEnabled: true,
        enterpriseMinOrderQty: 10,
        enterprisePackageMultiple: 5,
        preparationMinutes: 30,
        status: 'DRAFT',
        version: 0,
        skus: [
          {
            id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
            supplierSkuCode: 'RICE-GIFT-5KG',
            attributes: { weight: '5kg' },
            initialStock: 100,
            status: 'DRAFT',
          },
        ],
      });
      expect(replayed.status).toBe(201);
      expect(replayed.body).toEqual(created.body);
      expect(replayed.headers['idempotency-replayed']).toBe('true');
      expect(JSON.stringify(created.body)).not.toMatch(
        /companyId|supplierId|functionalAccountId|requestedSupplyPrice|supplyPrice|approvedSupplyPrice/iu,
      );
      expect(await fixture.repository.countSupplierProducts()).toBe(1);
      expect(await fixture.repository.countSupplierProductSkus()).toBe(1);

      const conflict = await createDraft(
        fixture,
        'product-draft-create-0001',
        draftBody({ name: '同幂等键不同商品' }),
      );
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-006-01/02 keeps the supplier submission unsaleable and creates no Product/Sku before both approvals', async () => {
    const fixture = await createFixture();
    try {
      const created = await createDraft(fixture);
      expect(created.status).toBe(201);

      const submitted = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier/products/${created.body.id}/submit-material`)
        .set('Idempotency-Key', 'product-submit-0001')
        .send({ version: 0, requestId: '22222222-2222-4222-8222-222222222222' });

      expect(submitted.status).toBe(201);
      expect(submitted.body).toMatchObject({
        approvalType: 'PRODUCT_MATERIAL',
        objectType: 'SUPPLIER_PRODUCT',
        objectId: created.body.id,
        status: 'PENDING',
        assignedAccountTypeCode: 'COMPANY_PRODUCT_OPS',
        version: 1,
      });
      expect(await fixture.repository.findSellableProductBySupplierProductId(created.body.id)).toBeNull();
      expect(await fixture.repository.countProducts()).toBe(0);
      expect(await fixture.repository.countSkus()).toBe(0);

      const blocked = await fixture.service.materializeApprovedProduct({
        supplierProductId: created.body.id,
        materialVersion: 1,
        priceVersion: 1,
        idempotencyKey: 'product-materialize-blocked-0001',
        detailSnapshot: { schemaVersion: '1.0', sections: [] },
        afterSaleSnapshot: { schemaVersion: '1.0', policy: 'company-after-sale' },
        deliveryRuleId,
      });
      expect(blocked).toMatchObject({ kind: 'PRODUCT_APPROVAL_INCOMPLETE' });
      expect(await fixture.repository.countProducts()).toBe(0);
      expect(await fixture.repository.countSkus()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('hides cross-supplier existence before lookup results and preserves the original draft', async () => {
    const fixture = await createFixture();
    try {
      const created = await createDraft(fixture);
      fixture.actorRef.supplierId = supplierB.id;

      const patched = await request(fixture.app.getHttpServer())
        .patch(`/v1/supplier/products/${created.body.id}`)
        .set('Idempotency-Key', 'product-cross-scope-patch-0001')
        .send({ version: 0, name: '越权改名' });
      const submitted = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier/products/${created.body.id}/submit-material`)
        .set('Idempotency-Key', 'product-cross-scope-submit-0001')
        .send({ version: 0, requestId: '33333333-3333-4333-8333-333333333333' });

      expect(patched.status).toBe(404);
      expect(submitted.status).toBe(404);
      expect(patched.body).toMatchObject({ code: 'SUPPLIER_PRODUCT_NOT_FOUND' });
      expect(submitted.body).toMatchObject({ code: 'SUPPLIER_PRODUCT_NOT_FOUND' });
      const stored = await fixture.repository.getSupplierProduct(created.body.id);
      expect(stored).toMatchObject({ name: '有机大米礼盒', status: 'DRAFT', version: 0 });
    } finally {
      await fixture.app.close();
    }
  });

  it('materializes one company Product/Sku set after both approvals despite concurrent replay', async () => {
    const fixture = await createFixture();
    try {
      const created = await createDraft(fixture);
      await fixture.repository.markApprovedForTest({
        supplierProductId: created.body.id,
        materialVersion: 2,
        prices: [
          {
            supplierSkuCode: 'RICE-GIFT-5KG',
            requestedSupplyPrice: 5000,
            requestedRetailSalePrice: 6990,
            requestedEnterpriseSalePrice: 6200,
          },
        ],
      });
      const command = {
        supplierProductId: created.body.id,
        materialVersion: 2,
        priceVersion: 1,
        idempotencyKey: 'product-materialize-approved-0001',
        detailSnapshot: { schemaVersion: '1.0', sections: [{ type: 'BASE' }] },
        afterSaleSnapshot: { schemaVersion: '1.0', policy: 'company-after-sale' },
        deliveryRuleId,
      };

      const results = await Promise.all(
        Array.from({ length: 5 }, () => fixture.service.materializeApprovedProduct(command)),
      );

      expect(results.every(({ kind }) => kind === 'OK')).toBe(true);
      expect(new Set(results.map(({ productId }) => productId))).toHaveLength(1);
      expect(results.filter(({ replayed }) => replayed)).toHaveLength(4);
      expect(JSON.stringify(results)).not.toMatch(/supplyPrice|requestedSupplyPrice/iu);
      expect(await fixture.repository.countProducts()).toBe(1);
      expect(await fixture.repository.countSkus()).toBe(1);
      expect(await fixture.repository.findSellableProductBySupplierProductId(created.body.id)).toMatchObject({
        supplierProductId: created.body.id,
        saleStatus: 'ACTIVE',
        skuCount: 1,
      });
    } finally {
      await fixture.app.close();
    }
  });
});
