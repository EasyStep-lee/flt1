import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const orderId = '70000000-0000-4000-8000-000000000001';
const accountId = '60000000-0000-4000-8000-000000000001';
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
    this.payment = null;
    this.notifications = new Map();
    this.effects = { freezes: 0, captures: 0, transactions: 0, allocations: 0, orderPaid: 0, outbox: 0 };
  }
  async beginWechatPrepay() { return { kind: 'STATE_CONFLICT' }; }
  async beginWelfareCardWechatPrepay(command) {
    if (command.orderId !== orderId) return { kind: 'NOT_FOUND' };
    if (command.actor.consumerUserId !== consumerUserId) return { kind: 'ACCESS_DENIED' };
    if (this.payment) return this.payment.idempotencyKey === command.idempotencyKey && this.payment.requestHash === command.requestHash
      ? { kind: 'REPLAY', payment: this.payment }
      : { kind: 'IDEMPOTENCY_CONFLICT' };
    this.payment = {
      paymentTransactionId, orderId, amount: 3_000, cashAmount: 3_000, welfareCardAmount: 4_000, totalAmount: 7_000,
      outTradeNo: 'WP2026081700000000000000000001', merchantConfigRef: 'secrets://wechat-pay/company-primary',
      collectorName: '江苏福礼团供应链科技有限公司', status: 'CREATED', idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
    };
    Object.assign(this.effects, { freezes: 1, transactions: 1, allocations: 2 });
    return { kind: 'NEEDS_PREPAY', payment: this.payment };
  }
  async completeWechatPrepay(command) {
    this.payment = { ...this.payment, status: 'PREPAY_CREATED', response: command.response };
    return { kind: 'COMPLETED', payment: this.payment };
  }
  async confirmWechatPayment({ notification }) {
    if (notification.amount !== this.payment.cashAmount) return { kind: 'AMOUNT_MISMATCH' };
    if (this.notifications.has(notification.notificationId)) return { kind: 'REPLAY', orderId, paymentTransactionId };
    this.notifications.set(notification.notificationId, notification);
    if (this.payment.status === 'PAID') return { kind: 'REPLAY', orderId, paymentTransactionId };
    this.payment = { ...this.payment, status: 'PAID' };
    Object.assign(this.effects, { captures: 1, orderPaid: 1, outbox: 1 });
    return { kind: 'PAID', orderId, paymentTransactionId };
  }
}

class Adapter {
  constructor() { this.prepayCalls = []; }
  async createPrepay(command) {
    this.prepayCalls.push(command);
    return { prepayId: 'mixed-prepay-1', clientPayment: { timeStamp: '1786666666', nonceStr: 'nonce', package: 'prepay_id=mixed-prepay-1', signType: 'RSA', paySign: 'test-signature' } };
  }
  async verifyNotification(_headers, body) {
    return { notificationId: body.id, outTradeNo: body.outTradeNo, wechatTransactionId: body.transactionId, amount: body.amount, tradeState: 'SUCCESS', verifiedAt: new Date('2026-08-17T05:00:00.000Z'), rawBodyHash: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
  }
}

const applications = [];
const fixture = async () => {
  const paymentRepository = new RecordingRepository();
  const wechatPaymentAdapter = new Adapter();
  const app = await createApplication({ config: config(), probes: probes(), orderActorResolver: actorResolver, paymentRepository, wechatPaymentAdapter, logger: false });
  await app.init(); applications.push(app);
  return { app, paymentRepository, wechatPaymentAdapter };
};
afterEach(async () => Promise.all(applications.splice(0).map((app) => app.close())));
const pay = (app, key = 'welfare-wechat-payment-0001', cookie = '__Host-fulishe-consumer=active', body = { accountId }) => request(app.getHttpServer())
  .post(`/v1/consumer/orders/${orderId}/welfare-card-wechat-payment`).set('Cookie', cookie).set('Idempotency-Key', key).send(body);

describe('M3-P056 welfare-card plus WeChat success API', () => {
  it('freezes the automatic maximum deduction and creates exactly one company WeChat prepay for the difference', async () => {
    const { app, paymentRepository, wechatPaymentAdapter } = await fixture();
    const first = await pay(app).expect(201);
    const replay = await pay(app).expect(200);
    expect(replay.body).toEqual(first.body);
    expect(first.body).toMatchObject({ paymentMode: 'WELFARE_CARD_WECHAT', welfareCardAmount: 4_000, cashAmount: 3_000, totalAmount: 7_000, amount: 3_000, collectorName: '江苏福礼团供应链科技有限公司' });
    expect(first.body.welfareCardAmount + first.body.cashAmount).toBe(first.body.totalAmount);
    expect(paymentRepository.effects).toMatchObject({ freezes: 1, transactions: 1, allocations: 2 });
    expect(wechatPaymentAdapter.prepayCalls).toHaveLength(1);
    expect(wechatPaymentAdapter.prepayCalls[0].amount).toBe(3_000);
    expect(JSON.stringify(first.body)).not.toMatch(/accountId|balanceAmount|companyId|consumerUserId|supplyPrice|merchantConfig/iu);
  });

  it('captures the frozen welfare amount only after the verified WeChat difference succeeds and replays callbacks without side effects', async () => {
    const { app, paymentRepository } = await fixture();
    await pay(app).expect(201);
    const notification = { id: 'mixed-notification-1', outTradeNo: 'WP2026081700000000000000000001', transactionId: 'mixed-transaction-1', amount: 3_000 };
    await request(app.getHttpServer()).post('/v1/payment-notifications/wechat').send(notification).expect(200);
    await request(app.getHttpServer()).post('/v1/payment-notifications/wechat').send(notification).expect(200);
    expect(paymentRepository.effects).toEqual({ freezes: 1, captures: 1, transactions: 1, allocations: 2, orderPaid: 1, outbox: 1 });
  });

  it('rejects owner fields, wrong owner and changed idempotency without additional freezes or transactions', async () => {
    const { app, paymentRepository } = await fixture();
    await pay(app, 'welfare-wechat-owner-field', '__Host-fulishe-consumer=active', { accountId, consumerUserId }).expect(422);
    await pay(app, 'welfare-wechat-wrong-owner', '__Host-fulishe-consumer=other').expect(403);
    await pay(app).expect(201);
    await pay(app, 'welfare-wechat-changed-key').expect(409);
    expect(paymentRepository.effects.freezes).toBe(1);
    expect(paymentRepository.effects.transactions).toBe(1);
  });
});
