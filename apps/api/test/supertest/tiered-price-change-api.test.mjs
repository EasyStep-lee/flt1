import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { InMemoryPriceChangeRepository } from '../../dist/price-changes/in-memory-price-change.repository.js';
import { InMemoryPriceEffectScheduler } from '../../dist/price-changes/price-effect.scheduler.js';

const skuId = '99999999-9999-4999-8999-999999999999';
const supplierId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const supplierActor = {
  role: 'SUPPLIER_PRICING',
  supplierId,
  identityId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  functionalAccountId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
};
const companyActor = {
  accountTypeCode: 'COMPANY_PRICE_REVIEW',
  companyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  identityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  functionalAccountId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  workspaceRoute: '/company-admin/workspaces/price-review',
};

const config = () => loadRuntimeConfig({
  NODE_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
  INFRA_HEALTH_TIMEOUT_MS: '50',
});
const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name,
  check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));

const applications = [];
const createFixture = async (options = {}) => {
  const audit = options.audit ?? new InMemoryAuditLogRepository();
  const priceChanges = new InMemoryPriceChangeRepository([{
    id: skuId,
    companyId: companyActor.companyId,
    supplierId,
    productName: '在售测试商品',
    code: 'SKU-PRICE-001',
    approvedSupplyPrice: 5_000,
    currentRetailSalePrice: 6_990,
    currentEnterpriseSalePrice: 6_200,
    supplyPriceVersion: 0,
    retailPriceVersion: 0,
    enterprisePriceVersion: 0,
  }], audit);
  const scheduler = new InMemoryPriceEffectScheduler(priceChanges);
  const app = await createApplication({
    config: config(),
    probes: probes(),
    supplierPricingActorResolver: { resolve: async () => ({ ...supplierActor }) },
    companyProductApprovalActorResolver: { resolve: async () => ({ ...companyActor, ...options.companyActor }) },
    supplierSecondVerifier: { verify: async ({ code }) => code === '246810' },
    companySecondVerifier: { verify: async ({ code }) => code === '135790' },
    auditLogRepository: audit,
    priceChangeRepository: priceChanges,
    priceEffectScheduler: scheduler,
    logger: false,
  });
  await app.init();
  applications.push(app);
  return { app, audit, priceChanges, scheduler };
};

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe('M2-P019 tiered post-listing price changes', () => {
  it('keeps the approved supply price unchanged until a different natural person approves', async () => {
    const { app, audit } = await createFixture();
    const submitted = await request(app.getHttpServer())
      .post(`/v1/supplier/pricing/skus/${skuId}/supply-price-change`)
      .set('Idempotency-Key', randomUUID())
      .send({
        requestedSupplyPrice: 5_400,
        reason: '原材料成本调整',
        effectiveAt: new Date(0).toISOString(),
        version: 0,
        secondVerificationCode: '246810',
      });

    expect(submitted.status).toBe(201);
    expect(submitted.body).toMatchObject({
      status: 'SUBMITTED',
      oldSupplyPrice: 5_000,
      requestedSupplyPrice: 5_400,
      currentApprovedSupplyPrice: 5_000,
    });

    const decided = await request(app.getHttpServer())
      .post(`/v1/company/price-reviews/${submitted.body.id}/decision`)
      .set('Idempotency-Key', randomUUID())
      .send({
        decision: 'APPROVE',
        opinion: '成本凭证与价格关系已核对',
        version: submitted.body.version,
        secondVerificationCode: '135790',
      });
    expect(decided.status).toBe(200);
    expect(decided.body).toMatchObject({
      approvalType: 'SUPPLY_PRICE_CHANGE',
      status: 'EFFECTIVE',
      currentApprovedSupplyPrice: 5_400,
    });
    expect(await audit.count()).toBe(2);
  });

  it('changes retail and enterprise prices without creating a price review', async () => {
    const { app } = await createFixture();
    const changed = await request(app.getHttpServer())
      .patch(`/v1/supplier/pricing/skus/${skuId}/sale-prices`)
      .set('Idempotency-Key', randomUUID())
      .send({
        retailSalePrice: 7_200,
        enterpriseSalePrice: 6_500,
        retailPriceVersion: 0,
        enterprisePriceVersion: 0,
        reason: '销售策略调整',
        effectiveAt: new Date(0).toISOString(),
        secondVerificationCode: '246810',
      });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      currentRetailSalePrice: 7_200,
      currentEnterpriseSalePrice: 6_500,
      reviewCreated: false,
    });
    const reviews = await request(app.getHttpServer())
      .get('/v1/company/price-reviews/supply-price-changes');
    expect(reviews.status).toBe(200);
    expect(reviews.body.total).toBe(0);
  });

  it('rejects client ownership fields and never exposes another supplier SKU', async () => {
    const { app } = await createFixture();
    const forbiddenOwner = await request(app.getHttpServer())
      .post(`/v1/supplier/pricing/skus/${skuId}/supply-price-change`)
      .set('Idempotency-Key', randomUUID())
      .send({
        supplierId,
        requestedSupplyPrice: 5_400,
        reason: '非法归属字段',
        effectiveAt: new Date(0).toISOString(),
        version: 0,
        secondVerificationCode: '246810',
      });
    expect(forbiddenOwner.status).toBe(403);
    expect(forbiddenOwner.body.code).toBe('SUPPLIER_SCOPE_FORBIDDEN');
  });

  it('replays the same command and rejects a changed payload under the same idempotency key', async () => {
    const { app } = await createFixture();
    const key = randomUUID();
    const payload = {
      retailSalePrice: 7_100,
      retailPriceVersion: 0,
      reason: '零售策略变更',
      effectiveAt: new Date(0).toISOString(),
      secondVerificationCode: '246810',
    };
    const first = await request(app.getHttpServer())
      .patch(`/v1/supplier/pricing/skus/${skuId}/sale-prices`)
      .set('Idempotency-Key', key)
      .send(payload);
    const replayed = await request(app.getHttpServer())
      .patch(`/v1/supplier/pricing/skus/${skuId}/sale-prices`)
      .set('Idempotency-Key', key)
      .send(payload);
    const conflict = await request(app.getHttpServer())
      .patch(`/v1/supplier/pricing/skus/${skuId}/sale-prices`)
      .set('Idempotency-Key', key)
      .send({ ...payload, retailSalePrice: 7_200 });

    expect(first.status).toBe(200);
    expect(replayed.status).toBe(200);
    expect(replayed.headers['idempotency-replayed']).toBe('true');
    expect(replayed.body.retailPriceVersion).toBe(1);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('allows only one concurrent pending supply-price request', async () => {
    const { app } = await createFixture();
    const payload = {
      requestedSupplyPrice: 5_300,
      reason: '并发成本调整',
      effectiveAt: new Date(0).toISOString(),
      version: 0,
      secondVerificationCode: '246810',
    };
    const results = await Promise.all([
      request(app.getHttpServer()).post(`/v1/supplier/pricing/skus/${skuId}/supply-price-change`).set('Idempotency-Key', randomUUID()).send(payload),
      request(app.getHttpServer()).post(`/v1/supplier/pricing/skus/${skuId}/supply-price-change`).set('Idempotency-Key', randomUUID()).send(payload),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(results.find((result) => result.status === 409).body.code).toBe('PRICE_CHANGE_PENDING');
  });

  it('forbids approval by the applicant natural person even through a company account', async () => {
    const { app } = await createFixture({ companyActor: { identityId: supplierActor.identityId } });
    const submitted = await request(app.getHttpServer())
      .post(`/v1/supplier/pricing/skus/${skuId}/supply-price-change`)
      .set('Idempotency-Key', randomUUID())
      .send({ requestedSupplyPrice: 5_300, reason: '同人审核测试', effectiveAt: new Date(0).toISOString(), version: 0, secondVerificationCode: '246810' });
    const decision = await request(app.getHttpServer())
      .post(`/v1/company/price-reviews/${submitted.body.id}/decision`)
      .set('Idempotency-Key', randomUUID())
      .send({ decision: 'APPROVE', opinion: '不得由同一自然人审核', version: submitted.body.version, secondVerificationCode: '135790' });
    expect(decision.status).toBe(403);
    expect(decision.body.code).toBe('SELF_APPROVAL_FORBIDDEN');
  });

  it('keeps future sale prices unchanged until the durable scheduled effect is due', async () => {
    const { app, priceChanges, scheduler } = await createFixture();
    const future = new Date(Date.now() + 60_000);
    const changed = await request(app.getHttpServer())
      .patch(`/v1/supplier/pricing/skus/${skuId}/sale-prices`)
      .set('Idempotency-Key', randomUUID())
      .send({ retailSalePrice: 7_300, retailPriceVersion: 0, reason: '预约销售价', effectiveAt: future.toISOString(), secondVerificationCode: '246810' });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ currentRetailSalePrice: 6_990, retailPriceVersion: 0, scheduled: true, reviewCreated: false });
    expect(scheduler.count()).toBe(1);
    await scheduler.flushDue(new Date(future.getTime() + 1));
    expect((await priceChanges.listSupplierSkus(supplierId))[0]).toMatchObject({ currentRetailSalePrice: 7_300, retailPriceVersion: 1 });
  });

  it('rolls back the mutation when durable audit evidence cannot be appended', async () => {
    const audit = new InMemoryAuditLogRepository({ failAppend: true });
    const { app, priceChanges } = await createFixture({ audit });
    const changed = await request(app.getHttpServer())
      .patch(`/v1/supplier/pricing/skus/${skuId}/sale-prices`)
      .set('Idempotency-Key', randomUUID())
      .send({ retailSalePrice: 7_300, retailPriceVersion: 0, reason: '审计失败回滚', effectiveAt: new Date(0).toISOString(), secondVerificationCode: '246810' });
    expect(changed.status).toBe(503);
    expect(changed.body.code).toBe('AUDIT_REQUIRED');
    expect((await priceChanges.listSupplierSkus(supplierId))[0]).toMatchObject({ currentRetailSalePrice: 6_990, retailPriceVersion: 0 });
  });
});
