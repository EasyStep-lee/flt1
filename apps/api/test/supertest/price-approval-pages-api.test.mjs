import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
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
  NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
  DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
});
const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));

const applications = [];
const createFixture = async () => {
  const repository = new InMemoryPriceChangeRepository([{
    id: skuId,
    companyId: companyActor.companyId,
    supplierId,
    productName: '在售测试商品',
    code: 'SKU-P071-001',
    approvedSupplyPrice: 5_000,
    currentRetailSalePrice: 6_990,
    currentEnterpriseSalePrice: 6_200,
    supplyPriceVersion: 0,
    retailPriceVersion: 0,
    enterprisePriceVersion: 0,
  }]);
  const app = await createApplication({
    config: config(), probes: probes(),
    supplierPricingActorResolver: { resolve: async () => ({ ...supplierActor }) },
    companyProductApprovalActorResolver: { resolve: async () => ({ ...companyActor }) },
    supplierSecondVerifier: { verify: async ({ code }) => code === '246810' },
    companySecondVerifier: { verify: async ({ code }) => code === '135790' },
    priceChangeRepository: repository,
    priceEffectScheduler: new InMemoryPriceEffectScheduler(repository),
    logger: false,
  });
  await app.init();
  applications.push(app);
  return app;
};

afterEach(async () => Promise.all(applications.splice(0).map((app) => app.close())));

describe('M2-P071 independent price and approval pages', () => {
  it('returns only the current supplier applications and a company-scoped opinion history', async () => {
    const app = await createFixture();
    const submitted = await request(app.getHttpServer())
      .post(`/v1/supplier/pricing/skus/${skuId}/supply-price-change`)
      .set('Idempotency-Key', randomUUID())
      .send({ requestedSupplyPrice: 5_400, reason: '原材料成本调整', effectiveAt: new Date(0).toISOString(), version: 0, secondVerificationCode: '246810' });
    expect(submitted.status).toBe(201);

    const supplierPage = await request(app.getHttpServer())
      .get('/v1/supplier/pricing/supply-price-changes');
    expect(supplierPage.status).toBe(200);
    expect(supplierPage.body).toMatchObject({ total: 1, items: [{ id: submitted.body.id, status: 'SUBMITTED' }] });
    expect(JSON.stringify(supplierPage.body)).not.toMatch(/supplierId|companyId|identityId|functionalAccountId/iu);

    const decided = await request(app.getHttpServer())
      .post(`/v1/company/price-reviews/supply-price-changes/${submitted.body.id}/decision`)
      .set('Idempotency-Key', randomUUID())
      .send({ decision: 'APPROVE', opinion: '成本凭证已核对', version: submitted.body.version, secondVerificationCode: '135790' });
    expect(decided.status).toBe(200);

    const history = await request(app.getHttpServer())
      .get(`/v1/company/price-reviews/supply-price-changes/${submitted.body.id}/history`);
    expect(history.status).toBe(200);
    expect(history.body.items.map(({ event }) => event)).toEqual(['SUBMIT', 'APPROVE', 'EFFECT']);
    expect(history.body.items[1]).toMatchObject({ opinion: '成本凭证已核对', fromStatus: 'SUBMITTED', toStatus: 'APPROVED' });
    expect(JSON.stringify(history.body)).not.toMatch(/supplierId|companyId|identityId|functionalAccountId/iu);
  });

  it('does not accept an unreasoned batch decision shape', async () => {
    const app = await createFixture();
    const response = await request(app.getHttpServer())
      .post('/v1/company/price-reviews/supply-price-changes/batch/decision')
      .set('Idempotency-Key', randomUUID())
      .send({ taskIds: [randomUUID()], decision: 'APPROVE', opinion: '', secondVerificationCode: '135790' });
    expect([404, 422]).toContain(response.status);
  });

  it('replays one decision but lets only one different concurrent decision win', async () => {
    const app = await createFixture();
    const submitted = await request(app.getHttpServer())
      .post(`/v1/supplier/pricing/skus/${skuId}/supply-price-change`)
      .set('Idempotency-Key', randomUUID())
      .send({ requestedSupplyPrice: 5_400, reason: '并发审核测试', effectiveAt: new Date(0).toISOString(), version: 0, secondVerificationCode: '246810' });
    const key = randomUUID();
    const payload = { decision: 'APPROVE', opinion: '成本凭证已核对', version: submitted.body.version, secondVerificationCode: '135790' };
    const first = await request(app.getHttpServer())
      .post(`/v1/company/price-reviews/supply-price-changes/${submitted.body.id}/decision`)
      .set('Idempotency-Key', key)
      .send(payload);
    const replay = await request(app.getHttpServer())
      .post(`/v1/company/price-reviews/supply-price-changes/${submitted.body.id}/decision`)
      .set('Idempotency-Key', key)
      .send(payload);
    const stale = await request(app.getHttpServer())
      .post(`/v1/company/price-reviews/supply-price-changes/${submitted.body.id}/decision`)
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, decision: 'REJECT', opinion: '并发冲突决定' });

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('APPROVAL_STATE_INVALID');
  });
});
