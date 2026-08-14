import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { WechatPaymentAdapterError } from '../../dist/payments/wechat-payment.adapter.js';

const orderId = '70000000-0000-4000-8000-000000000001';
const paymentTransactionId = '71000000-0000-4000-8000-000000000001';
const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const merchantConfigRef = 'secrets://wechat-pay/company-primary';

const config = () =>
  loadRuntimeConfig({
    NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
    DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
  });

const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));

const actorResolver = {
  resolveConsumer: async (cookie) => cookie === '__Host-fulishe-consumer=consumer-session'
    ? { kind: 'CONSUMER', companyId, consumerUserId, status: 'ACTIVE' }
    : cookie === '__Host-fulishe-consumer=other-session'
      ? { kind: 'CONSUMER', companyId, consumerUserId: '10000000-0000-4000-8000-000000000009', status: 'ACTIVE' }
      : null,
  resolveEnterprise: async () => null,
};

class RecordingPaymentRepository {
  constructor() {
    this.payment = null;
    this.notifications = new Map();
    this.effects = { allocations: 0, orderPaid: 0, inventoryConfirmed: 0, fulfillmentActivated: 0, outbox: 0 };
  }

  async beginWechatPrepay(command) {
    if (command.orderId !== orderId) return { kind: 'NOT_FOUND' };
    if (command.actor.kind !== 'CONSUMER' || command.actor.consumerUserId !== consumerUserId) return { kind: 'ACCESS_DENIED' };
    if (this.payment) {
      if (this.payment.idempotencyKey !== command.idempotencyKey || this.payment.requestHash !== command.requestHash) {
        return { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      return this.payment.status === 'PREPAY_CREATED'
        ? { kind: 'REPLAY', payment: { ...this.payment, response: this.payment.response } }
        : { kind: 'NEEDS_PREPAY', payment: this.payment };
    }
    this.payment = {
      paymentTransactionId, orderId, amount: 5800, outTradeNo: 'WP2026081400000000000000000001',
      merchantConfigRef, collectorName: '江苏福礼团供应链科技有限公司',
      status: 'CREATED', idempotencyKey: command.idempotencyKey, requestHash: command.requestHash,
    };
    this.effects.allocations += 2;
    return { kind: 'NEEDS_PREPAY', payment: this.payment };
  }

  async completeWechatPrepay(command) {
    if (!this.payment || command.paymentTransactionId !== this.payment.paymentTransactionId) return { kind: 'STATE_CONFLICT' };
    if (command.idempotencyKey !== this.payment.idempotencyKey || command.requestHash !== this.payment.requestHash) {
      return { kind: 'IDEMPOTENCY_CONFLICT' };
    }
    if (this.payment.status === 'PREPAY_CREATED') return { kind: 'REPLAY', payment: this.payment };
    this.payment = { ...this.payment, status: 'PREPAY_CREATED', response: command.response };
    return { kind: 'COMPLETED', payment: this.payment };
  }

  async confirmWechatPayment({ notification }) {
    const duplicate = this.notifications.get(notification.notificationId);
    if (duplicate) return duplicate.rawBodyHash === notification.rawBodyHash
      ? { kind: 'REPLAY', orderId, paymentTransactionId }
      : { kind: 'TRANSACTION_CONFLICT' };
    if (!this.payment || notification.outTradeNo !== this.payment.outTradeNo) return { kind: 'NOT_FOUND' };
    if (notification.amount !== this.payment.amount) return { kind: 'AMOUNT_MISMATCH' };
    if (this.payment.status === 'PAID') {
      if (notification.wechatTransactionId !== this.payment.wechatTransactionId) return { kind: 'TRANSACTION_CONFLICT' };
      this.notifications.set(notification.notificationId, notification);
      return { kind: 'REPLAY', orderId, paymentTransactionId };
    }
    if (this.payment.status !== 'PREPAY_CREATED') return { kind: 'STATE_CONFLICT' };
    this.payment = { ...this.payment, status: 'PAID', wechatTransactionId: notification.wechatTransactionId };
    this.notifications.set(notification.notificationId, notification);
    this.effects.orderPaid += 1;
    this.effects.inventoryConfirmed += 2;
    this.effects.fulfillmentActivated += 2;
    this.effects.outbox += 1;
    return { kind: 'PAID', orderId, paymentTransactionId };
  }
}

class DeterministicWechatAdapter {
  constructor() { this.prepayCalls = []; this.verifyCalls = []; }

  async createPrepay(command) {
    this.prepayCalls.push(command);
    return {
      prepayId: 'wx-prepay-idempotent-0001',
      clientPayment: { timeStamp: '1786666666', nonceStr: 'nonce-0001', package: 'prepay_id=wx-prepay-idempotent-0001', signType: 'RSA', paySign: 'deterministic-test-signature' },
    };
  }

  async verifyNotification(_headers, body) {
    this.verifyCalls.push(body);
    if (body.signature !== 'verified-test-signature') {
      throw new WechatPaymentAdapterError('PAYMENT_NOTIFICATION_INVALID', 'Signature verification failed');
    }
    return {
      notificationId: body.id,
      outTradeNo: body.outTradeNo,
      wechatTransactionId: body.transactionId,
      amount: body.amount,
      tradeState: 'SUCCESS',
      verifiedAt: new Date('2026-08-14T05:00:00.000Z'),
      rawBodyHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    };
  }
}

const createFixture = async () => {
  const paymentRepository = new RecordingPaymentRepository();
  const wechatPaymentAdapter = new DeterministicWechatAdapter();
  const app = await createApplication({
    config: config(), probes: probes(), orderActorResolver: actorResolver,
    paymentRepository, wechatPaymentAdapter, logger: false,
  });
  await app.init();
  return { app, paymentRepository, wechatPaymentAdapter };
};

const prepay = (app, key = 'wechat-prepay-idempotent-0001', cookie = '__Host-fulishe-consumer=consumer-session') =>
  request(app.getHttpServer()).post(`/v1/orders/${orderId}/wechat-prepay`)
    .set('Cookie', cookie).set('Idempotency-Key', key).send({});

const callback = (app, overrides = {}) => request(app.getHttpServer())
  .post('/v1/payment-notifications/wechat')
  .send({
    id: 'wechat-notification-0001', signature: 'verified-test-signature',
    outTradeNo: 'WP2026081400000000000000000001', transactionId: 'wechat-transaction-0001', amount: 5800,
    ...overrides,
  });

describe('P0-024 WeChat payment idempotency', () => {
  it('creates one private WeChat prepay and replays the same business command', async () => {
    const { app, paymentRepository, wechatPaymentAdapter } = await createFixture();
    try {
      const first = await prepay(app).expect(201);
      const replay = await prepay(app).expect(200);
      expect(first.headers['cache-control']).toMatch(/private.*no-store/iu);
      expect(first.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(first.body).toMatchObject({
        orderId,
        paymentTransactionId,
        channel: 'WECHAT_PAY',
        status: 'PREPAY_CREATED',
        amount: 5800,
        collectorName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED',
      });
      expect(replay.body).toEqual(first.body);
      expect(wechatPaymentAdapter.prepayCalls).toHaveLength(1);
      expect(wechatPaymentAdapter.prepayCalls[0]).toMatchObject({
        merchantConfigRef,
        collectorLegalName: '江苏福礼团供应链科技有限公司',
      });
      expect(paymentRepository.effects.allocations).toBe(2);
      expect(JSON.stringify(first.body)).not.toMatch(/companyId|consumerUserId|supplyPrice|merchantConfig|secret/iu);
    } finally { await app.close(); }
  });

  it('processes the first verified callback once and makes repeat and concurrent deliveries side-effect free', async () => {
    const { app, paymentRepository } = await createFixture();
    try {
      await prepay(app).expect(201);
      await callback(app).expect(200).expect({ code: 'SUCCESS', message: '成功' });
      await callback(app).expect(200).expect({ code: 'SUCCESS', message: '成功' });
      await Promise.all([
        callback(app, { id: 'wechat-notification-0002' }).expect(200),
        callback(app, { id: 'wechat-notification-0003' }).expect(200),
      ]);
      expect(paymentRepository.effects).toEqual({
        allocations: 2, orderPaid: 1, inventoryConfirmed: 2, fulfillmentActivated: 2, outbox: 1,
      });
      expect(paymentRepository.notifications.size).toBe(3);
    } finally { await app.close(); }
  });

  it('rejects invalid signature, amount mismatch, wrong owner and changed idempotency without side effects', async () => {
    const { app, paymentRepository } = await createFixture();
    try {
      await prepay(app, 'wechat-prepay-no-session-0001', '').expect(401);
      await prepay(app, 'wechat-prepay-wrong-owner-0001', '__Host-fulishe-consumer=other-session').expect(403);
      await prepay(app).expect(201);
      await prepay(app, 'wechat-prepay-changed-key-0001').expect(409)
        .expect(({ body }) => expect(body.code).toBe('PAYMENT_IDEMPOTENCY_CONFLICT'));
      await callback(app, { signature: 'bad-signature' }).expect(401)
        .expect(({ body }) => expect(body.code).toBe('PAYMENT_NOTIFICATION_INVALID'));
      await callback(app, { id: 'wechat-notification-wrong-amount', amount: 5801 }).expect(409)
        .expect(({ body }) => expect(body.code).toBe('PAYMENT_AMOUNT_MISMATCH'));
      expect(paymentRepository.effects).toEqual({
        allocations: 2, orderPaid: 0, inventoryConfirmed: 0, fulfillmentActivated: 0, outbox: 0,
      });
    } finally { await app.close(); }
  });

  it('fails closed when the real WeChat adapter is absent', async () => {
    const paymentRepository = new RecordingPaymentRepository();
    const app = await createApplication({
      config: config(), probes: probes(), orderActorResolver: actorResolver, paymentRepository, logger: false,
    });
    await app.init();
    try {
      await prepay(app, 'wechat-prepay-no-adapter-0001').expect(503)
        .expect(({ body }) => expect(body.code).toBe('EXTERNAL_SERVICE_UNAVAILABLE'));
      expect(paymentRepository.effects.orderPaid).toBe(0);
    } finally { await app.close(); }
  });
});
