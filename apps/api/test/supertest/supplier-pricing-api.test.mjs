import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { InMemoryCategoryRepository } from '../../dist/categories/in-memory-category.repository.js';
import { InMemoryCategoryTemplateRepository } from '../../dist/category-templates/in-memory-category-template.repository.js';
import { createApplication } from '../../dist/bootstrap.js';
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
const supplierB = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
  companyId: company.id,
  status: 'ACTIVE',
};
const supplierIdentityId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const productFunctionalAccountId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const pricingFunctionalAccountId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

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
  name: '独立定价大米礼盒',
  brand: '福礼优选',
  attributes: { schemaVersion: '1.0', material: { description: '东北粳米' } },
  qualificationReferences: ['object://supplier-product/license-pricing-001'],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  enterpriseMinOrderQty: 10,
  enterprisePackageMultiple: 5,
  preparationMinutes: 30,
  skus: [
    {
      supplierSkuCode: 'RICE-PRICE-5KG',
      attributes: { weight: '5kg' },
      initialStock: 100,
    },
  ],
};

const initialPriceBody = (overrides = {}) => ({
  requestId: randomUUID(),
  prices: [
    {
      supplierSkuCode: 'RICE-PRICE-5KG',
      requestedSupplyPrice: 5_000,
      requestedRetailSalePrice: 6_990,
      requestedEnterpriseSalePrice: 6_200,
    },
  ],
  ...overrides,
});

const createFixture = async ({ auditFail = false, safeDefault = false } = {}) => {
  const audit = new InMemoryAuditLogRepository({ ...(auditFail ? { failAppend: true } : {}) });
  const repository = new InMemorySupplierProductRepository({
    auditLogRepository: audit,
    companies: [company],
    suppliers: [supplier, supplierB],
  });
  const categories = new InMemoryCategoryRepository({
    auditLogRepository: audit,
    companies: [company],
    suppliers: [supplier, supplierB],
  });
  const root = await categories.seedForTest({ companyId: company.id, parentId: null, name: '食品', level: 1, sortWeight: 1 });
  const middle = await categories.seedForTest({ companyId: company.id, parentId: root.id, name: '粮油', level: 2, sortWeight: 1 });
  const leaf = await categories.seedForTest({ id: draftBody.categoryId, companyId: company.id, parentId: middle.id, name: '大米', level: 3, sortWeight: 1 });
  const templates = new InMemoryCategoryTemplateRepository({ auditLogRepository: audit, categoryRepository: categories });
  await templates.seedPublishedForTest({ companyId: company.id, categoryId: leaf.id });
  const productActor = {
    role: 'SUPPLIER_PRODUCT',
    supplierId: supplier.id,
    identityId: supplierIdentityId,
    functionalAccountId: productFunctionalAccountId,
  };
  const pricingActor = {
    role: 'SUPPLIER_PRICING',
    supplierId: supplier.id,
    identityId: supplierIdentityId,
    functionalAccountId: pricingFunctionalAccountId,
  };
  const companyActor = {
    accountTypeCode: 'COMPANY_PRICE_REVIEW',
    companyId: company.id,
    functionalAccountId: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
    identityId: 'ffffffff-ffff-4fff-8fff-fffffffffff2',
    workspaceRoute: '/company-admin/workspaces/price-review',
  };
  const app = await createApplication({
    config: config(),
    probes: probes(),
    auditLogRepository: audit,
    categoryRepository: categories,
    categoryTemplateRepository: templates,
    supplierProductRepository: repository,
    supplierProductActorResolver: { resolve: async () => ({ ...productActor }) },
    ...(safeDefault
      ? {}
      : { supplierPricingActorResolver: { resolve: async () => ({ ...pricingActor }) } }),
    companyProductApprovalActorResolver: { resolve: async () => ({ ...companyActor }) },
    logger: false,
  });
  await app.init();
  await app.listen(0, '127.0.0.1');
  return { app, audit, companyActor, pricingActor, productActor, repository };
};

const prepareSubmittedProduct = async (fixture, options = {}) => {
  const supplierSkuCode = options.supplierSkuCode ?? 'RICE-PRICE-5KG';
  const created = await request(fixture.app.getHttpServer())
    .post('/v1/supplier/products')
    .set('Idempotency-Key', `product-create-${randomUUID()}`)
    .send({
      ...draftBody,
      name: options.name ?? draftBody.name,
      skus: [{ ...draftBody.skus[0], supplierSkuCode }],
    });
  expect(created.status).toBe(201);
  const submitted = await request(fixture.app.getHttpServer())
    .post(`/v1/supplier/products/${created.body.id}/submit-material`)
    .set('Idempotency-Key', `material-submit-${randomUUID()}`)
    .send({ version: 0, requestId: randomUUID() });
  expect(submitted.status).toBe(201);
  return created.body;
};

const submitInitialPrices = (fixture, productId, body, key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .put(`/v1/supplier/pricing/products/${productId}/initial-prices`)
    .set('Idempotency-Key', key)
    .send(body);

describe('P0-008 supplier independent initial pricing', () => {
  it('NEG-M2-008-01 freezes an immutable three-price snapshot on the independent pricing API', async () => {
    const fixture = await createFixture();
    try {
      const product = await prepareSubmittedProduct(fixture);
      const response = await submitInitialPrices(
        fixture,
        product.id,
        initialPriceBody(),
        'initial-price-submit-0001',
      );

      expect(response.status).toBe(201);
      expect(response.headers['cache-control']).toContain('private');
      expect(response.body).toMatchObject({
        supplierProductId: product.id,
        status: 'PENDING',
        version: 1,
        prices: [
          {
            supplierSkuCode: 'RICE-PRICE-5KG',
            requestedSupplyPrice: 5_000,
            requestedRetailSalePrice: 6_990,
            requestedEnterpriseSalePrice: 6_200,
          },
        ],
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /companyId|supplierId|functionalAccountId|identityId/iu,
      );

      const page = await request(fixture.app.getHttpServer()).get(
        '/v1/supplier/pricing/products',
      );
      expect(page.status).toBe(200);
      expect(page.headers['cache-control']).toContain('private');
      expect(page.body).toMatchObject({
        total: 1,
        items: [
          {
            supplierProductId: product.id,
            initialPriceEditable: false,
            latestReview: { status: 'PENDING', version: 1 },
            skus: [
              {
                supplierSkuCode: 'RICE-PRICE-5KG',
                requestedSupplyPrice: 5_000,
                requestedRetailSalePrice: 6_990,
                requestedEnterpriseSalePrice: 6_200,
              },
            ],
          },
        ],
      });

      expect(JSON.stringify(product)).not.toMatch(
        /requestedSupplyPrice|requestedRetailSalePrice|requestedEnterpriseSalePrice|supplyPrice/iu,
      );
      const audit = await fixture.audit.list({
        action: 'PRODUCT_INITIAL_PRICES_SUBMITTED',
        page: 1,
        pageSize: 20,
      });
      expect(audit.total).toBe(1);
      expect(JSON.stringify(audit.items)).not.toMatch(
        /requestedSupplyPrice|requestedRetailSalePrice|requestedEnterpriseSalePrice|5000|6990|6200/iu,
      );
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-008-02 denies safe-default, wrong-role and client-supplied ownership', async () => {
    const denied = await createFixture({ safeDefault: true });
    const fixture = await createFixture();
    try {
      const product = await prepareSubmittedProduct(fixture);
      const unauthenticated = await request(denied.app.getHttpServer()).get(
        '/v1/supplier/pricing/products',
      );
      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });

      fixture.pricingActor.role = 'SUPPLIER_PRODUCT';
      const wrongRole = await request(fixture.app.getHttpServer()).get(
        '/v1/supplier/pricing/products',
      );
      expect(wrongRole.status).toBe(403);
      expect(wrongRole.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      fixture.pricingActor.role = 'SUPPLIER_PRICING';

      const tampered = await submitInitialPrices(fixture, product.id, {
        ...initialPriceBody(),
        supplierId: supplier.id,
      });
      expect(tampered.status).toBe(403);
      expect(tampered.body).toMatchObject({ code: 'SUPPLIER_SCOPE_FORBIDDEN' });
      expect(await fixture.repository.listInitialPriceReviews(company.id)).toHaveLength(0);
    } finally {
      await denied.app.close();
      await fixture.app.close();
    }
  });

  it('NEG-M2-008-03 rejects decimal, negative, duplicate and incomplete SKU price sets', async () => {
    const fixture = await createFixture();
    try {
      const product = await prepareSubmittedProduct(fixture);
      const invalidBodies = [
        initialPriceBody({
          prices: [
            {
              supplierSkuCode: 'RICE-PRICE-5KG',
              requestedSupplyPrice: 5_000.5,
              requestedRetailSalePrice: 6_990,
              requestedEnterpriseSalePrice: 6_200,
            },
          ],
        }),
        initialPriceBody({
          prices: [
            {
              supplierSkuCode: 'RICE-PRICE-5KG',
              requestedSupplyPrice: -1,
              requestedRetailSalePrice: 6_990,
              requestedEnterpriseSalePrice: 6_200,
            },
          ],
        }),
        initialPriceBody({
          prices: [
            {
              supplierSkuCode: 'RICE-PRICE-5KG',
              requestedSupplyPrice: 5_000,
              requestedRetailSalePrice: 6_990,
              requestedEnterpriseSalePrice: 6_200,
            },
            {
              supplierSkuCode: 'RICE-PRICE-5KG',
              requestedSupplyPrice: 5_000,
              requestedRetailSalePrice: 6_990,
              requestedEnterpriseSalePrice: 6_200,
            },
          ],
        }),
        initialPriceBody({ prices: [] }),
        initialPriceBody({
          prices: [
            {
              supplierSkuCode: 'NOT-A-PRODUCT-SKU',
              requestedSupplyPrice: 5_000,
              requestedRetailSalePrice: 6_990,
              requestedEnterpriseSalePrice: 6_200,
            },
          ],
        }),
      ];

      for (const body of invalidBodies) {
        const response = await submitInitialPrices(fixture, product.id, body);
        expect(response.status).toBe(422);
        expect(response.body).toMatchObject({ code: 'PRICE_INVALID' });
      }
      expect(await fixture.repository.listInitialPriceReviews(company.id)).toHaveLength(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-008-04 does not reveal whether a cross-supplier product exists', async () => {
    const fixture = await createFixture();
    try {
      fixture.productActor.supplierId = supplierB.id;
      fixture.productActor.identityId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccd';
      const productB = await prepareSubmittedProduct(fixture, {
        name: '供应商乙大米礼盒',
        supplierSkuCode: 'RICE-PRICE-B-5KG',
      });
      fixture.productActor.supplierId = supplier.id;
      fixture.productActor.identityId = supplierIdentityId;

      const response = await submitInitialPrices(
        fixture,
        productB.id,
        initialPriceBody({
          prices: [
            {
              supplierSkuCode: 'RICE-PRICE-B-5KG',
              requestedSupplyPrice: 5_000,
              requestedRetailSalePrice: 6_990,
              requestedEnterpriseSalePrice: 6_200,
            },
          ],
        }),
      );
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'SUPPLIER_SCOPE_FORBIDDEN' });

      const page = await request(fixture.app.getHttpServer()).get(
        '/v1/supplier/pricing/products',
      );
      expect(page.body).toMatchObject({ total: 0, items: [] });
      expect(await fixture.repository.listInitialPriceReviews(company.id)).toHaveLength(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-008-05 replays one concurrent submission and rejects key reuse with another body', async () => {
    const fixture = await createFixture();
    try {
      const product = await prepareSubmittedProduct(fixture);
      const body = initialPriceBody();
      const key = 'initial-price-concurrent-0001';
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => submitInitialPrices(fixture, product.id, body, key)),
      );

      expect(responses.every(({ status }) => status === 201)).toBe(true);
      expect(new Set(responses.map(({ body: value }) => value.id))).toHaveLength(1);
      expect(
        responses.filter(({ headers }) => headers['idempotency-replayed'] === 'true'),
      ).toHaveLength(4);
      expect(await fixture.repository.listInitialPriceReviews(company.id)).toHaveLength(1);
      expect(await fixture.audit.count()).toBe(1);

      const conflict = await submitInitialPrices(
        fixture,
        product.id,
        initialPriceBody({
          prices: [
            {
              supplierSkuCode: 'RICE-PRICE-5KG',
              requestedSupplyPrice: 5_001,
              requestedRetailSalePrice: 6_990,
              requestedEnterpriseSalePrice: 6_200,
            },
          ],
        }),
        key,
      );
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

      const duplicate = await submitInitialPrices(
        fixture,
        product.id,
        initialPriceBody(),
        'initial-price-second-pending-0001',
      );
      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toMatchObject({ code: 'INITIAL_PRICE_REVIEW_PENDING' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-008-06 rolls back the price task when required audit append fails', async () => {
    const fixture = await createFixture({ auditFail: true });
    try {
      const product = await prepareSubmittedProduct(fixture);
      const response = await submitInitialPrices(fixture, product.id, initialPriceBody());

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'AUDIT_REQUIRED' });
      expect(await fixture.repository.listInitialPriceReviews(company.id)).toHaveLength(0);
      const page = await request(fixture.app.getHttpServer()).get(
        '/v1/supplier/pricing/products',
      );
      expect(page.body.items[0]).toMatchObject({ initialPriceEditable: true, latestReview: null });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-008-07 rejects company-side price rewriting and preserves the supplier snapshot', async () => {
    const fixture = await createFixture();
    try {
      const product = await prepareSubmittedProduct(fixture);
      const submitted = await submitInitialPrices(fixture, product.id, initialPriceBody());
      expect(submitted.status).toBe(201);

      const rewritten = await request(fixture.app.getHttpServer())
        .post(`/v1/company/price-reviews/${submitted.body.id}/decision`)
        .set('Idempotency-Key', 'company-price-rewrite-0001')
        .send({
          decision: 'APPROVE',
          opinion: '尝试在公司审核时改写供应价',
          requestedSupplyPrice: 1,
          version: 1,
        });
      expect(rewritten.status).toBe(422);
      expect(rewritten.body).toMatchObject({ code: 'VALIDATION_FAILED' });

      const priceQueue = await request(fixture.app.getHttpServer()).get(
        '/v1/company/price-reviews',
      );
      expect(priceQueue.body.items[0]).toMatchObject({
        status: 'PENDING',
        version: 1,
        skus: [
          {
            requestedSupplyPrice: 5_000,
            requestedRetailSalePrice: 6_990,
            requestedEnterpriseSalePrice: 6_200,
          },
        ],
      });
    } finally {
      await fixture.app.close();
    }
  });

  it('keeps a rejected initial-price snapshot and appends a new submission', async () => {
    const fixture = await createFixture();
    try {
      const product = await prepareSubmittedProduct(fixture);
      const first = await submitInitialPrices(
        fixture,
        product.id,
        initialPriceBody(),
        'initial-price-history-0001',
      );
      expect(first.status).toBe(201);
      const rejected = await request(fixture.app.getHttpServer())
        .post(`/v1/company/price-reviews/${first.body.id}/decision`)
        .set('Idempotency-Key', 'company-price-reject-0001')
        .send({ decision: 'REJECT', opinion: '供应价依据不足', version: 1 });
      expect(rejected.status).toBe(200);

      const second = await submitInitialPrices(
        fixture,
        product.id,
        initialPriceBody({
          prices: [
            {
              supplierSkuCode: 'RICE-PRICE-5KG',
              requestedSupplyPrice: 4_900,
              requestedRetailSalePrice: 6_880,
              requestedEnterpriseSalePrice: 6_100,
            },
          ],
        }),
        'initial-price-history-0002',
      );
      expect(second.status).toBe(201);

      const history = await fixture.repository.listInitialPriceReviews(company.id);
      expect(history).toHaveLength(2);
      expect(history.find(({ id }) => id === first.body.id)).toMatchObject({
        status: 'REJECTED',
        skus: [{ requestedSupplyPrice: 5_000 }],
      });
      expect(history.find(({ id }) => id === second.body.id)).toMatchObject({
        status: 'PENDING',
        skus: [{ requestedSupplyPrice: 4_900 }],
      });
    } finally {
      await fixture.app.close();
    }
  });
});
