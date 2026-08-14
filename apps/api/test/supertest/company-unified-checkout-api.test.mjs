import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const enterpriseId = '20000000-0000-4000-8000-000000000001';
const enterpriseUserId = '21000000-0000-4000-8000-000000000001';
const orderId = '70000000-0000-4000-8000-000000000025';
const remittanceId = '75000000-0000-4000-8000-000000000025';

const config = () => loadRuntimeConfig({
  NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
  DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
});

const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));

const orderActorResolver = {
  resolveConsumer: async () => null,
  resolveEnterprise: async (cookie) => cookie === '__Host-fulishe-enterprise=enterprise-session'
    ? { kind: 'ENTERPRISE', companyId, enterpriseCustomerId: enterpriseId, enterpriseUserId, status: 'ACTIVE', permissions: ['PURCHASE'] }
    : cookie === '__Host-fulishe-enterprise=other-enterprise-session'
      ? { kind: 'ENTERPRISE', companyId, enterpriseCustomerId: '20000000-0000-4000-8000-000000000009', enterpriseUserId: '21000000-0000-4000-8000-000000000009', status: 'ACTIVE', permissions: ['PURCHASE'] }
      : null,
};

const companyFinanceActorResolver = {
  resolve: async (cookie) => cookie === '__Host-fulishe-company=finance-session'
    ? { companyId, functionalAccountId: '30000000-0000-4000-8000-000000000025', identityId: '31000000-0000-4000-8000-000000000025', accountTypeCode: 'COMPANY_FINANCE', workspaceRoute: '/company-admin/workspaces/finance' }
    : cookie === '__Host-fulishe-company=other-company-session'
      ? { companyId: '10000000-0000-4000-8000-000000000009', functionalAccountId: '30000000-0000-4000-8000-000000000099', identityId: '31000000-0000-4000-8000-000000000099', accountTypeCode: 'COMPANY_FINANCE', workspaceRoute: '/company-admin/workspaces/finance' }
      : null,
};

class RecordingRemittanceRepository {
  constructor() {
    this.remittance = null;
    this.reviews = new Map();
    this.effects = { orderPaid: 0, inventoryConfirmed: 0, fulfillmentActivated: 0, outbox: 0, delivery: 0 };
  }

  response() {
    return {
      remittanceId,
      orderId,
      orderNo: 'FS2026081400000025',
      sellerName: '江苏福礼团供应链科技有限公司',
      checkoutMode: 'COMPANY_UNIFIED',
      paymentMethod: 'BANK_TRANSFER',
      totalAmount: 5800,
      paymentStatus: this.remittance?.status === 'CONFIRMED' ? 'PAID' : 'PENDING',
      orderStatus: this.remittance?.status === 'CONFIRMED' ? 'PAID' : 'PENDING_PAYMENT',
      remittanceStatus: this.remittance?.status ?? 'PENDING_REVIEW',
      version: this.remittance?.version ?? 0,
      submittedAt: '2026-08-14T09:00:00.000Z',
      reviewedAt: this.remittance?.status === 'CONFIRMED' ? '2026-08-14T09:05:00.000Z' : null,
    };
  }

  async submit(command) {
    if (command.orderId !== orderId) return { kind: 'NOT_FOUND' };
    if (command.actor.enterpriseCustomerId !== enterpriseId) return { kind: 'ACCESS_DENIED' };
    if (command.amount !== 5800) return { kind: 'AMOUNT_MISMATCH' };
    if (this.remittance) {
      if (this.remittance.idempotencyKey === command.idempotencyKey) {
        return this.remittance.requestHash === command.requestHash
          ? { kind: 'REPLAY', remittance: this.response() }
          : { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      return { kind: 'ALREADY_SUBMITTED' };
    }
    this.remittance = { status: 'PENDING_REVIEW', version: 0, idempotencyKey: command.idempotencyKey, requestHash: command.requestHash };
    return { kind: 'SUBMITTED', remittance: this.response() };
  }

  async review(command) {
    if (command.orderId !== orderId || !this.remittance) return { kind: 'NOT_FOUND' };
    if (command.actor.companyId !== companyId) return { kind: 'ACCESS_DENIED' };
    const existing = this.reviews.get(command.idempotencyKey);
    if (existing) return existing.requestHash === command.requestHash
      ? { kind: 'REPLAY', remittance: this.response() }
      : { kind: 'IDEMPOTENCY_CONFLICT' };
    if (command.expectedVersion !== this.remittance.version) return { kind: 'VERSION_CONFLICT' };
    if (command.amount !== 5800) return { kind: 'AMOUNT_MISMATCH' };
    if (this.remittance.status !== 'PENDING_REVIEW') return { kind: 'STATE_CONFLICT' };
    this.remittance = { ...this.remittance, status: command.decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED', version: 1 };
    this.reviews.set(command.idempotencyKey, { requestHash: command.requestHash });
    if (command.decision === 'CONFIRM') {
      this.effects.orderPaid += 1;
      this.effects.inventoryConfirmed += 3;
      this.effects.fulfillmentActivated += 3;
      this.effects.outbox += 1;
    }
    return { kind: command.decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED', remittance: this.response() };
  }
}

const createFixture = async () => {
  const enterpriseRemittanceRepository = new RecordingRemittanceRepository();
  const app = await createApplication({
    config: config(), probes: probes(), orderActorResolver,
    companyFinanceActorResolver, enterpriseRemittanceRepository, logger: false,
  });
  await app.init();
  return { app, enterpriseRemittanceRepository };
};

const submit = (app, body = { amount: 5800, proofObjectKey: 'enterprise-remittance/2026/08/proof-0025.pdf' }, key = 'remittance-submit-00000025', cookie = '__Host-fulishe-enterprise=enterprise-session') =>
  request(app.getHttpServer()).post(`/v1/enterprise/orders/${orderId}/remittance-proof`)
    .set('Cookie', cookie).set('Idempotency-Key', key).send(body);

const review = (app, body = { decision: 'CONFIRM', amount: 5800, version: 0, reason: '银行流水与订单金额一致' }, key = 'remittance-review-00000025', cookie = '__Host-fulishe-company=finance-session') =>
  request(app.getHttpServer()).post(`/v1/company/enterprise-orders/${orderId}/remittance-review`)
    .set('Cookie', cookie).set('Idempotency-Key', key).send(body);

describe('P0-025 company unified customer checkout', () => {
  it('submits one private company bank-remittance proof and replays the same command', async () => {
    const { app } = await createFixture();
    try {
      const first = await submit(app).expect(201);
      const replay = await submit(app).expect(200);
      expect(first.headers['cache-control']).toMatch(/private.*no-store/iu);
      expect(first.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(first.body).toMatchObject({
        orderId, remittanceId, sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED', paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'PENDING', remittanceStatus: 'PENDING_REVIEW', totalAmount: 5800,
      });
      expect(replay.body).toEqual(first.body);
      expect(JSON.stringify(first.body)).not.toMatch(/supplierPrice|supplyPrice|supplierPayable|bankAccount|companyId|enterpriseCustomerId/iu);
    } finally { await app.close(); }
  });

  it('lets only company finance confirm exact funds once and activates no delivery object', async () => {
    const { app, enterpriseRemittanceRepository } = await createFixture();
    try {
      await submit(app).expect(201);
      const confirmed = await review(app).expect(200);
      const replay = await review(app).expect(200);
      expect(confirmed.body).toMatchObject({
        sellerName: '江苏福礼团供应链科技有限公司', checkoutMode: 'COMPANY_UNIFIED',
        paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PAID', orderStatus: 'PAID', remittanceStatus: 'CONFIRMED',
      });
      expect(replay.body).toEqual(confirmed.body);
      expect(enterpriseRemittanceRepository.effects).toEqual({
        orderPaid: 1, inventoryConfirmed: 3, fulfillmentActivated: 3, outbox: 1, delivery: 0,
      });
    } finally { await app.close(); }
  });

  it('rejects ALIPAY/client scope, wrong owner, amount mismatch, stale review and non-finance sessions without side effects', async () => {
    const { app, enterpriseRemittanceRepository } = await createFixture();
    try {
      await submit(app, { amount: 5800, proofObjectKey: 'enterprise-remittance/2026/08/proof-0025.pdf', channel: 'ALIPAY' }).expect(422)
        .expect(({ body }) => expect(body.code).toBe('FIELD_FORBIDDEN'));
      await submit(app, undefined, 'remittance-other-owner-00025', '__Host-fulishe-enterprise=other-enterprise-session').expect(403);
      await submit(app, { amount: 5801, proofObjectKey: 'enterprise-remittance/2026/08/proof-0025.pdf' }, 'remittance-wrong-amount-025').expect(409)
        .expect(({ body }) => expect(body.code).toBe('AMOUNT_MISMATCH'));
      await submit(app).expect(201);
      await review(app, undefined, 'remittance-no-finance-00025', '').expect(401);
      await review(app, undefined, 'remittance-other-company-025', '__Host-fulishe-company=other-company-session').expect(403);
      await review(app, { decision: 'CONFIRM', amount: 5801, version: 0, reason: '金额不匹配' }, 'remittance-review-amount-025').expect(409)
        .expect(({ body }) => expect(body.code).toBe('AMOUNT_MISMATCH'));
      await review(app, { decision: 'CONFIRM', amount: 5800, version: 1, reason: '使用过期版本' }, 'remittance-review-stale-0025').expect(409)
        .expect(({ body }) => expect(body.code).toBe('APPROVAL_VERSION_CONFLICT'));
      expect(enterpriseRemittanceRepository.effects).toEqual({
        orderPaid: 0, inventoryConfirmed: 0, fulfillmentActivated: 0, outbox: 0, delivery: 0,
      });
    } finally { await app.close(); }
  });
});
