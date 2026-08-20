import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import {
  RefundAdapterError,
  UnavailableWelfareRefundAdapter,
} from '../../dist/refunds/refund.adapter.js';

const afterSaleId = '86000000-0000-4000-8000-000000000001';
const orderId = '87000000-0000-4000-8000-000000000001';
const orderItemId = '88000000-0000-4000-8000-000000000001';
const companyId = '10000000-0000-4000-8000-000000000001';
const originalWelfareCardAccountId = '89000000-0000-4000-8000-000000000001';
const originalPaymentTransactionId = '8a000000-0000-4000-8000-000000000001';
const originalWechatTotalAmount = 4000;

const config = () =>
  loadRuntimeConfig({
    NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
    DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
  });

const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));

const orderServiceActor = {
  accountTypeCode: 'COMPANY_ORDER_SERVICE',
  companyId,
  functionalAccountId: '8b000000-0000-4000-8000-000000000001',
  identityType: 'COMPANY_USER',
  identityId: '8c000000-0000-4000-8000-000000000001',
  workspaceRoute: '/company-admin/workspaces/order-service',
};

const actorResolver = {
  resolve: async (cookie) => cookie === '__Host-fulishe-company=order-service-session'
    ? orderServiceActor
    : cookie === '__Host-fulishe-company=same-reviewer-session'
      ? { ...orderServiceActor, identityId: '8d000000-0000-4000-8000-000000000001' }
      : cookie === '__Host-fulishe-company=other-company-session'
        ? { ...orderServiceActor, companyId: '10000000-0000-4000-8000-000000000009' }
        : null,
};

class RecordingRefundRepository {
  constructor({ invalidWechatTotal = false, unknownWechat = false, overpaid = false } = {}) {
    this.invalidWechatTotal = invalidWechatTotal;
    this.unknownWechat = unknownWechat;
    this.overpaid = overpaid;
    this.transaction = null;
    this.effects = { transaction: 0, financial: 0, inventory: 0, reconciliation: 0 };
  }

  async begin(command) {
    if (command.afterSaleId !== afterSaleId || command.actor.companyId !== companyId) return { kind: 'NOT_FOUND' };
    if (command.actor.identityId === '8d000000-0000-4000-8000-000000000001') return { kind: 'SAME_NATURAL_PERSON' };
    if (command.authorizationVersion !== 3) return { kind: 'VERSION_CONFLICT' };
    if (this.overpaid) return { kind: 'OVERPAID' };
    if (this.transaction) {
      return this.transaction.idempotencyKey === command.idempotencyKey && this.transaction.requestHash === command.requestHash
        ? { kind: this.transaction.status === 'UNKNOWN' ? 'REPLAY' : 'CONTINUE', refund: this.transaction }
        : { kind: 'IDEMPOTENCY_CONFLICT' };
    }
    this.transaction = {
      refundId: '8e000000-0000-4000-8000-000000000001', afterSaleId, orderId, orderItemId,
      refundNo: 'RF202608140000000000000001', status: 'PROCESSING', authorizationVersion: 3,
      welfareCardRefundAmount: 900, cashRefundAmount: 2000,
      welfareChannelStatus: 'PENDING', wechatChannelStatus: 'PENDING',
      originalWelfareCardAccountId, originalPaymentTransactionId,
      originalWechatOutTradeNo: 'WP2026081400000000000000000001',
      originalWechatTransactionId: 'wechat-transaction-original-0001',
      originalWechatTotalAmount: this.invalidWechatTotal ? 1500 : originalWechatTotalAmount,
      idempotencyKey: command.idempotencyKey, requestHash: command.requestHash,
    };
    this.effects = { transaction: 1, financial: 1, inventory: 1, reconciliation: 1 };
    return { kind: 'CREATED', refund: this.transaction };
  }

  async recordWelfareResult(_refundId, result) {
    this.transaction = {
      ...this.transaction,
      welfareChannelStatus: result,
      ...(result === 'UNKNOWN' ? { status: 'UNKNOWN' } : {}),
    };
    return this.transaction;
  }

  async claimChannel(_refundId, channel) {
    const key = channel === 'WELFARE' ? 'welfareChannelStatus' : 'wechatChannelStatus';
    if (this.transaction[key] === 'PROCESSING') return { kind: 'BUSY', refund: this.transaction };
    if (this.transaction[key] !== 'PENDING') return { kind: 'DONE', refund: this.transaction };
    this.transaction = { ...this.transaction, [key]: 'PROCESSING' };
    return { kind: 'CLAIMED', refund: this.transaction };
  }

  async recordWechatResult(_refundId, result) {
    const status = result === 'UNKNOWN' ? 'UNKNOWN' : 'SUCCEEDED';
    this.transaction = { ...this.transaction, wechatChannelStatus: result, status };
    return this.transaction;
  }
}

class RecordingWelfareRefundAdapter {
  constructor() { this.calls = []; }
  async refund(command) { this.calls.push(command); return { kind: 'SUCCEEDED' }; }
}

class RecordingWechatRefundAdapter {
  constructor(unknown = false, unavailable = false) {
    this.unknown = unknown;
    this.unavailable = unavailable;
    this.calls = [];
  }
  async refund(command) {
    this.calls.push(command);
    if (this.unavailable) {
      throw new RefundAdapterError(
        'EXTERNAL_SERVICE_UNAVAILABLE',
        'WeChat refund result could not be confirmed',
      );
    }
    return { kind: this.unknown ? 'UNKNOWN' : 'SUCCEEDED' };
  }
}

const createFixture = async (options = {}) => {
  const refundRepository = new RecordingRefundRepository(options);
  const welfareRefundAdapter = new RecordingWelfareRefundAdapter();
  const wechatRefundAdapter = new RecordingWechatRefundAdapter(
    options.unknownWechat,
    options.unavailableWechat,
  );
  const app = await createApplication({
    config: config(), probes: probes(), logger: false,
    refundRepository, refundActorResolver: actorResolver,
    welfareRefundAdapter, wechatRefundAdapter,
  });
  await app.init();
  return { app, refundRepository, welfareRefundAdapter, wechatRefundAdapter };
};

const refund = (app, {
  cookie = '__Host-fulishe-company=order-service-session',
  idempotencyKey = 'refund-original-structure-0001',
  body = { authorizationVersion: 3, reason: '客户退货，按已批准金额执行退款' },
} = {}) => request(app.getHttpServer())
  .post(`/v1/aftersales/${afterSaleId}/refund`)
  .set('Cookie', cookie)
  .set('Idempotency-Key', idempotencyKey)
  .send(body);

describe('P0-026 original payment structure refund', () => {
  it('returns welfare to the original account and WeChat cash to the original transaction exactly once', async () => {
    const fixture = await createFixture();
    try {
      const first = await refund(fixture.app).expect(201);
      const replay = await refund(fixture.app).expect(200);
      expect(first.headers['cache-control']).toMatch(/private.*no-store/iu);
      expect(first.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(first.body).toMatchObject({
        afterSaleId, orderId, orderItemId, status: 'SUCCEEDED',
        welfareCardRefundAmount: 900, cashRefundAmount: 2000,
        welfareChannelStatus: 'SUCCEEDED', wechatChannelStatus: 'SUCCEEDED',
      });
      expect(replay.body).toEqual(first.body);
      expect(fixture.welfareRefundAdapter.calls).toEqual([expect.objectContaining({
        refundAmount: 900, originalWelfareCardAccountId,
      })]);
      expect(fixture.wechatRefundAdapter.calls).toEqual([expect.objectContaining({
        refundAmount: 2000, originalPaymentTransactionId,
        originalWechatTransactionId: 'wechat-transaction-original-0001',
        originalWechatTotalAmount,
      })]);
      expect(fixture.refundRepository.effects).toEqual({
        transaction: 1, financial: 1, inventory: 1, reconciliation: 1,
      });
      expect(JSON.stringify(first.body)).not.toMatch(/companyId|identityId|accountId|paymentTransactionId|originalWechatTotalAmount|supplyPrice/iu);
    } finally { await fixture.app.close(); }
  });

  it('rejects ownership, self-review, changed idempotency and client-controlled allocation without side effects', async () => {
    const fixture = await createFixture();
    try {
      await refund(fixture.app, { cookie: '' }).expect(401);
      await refund(fixture.app, { cookie: '__Host-fulishe-company=other-company-session' }).expect(404);
      await refund(fixture.app, { cookie: '__Host-fulishe-company=same-reviewer-session' }).expect(409)
        .expect(({ body }) => expect(body.code).toBe('SAME_NATURAL_PERSON_REVIEW_FORBIDDEN'));
      await refund(fixture.app, { body: {
        authorizationVersion: 3, reason: '试图覆盖退款归属', cashRefundAmount: 1,
        welfareCardAccountId: originalWelfareCardAccountId,
      } }).expect(422).expect(({ body }) => expect(body.code).toBe('FIELD_FORBIDDEN'));
      expect(fixture.refundRepository.effects.transaction).toBe(0);

      await refund(fixture.app).expect(201);
      await refund(fixture.app, {
        idempotencyKey: 'refund-original-structure-0001',
        body: { authorizationVersion: 3, reason: '改变同一幂等键的请求内容' },
      }).expect(409).expect(({ body }) => expect(body.code).toBe('REFUND_DUPLICATE'));
      expect(fixture.refundRepository.effects.transaction).toBe(1);
    } finally { await fixture.app.close(); }
  });

  it('keeps an unknown WeChat result without initiating the external refund again on replay', async () => {
    const fixture = await createFixture({ unknownWechat: true });
    try {
      const first = await refund(fixture.app).expect(202);
      const replay = await refund(fixture.app).expect(200);
      expect(first.body.status).toBe('UNKNOWN');
      expect(replay.body).toEqual(first.body);
      expect(fixture.welfareRefundAdapter.calls).toHaveLength(1);
      expect(fixture.wechatRefundAdapter.calls).toHaveLength(1);
    } finally { await fixture.app.close(); }
  });

  it('fails closed on an invalid server-owned WeChat total before claiming or calling the channel', async () => {
    const fixture = await createFixture({ invalidWechatTotal: true });
    try {
      await refund(fixture.app).expect(409)
        .expect(({ body }) => expect(body.code).toBe('REFUND_ALLOCATION_INVALID'));
      await refund(fixture.app).expect(409)
        .expect(({ body }) => expect(body.code).toBe('REFUND_ALLOCATION_INVALID'));
      expect(fixture.refundRepository.transaction.wechatChannelStatus).toBe('PENDING');
      expect(fixture.wechatRefundAdapter.calls).toHaveLength(0);
    } finally { await fixture.app.close(); }
  });

  it('rejects cumulative over-refund and persists adapter exceptions as unknown without retrying', async () => {
    const overpaid = await createFixture({ overpaid: true });
    try {
      await refund(overpaid.app).expect(409)
        .expect(({ body }) => expect(body.code).toBe('REFUND_OVERPAID'));
      expect(overpaid.refundRepository.effects.transaction).toBe(0);
    } finally { await overpaid.app.close(); }

    const refundRepository = new RecordingRefundRepository();
    const app = await createApplication({
      config: config(), probes: probes(), logger: false,
      refundRepository, refundActorResolver: actorResolver,
      welfareRefundAdapter: new UnavailableWelfareRefundAdapter(),
    });
    await app.init();
    try {
      await refund(app).expect(503)
        .expect(({ body }) => expect(body.code).toBe('EXTERNAL_SERVICE_UNAVAILABLE'));
      await refund(app).expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe('UNKNOWN');
          expect(body.welfareChannelStatus).toBe('UNKNOWN');
          expect(body.wechatChannelStatus).toBe('PENDING');
        });
      expect(refundRepository.effects.transaction).toBe(1);
    } finally { await app.close(); }

    const wechatFailure = await createFixture({ unavailableWechat: true });
    try {
      await refund(wechatFailure.app).expect(503)
        .expect(({ body }) => expect(body.code).toBe('EXTERNAL_SERVICE_UNAVAILABLE'));
      await refund(wechatFailure.app).expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe('UNKNOWN');
          expect(body.welfareChannelStatus).toBe('SUCCEEDED');
          expect(body.wechatChannelStatus).toBe('UNKNOWN');
        });
      expect(wechatFailure.welfareRefundAdapter.calls).toHaveLength(1);
      expect(wechatFailure.wechatRefundAdapter.calls).toHaveLength(1);
    } finally { await wechatFailure.app.close(); }
  });

  it('claims each channel before external calls so concurrent duplicate requests never double-refund', async () => {
    const fixture = await createFixture();
    try {
      const [left, right] = await Promise.all([
        refund(fixture.app),
        refund(fixture.app),
      ]);
      expect([left.status, right.status].sort()).toEqual([200, 201]);
      expect(fixture.welfareRefundAdapter.calls).toHaveLength(1);
      expect(fixture.wechatRefundAdapter.calls).toHaveLength(1);
      expect(fixture.refundRepository.effects.transaction).toBe(1);
      await refund(fixture.app).expect(200)
        .expect(({ body }) => expect(body.status).toBe('SUCCEEDED'));
    } finally { await fixture.app.close(); }
  });
});
