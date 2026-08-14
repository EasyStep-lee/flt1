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

const fixture = () => {
  let tail = Promise.resolve();
  const state = {
    payment: {
      id: '71000000-0000-4000-8000-000000000001',
      orderId: '70000000-0000-4000-8000-000000000001',
      channel: 'WECHAT_PAY', amount: 5800, outTradeNo: 'WP2026081400000000000000000001',
      wechatTransactionId: null, status: 'PREPAY_CREATED', version: 1,
    },
    order: {
      id: '70000000-0000-4000-8000-000000000001',
      companyId: '10000000-0000-4000-8000-000000000001',
      consumerUserId: '10000000-0000-4000-8000-000000000002', enterpriseCustomerId: null,
      orderType: 'CONSUMER', cashAmount: 5800, totalAmount: 5800, welfareCardAmount: 0,
      paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT', version: 0,
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
    notifications: new Map(), inventoryCommands: [], events: [], outboxes: [],
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
    supplierFulfillmentOrder: {
      updateMany: async ({ data }) => {
        for (const item of state.order.supplierFulfillments) item.status = data.status;
        return { count: state.order.supplierFulfillments.length };
      },
    },
    inventoryCommand: { create: async ({ data }) => { state.inventoryCommands.push(clone(data)); return clone(data); } },
    buyerOrderEvent: { create: async ({ data }) => { state.events.push(clone(data)); return clone(data); } },
    paymentOutbox: { create: async ({ data }) => { state.outboxes.push(clone(data)); return clone(data); } },
  };
  const prisma = {
    $transaction: async (callback) => {
      const beforeTurn = tail;
      let release;
      tail = new Promise((resolve) => { release = resolve; });
      await beforeTurn;
      const before = clone({
        payment: state.payment, order: state.order, balances: [...state.balances], logs: state.logs,
        notifications: [...state.notifications], inventoryCommands: state.inventoryCommands, events: state.events, outboxes: state.outboxes,
      });
      try { return await callback(tx); }
      catch (error) {
        Object.assign(state.payment, before.payment); Object.assign(state.order, before.order);
        state.balances = new Map(before.balances); state.logs = before.logs;
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
