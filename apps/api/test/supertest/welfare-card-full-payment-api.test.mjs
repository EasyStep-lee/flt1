import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const otherConsumerUserId = '10000000-0000-4000-8000-000000000009';
const orderId = '70000000-0000-4000-8000-000000000001';
const accountId = '60000000-0000-4000-8000-000000000001';
const otherAccountId = '60000000-0000-4000-8000-000000000002';

const config = () => loadRuntimeConfig({
  NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
  DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
});
const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));
const actorResolver = {
  resolveConsumer: async (cookie) => cookie === '__Host-fulishe-consumer=active'
    ? { kind: 'CONSUMER', companyId, consumerUserId, status: 'ACTIVE' }
    : cookie === '__Host-fulishe-consumer=other'
      ? { kind: 'CONSUMER', companyId, consumerUserId: otherConsumerUserId, status: 'ACTIVE' }
      : cookie === '__Host-fulishe-consumer=suspended'
        ? { kind: 'CONSUMER', companyId, consumerUserId, status: 'SUSPENDED' }
        : null,
  resolveEnterprise: async () => null,
};

class RecordingFullPaymentRepository {
  constructor() {
    this.commands = new Map();
    this.paid = false;
    this.effects = { freezeLedger: 0, captureLedger: 0, allocations: 0, orderPaid: 0, inventoryConfirmed: 0, fulfillmentActivated: 0, outbox: 0, paymentTransactions: 0 };
  }

  async payFull(command) {
    if (command.orderId !== orderId) return { kind: 'NOT_FOUND' };
    if (command.consumerUserId !== consumerUserId) return { kind: 'ACCESS_DENIED' };
    const existing = this.commands.get(command.idempotencyKey);
    if (existing) return existing.requestHash === command.requestHash
      ? { kind: 'OK', replayed: true, value: existing.value }
      : { kind: 'IDEMPOTENCY_CONFLICT' };
    if (command.accountId === otherAccountId) return { kind: 'ACCOUNT_NOT_ELIGIBLE' };
    if (command.accountId.endsWith('0003')) return { kind: 'INSUFFICIENT_BALANCE' };
    if (this.paid) return { kind: 'STATE_CONFLICT' };
    const value = {
      orderId, orderNo: 'FS202608170000000001', paymentStatus: 'PAID', orderStatus: 'PAID',
      paymentMode: 'WELFARE_CARD', welfareCardAmount: 7_000, cashAmount: 0,
      paidAt: '2026-08-17T03:00:00.000Z', itemCount: 2, supplierFulfillmentCount: 2,
    };
    this.paid = true;
    this.commands.set(command.idempotencyKey, { requestHash: command.requestHash, value });
    Object.assign(this.effects, {
      freezeLedger: 1, captureLedger: 1, allocations: 2, orderPaid: 1,
      inventoryConfirmed: 2, fulfillmentActivated: 2, outbox: 1, paymentTransactions: 0,
    });
    return { kind: 'OK', replayed: false, value };
  }
}

class RecordingWechatAdapter {
  constructor() { this.prepayCalls = []; }
  async createPrepay(command) { this.prepayCalls.push(command); throw new Error('FULL_WELFARE_PAYMENT_MUST_NOT_CALL_WECHAT'); }
  async verifyNotification() { throw new Error('NOT_USED'); }
}

const applications = [];
const fixture = async () => {
  const welfareCardPaymentRepository = new RecordingFullPaymentRepository();
  const wechatPaymentAdapter = new RecordingWechatAdapter();
  const app = await createApplication({
    config: config(), probes: probes(), orderActorResolver: actorResolver,
    welfareCardPaymentRepository, wechatPaymentAdapter, logger: false,
  });
  await app.init();
  applications.push(app);
  return { app, welfareCardPaymentRepository, wechatPaymentAdapter };
};
afterEach(async () => Promise.all(applications.splice(0).map((app) => app.close())));

const pay = (app, {
  key = 'welfare-full-payment-0001', cookie = '__Host-fulishe-consumer=active',
  selectedAccountId = accountId, body = { accountId: selectedAccountId }, targetOrderId = orderId,
} = {}) => request(app.getHttpServer())
  .post(`/v1/consumer/orders/${targetOrderId}/welfare-card-full-payment`)
  .set('Cookie', cookie).set('Idempotency-Key', key).send(body);

describe('M3-P055 welfare-card full payment API', () => {
  it('pays an owned order fully by one welfare account without any external payment call', async () => {
    const { app, welfareCardPaymentRepository, wechatPaymentAdapter } = await fixture();
    const response = await pay(app).expect(201);
    expect(response.headers['cache-control']).toMatch(/private.*no-store/iu);
    expect(response.headers['x-robots-tag']).toMatch(/noindex/iu);
    expect(response.body).toEqual({
      orderId, orderNo: 'FS202608170000000001', paymentStatus: 'PAID', orderStatus: 'PAID',
      paymentMode: 'WELFARE_CARD', welfareCardAmount: 7_000, cashAmount: 0,
      paidAt: '2026-08-17T03:00:00.000Z', itemCount: 2, supplierFulfillmentCount: 2,
    });
    expect(welfareCardPaymentRepository.effects).toEqual({
      freezeLedger: 1, captureLedger: 1, allocations: 2, orderPaid: 1,
      inventoryConfirmed: 2, fulfillmentActivated: 2, outbox: 1, paymentTransactions: 0,
    });
    expect(wechatPaymentAdapter.prepayCalls).toHaveLength(0);
    expect(JSON.stringify(response.body)).not.toMatch(/supplyPrice|supplierPayable|companyId|consumerUserId|accountId|secret/iu);
  });

  it('replays one command exactly and makes concurrent duplicates side-effect free', async () => {
    const { app, welfareCardPaymentRepository } = await fixture();
    const first = await pay(app).expect(201);
    const replay = await pay(app).expect(200);
    expect(replay.body).toEqual(first.body);
    const concurrent = await Promise.all([
      pay(app, { key: 'welfare-full-payment-concurrent-0001' }),
      pay(app, { key: 'welfare-full-payment-concurrent-0001' }),
    ]);
    expect(concurrent.map(({ status }) => status).sort()).toEqual([409, 409]);
    expect(welfareCardPaymentRepository.effects.orderPaid).toBe(1);
    expect(welfareCardPaymentRepository.effects.freezeLedger).toBe(1);
    expect(welfareCardPaymentRepository.effects.captureLedger).toBe(1);
  });

  it('rejects missing or suspended sessions, owner injection, wrong owner, ineligible account and insufficient balance without writes', async () => {
    const { app, welfareCardPaymentRepository } = await fixture();
    await pay(app, { cookie: '' }).expect(401);
    await pay(app, { cookie: '__Host-fulishe-consumer=suspended' }).expect(403)
      .expect(({ body }) => expect(body.code).toBe('ACCOUNT_SUSPENDED'));
    await pay(app, { body: { accountId, consumerUserId } }).expect(422)
      .expect(({ body }) => expect(body.code).toBe('FIELD_FORBIDDEN'));
    await pay(app, { cookie: '__Host-fulishe-consumer=other' }).expect(403)
      .expect(({ body }) => expect(body.code).toBe('ACCESS_DENIED'));
    await pay(app, { selectedAccountId: otherAccountId }).expect(409)
      .expect(({ body }) => expect(body.code).toBe('WELFARE_CARD_NOT_ELIGIBLE'));
    await pay(app, { selectedAccountId: '60000000-0000-4000-8000-000000000003' }).expect(409)
      .expect(({ body }) => expect(body.code).toBe('WELFARE_CARD_INSUFFICIENT_BALANCE'));
    expect(welfareCardPaymentRepository.effects.orderPaid).toBe(0);
    expect(welfareCardPaymentRepository.effects.freezeLedger).toBe(0);
  });

  it('rejects invalid fields, changed idempotency payload and paid-state conflicts without double debit', async () => {
    const { app, welfareCardPaymentRepository } = await fixture();
    await pay(app, { body: {} }).expect(422).expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
    await pay(app, { selectedAccountId: 'not-a-uuid' }).expect(422).expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
    await pay(app).expect(201);
    await pay(app, { selectedAccountId: otherAccountId }).expect(409)
      .expect(({ body }) => expect(body.code).toBe('PAYMENT_IDEMPOTENCY_CONFLICT'));
    await pay(app, { key: 'welfare-full-payment-new-key-0001' }).expect(409)
      .expect(({ body }) => expect(body.code).toBe('PAYMENT_STATE_INVALID'));
    expect(welfareCardPaymentRepository.effects.orderPaid).toBe(1);
    expect(welfareCardPaymentRepository.effects.allocations).toBe(2);
  });
});
