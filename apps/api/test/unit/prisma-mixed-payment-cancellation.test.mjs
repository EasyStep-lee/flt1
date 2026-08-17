import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaPaymentRepository } from '../../dist/payments/prisma-payment.repository.js';

const clone = (value) => globalThis.structuredClone(value);
const paymentId = '71000000-0000-4000-8000-000000000001';
const orderId = '70000000-0000-4000-8000-000000000001';
const cancelKey = 'welfare-wechat-cancel-repository-0001';
const requestHash = 'c'.repeat(64);

const fixture = ({ failAtEvent = false } = {}) => {
  const state = {
    payment: { id: paymentId, orderId, amount: 4000, status: 'PREPAY_CREATED', version: 1 },
    order: {
      id: orderId, companyId: '10000000-0000-4000-8000-000000000001', orderType: 'CONSUMER',
      consumerUserId: '10000000-0000-4000-8000-000000000002', welfareCardAmount: 1800,
      welfareCardAccountId: '60000000-0000-4000-8000-000000000001', cashAmount: 4000, totalAmount: 5800,
      paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT', version: 1,
      items: [
        { skuId: '30000000-0000-4000-8000-000000000001', supplierId: '20000000-0000-4000-8000-000000000001', quantity: 1 },
        { skuId: '30000000-0000-4000-8000-000000000001', supplierId: '20000000-0000-4000-8000-000000000001', quantity: 2 },
        { skuId: '30000000-0000-4000-8000-000000000002', supplierId: '20000000-0000-4000-8000-000000000002', quantity: 2 },
      ],
      supplierFulfillments: [{ activationStatus: 'PENDING_PAYMENT', preparationStatus: 'PENDING' }, { activationStatus: 'PENDING_PAYMENT', preparationStatus: 'PENDING' }],
    },
    attempt: { paymentTransactionId: paymentId, idempotencyKey: cancelKey, requestHash, status: 'CREATED', responseSnapshot: null },
    account: { id: '60000000-0000-4000-8000-000000000001', balanceAmount: 3000, frozenAmount: 2000, version: 1 },
    balances: new Map([
      ['30000000-0000-4000-8000-000000000001', { id: 'balance-1', availableQty: 2, reservedQty: 3, soldQty: 0, damagedQty: 0, version: 1 }],
      ['30000000-0000-4000-8000-000000000002', { id: 'balance-2', availableQty: 3, reservedQty: 2, soldQty: 0, damagedQty: 0, version: 1 }],
    ]),
    logs: [
      { skuId: '30000000-0000-4000-8000-000000000001', referenceType: 'ORDER_RESERVATION', referenceId: orderId },
      { skuId: '30000000-0000-4000-8000-000000000002', referenceType: 'ORDER_RESERVATION', referenceId: orderId },
    ],
    ledgers: [], commands: [], events: [],
  };
  const tx = {
    paymentTransaction: {
      findUnique: async ({ where }) => where.id === state.payment.id
        ? { ...clone(state.payment), attempts: [clone(state.attempt)], order: clone(state.order) }
        : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== state.payment.id || where.version !== state.payment.version || where.status !== state.payment.status) return { count: 0 };
        state.payment.status = data.status;
        if (data.closedAt) state.payment.closedAt = data.closedAt;
        state.payment.version += data.version.increment;
        return { count: 1 };
      },
    },
    welfareCardAccount: {
      findUnique: async ({ where }) => where.id === state.account.id ? clone(state.account) : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== state.account.id || where.version !== state.account.version || where.frozenAmount !== state.account.frozenAmount) return { count: 0 };
        state.account.frozenAmount -= data.frozenAmount.decrement;
        state.account.version += data.version.increment;
        return { count: 1 };
      },
    },
    welfareCardLedger: { create: async ({ data }) => { state.ledgers.push(clone(data)); return clone(data); } },
    inventoryChangeLog: {
      findFirst: async ({ where }) => clone(state.logs.find((item) => item.skuId === where.skuId && item.referenceType === where.referenceType && item.referenceId === where.referenceId) ?? null),
      create: async ({ data }) => { state.logs.push(clone(data)); return clone(data); },
    },
    inventoryBalance: {
      findUnique: async ({ where }) => clone(state.balances.get(where.skuId) ?? null),
      updateMany: async ({ where, data }) => {
        const balance = [...state.balances.values()].find((item) => item.id === where.id);
        if (!balance || balance.version !== where.version || balance.reservedQty < where.reservedQty.gte) return { count: 0 };
        balance.availableQty += data.availableQty.increment;
        balance.reservedQty -= data.reservedQty.decrement;
        balance.version += data.version.increment;
        return { count: 1 };
      },
    },
    buyerOrder: {
      updateMany: async ({ where, data }) => {
        if (where.id !== state.order.id || where.version !== state.order.version || where.paymentStatus !== state.order.paymentStatus || where.orderStatus !== state.order.orderStatus) return { count: 0 };
        state.order.paymentStatus = data.paymentStatus;
        if (data.orderStatus) state.order.orderStatus = data.orderStatus;
        state.order.version += data.version.increment;
        return { count: 1 };
      },
    },
    supplierFulfillmentOrder: {
      updateMany: async ({ data }) => {
        for (const item of state.order.supplierFulfillments) Object.assign(item, data);
        return { count: state.order.supplierFulfillments.length };
      },
    },
    inventoryCommand: { create: async ({ data }) => { state.commands.push(clone(data)); return clone(data); } },
    buyerOrderEvent: { create: async ({ data }) => { if (failAtEvent) throw new Error('SIMULATED_CANCEL_EVENT_FAILURE'); state.events.push(clone(data)); return clone(data); } },
    paymentAttempt: {
      update: async ({ data }) => { Object.assign(state.attempt, clone(data)); return clone(state.attempt); },
    },
  };
  const prisma = {
    $transaction: async (callback) => {
      const before = clone({
        payment: state.payment, order: state.order, attempt: state.attempt, account: state.account,
        balances: [...state.balances], logs: state.logs, ledgers: state.ledgers, commands: state.commands, events: state.events,
      });
      try { return await callback(tx); }
      catch (error) {
        state.payment = before.payment; state.order = before.order; state.attempt = before.attempt; state.account = before.account;
        state.balances = new Map(before.balances); state.logs = before.logs; state.ledgers = before.ledgers; state.commands = before.commands; state.events = before.events;
        throw error;
      }
    },
  };
  return { prisma, state };
};

const command = (externalTradeState = 'CLOSED') => ({
  paymentTransactionId: paymentId, idempotencyKey: cancelKey, requestHash,
  requestId: 'repository-cancel-request-0001', externalTradeState,
});

test('M3-P057 explicit WeChat close atomically releases the frozen welfare amount and every reserved SKU once', async () => {
  const { prisma, state } = fixture();
  const repository = new PrismaPaymentRepository(prisma);
  const first = await repository.cancelWelfareCardWechatPayment(command());
  const replay = await repository.cancelWelfareCardWechatPayment(command());
  assert.equal(first.kind, 'CANCELLED');
  assert.deepEqual(replay, { kind: 'REPLAY', resolution: 'CANCELLED', orderId, paymentTransactionId: paymentId });
  assert.equal(state.payment.status, 'CLOSED');
  assert.equal(state.order.paymentStatus, 'CLOSED');
  assert.equal(state.order.orderStatus, 'CANCELLED');
  assert.equal(state.account.balanceAmount, 3000);
  assert.equal(state.account.frozenAmount, 200);
  assert.equal(state.ledgers.length, 1);
  assert.deepEqual({ businessType: state.ledgers[0].businessType, direction: state.ledgers[0].direction, amount: state.ledgers[0].amount }, { businessType: 'RELEASE', direction: 'CREDIT', amount: 1800 });
  assert.deepEqual([...state.balances.values()].map(({ availableQty, reservedQty }) => ({ availableQty, reservedQty })), [
    { availableQty: 5, reservedQty: 0 }, { availableQty: 5, reservedQty: 0 },
  ]);
  assert.equal(state.logs.filter(({ referenceType }) => referenceType === 'ORDER_RELEASE').length, 2);
  assert.equal(state.commands.length, 1);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].event, 'PAYMENT_CANCELLED');
  assert.ok(state.order.supplierFulfillments.every(({ activationStatus, preparationStatus }) => activationStatus === 'CANCELLED' && preparationStatus === 'CANCELLED'));
});

test('M3-P057 unknown WeChat state changes only recovery status and never releases welfare or inventory', async () => {
  const { prisma, state } = fixture();
  const repository = new PrismaPaymentRepository(prisma);
  const first = await repository.markWelfareCardWechatPaymentUnknown(command('USERPAYING'));
  const replay = await repository.markWelfareCardWechatPaymentUnknown(command('USERPAYING'));
  assert.equal(first.kind, 'UNKNOWN');
  assert.equal(replay.kind, 'UNKNOWN');
  assert.equal(state.payment.status, 'UNKNOWN');
  assert.equal(state.order.paymentStatus, 'UNKNOWN');
  assert.equal(state.order.orderStatus, 'PENDING_PAYMENT');
  assert.equal(state.account.frozenAmount, 2000);
  assert.equal(state.ledgers.length, 0);
  assert.equal(state.logs.filter(({ referenceType }) => referenceType === 'ORDER_RELEASE').length, 0);
  assert.equal(state.commands.length, 0);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].snapshot.fundsAndInventoryReleased, false);
});

test('M3-P057 a late audit failure rolls back account, inventory, order and payment together', async () => {
  const { prisma, state } = fixture({ failAtEvent: true });
  const repository = new PrismaPaymentRepository(prisma);
  await assert.rejects(repository.cancelWelfareCardWechatPayment(command()), /SIMULATED_CANCEL_EVENT_FAILURE/u);
  assert.equal(state.payment.status, 'PREPAY_CREATED');
  assert.equal(state.order.orderStatus, 'PENDING_PAYMENT');
  assert.equal(state.account.frozenAmount, 2000);
  assert.equal(state.ledgers.length, 0);
  assert.equal(state.logs.filter(({ referenceType }) => referenceType === 'ORDER_RELEASE').length, 0);
  assert.equal(state.commands.length, 0);
  assert.equal(state.events.length, 0);
});
