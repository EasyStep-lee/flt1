import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { InMemoryCategoryRepository } from '../../dist/categories/in-memory-category.repository.js';
import { InMemoryCategoryTemplateRepository } from '../../dist/category-templates/in-memory-category-template.repository.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemorySupplierProductRepository } from '../../dist/supplier-products/in-memory-supplier-product.repository.js';

const company = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  legalName: '江苏福礼团供应链科技有限公司',
  platformName: '福礼社',
  status: 'ACTIVE',
};
const supplier = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  companyId: company.id,
  status: 'ACTIVE',
};
const supplierIdentityId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const supplierFunctionalAccountId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const productOpsIdentityId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const priceReviewerIdentityId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

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

const draftBody = {
  categoryId: '11111111-1111-4111-8111-111111111111',
  templateVersion: 1,
  name: '双审大米礼盒',
  brand: '福礼优选',
  attributes: { schemaVersion: '1.0', material: { description: '东北粳米' } },
  qualificationReferences: ['object://supplier-product/license-approval-001'],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  enterpriseMinOrderQty: 10,
  enterprisePackageMultiple: 5,
  preparationMinutes: 30,
  skus: [
    {
      supplierSkuCode: 'RICE-APPROVAL-5KG',
      attributes: { weight: '5kg' },
      initialStock: 100,
    },
  ],
};

const createFixture = async ({ auditFail = false } = {}) => {
  const audit = new InMemoryAuditLogRepository({
    ...(auditFail ? { failOnAppendNumber: 2 } : {}),
  });
  const repository = new InMemorySupplierProductRepository({
    auditLogRepository: audit,
    companies: [company],
    suppliers: [supplier],
  });
  const categories = new InMemoryCategoryRepository({
    auditLogRepository: audit,
    companies: [company],
    suppliers: [supplier],
  });
  const root = await categories.seedForTest({ companyId: company.id, parentId: null, name: '食品', level: 1, sortWeight: 1 });
  const middle = await categories.seedForTest({ companyId: company.id, parentId: root.id, name: '粮油', level: 2, sortWeight: 1 });
  const leaf = await categories.seedForTest({ id: draftBody.categoryId, companyId: company.id, parentId: middle.id, name: '大米', level: 3, sortWeight: 1 });
  const templates = new InMemoryCategoryTemplateRepository({ auditLogRepository: audit, categoryRepository: categories });
  await templates.seedPublishedForTest({ companyId: company.id, categoryId: leaf.id });
  const actor = {
    accountTypeCode: 'COMPANY_PRODUCT_OPS',
    companyId: company.id,
    functionalAccountId: '22222222-2222-4222-8222-222222222222',
    identityId: productOpsIdentityId,
    workspaceRoute: '/company-admin/workspaces/product-ops',
  };
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
        supplierId: supplier.id,
        identityId: supplierIdentityId,
        functionalAccountId: supplierFunctionalAccountId,
      }),
    },
    companyProductApprovalActorResolver: { resolve: async () => ({ ...actor }) },
    logger: false,
  });
  await app.init();
  await app.listen(0, '127.0.0.1');
  return { actor, app, audit, repository };
};

const prepareReviews = async (fixture) => {
  const created = await request(fixture.app.getHttpServer())
    .post('/v1/supplier/products')
    .set('Idempotency-Key', `product-create-${randomUUID()}`)
    .send(draftBody);
  expect(created.status).toBe(201);
  const submitted = await request(fixture.app.getHttpServer())
    .post(`/v1/supplier/products/${created.body.id}/submit-material`)
    .set('Idempotency-Key', `material-submit-${randomUUID()}`)
    .send({ version: 0, requestId: randomUUID() });
  expect(submitted.status).toBe(201);

  const priceTask = await fixture.repository.stageInitialPrices({
    supplierId: supplier.id,
    supplierProductId: created.body.id,
    applicantIdentityId: supplierIdentityId,
    applicantFunctionalAccountId: supplierFunctionalAccountId,
    idempotencyKey: `price-stage-${randomUUID()}`,
    requestHash: 'initial-price-request-hash',
    requestId: randomUUID(),
    ip: '127.0.0.1',
    prices: [
      {
        supplierSkuCode: 'RICE-APPROVAL-5KG',
        requestedSupplyPrice: 5_000,
        requestedRetailSalePrice: 6_990,
        requestedEnterpriseSalePrice: 6_200,
      },
    ],
  });
  expect(priceTask.kind).toBe('OK');
  return {
    materialTaskId: submitted.body.id,
    priceTaskId: priceTask.value.id,
    supplierProductId: created.body.id,
  };
};

const decide = (fixture, kind, taskId, body, key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .post(
      kind === 'material'
        ? `/v1/company/product-material-reviews/${taskId}/decision`
        : `/v1/company/price-reviews/${taskId}/decision`,
    )
    .set('Idempotency-Key', key)
    .send(body);

describe('P0-007 company product material and price approval split', () => {
  it('NEG-M2-007-02 exposes separate role-scoped queues and never leaks prices to product operations', async () => {
    const fixture = await createFixture();
    try {
      await prepareReviews(fixture);

      const materialQueue = await request(fixture.app.getHttpServer()).get(
        '/v1/company/product-material-reviews',
      );
      const forbiddenPriceQueue = await request(fixture.app.getHttpServer()).get(
        '/v1/company/price-reviews',
      );

      expect(materialQueue.status).toBe(200);
      expect(materialQueue.headers['cache-control']).toContain('private');
      expect(materialQueue.body.total).toBe(1);
      expect(JSON.stringify(materialQueue.body)).not.toMatch(
        /requestedSupplyPrice|requestedRetailSalePrice|requestedEnterpriseSalePrice|supplyPrice/iu,
      );
      expect(forbiddenPriceQueue.status).toBe(403);
      expect(forbiddenPriceQueue.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });

      fixture.actor.accountTypeCode = 'COMPANY_PRICE_REVIEW';
      fixture.actor.workspaceRoute = '/company-admin/workspaces/price-review';
      fixture.actor.functionalAccountId = '33333333-3333-4333-8333-333333333333';
      fixture.actor.identityId = priceReviewerIdentityId;
      const priceQueue = await request(fixture.app.getHttpServer()).get(
        '/v1/company/price-reviews',
      );
      const forbiddenMaterialQueue = await request(fixture.app.getHttpServer()).get(
        '/v1/company/product-material-reviews',
      );

      expect(priceQueue.status).toBe(200);
      expect(priceQueue.body.items[0].skus[0]).toMatchObject({
        requestedSupplyPrice: 5_000,
        requestedRetailSalePrice: 6_990,
        requestedEnterpriseSalePrice: 6_200,
      });
      expect(forbiddenMaterialQueue.status).toBe(403);
      expect(forbiddenMaterialQueue.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-007-01 materializes exactly one Product/Sku only after both approvals', async () => {
    const fixture = await createFixture();
    try {
      const prepared = await prepareReviews(fixture);
      const material = await decide(fixture, 'material', prepared.materialTaskId, {
        decision: 'APPROVE',
        opinion: '商品资料与资质符合要求',
        version: 1,
      });

      expect(material.status).toBe(200);
      expect(material.body).toMatchObject({
        status: 'APPROVED',
        publicationStatus: 'WAITING_OTHER_APPROVAL',
      });
      expect(await fixture.repository.countProducts()).toBe(0);
      expect(await fixture.repository.countSkus()).toBe(0);

      fixture.actor.accountTypeCode = 'COMPANY_PRICE_REVIEW';
      fixture.actor.workspaceRoute = '/company-admin/workspaces/price-review';
      fixture.actor.functionalAccountId = '33333333-3333-4333-8333-333333333333';
      fixture.actor.identityId = priceReviewerIdentityId;
      const price = await decide(fixture, 'price', prepared.priceTaskId, {
        decision: 'APPROVE',
        opinion: '三类初始价格符合审核口径',
        version: 1,
      });

      expect(price.status).toBe(200);
      expect(price.body).toMatchObject({
        status: 'APPROVED',
        publicationStatus: 'ACTIVE',
        supplierProductId: prepared.supplierProductId,
        productId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      });
      expect(JSON.stringify(price.body)).not.toMatch(/supplyPrice|requestedSupplyPrice/iu);
      expect(await fixture.repository.countProducts()).toBe(1);
      expect(await fixture.repository.countSkus()).toBe(1);
      expect(await fixture.audit.count()).toBe(3);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-007-03 replays a concurrent decision once and rejects a stale different decision', async () => {
    const fixture = await createFixture();
    try {
      const prepared = await prepareReviews(fixture);
      await decide(fixture, 'material', prepared.materialTaskId, {
        decision: 'APPROVE',
        opinion: '资料通过',
        version: 1,
      });
      fixture.actor.accountTypeCode = 'COMPANY_PRICE_REVIEW';
      fixture.actor.workspaceRoute = '/company-admin/workspaces/price-review';
      fixture.actor.functionalAccountId = '33333333-3333-4333-8333-333333333333';
      fixture.actor.identityId = priceReviewerIdentityId;
      const key = 'price-decision-concurrent-0001';
      const body = { decision: 'APPROVE', opinion: '价格通过', version: 1 };
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => decide(fixture, 'price', prepared.priceTaskId, body, key)),
      );

      expect(responses.every(({ status }) => status === 200)).toBe(true);
      expect(new Set(responses.map(({ body: value }) => value.productId))).toHaveLength(1);
      expect(responses.filter(({ headers }) => headers['idempotency-replayed'] === 'true')).toHaveLength(4);
      expect(await fixture.repository.countProducts()).toBe(1);
      expect(await fixture.repository.countSkus()).toBe(1);
      expect(await fixture.audit.count()).toBe(3);

      const stale = await decide(fixture, 'price', prepared.priceTaskId, {
        decision: 'REJECT',
        opinion: '迟到的冲突决定',
        version: 1,
      });
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ code: 'APPROVAL_VERSION_CONFLICT' });
      expect(await fixture.repository.countProducts()).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('refuses the same natural person across functional accounts without state or audit changes', async () => {
    const fixture = await createFixture();
    try {
      const prepared = await prepareReviews(fixture);
      fixture.actor.identityId = supplierIdentityId;
      const response = await decide(fixture, 'material', prepared.materialTaskId, {
        decision: 'APPROVE',
        opinion: '同人跨账号尝试自审',
        version: 1,
      });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'SELF_APPROVAL_FORBIDDEN' });
      expect(await fixture.repository.countProducts()).toBe(0);
      expect(await fixture.audit.count()).toBe(1);
      const queue = await request(fixture.app.getHttpServer()).get(
        '/v1/company/product-material-reviews',
      );
      expect(queue.body.items[0]).toMatchObject({ status: 'PENDING', version: 1 });
    } finally {
      await fixture.app.close();
    }
  });

  it('rolls back the approval when the required append-only audit write fails', async () => {
    const fixture = await createFixture({ auditFail: true });
    try {
      const prepared = await prepareReviews(fixture);
      const response = await decide(fixture, 'material', prepared.materialTaskId, {
        decision: 'APPROVE',
        opinion: '资料通过但审计不可用',
        version: 1,
      });

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'AUDIT_REQUIRED' });
      expect(await fixture.repository.countProducts()).toBe(0);
      const queue = await request(fixture.app.getHttpServer()).get(
        '/v1/company/product-material-reviews',
      );
      expect(queue.body.items[0]).toMatchObject({ status: 'PENDING', version: 1 });
    } finally {
      await fixture.app.close();
    }
  });

  it('keeps rejected material and price request snapshots immutable across supplier correction', async () => {
    const fixture = await createFixture();
    try {
      const prepared = await prepareReviews(fixture);
      const rejected = await decide(fixture, 'material', prepared.materialTaskId, {
        decision: 'REJECT',
        opinion: '请补正商品名称和产地说明',
        version: 1,
      });
      expect(rejected.status).toBe(200);
      expect(rejected.body).toMatchObject({ status: 'REJECTED', publicationStatus: 'REJECTED' });

      const corrected = await request(fixture.app.getHttpServer())
        .patch(`/v1/supplier/products/${prepared.supplierProductId}`)
        .set('Idempotency-Key', 'material-correction-after-reject-0001')
        .send({
          version: 2,
          name: '补正后的大米礼盒',
          attributes: { schemaVersion: '1.0', material: { description: '补正后的产地' } },
        });
      expect(corrected.status).toBe(200);

      const historical = await request(fixture.app.getHttpServer()).get(
        '/v1/company/product-material-reviews',
      );
      expect(historical.status).toBe(200);
      expect(historical.body.items[0]).toMatchObject({
        name: '双审大米礼盒',
        status: 'REJECTED',
        version: 2,
      });
      expect(JSON.stringify(historical.body.items[0])).not.toContain('补正后的产地');

      fixture.actor.accountTypeCode = 'COMPANY_PRICE_REVIEW';
      fixture.actor.workspaceRoute = '/company-admin/workspaces/price-review';
      fixture.actor.functionalAccountId = '33333333-3333-4333-8333-333333333333';
      fixture.actor.identityId = priceReviewerIdentityId;
      const stalePrice = await decide(fixture, 'price', prepared.priceTaskId, {
        decision: 'APPROVE',
        opinion: '资料补正期间不得批准旧价格快照',
        version: 1,
      });
      expect(stalePrice.status).toBe(409);
      expect(stalePrice.body).toMatchObject({ code: 'APPROVAL_STATE_INVALID' });
      expect(await fixture.repository.countProducts()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });
});
