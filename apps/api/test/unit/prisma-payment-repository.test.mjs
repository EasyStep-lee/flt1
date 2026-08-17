import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaPaymentRepository } from '../../dist/payments/prisma-payment.repository.js';

const clone = (value) => globalThis.structuredClone(value);

const notification = (overrides = {}) => ({
  notificationId: 'wechat-notification-repository-0001',
  outTradeNo: 'WP2026081400000000000000000001',
  wechatTransactionId: 'wechat-transaction-repository-0001',
  amount: 5800,
  tradeState: 'SUCCESS',
  verifiedAt: new Date('2026-08-14T05:00:00.000Z'),
  rawBodyHash: 'a'.repeat(64),
  ...overrides,
});

const fixture = ({ enterprise = false, paymentMethod = 'WECHAT_PAY', mixed = false, failAtOutbox = false } = {}) => {
  let tail = Promise.resolve();
  const state = {
    payment: {
      id: '71000000-0000-4000-8000-000000000001',
      orderId: '70000000-0000-4000-8000-000000000001',
      channel: 'WECHAT_PAY', amount: mixed ? 4000 : 5800, outTradeNo: 'WP2026081400000000000000000001',
      wechatTransactionId: null, status: 'PREPAY_CREATED', version: 1,
    },
    order: {
      id: '70000000-0000-4000-8000-000000000001',
      companyId: '10000000-0000-4000-8000-000000000001',
      consumerUserId: enterprise ? null : '10000000-0000-4000-8000-000000000002',
      enterpriseCustomerId: enterprise ? '10000000-0000-4000-8000-000000000029' : null,
      orderType: enterprise ? 'ENTERPRISE' : 'CONSUMER', cashAmount: mixed ? 4000 : 5800, totalAmount: 5800, welfareCardAmount: mixed ? 1800 : 0,
      welfareCardAccountId: mixed ? '60000000-0000-4000-8000-000000000001' : null,
      paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT', version: 0,
      enterpriseProcurementOrder: enterprise
        ? { buyerOrderId: '70000000-0000-4000-8000-000000000001', paymentMethod, remittanceReviewStatus: 'NOT_SUBMITTED', status: 'PENDING_PAYMENT', version: 0 }
        : null,
      items: [
        { id: '72000000-0000-4000-8000-000000000001', skuId: '30000000-0000-4000-8000-000000000001', supplierId: '20000000-0000-4000-8000-000000000001', quantity: 1 },
        { id: '72000000-0000-4000-8000-000000000002', skuId: '30000000-0000-4000-8000-000000000002', supplierId: '20000000-0000-4000-8000-000000000002', quantity: 2 },
      ],
      supplierFulfillments: [
        { id: '73000000-0000-4000-8000-000000000001', supplierId: '20000000-0000-4000-8000-000000000001', status: 'PENDING_PAYMENT' },
        { id: '73000000-0000-4000-8000-000000000002', supplierId: '20000000-0000-4000-8000-000000000002', status: 'PENDING_PAYMENT' },
      ],
    },
    balances: new Map([
      ['30000000-0000-4000-8000-000000000001', { id: '74000000-0000-4000-8000-000000000001', availableQty: 4, reservedQty: 1, soldQty: 0, damagedQty: 0, version: 1 }],
      ['30000000-0000-4000-8000-000000000002', { id: '74000000-0000-4000-8000-000000000002', availableQty: 3, reservedQty: 2, soldQty: 0, damagedQty: 0, version: 1 }],
    ]),
    logs: [
      { id: 'reserve-1', skuId: '30000000-0000-4000-8000-000000000001', referenceType: 'ORDER_RESERVATION', referenceId: '70000000-0000-4000-8000-000000000001' },
      { id: 'reserve-2', skuId: '30000000-0000-4000-8000-000000000002', referenceType: 'ORDER_RESERVATION', referenceId: '70000000-0000-4000-8000-000000000001' },
    ],
    account: mixed ? { id: '60000000-0000-4000-8000-000000000001', status: 'ACTIVE', balanceAmount: 3000, frozenAmount: 2000, version: 1 } : null,
    ledgers: [], notifications: new Map(), inventoryCommands: [], events: [], outboxes: [],
  };
  const findPayment = (where, includeOrder = false) => {
    const matches = where.id === state.payment.id || where.outTradeNo === state.payment.outTradeNo ||
      (where.wechatTransactionId && where.wechatTransactionId === state.payment.wechatTransactionId);
    if (!matches) return null;
    return includeOrder ? { ...clone(state.payment), order: clone(state.order) } : clone(state.payment);
  };
  const tx = {
    paymentNotification: {
      findUnique: async ({ where }) => clone(state.notifications.get(where.notificationId) ?? null),
      create: async ({ data }) => {
        if (state.notifications.has(data.notificationId)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        state.notifications.set(data.notificationId, clone(data));
        return clone(data);
      },
    },
    paymentTransaction: {
      findUnique: async ({ where, include }) => findPayment(where, Boolean(include?.order)),
      updateMany: async ({ where, data }) => {
        if (state.payment.id !== where.id || state.payment.version !== where.version || state.payment.status !== where.status) return { count: 0 };
        Object.assign(state.payment, {
          status: data.status, wechatTransactionId: data.wechatTransactionId,
          notifyVerifiedAt: data.notifyVerifiedAt, paidAt: data.paidAt,
          version: state.payment.version + (data.version?.increment ?? 0),
        });
        return { count: 1 };
      },
    },
    inventoryChangeLog: {
      findFirst: async ({ where }) => clone(state.logs.find((item) =>
        item.skuId === where.skuId && item.referenceType === where.referenceType && item.referenceId === where.referenceId,
      ) ?? null),
      create: async ({ data }) => { state.logs.push(clone(data)); return clone(data); },
    },
    inventoryBalance: {
      findUnique: async ({ where }) => clone(state.balances.get(where.skuId) ?? null),
      updateMany: async ({ where, data }) => {
        const balance = [...state.balances.values()].find((item) => item.id === where.id);
        if (!balance || balance.version !== where.version || balance.reservedQty < where.reservedQty.gte) return { count: 0 };
        balance.reservedQty -= data.reservedQty.decrement;
        balance.soldQty += data.soldQty.increment;
        balance.version += data.version.increment;
        return { count: 1 };
      },
    },
    buyerOrder: {
      updateMany: async ({ where, data }) => {
        if (state.order.id !== where.id || state.order.version !== where.version || state.order.paymentStatus !== where.paymentStatus || state.order.orderStatus !== where.orderStatus) return { count: 0 };
        Object.assign(state.order, {
          externalPaymentMethod: data.externalPaymentMethod, paymentStatus: data.paymentStatus,
          orderStatus: data.orderStatus, version: state.order.version + data.version.increment,
        });
        return { count: 1 };
      },
    },
    welfareCardAccount: {
      findUnique: async ({ where }) => state.account && where.id === state.account.id ? clone(state.account) : null,
      updateMany: async ({ where, data }) => {
        if (!state.account || where.id !== state.account.id || where.version !== state.account.version || where.balanceAmount !== state.account.balanceAmount || where.frozenAmount !== state.account.frozenAmount) return { count: 0 };
        state.account.balanceAmount -= data.balanceAmount.decrement;
        state.account.frozenAmount -= data.frozenAmount.decrement;
        state.account.version += data.version.increment;
        return { count: 1 };
      },
    },
    welfareCardLedger: { create: async ({ data }) => { state.ledgers.push(clone(data)); return clone(data); } },
    enterpriseProcurementOrder: {
      updateMany: async ({ where, data }) => {
        const procurement = state.order.enterpriseProcurementOrder;
        if (!procurement || procurement.buyerOrderId !== where.buyerOrderId || procurement.version !== where.version || procurement.status !== where.status || procurement.paymentMethod !== where.paymentMethod) return { count: 0 };
        procurement.status = data.status;
        procurement.version += data.version.increment;
        return { count: 1 };
      },
    },
    supplierFulfillmentOrder: {
      updateMany: async ({ data }) => {
        for (const item of state.order.supplierFulfillments) item.status = data.status;
        return { count: state.order.supplierFulfillments.length };
      },
    },
    inventoryCommand: { create: async ({ data }) => { state.inventoryCommands.push(clone(data)); return clone(data); } },
    buyerOrderEvent: { create: async ({ data }) => { state.events.push(clone(data)); return clone(data); } },
    paymentOutbox: { create: async ({ data }) => { if (failAtOutbox) throw new Error('SIMULATED_MIXED_OUTBOX_FAILURE'); state.outboxes.push(clone(data)); return clone(data); } },
  };
  const prisma = {
    $transaction: async (callback) => {
      const beforeTurn = tail;
      let release;
      tail = new Promise((resolve) => { release = resolve; });
      await beforeTurn;
      const before = clone({
        payment: state.payment, order: state.order, balances: [...state.balances], logs: state.logs,
        account: state.account, ledgers: state.ledgers, notifications: [...state.notifications], inventoryCommands: state.inventoryCommands, events: state.events, outboxes: state.outboxes,
      });
      try { return await callback(tx); }
      catch (error) {
        Object.assign(state.payment, before.payment); Object.assign(state.order, before.order);
        state.balances = new Map(before.balances); state.logs = before.logs;
        state.account = before.account; state.ledgers = before.ledgers;
        state.notifications = new Map(before.notifications); state.inventoryCommands = before.inventoryCommands;
        state.events = before.events; state.outboxes = before.outboxes;
        throw error;
      } finally { release(); }
    },
    paymentNotification: { findUnique: async ({ where }) => clone(state.notifications.get(where.notificationId) ?? null) },
    paymentTransaction: { findUnique: async ({ where }) => findPayment(where, false) },
  };
  return { prisma, state };
};

test('M3-P024 Prisma callback transaction confirms every reserved SKU and appends one order event/outbox', async () => {
  const { prisma, state } = fixture();
  const repository = new PrismaPaymentRepository(prisma);
  const result = await repository.confirmWechatPayment({ notification: notification(), requestId: 'repository-paid-0001' });
  assert.deepEqual(result, {
    kind: 'PAID', orderId: state.order.id, paymentTransactionId: state.payment.id,
  });
  assert.equal(state.payment.status, 'PAID');
  assert.equal(state.order.paymentStatus, 'PAID');
  assert.equal(state.order.orderStatus, 'PAID');
  assert.deepEqual([...state.balances.values()].map(({ reservedQty, soldQty, version }) => ({ reservedQty, soldQty, version })), [
    { reservedQty: 0, soldQty: 1, version: 2 }, { reservedQty: 0, soldQty: 2, version: 2 },
  ]);
  assert.equal(state.logs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 2);
  assert.equal(state.inventoryCommands.length, 1);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].event, 'PAYMENT_CONFIRMED');
  assert.equal(state.outboxes.length, 1);
  assert.equal(state.outboxes[0].eventType, 'BUYER_ORDER_PAID_V1');
  assert.doesNotMatch(JSON.stringify(state.outboxes[0].payload), /supply|price|margin|payable|phone|address/iu);
});

test('M3-P024 duplicate and concurrent callbacks produce exactly one financial/inventory/outbox mutation', async () => {
  const { prisma, state } = fixture();
  const repository = new PrismaPaymentRepository(prisma);
  const results = await Promise.all([
    repository.confirmWechatPayment({ notification: notification(), requestId: 'concurrent-1' }),
    repository.confirmWechatPayment({ notification: notification(), requestId: 'concurrent-2' }),
  ]);
  assert.deepEqual(results.map(({ kind }) => kind).sort(), ['PAID', 'REPLAY']);
  assert.equal(state.logs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 2);
  assert.equal(state.inventoryCommands.length, 1);
  assert.equal(state.events.length, 1);
  assert.equal(state.outboxes.length, 1);

  const retry = await repository.confirmWechatPayment({
    notification: notification({ notificationId: 'wechat-notification-repository-0002' }),
    requestId: 'retry-new-notification-id',
  });
  assert.equal(retry.kind, 'REPLAY');
  assert.equal(state.notifications.size, 2);
  assert.equal(state.outboxes.length, 1);
});

test('M3-P024 amount and transaction conflicts fail closed before any order or inventory mutation', async () => {
  const first = fixture();
  const repository = new PrismaPaymentRepository(first.prisma);
  assert.deepEqual(
    await repository.confirmWechatPayment({ notification: notification({ amount: 5801 }), requestId: 'wrong-amount' }),
    { kind: 'AMOUNT_MISMATCH' },
  );
  assert.equal(first.state.payment.status, 'PREPAY_CREATED');
  assert.equal(first.state.logs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 0);
  assert.equal(first.state.outboxes.length, 0);
});

test('M3-P029 enterprise WeChat callback follows the frozen payment route and advances the procurement aggregate', async () => {
  const accepted = fixture({ enterprise: true, paymentMethod: 'WECHAT_PAY' });
  const repository = new PrismaPaymentRepository(accepted.prisma);
  assert.equal((await repository.confirmWechatPayment({ notification: notification(), requestId: 'enterprise-wechat-paid' })).kind, 'PAID');
  assert.equal(accepted.state.order.enterpriseProcurementOrder.status, 'PAID');

  const rejected = fixture({ enterprise: true, paymentMethod: 'BANK_TRANSFER' });
  const rejectedRepository = new PrismaPaymentRepository(rejected.prisma);
  assert.deepEqual(
    await rejectedRepository.confirmWechatPayment({ notification: notification(), requestId: 'enterprise-wrong-route' }),
    { kind: 'STATE_CONFLICT' },
  );
  assert.equal(rejected.state.order.enterpriseProcurementOrder.status, 'PENDING_PAYMENT');
  assert.equal(rejected.state.logs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 0);
});

test('M3-P056 mixed callback captures the frozen welfare amount exactly once after the WeChat difference succeeds', async () => {
  const { prisma, state } = fixture({ mixed: true });
  const repository = new PrismaPaymentRepository(prisma);
  const result = await repository.confirmWechatPayment({ notification: notification({ amount: 4000 }), requestId: 'mixed-paid' });
  assert.equal(result.kind, 'PAID');
  assert.deepEqual({ balance: state.account.balanceAmount, frozen: state.account.frozenAmount, version: state.account.version }, { balance: 1200, frozen: 200, version: 2 });
  assert.deepEqual(state.ledgers.map(({ businessType, amount, beforeBalance, afterBalance, beforeFrozen, afterFrozen }) => ({ businessType, amount, beforeBalance, afterBalance, beforeFrozen, afterFrozen })), [
    { businessType: 'CAPTURE', amount: 1800, beforeBalance: 3000, afterBalance: 1200, beforeFrozen: 2000, afterFrozen: 200 },
  ]);
  const replay = await repository.confirmWechatPayment({ notification: notification({ amount: 4000, notificationId: 'wechat-notification-repository-0002' }), requestId: 'mixed-replay' });
  assert.equal(replay.kind, 'REPLAY');
  assert.equal(state.ledgers.length, 1); assert.equal(state.outboxes.length, 1);
});

test('M3-P056 mixed callback rolls back welfare capture, order, inventory and outbox when a late write fails', async () => {
  const { prisma, state } = fixture({ mixed: true, failAtOutbox: true });
  const repository = new PrismaPaymentRepository(prisma);
  await assert.rejects(
    repository.confirmWechatPayment({ notification: notification({ amount: 4000 }), requestId: 'mixed-late-failure' }),
    /SIMULATED_MIXED_OUTBOX_FAILURE/u,
  );
  assert.deepEqual({ balance: state.account.balanceAmount, frozen: state.account.frozenAmount, version: state.account.version }, { balance: 3000, frozen: 2000, version: 1 });
  assert.equal(state.ledgers.length, 0);
  assert.equal(state.order.paymentStatus, 'PENDING'); assert.equal(state.payment.status, 'PREPAY_CREATED');
  assert.equal(state.logs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 0);
  assert.equal(state.outboxes.length, 0);
});
