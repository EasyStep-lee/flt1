import { randomUUID } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { createApplication } from '../../dist/bootstrap.js';
import { InMemoryCategoryTemplateRepository } from '../../dist/category-templates/in-memory-category-template.repository.js';
import { InMemoryCategoryRepository } from '../../dist/categories/in-memory-category.repository.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemoryRegulatedCategoryRepository } from '../../dist/regulated-categories/in-memory-regulated-category.repository.js';
import { InMemorySupplierProductRepository } from '../../dist/supplier-products/in-memory-supplier-product.repository.js';

const company = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  legalName: '江苏福礼团供应链科技有限公司',
  platformName: '福礼团',
  status: 'ACTIVE',
};
const supplier = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  companyId: company.id,
  status: 'ACTIVE',
};

const templateBody = ({ compliant = true } = {}) => ({
  regulatoryMode: 'HIGH_RISK',
  profile: 'GENERIC',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [{
      key: 'approval-number', label: '批准文号', type: 'TEXT', required: true, unit: null,
      enumValues: [],
      validation: { min: null, max: null, minLength: 1, maxLength: 100, pattern: null },
      searchable: false, specification: false, detailModuleKey: 'qualifications',
    }],
  },
  skuDimensions: { dimensions: [] },
  qualificationRules: {
    rules: [{
      key: 'regulated-license', label: '强监管经营资质', required: true,
      expiryRequired: true, objectTypes: ['IMAGE', 'PDF'],
    }],
  },
  detailModules: {
    modules: compliant
      ? [
          { key: 'qualifications', title: '资质公示', kind: 'QUALIFICATIONS', sortWeight: 10 },
          { key: 'regulated-warning', title: '购买警示', kind: 'NOTICE', sortWeight: 20 },
        ]
      : [{ key: 'qualifications', title: '资质公示', kind: 'FIELDS', sortWeight: 10 }],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理售后。',
    evidenceRequirements: ['PACKAGE_PHOTO'],
  },
});

const productBody = (categoryId, name, qualificationValidUntil) => ({
  categoryId,
  templateVersion: 1,
  name,
  brand: null,
  attributes: { 'approval-number': 'TEST-ONLY-001' },
  qualificationReferences: ['object://supplier-product/regulated-license-test'],
  ...(qualificationValidUntil ? { qualificationValidUntil } : {}),
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: false,
  enterpriseMinOrderQty: 1,
  enterprisePackageMultiple: 1,
  preparationMinutes: 30,
  skus: [{ supplierSkuCode: `${name}-SKU`, attributes: {}, initialStock: 10 }],
});

const future = () => new Date(Date.now() + 86_400_000).toISOString();
const past = () => new Date(Date.now() - 86_400_000).toISOString();

describe('P0-018 regulated categories default to deny', () => {
  let app;
  let audit;
  let categories;
  let templates;
  let products;
  let regulated;
  let leaf;
  let invalidLeaf;

  beforeEach(async () => {
    audit = new InMemoryAuditLogRepository();
    categories = new InMemoryCategoryRepository({
      auditLogRepository: audit,
      companies: [company],
      suppliers: [supplier],
    });
    const root = await categories.seedForTest({
      companyId: company.id, parentId: null, name: '健康服务', level: 1, sortWeight: 10,
    });
    const middle = await categories.seedForTest({
      companyId: company.id, parentId: root.id, name: '强监管预留', level: 2, sortWeight: 10,
    });
    leaf = await categories.seedForTest({
      companyId: company.id, parentId: middle.id, name: '医疗器械预留', level: 3, sortWeight: 10,
    });
    invalidLeaf = await categories.seedForTest({
      companyId: company.id, parentId: middle.id, name: '无合规模板预留', level: 3, sortWeight: 20,
    });
    templates = new InMemoryCategoryTemplateRepository({
      auditLogRepository: audit,
      categoryRepository: categories,
    });
    products = new InMemorySupplierProductRepository({
      auditLogRepository: audit,
      companies: [company],
      suppliers: [supplier],
    });
    regulated = new InMemoryRegulatedCategoryRepository({ auditLogRepository: audit });
    app = await createApplication({
      config: loadRuntimeConfig({
        NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
        DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe',
        REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
        INFRA_HEALTH_TIMEOUT_MS: '50',
      }),
      probes: ['database', 'redis', 'queue'].map((name) => ({
        name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
      })),
      auditLogRepository: audit,
      categoryRepository: categories,
      categoryTemplateRepository: templates,
      supplierProductRepository: products,
      regulatedCategoryRepository: regulated,
      supplierProductActorResolver: {
        resolve: async () => ({
          role: 'SUPPLIER_PRODUCT', supplierId: supplier.id,
          identityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          functionalAccountId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        }),
      },
      companyProductApprovalActorResolver: {
        resolve: async () => ({
          accountTypeCode: 'COMPANY_PRODUCT_OPS', companyId: company.id,
          identityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          functionalAccountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          workspaceRoute: '/company-admin/workspaces/product-ops',
        }),
      },
      companySecondVerifier: { verify: async ({ code }) => code === '246810' },
      logger: false,
    });
    await app.listen(0, '127.0.0.1');

    for (const [category, body] of [[leaf, templateBody()], [invalidLeaf, templateBody({ compliant: false })]]) {
      const created = await request(app.getHttpServer())
        .post(`/v1/company/categories/${category.id}/template-versions`)
        .set('Idempotency-Key', randomUUID())
        .send(body);
      expect(created.status).toBe(201);
      const published = await request(app.getHttpServer())
        .post(`/v1/company/category-template-versions/${created.body.id}/publish`)
        .set('Idempotency-Key', randomUUID())
        .send({ revision: created.body.revision });
      expect(published.status).toBe(200);
    }
  });

  afterEach(async () => app?.close());

  it('NEG-M2-018-01 keeps a high-risk category disabled until explicit verified enablement', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/supplier/products')
      .set('Idempotency-Key', randomUUID())
      .send(productBody(leaf.id, '默认关闭商品', future()));
    expect(created.status).toBe(201);

    const denied = await request(app.getHttpServer())
      .post(`/v1/supplier/products/${created.body.id}/submit-material`)
      .set('Idempotency-Key', randomUUID())
      .send({ version: created.body.version, requestId: randomUUID() });
    expect(denied.status).toBe(409);
    expect(denied.body).toMatchObject({ code: 'REGULATED_CATEGORY_DISABLED' });

    const verificationDenied = await request(app.getHttpServer())
      .post(`/v1/company/regulated-category-controls/${leaf.id}/enable`)
      .set('Idempotency-Key', randomUUID())
      .send({
        version: 0,
        companyQualificationReferences: ['object://company-qualification/regulated-test'],
        qualificationValidUntil: future(),
        secondVerificationCode: '000000',
      });
    expect(verificationDenied.status).toBe(428);
    expect(verificationDenied.body).toMatchObject({ code: 'SECOND_VERIFICATION_REQUIRED' });

    const enabled = await request(app.getHttpServer())
      .post(`/v1/company/regulated-category-controls/${leaf.id}/enable`)
      .set('Idempotency-Key', 'regulated-enable-001')
      .send({
        version: 0,
        companyQualificationReferences: ['object://company-qualification/regulated-test'],
        qualificationValidUntil: future(),
        secondVerificationCode: '246810',
      });
    expect(enabled.status).toBe(200);
    expect(enabled.body).toMatchObject({
      categoryId: leaf.id,
      status: 'ENABLED',
      companyQualificationReferenceCount: 1,
      version: 1,
    });
    expect(JSON.stringify(enabled.body)).not.toMatch(/object:\/\/|companyId|identityId/iu);

    const replayed = await request(app.getHttpServer())
      .post(`/v1/company/regulated-category-controls/${leaf.id}/enable`)
      .set('Idempotency-Key', 'regulated-enable-001')
      .send({
        version: 0,
        companyQualificationReferences: ['object://company-qualification/regulated-test'],
        qualificationValidUntil: enabled.body.qualificationValidUntil,
        secondVerificationCode: '246810',
      });
    expect(replayed.status).toBe(200);
    expect(replayed.headers['idempotency-replayed']).toBe('true');
    expect(replayed.body).toEqual(enabled.body);

    const idempotencyConflict = await request(app.getHttpServer())
      .post(`/v1/company/regulated-category-controls/${leaf.id}/enable`)
      .set('Idempotency-Key', 'regulated-enable-001')
      .send({
        version: 0,
        companyQualificationReferences: ['object://company-qualification/other-test'],
        qualificationValidUntil: future(),
        secondVerificationCode: '246810',
      });
    expect(idempotencyConflict.status).toBe(409);
    expect(idempotencyConflict.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    const stale = await request(app.getHttpServer())
      .post(`/v1/company/regulated-category-controls/${leaf.id}/enable`)
      .set('Idempotency-Key', randomUUID())
      .send({
        version: 0,
        companyQualificationReferences: ['object://company-qualification/regulated-test'],
        qualificationValidUntil: future(),
        secondVerificationCode: '246810',
      });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(regulated.historyCount()).toBe(1);

    const enabledAudit = await audit.list({
      action: 'REGULATED_CATEGORY_ENABLED',
      objectType: 'REGULATED_CATEGORY_CONTROL',
      page: 1,
      pageSize: 20,
    });
    expect(enabledAudit.total).toBe(1);
    expect(JSON.stringify(enabledAudit.items[0].afterSnapshot)).not.toMatch(/object:\/\//iu);

    const accepted = await request(app.getHttpServer())
      .post(`/v1/supplier/products/${created.body.id}/submit-material`)
      .set('Idempotency-Key', randomUUID())
      .send({ version: created.body.version, requestId: randomUUID() });
    expect(accepted.status).toBe(201);

    const disabled = await request(app.getHttpServer())
      .post(`/v1/company/regulated-category-controls/${leaf.id}/disable`)
      .set('Idempotency-Key', randomUUID())
      .send({ version: enabled.body.version, reason: '资质复核暂停', secondVerificationCode: '246810' });
    expect(disabled.status).toBe(200);
    expect(disabled.body).toMatchObject({ status: 'DISABLED', version: 2 });
    expect(regulated.historyCount()).toBe(2);

    const approvalDenied = await request(app.getHttpServer())
      .post(`/v1/company/product-material-reviews/${accepted.body.id}/decision`)
      .set('Idempotency-Key', randomUUID())
      .send({ decision: 'APPROVE', opinion: '资料符合', version: accepted.body.version });
    expect(approvalDenied.status).toBe(409);
    expect(approvalDenied.body).toMatchObject({ code: 'REGULATED_CATEGORY_DISABLED' });
  });

  it('NEG-M2-018-02 rejects missing or expired company/product qualification snapshots', async () => {
    const expiredCompany = await request(app.getHttpServer())
      .post(`/v1/company/regulated-category-controls/${leaf.id}/enable`)
      .set('Idempotency-Key', randomUUID())
      .send({
        version: 0,
        companyQualificationReferences: ['object://company-qualification/expired-test'],
        qualificationValidUntil: past(),
        secondVerificationCode: '246810',
      });
    expect(expiredCompany.status).toBe(422);
    expect(expiredCompany.body).toMatchObject({ code: 'QUALIFICATION_REQUIRED' });

    await request(app.getHttpServer())
      .post(`/v1/company/regulated-category-controls/${leaf.id}/enable`)
      .set('Idempotency-Key', randomUUID())
      .send({
        version: 0,
        companyQualificationReferences: ['object://company-qualification/valid-test'],
        qualificationValidUntil: future(),
        secondVerificationCode: '246810',
      })
      .expect(200);

    for (const [name, validUntil] of [['缺有效期商品', undefined], ['资质过期商品', past()]]) {
      const created = await request(app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', randomUUID())
        .send(productBody(leaf.id, name, validUntil));
      expect(created.status).toBe(201);
      const denied = await request(app.getHttpServer())
        .post(`/v1/supplier/products/${created.body.id}/submit-material`)
        .set('Idempotency-Key', randomUUID())
        .send({ version: created.body.version, requestId: randomUUID() });
      expect(denied.status).toBe(422);
      expect(denied.body).toMatchObject({ code: 'QUALIFICATION_REQUIRED' });
    }
  });

  it('NEG-M2-018-03 rejects a high-risk product bound to a non-compliant published template', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/supplier/products')
      .set('Idempotency-Key', randomUUID())
      .send(productBody(invalidLeaf.id, '模板不合规商品', future()));
    expect(created.status).toBe(201);
    const denied = await request(app.getHttpServer())
      .post(`/v1/supplier/products/${created.body.id}/submit-material`)
      .set('Idempotency-Key', randomUUID())
      .send({ version: created.body.version, requestId: randomUUID() });
    expect(denied.status).toBe(422);
    expect(denied.body).toMatchObject({ code: 'CATEGORY_TEMPLATE_INVALID' });
  });
});
