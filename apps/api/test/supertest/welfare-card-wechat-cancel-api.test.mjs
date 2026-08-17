import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const orderId = '70000000-0000-4000-8000-000000000001';
const paymentTransactionId = '71000000-0000-4000-8000-000000000001';

const config = () => loadRuntimeConfig({
  NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
  DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
});
const probes = () => ['database', 'redis', 'queue'].map((name) => ({ name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }) }));
const actorResolver = {
  resolveConsumer: async (cookie) => cookie === '__Host-fulishe-consumer=active'
    ? { kind: 'CONSUMER', companyId, consumerUserId, status: 'ACTIVE' }
    : cookie === '__Host-fulishe-consumer=other'
      ? { kind: 'CONSUMER', companyId, consumerUserId: '10000000-0000-4000-8000-000000000009', status: 'ACTIVE' }
      : null,
  resolveEnterprise: async () => null,
};

class RecordingRepository {
  constructor() {
    this.effects = { released: 0, unknown: 0, paid: 0 };
    this.requests = new Map();
  }
  async beginWechatPrepay() { return { kind: 'STATE_CONFLICT' }; }
  async beginWelfareCardWechatPrepay() { return { kind: 'STATE_CONFLICT' }; }
  async completeWechatPrepay() { return { kind: 'STATE_CONFLICT' }; }
  async beginWelfareCardWechatCancellation(command) {
    if (command.orderId !== orderId) return { kind: 'NOT_FOUND' };
    if (command.actor.consumerUserId !== consumerUserId) return { kind: 'ACCESS_DENIED' };
    const existing = this.requests.get(command.idempotencyKey);
    if (existing) return existing.requestHash === command.requestHash ? { kind: 'QUERY_REQUIRED', payment: existing.payment } : { kind: 'IDEMPOTENCY_CONFLICT' };
    if (this.requests.size > 0) return { kind: 'IDEMPOTENCY_CONFLICT' };
    const payment = {
      paymentTransactionId, orderId, outTradeNo: 'WP2026081700000000000000000001', amount: 3_000,
      merchantConfigRef: 'secrets://wechat-pay/company-primary', collectorName: '江苏福礼团供应链科技有限公司', status: 'PREPAY_CREATED',
    };
    this.requests.set(command.idempotencyKey, { requestHash: command.requestHash, payment });
    return { kind: 'QUERY_REQUIRED', payment };
  }
  async cancelWelfareCardWechatPayment() {
    if (this.resolution === 'CANCELLED') return { kind: 'REPLAY', resolution: 'CANCELLED', orderId, paymentTransactionId };
    this.effects.released += 1;
    this.resolution = 'CANCELLED';
    return { kind: 'CANCELLED', orderId, paymentTransactionId };
  }
  async markWelfareCardWechatPaymentUnknown() {
    this.effects.unknown += 1;
    return { kind: 'UNKNOWN', orderId, paymentTransactionId };
  }
  async confirmWechatPayment() {
    this.effects.paid += 1;
    return { kind: 'PAID', orderId, paymentTransactionId };
  }
}

class Adapter {
  constructor(queryResult, closeResult = { kind: 'CLOSED' }) {
    this.queryResult = queryResult;
    this.closeResult = closeResult;
    this.queryCalls = [];
    this.closeCalls = [];
  }
  async createPrepay() { throw new Error('NOT_USED'); }
  async verifyNotification() { throw new Error('NOT_USED'); }
  async queryTransaction(command) { this.queryCalls.push(command); return this.queryResult; }
  async closeTransaction(command) { this.closeCalls.push(command); return this.closeResult; }
}

const applications = [];
const fixture = async (queryResult, closeResult) => {
  const paymentRepository = new RecordingRepository();
  const wechatPaymentAdapter = new Adapter(queryResult, closeResult);
  const app = await createApplication({ config: config(), probes: probes(), orderActorResolver: actorResolver, paymentRepository, wechatPaymentAdapter, logger: false });
  await app.init(); applications.push(app);
  return { app, paymentRepository, wechatPaymentAdapter };
};
afterEach(async () => Promise.all(applications.splice(0).map((app) => app.close())));

const cancel = (app, key = 'welfare-wechat-cancel-0001', cookie = '__Host-fulishe-consumer=active', body = { reason: 'USER_CANCELLED' }) => request(app.getHttpServer())
  .post(`/v1/consumer/orders/${orderId}/welfare-card-wechat-payment/cancel`)
  .set('Cookie', cookie)
  .set('Idempotency-Key', key)
  .send(body);

describe('M3-P057 welfare-card plus WeChat cancellation API', () => {
  it('queries WeChat, closes an explicit NOTPAY transaction, then releases welfare and inventory exactly once', async () => {
    const { app, paymentRepository, wechatPaymentAdapter } = await fixture({ kind: 'NOT_PAID', tradeState: 'NOTPAY' });
    const first = await cancel(app).expect(200);
    const replay = await cancel(app).expect(200);
    expect(first.body).toEqual({ resolution: 'CANCELLED', orderId, paymentStatus: 'CLOSED', orderStatus: 'CANCELLED', retriable: false });
    expect(replay.body).toEqual(first.body);
    expect(wechatPaymentAdapter.queryCalls).toHaveLength(2);
    expect(wechatPaymentAdapter.closeCalls).toHaveLength(2);
    expect(paymentRepository.effects).toEqual({ released: 1, unknown: 0, paid: 0 });
    expect(JSON.stringify(first.body)).not.toMatch(/account|balance|companyId|consumerUserId|supplyPrice|merchantConfig/iu);
  });

  it.each([
    [{ kind: 'PENDING', tradeState: 'USERPAYING' }],
    [{ kind: 'UNKNOWN' }],
  ])('keeps funds and inventory frozen when WeChat is pending or unknown', async (queryResult) => {
    const { app, paymentRepository, wechatPaymentAdapter } = await fixture(queryResult);
    const response = await cancel(app, `welfare-wechat-unknown-${queryResult.kind.toLowerCase()}`).expect(200);
    expect(response.body).toEqual({ resolution: 'UNKNOWN', orderId, paymentStatus: 'UNKNOWN', orderStatus: 'PENDING_PAYMENT', retriable: true });
    expect(wechatPaymentAdapter.closeCalls).toHaveLength(0);
    expect(paymentRepository.effects).toEqual({ released: 0, unknown: 1, paid: 0 });
  });

  it('confirms the existing payment chain instead of releasing when active query says paid', async () => {
    const verifiedAt = new Date('2026-08-17T07:00:00.000Z');
    const paidQuery = {
      kind: 'PAID', outTradeNo: 'WP2026081700000000000000000001', wechatTransactionId: 'wechat-paid-query-1',
      amount: 3_000, verifiedAt, rawBodyHash: createHash('sha256').update('query-paid').digest('hex'),
    };
    const { app, paymentRepository } = await fixture(paidQuery);
    const response = await cancel(app, 'welfare-wechat-paid-query').expect(200);
    expect(response.body).toEqual({ resolution: 'PAID', orderId, paymentStatus: 'PAID', orderStatus: 'PAID', retriable: false });
    expect(paymentRepository.effects).toEqual({ released: 0, unknown: 0, paid: 1 });
  });

  it('rejects owner fields, wrong owner and a changed idempotency command without querying or releasing', async () => {
    const { app, paymentRepository, wechatPaymentAdapter } = await fixture({ kind: 'UNKNOWN' });
    await cancel(app, 'welfare-wechat-owner-field', '__Host-fulishe-consumer=active', { reason: 'USER_CANCELLED', consumerUserId }).expect(422);
    await cancel(app, 'welfare-wechat-wrong-owner', '__Host-fulishe-consumer=other').expect(403);
    await cancel(app).expect(200);
    await cancel(app, 'welfare-wechat-changed-key', '__Host-fulishe-consumer=active', { reason: 'PAYMENT_TIMEOUT' }).expect(409);
    expect(wechatPaymentAdapter.queryCalls).toHaveLength(1);
    expect(paymentRepository.effects.released).toBe(0);
  });
});
