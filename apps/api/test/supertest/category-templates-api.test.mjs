import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { createApplication } from '../../dist/bootstrap.js';
import { InMemoryCategoryTemplateRepository } from '../../dist/category-templates/in-memory-category-template.repository.js';
import { InMemoryCategoryRepository } from '../../dist/categories/in-memory-category.repository.js';
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

const templateBody = (overrides = {}) => ({
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      {
        key: 'description',
        label: '商品说明',
        type: 'TEXT',
        required: true,
        unit: null,
        enumValues: [],
        validation: {
          min: null,
          max: null,
          minLength: 1,
          maxLength: 200,
          pattern: null,
        },
        searchable: false,
        specification: false,
        detailModuleKey: 'base',
      },
      {
        key: 'pack',
        label: '包装规格',
        type: 'ENUM',
        required: true,
        unit: null,
        enumValues: ['单盒', '整箱'],
        validation: {
          min: null,
          max: null,
          minLength: null,
          maxLength: null,
          pattern: null,
        },
        searchable: true,
        specification: true,
        detailModuleKey: 'specifications',
      },
    ],
  },
  skuDimensions: {
    dimensions: [{ key: 'pack', label: '包装规格', fieldKey: 'pack' }],
  },
  qualificationRules: {
    rules: [
      {
        key: 'business-license',
        label: '经营资质',
        required: true,
        expiryRequired: true,
        objectTypes: ['IMAGE', 'PDF'],
      },
    ],
  },
  detailModules: {
    modules: [
      { key: 'base', title: '基础信息', kind: 'FIELDS', sortWeight: 10 },
      { key: 'specifications', title: '规格参数', kind: 'FIELDS', sortWeight: 20 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'COMPANY_STANDARD',
    notice: '由江苏福礼团供应链科技有限公司统一受理售后。',
    evidenceRequirements: ['PACKAGE_PHOTO'],
  },
  ...overrides,
});

const productBody = (categoryId, templateVersion, name = '模板绑定商品') => ({
  categoryId,
  templateVersion,
  name,
  brand: null,
  attributes: { description: '受模板约束', pack: '单盒' },
  qualificationReferences: ['object://supplier-product/business-license-001'],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: false,
  enterpriseMinOrderQty: 1,
  enterprisePackageMultiple: 1,
  preparationMinutes: 30,
  skus: [
    {
      supplierSkuCode: `${name}-SKU`,
      attributes: { pack: '单盒' },
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
  const root = await categories.seedForTest({
    companyId: company.id,
    parentId: null,
    name: '食品饮料',
    level: 1,
    sortWeight: 10,
  });
  const middle = await categories.seedForTest({
    companyId: company.id,
    parentId: root.id,
    name: '粮油米面',
    level: 2,
    sortWeight: 10,
  });
  const leaf = await categories.seedForTest({
    companyId: company.id,
    parentId: middle.id,
    name: '大米',
    level: 3,
    sortWeight: 10,
  });
  const disabledLeaf = await categories.seedForTest({
    companyId: company.id,
    parentId: middle.id,
    name: '停用末级',
    level: 3,
    sortWeight: 20,
    status: 'DISABLED',
  });
  const foreignRoot = await categories.seedForTest({
    companyId: otherCompany.id,
    parentId: null,
    name: '外部一级',
    level: 1,
    sortWeight: 10,
  });
  const foreignMiddle = await categories.seedForTest({
    companyId: otherCompany.id,
    parentId: foreignRoot.id,
    name: '外部二级',
    level: 2,
    sortWeight: 10,
  });
  const foreignLeaf = await categories.seedForTest({
    companyId: otherCompany.id,
    parentId: foreignMiddle.id,
    name: '外部末级',
    level: 3,
    sortWeight: 10,
  });
  const templates = new InMemoryCategoryTemplateRepository({
    auditLogRepository: audit,
    categoryRepository: categories,
  });
  const products = new InMemorySupplierProductRepository({
    auditLogRepository: audit,
    companies: [company],
    suppliers: [supplier],
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
  await app.listen(0, '127.0.0.1');
  return {
    app,
    audit,
    categories,
    disabledLeaf,
    foreignLeaf,
    leaf,
    middle,
    products,
    root,
    templates,
  };
};

const createTemplate = (fixture, categoryId, body = templateBody(), key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .post(`/v1/company/categories/${categoryId}/template-versions`)
    .set('Idempotency-Key', key)
    .send(body);

const patchTemplate = (fixture, templateId, body, key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .patch(`/v1/company/category-template-versions/${templateId}`)
    .set('Idempotency-Key', key)
    .send(body);

const publishTemplate = (fixture, templateId, revision, key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .post(`/v1/company/category-template-versions/${templateId}/publish`)
    .set('Idempotency-Key', key)
    .send({ revision });

describe('P0-012 versioned category templates', () => {
  it('creates, edits and publishes immutable versions while retiring the prior active version', async () => {
    const fixture = await createFixture();
    try {
      const key = 'template-v1-create-0001';
      const created = await createTemplate(fixture, fixture.leaf.id, templateBody(), key);
      const replayed = await createTemplate(fixture, fixture.leaf.id, templateBody(), key);
      expect(created.status).toBe(201);
      expect(created.headers['cache-control']).toContain('private');
      expect(created.body).toMatchObject({
        categoryId: fixture.leaf.id,
        version: 1,
        revision: 0,
        status: 'DRAFT',
      });
      expect(replayed.status).toBe(201);
      expect(replayed.body).toEqual(created.body);
      expect(replayed.headers['idempotency-replayed']).toBe('true');
      expect(JSON.stringify(created.body)).not.toMatch(
        /companyId|functionalAccountId|identityId|supplyPrice|settlement|margin/iu,
      );

      const publishedV1 = await publishTemplate(
        fixture,
        created.body.id,
        created.body.revision,
        'template-v1-publish-0001',
      );
      expect(publishedV1.status).toBe(200);
      expect(publishedV1.body).toMatchObject({ version: 1, revision: 1, status: 'PUBLISHED' });
      const v1Snapshot = globalThis.structuredClone(publishedV1.body);

      const createdV2 = await createTemplate(
        fixture,
        fixture.leaf.id,
        templateBody(),
        'template-v2-create-0001',
      );
      expect(createdV2.status).toBe(201);
      expect(createdV2.body).toMatchObject({ version: 2, revision: 0, status: 'DRAFT' });
      const nextBody = templateBody({
        afterSaleRules: {
          returnPolicy: 'CATEGORY_RESTRICTED',
          notice: '公司统一受理；生鲜属性商品按页面提示核验。',
          evidenceRequirements: ['PACKAGE_PHOTO', 'UNBOXING_VIDEO'],
        },
      });
      const patched = await patchTemplate(fixture, createdV2.body.id, {
        revision: 0,
        ...nextBody,
      });
      expect(patched.status).toBe(200);
      expect(patched.body).toMatchObject({ version: 2, revision: 1, status: 'DRAFT' });

      const publishedV2 = await publishTemplate(fixture, patched.body.id, patched.body.revision);
      expect(publishedV2.status).toBe(200);
      expect(publishedV2.body).toMatchObject({ version: 2, revision: 2, status: 'PUBLISHED' });
      const listed = await request(fixture.app.getHttpServer()).get(
        `/v1/company/categories/${fixture.leaf.id}/template-versions`,
      );
      expect(listed.status).toBe(200);
      expect(listed.body.activeVersion).toBe(2);
      expect(listed.body.items.map(({ version, status }) => [version, status])).toEqual([
        [2, 'PUBLISHED'],
        [1, 'RETIRED'],
      ]);
      expect(listed.body.items[1]).toMatchObject({
        ...v1Snapshot,
        status: 'RETIRED',
        revision: 2,
        retiredAt: expect.any(String),
      });
      expect(listed.body.items[1].fieldSchema).toEqual(v1Snapshot.fieldSchema);
      expect(await fixture.templates.historyCount()).toBe(6);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-012-01/02 rejects invalid schemas and non-leaf, disabled or cross-company categories', async () => {
    const fixture = await createFixture();
    try {
      const duplicateFields = templateBody({
        fieldSchema: {
          ...templateBody().fieldSchema,
          fields: [
            templateBody().fieldSchema.fields[0],
            { ...templateBody().fieldSchema.fields[0], label: '重复字段' },
          ],
        },
      });
      for (const [categoryId, body, expectedCode] of [
        [fixture.leaf.id, duplicateFields, 'TEMPLATE_SCHEMA_INVALID'],
        [fixture.root.id, templateBody(), 'CATEGORY_NOT_LEAF'],
        [fixture.middle.id, templateBody(), 'CATEGORY_NOT_LEAF'],
        [fixture.disabledLeaf.id, templateBody(), 'CATEGORY_DISABLED'],
        [fixture.foreignLeaf.id, templateBody(), 'CATEGORY_NOT_FOUND'],
      ]) {
        const response = await createTemplate(fixture, categoryId, body);
        expect(response.status).toBe(expectedCode === 'CATEGORY_NOT_FOUND' ? 404 : 422);
        expect(response.body).toMatchObject({ code: expectedCode });
      }

      const danglingModule = templateBody({
        detailModules: { modules: [{ key: 'other', title: '错误模块', kind: 'FIELDS', sortWeight: 1 }] },
      });
      const dangling = await createTemplate(fixture, fixture.leaf.id, danglingModule);
      expect(dangling.status).toBe(422);
      expect(dangling.body).toMatchObject({ code: 'TEMPLATE_SCHEMA_INVALID' });
      expect(await fixture.templates.count()).toBe(0);
      expect(await fixture.templates.historyCount()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-012-03 rejects stale or published edits under concurrent publish attempts', async () => {
    const fixture = await createFixture();
    try {
      const created = await createTemplate(fixture, fixture.leaf.id);
      expect(created.status).toBe(201);
      const stale = await patchTemplate(fixture, created.body.id, {
        revision: 99,
        ...templateBody(),
      });
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT' });

      const attempts = await Promise.all(
        Array.from({ length: 4 }, (_, index) =>
          publishTemplate(fixture, created.body.id, 0, `template-publish-race-${index}`),
        ),
      );
      expect(attempts.filter(({ status }) => status === 200)).toHaveLength(1);
      expect(attempts.filter(({ status }) => status === 409)).toHaveLength(3);
      expect(await fixture.templates.publishedCount(fixture.leaf.id)).toBe(1);

      const immutable = await patchTemplate(fixture, created.body.id, {
        revision: 1,
        ...templateBody(),
      });
      expect(immutable.status).toBe(409);
      expect(immutable.body).toMatchObject({ code: 'TEMPLATE_IMMUTABLE' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-012-05 returns structured 503 and rolls back mandatory audit failures', async () => {
    const failed = await createFixture({ auditFail: true });
    try {
      const response = await createTemplate(failed, failed.leaf.id);
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'AUDIT_REQUIRED' });
      expect(await failed.templates.count()).toBe(0);
      expect(await failed.templates.historyCount()).toBe(0);
    } finally {
      await failed.app.close();
    }
  });

  it('NEG-M2-012-04 allows SupplierProduct only on the current published template version', async () => {
    const fixture = await createFixture();
    try {
      const beforePublish = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'template-product-before-publish')
        .send(productBody(fixture.leaf.id, 1, '发布前商品'));
      expect(beforePublish.status).toBe(422);
      expect(beforePublish.body).toMatchObject({ code: 'TEMPLATE_VERSION_INACTIVE' });

      const v1 = await createTemplate(fixture, fixture.leaf.id);
      await publishTemplate(fixture, v1.body.id, v1.body.revision);
      const productV1 = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'template-product-v1')
        .send(productBody(fixture.leaf.id, 1, '版本一商品'));
      expect(productV1.status).toBe(201);

      const v2 = await createTemplate(fixture, fixture.leaf.id);
      await publishTemplate(fixture, v2.body.id, v2.body.revision);
      const oldVersion = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'template-product-retired-v1')
        .send(productBody(fixture.leaf.id, 1, '退役版本商品'));
      expect(oldVersion.status).toBe(422);
      expect(oldVersion.body).toMatchObject({ code: 'TEMPLATE_VERSION_INACTIVE' });

      const staleSubmit = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier/products/${productV1.body.id}/submit-material`)
        .set('Idempotency-Key', 'template-product-submit-retired-v1')
        .send({ version: 0, requestId: randomUUID() });
      expect(staleSubmit.status).toBe(422);
      expect(staleSubmit.body).toMatchObject({ code: 'TEMPLATE_VERSION_INACTIVE' });
      expect((await fixture.products.getSupplierProduct(productV1.body.id)).status).toBe('DRAFT');

      const productV2 = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'template-product-v2')
        .send(productBody(fixture.leaf.id, 2, '版本二商品'));
      expect(productV2.status).toBe(201);
      expect(productV2.body).toMatchObject({ templateVersion: 2 });
    } finally {
      await fixture.app.close();
    }
  });

  it('defaults template management to deny and prevents category deletion after any version exists', async () => {
    const denied = await createFixture({ safeDefault: true });
    try {
      const response = await request(denied.app.getHttpServer()).get(
        `/v1/company/categories/${denied.leaf.id}/template-versions`,
      );
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    } finally {
      await denied.app.close();
    }

    const fixture = await createFixture();
    try {
      const created = await createTemplate(fixture, fixture.leaf.id);
      expect(created.status).toBe(201);
      const removed = await request(fixture.app.getHttpServer())
        .delete(`/v1/company/categories/${fixture.leaf.id}`)
        .query({ version: fixture.leaf.version })
        .set('Idempotency-Key', 'template-referenced-category-delete');
      expect(removed.status).toBe(409);
      expect(removed.body).toMatchObject({ code: 'CATEGORY_REFERENCED' });
    } finally {
      await fixture.app.close();
    }
  });
});
