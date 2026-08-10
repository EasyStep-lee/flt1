import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { createApplication } from '../../dist/bootstrap.js';
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
const otherCompany = {
  id: '99999999-9999-4999-8999-999999999999',
  legalName: '越权公司',
  platformName: '越权公司',
  status: 'ACTIVE',
};
const supplier = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  companyId: company.id,
  status: 'ACTIVE',
};

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

const draftBody = (categoryId) => ({
  categoryId,
  templateVersion: 1,
  name: `分类校验商品-${categoryId.slice(0, 8)}`,
  brand: null,
  attributes: { schemaVersion: '1.0', material: { description: '分类校验' } },
  qualificationReferences: ['object://supplier-product/category-license-001'],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  enterpriseMinOrderQty: 10,
  enterprisePackageMultiple: 5,
  preparationMinutes: 30,
  skus: [
    {
      supplierSkuCode: `CATEGORY-${categoryId.slice(0, 8)}`,
      attributes: { pack: '1' },
      initialStock: 10,
    },
  ],
});

const createFixture = async ({ auditFail = false, safeDefault = false } = {}) => {
  const audit = new InMemoryAuditLogRepository({ failAppend: auditFail });
  const categories = new InMemoryCategoryRepository({
    auditLogRepository: audit,
    companies: [company, otherCompany],
    suppliers: [supplier],
  });
  const products = new InMemorySupplierProductRepository({
    auditLogRepository: audit,
    companies: [company],
    suppliers: [supplier],
  });
  const templates = new InMemoryCategoryTemplateRepository({
    auditLogRepository: audit,
    categoryRepository: categories,
  });
  const actor = {
    accountTypeCode: 'COMPANY_PRODUCT_OPS',
    companyId: company.id,
    functionalAccountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    identityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    workspaceRoute: '/company-admin/workspaces/product-ops',
  };
  const app = await createApplication({
    config: config(),
    probes: probes(),
    auditLogRepository: audit,
    categoryRepository: categories,
    categoryTemplateRepository: templates,
    supplierProductRepository: products,
    supplierProductActorResolver: {
      resolve: async () => ({
        role: 'SUPPLIER_PRODUCT',
        supplierId: supplier.id,
        identityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        functionalAccountId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      }),
    },
    ...(safeDefault
      ? {}
      : { companyProductApprovalActorResolver: { resolve: async () => ({ ...actor }) } }),
    logger: false,
  });
  await app.init();
  return { actor, app, audit, categories, products, templates };
};

const createCategory = (fixture, body, key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .post('/v1/company/categories')
    .set('Idempotency-Key', key)
    .send(body);

const patchCategory = (fixture, categoryId, body, key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .patch(`/v1/company/categories/${categoryId}`)
    .set('Idempotency-Key', key)
    .send(body);

const createTree = async (fixture) => {
  const root = await createCategory(fixture, {
    parentId: null,
    name: '食品饮料',
    level: 1,
    sortWeight: 20,
  });
  expect(root.status).toBe(201);
  const middle = await createCategory(fixture, {
    parentId: root.body.id,
    name: '粮油米面',
    level: 2,
    sortWeight: 10,
  });
  expect(middle.status).toBe(201);
  const leaf = await createCategory(fixture, {
    parentId: middle.body.id,
    name: '大米',
    level: 3,
    sortWeight: 5,
  });
  if (leaf.status === 201) {
    await fixture.templates.seedPublishedForTest({
      companyId: company.id,
      categoryId: leaf.body.id,
    });
  }
  expect(leaf.status).toBe(201);
  return { leaf: leaf.body, middle: middle.body, root: root.body };
};

describe('P0-011 protected category tree', () => {
  it('creates, idempotently replays and stably sorts a strict three-level company tree', async () => {
    const fixture = await createFixture();
    try {
      const firstKey = 'category-root-create-0001';
      const first = await createCategory(
        fixture,
        { parentId: null, name: ' 食品饮料 ', level: 1, sortWeight: 20 },
        firstKey,
      );
      const replay = await createCategory(
        fixture,
        { parentId: null, name: ' 食品饮料 ', level: 1, sortWeight: 20 },
        firstKey,
      );
      expect(first.status).toBe(201);
      expect(first.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
        parentId: null,
        name: '食品饮料',
        level: 1,
        sortWeight: 20,
        status: 'ENABLED',
        version: 0,
      });
      expect(replay.status).toBe(201);
      expect(replay.body).toEqual(first.body);
      expect(replay.headers['idempotency-replayed']).toBe('true');

      const conflict = await createCategory(
        fixture,
        { parentId: null, name: '生活服务', level: 1, sortWeight: 30 },
        firstKey,
      );
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

      const second = await createCategory(fixture, {
        parentId: null,
        name: '生鲜',
        level: 1,
        sortWeight: 10,
      });
      const middle = await createCategory(fixture, {
        parentId: first.body.id,
        name: '粮油米面',
        level: 2,
        sortWeight: 10,
      });
      const leaf = await createCategory(fixture, {
        parentId: middle.body.id,
        name: '大米',
        level: 3,
        sortWeight: 5,
      });
      expect([second.status, middle.status, leaf.status]).toEqual([201, 201, 201]);

      const listed = await request(fixture.app.getHttpServer()).get('/v1/company/categories');
      expect(listed.status).toBe(200);
      expect(listed.headers['cache-control']).toContain('private');
      expect(listed.body.total).toBe(4);
      expect(listed.body.items.map(({ name }) => name)).toEqual(['生鲜', '食品饮料']);
      expect(listed.body.items[1].children[0].children[0]).toMatchObject({ name: '大米' });
      expect(JSON.stringify(listed.body)).not.toMatch(
        /companyId|functionalAccountId|identityId|supplyPrice|settlement/iu,
      );
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-011-04 rejects skipped levels, cross-company parents and same-sibling duplicates', async () => {
    const fixture = await createFixture();
    try {
      const { root } = await createTree(fixture);
      const skipped = await createCategory(fixture, {
        parentId: root.id,
        name: '跳级末级',
        level: 3,
        sortWeight: 1,
      });
      expect(skipped.status).toBe(422);
      expect(skipped.body).toMatchObject({ code: 'CATEGORY_PARENT_INVALID' });

      const foreignParent = await fixture.categories.seedForTest({
        companyId: otherCompany.id,
        parentId: null,
        name: '外部一级',
        level: 1,
        sortWeight: 1,
      });
      const crossCompany = await createCategory(fixture, {
        parentId: foreignParent.id,
        name: '越权二级',
        level: 2,
        sortWeight: 1,
      });
      expect(crossCompany.status).toBe(422);
      expect(crossCompany.body).toMatchObject({ code: 'CATEGORY_PARENT_INVALID' });

      const duplicate = await createCategory(fixture, {
        parentId: null,
        name: '食品饮料',
        level: 1,
        sortWeight: 99,
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toMatchObject({ code: 'CATEGORY_DUPLICATE' });
      expect(await fixture.categories.count()).toBe(4);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-011-01/02 allows only enabled leaf categories and revalidates at submit time', async () => {
    const fixture = await createFixture();
    try {
      const { leaf, middle } = await createTree(fixture);
      const nonLeaf = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'category-non-leaf-product-0001')
        .send(draftBody(middle.id));
      expect(nonLeaf.status).toBe(422);
      expect(nonLeaf.body).toMatchObject({ code: 'CATEGORY_NOT_LEAF' });
      expect(await fixture.products.countSupplierProducts()).toBe(0);

      const created = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'category-leaf-product-0001')
        .send(draftBody(leaf.id));
      expect(created.status).toBe(201);

      const disabled = await patchCategory(fixture, leaf.id, {
        version: leaf.version,
        status: 'DISABLED',
      });
      expect(disabled.status).toBe(200);
      expect(disabled.body).toMatchObject({ status: 'DISABLED', version: 1 });

      const replayedCreate = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'category-leaf-product-0001')
        .send(draftBody(leaf.id));
      expect(replayedCreate.status).toBe(201);
      expect(replayedCreate.body).toEqual(created.body);
      expect(replayedCreate.headers['idempotency-replayed']).toBe('true');

      const rejectedCreate = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'category-disabled-product-0001')
        .send({ ...draftBody(leaf.id), name: '停用分类商品' });
      expect(rejectedCreate.status).toBe(422);
      expect(rejectedCreate.body).toMatchObject({ code: 'CATEGORY_DISABLED' });

      const rejectedSubmit = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier/products/${created.body.id}/submit-material`)
        .set('Idempotency-Key', 'category-disabled-submit-0001')
        .send({ version: 0, requestId: randomUUID() });
      expect(rejectedSubmit.status).toBe(422);
      expect(rejectedSubmit.body).toMatchObject({ code: 'CATEGORY_DISABLED' });
      expect((await fixture.products.getSupplierProduct(created.body.id)).status).toBe('DRAFT');
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-011-03 preserves children and product-referenced categories from physical deletion', async () => {
    const fixture = await createFixture();
    try {
      const { leaf, middle, root } = await createTree(fixture);
      const parentDelete = await request(fixture.app.getHttpServer())
        .delete(`/v1/company/categories/${root.id}`)
        .query({ version: root.version })
        .set('Idempotency-Key', 'category-parent-delete-0001');
      expect(parentDelete.status).toBe(409);
      expect(parentDelete.body).toMatchObject({ code: 'CATEGORY_REFERENCED' });

      const created = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'category-reference-product-0001')
        .send(draftBody(leaf.id));
      expect(created.status).toBe(201);
      const referencedDelete = await request(fixture.app.getHttpServer())
        .delete(`/v1/company/categories/${leaf.id}`)
        .query({ version: leaf.version })
        .set('Idempotency-Key', 'category-referenced-delete-0001');
      expect(referencedDelete.status).toBe(409);
      expect(referencedDelete.body).toMatchObject({ code: 'CATEGORY_REFERENCED' });
      expect(await fixture.categories.findById(company.id, leaf.id)).toMatchObject({ name: '大米' });

      const stale = await patchCategory(fixture, middle.id, {
        version: 99,
        sortWeight: 100,
      });
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT' });
      expect(await fixture.categories.historyCount()).toBe(3);
    } finally {
      await fixture.app.close();
    }
  });

  it('defaults category management to deny and rolls back when mandatory audit append fails', async () => {
    const denied = await createFixture({ safeDefault: true });
    try {
      const response = await request(denied.app.getHttpServer()).get('/v1/company/categories');
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    } finally {
      await denied.app.close();
    }

    const failed = await createFixture({ auditFail: true });
    try {
      const response = await createCategory(failed, {
        parentId: null,
        name: '审计失败分类',
        level: 1,
        sortWeight: 1,
      });
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'AUDIT_REQUIRED' });
      expect(await failed.categories.count()).toBe(0);
      expect(await failed.categories.historyCount()).toBe(0);
    } finally {
      await failed.app.close();
    }
  });
});
