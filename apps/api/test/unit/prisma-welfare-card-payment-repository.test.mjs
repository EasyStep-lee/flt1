import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaWelfareCardPaymentRepository } from '../../dist/welfare-card-payments/prisma-welfare-card-payment.repository.js';

const clone = (value) => globalThis.structuredClone(value);
const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const orderId = '70000000-0000-4000-8000-000000000001';
const accountId = '60000000-0000-4000-8000-000000000001';
const command = (overrides = {}) => ({
  companyId, consumerUserId, orderId, accountId,
  idempotencyKey: 'welfare-full-repository-0001', requestHash: 'a'.repeat(64), requestId: 'request-welfare-full-0001',
  ...overrides,
});

const fixture = ({ failAtOutbox = false } = {}) => {
  let tail = Promise.resolve();
  const state = {
    account: {
      id: accountId, consumerUserId, balanceAmount: 8_000, frozenAmount: 1_000, status: 'ACTIVE', version: 0,
      program: { companyId, scopeType: 'ALL_PRODUCTS', scopeRules: { schemaVersion: 1, includedIds: [], excludedIds: [] }, status: 'ACTIVE', complianceStatus: 'APPROVED' },
      batch: { companyId, status: 'ISSUED' },
      cardCode: { status: 'CLAIMED', claimedByConsumerUserId: consumerUserId },
    },
    order: {
      id: orderId, orderNo: 'FS202608170000000001', companyId, consumerUserId, orderType: 'CONSUMER',
      goodsAmount: 7_000, deliveryFee: 0, discountAmount: 0, totalAmount: 7_000,
      welfareCardAmount: 0, welfareCardAccountId: null, cashAmount: 7_000, externalPaymentMethod: null,
      paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT', version: 0,
      paymentTransactions: [], paymentAllocations: [],
      items: [
        { id: '72000000-0000-4000-8000-000000000001', lineNo: 1, skuId: '30000000-0000-4000-8000-000000000001', productId: '31000000-0000-4000-8000-000000000001', supplierId: '20000000-0000-4000-8000-000000000001', productSnapshot: { categoryId: '32000000-0000-4000-8000-000000000001' }, quantity: 1, lineAmount: 4_000 },
        { id: '72000000-0000-4000-8000-000000000002', lineNo: 2, skuId: '30000000-0000-4000-8000-000000000002', productId: '31000000-0000-4000-8000-000000000002', supplierId: '20000000-0000-4000-8000-000000000002', productSnapshot: { categoryId: '32000000-0000-4000-8000-000000000002' }, quantity: 1, lineAmount: 3_000 },
      ],
      supplierFulfillments: [
        { id: '73000000-0000-4000-8000-000000000001', buyerOrderId: orderId, supplierId: '20000000-0000-4000-8000-000000000001', activationStatus: 'PENDING_PAYMENT' },
        { id: '73000000-0000-4000-8000-000000000002', buyerOrderId: orderId, supplierId: '20000000-0000-4000-8000-000000000002', activationStatus: 'PENDING_PAYMENT' },
      ],
    },
    balances: new Map([
      ['30000000-0000-4000-8000-000000000001', { id: '74000000-0000-4000-8000-000000000001', availableQty: 4, reservedQty: 1, soldQty: 0, damagedQty: 0, version: 1 }],
      ['30000000-0000-4000-8000-000000000002', { id: '74000000-0000-4000-8000-000000000002', availableQty: 3, reservedQty: 1, soldQty: 0, damagedQty: 0, version: 1 }],
    ]),
    inventoryLogs: [
      { id: 'reserve-1', skuId: '30000000-0000-4000-8000-000000000001', referenceType: 'ORDER_RESERVATION', referenceId: orderId },
      { id: 'reserve-2', skuId: '30000000-0000-4000-8000-000000000002', referenceType: 'ORDER_RESERVATION', referenceId: orderId },
    ],
    ledgers: [], allocations: [], commands: new Map(), inventoryCommands: [], events: [], outboxes: [], paymentTransactions: [],
  };
  const commandLookup = (where) => {
    if (where.orderId) return [...state.commands.values()].find((entry) => entry.orderId === where.orderId) ?? null;
    const compound = where.companyId_consumerUserId_idempotencyKey;
    return compound ? state.commands.get(`${compound.companyId}:${compound.consumerUserId}:${compound.idempotencyKey}`) ?? null : null;
  };
  const tx = {
    welfareCardPaymentCommand: {
      findUnique: async ({ where }) => clone(commandLookup(where)),
      create: async ({ data }) => {
        const key = `${data.companyId}:${data.consumerUserId}:${data.idempotencyKey}`;
        if (state.commands.has(key) || [...state.commands.values()].some((entry) => entry.orderId === data.orderId)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        state.commands.set(key, clone(data)); return clone(data);
      },
    },
    buyerOrder: {
      findUnique: async ({ where }) => where.id === state.order.id ? clone(state.order) : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== state.order.id || where.version !== state.order.version || where.paymentStatus !== state.order.paymentStatus || where.orderStatus !== state.order.orderStatus) return { count: 0 };
        Object.assign(state.order, {
          welfareCardAmount: data.welfareCardAmount, welfareCardAccountId: data.welfareCardAccountId,
          cashAmount: data.cashAmount, externalPaymentMethod: data.externalPaymentMethod,
          paymentStatus: data.paymentStatus, orderStatus: data.orderStatus, version: state.order.version + data.version.increment,
        });
        return { count: 1 };
      },
    },
    welfareCardAccount: {
      findUnique: async ({ where }) => where.id === state.account.id ? clone(state.account) : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== state.account.id || where.version !== state.account.version || where.balanceAmount !== state.account.balanceAmount || where.frozenAmount !== state.account.frozenAmount) return { count: 0 };
        if (data.balanceAmount?.decrement) state.account.balanceAmount -= data.balanceAmount.decrement;
        if (data.frozenAmount?.increment) state.account.frozenAmount += data.frozenAmount.increment;
        if (data.frozenAmount?.decrement) state.account.frozenAmount -= data.frozenAmount.decrement;
        state.account.version += data.version.increment;
        return { count: 1 };
      },
    },
    welfareCardLedger: { create: async ({ data }) => { state.ledgers.push(clone(data)); return clone(data); } },
    orderPaymentAllocation: { createMany: async ({ data }) => { state.allocations.push(...clone(data)); return { count: data.length }; } },
    inventoryChangeLog: {
      findFirst: async ({ where }) => clone(state.inventoryLogs.find((entry) => entry.skuId === where.skuId && entry.referenceType === where.referenceType && entry.referenceId === where.referenceId) ?? null),
      create: async ({ data }) => { state.inventoryLogs.push(clone(data)); return clone(data); },
    },
    inventoryBalance: {
      findUnique: async ({ where }) => clone(state.balances.get(where.skuId) ?? null),
      updateMany: async ({ where, data }) => {
        const balance = [...state.balances.values()].find((entry) => entry.id === where.id);
        if (!balance || balance.version !== where.version || balance.reservedQty < where.reservedQty.gte) return { count: 0 };
        balance.reservedQty -= data.reservedQty.decrement; balance.soldQty += data.soldQty.increment; balance.version += data.version.increment;
        return { count: 1 };
      },
    },
    supplierFulfillmentOrder: {
      updateMany: async ({ where, data }) => {
        const matches = state.order.supplierFulfillments.filter((entry) => entry.buyerOrderId === where.buyerOrderId && entry.activationStatus === where.activationStatus);
        for (const entry of matches) entry.activationStatus = data.activationStatus;
        return { count: matches.length };
      },
    },
    inventoryCommand: { create: async ({ data }) => { state.inventoryCommands.push(clone(data)); return clone(data); } },
    buyerOrderEvent: { create: async ({ data }) => { state.events.push(clone(data)); return clone(data); } },
    paymentOutbox: { create: async ({ data }) => { if (failAtOutbox) throw new Error('SIMULATED_OUTBOX_FAILURE'); state.outboxes.push(clone(data)); return clone(data); } },
  };
  const prisma = {
    $transaction: async (callback) => {
      const previous = tail; let release;
      tail = new Promise((resolve) => { release = resolve; });
      await previous;
      const before = clone({
        account: state.account, order: state.order, balances: [...state.balances], inventoryLogs: state.inventoryLogs,
        ledgers: state.ledgers, allocations: state.allocations, commands: [...state.commands], inventoryCommands: state.inventoryCommands,
        events: state.events, outboxes: state.outboxes, paymentTransactions: state.paymentTransactions,
      });
      try { return await callback(tx); }
      catch (error) {
        state.account = before.account; state.order = before.order; state.balances = new Map(before.balances); state.inventoryLogs = before.inventoryLogs;
        state.ledgers = before.ledgers; state.allocations = before.allocations; state.commands = new Map(before.commands);
        state.inventoryCommands = before.inventoryCommands; state.events = before.events; state.outboxes = before.outboxes; state.paymentTransactions = before.paymentTransactions;
        throw error;
      } finally { release(); }
    },
    welfareCardPaymentCommand: { findUnique: async ({ where }) => clone(commandLookup(where)) },
  };
  return { prisma, state };
};

test('M3-P055 Prisma transaction freezes then captures, pays the order and confirms inventory without PaymentTransaction', async () => {
  const { prisma, state } = fixture();
  const repository = new PrismaWelfareCardPaymentRepository(prisma);
  const result = await repository.payFull(command());
  assert.equal(result.kind, 'OK'); assert.equal(result.replayed, false);
  assert.equal(state.account.balanceAmount, 1_000); assert.equal(state.account.frozenAmount, 1_000); assert.equal(state.account.version, 2);
  assert.deepEqual(state.ledgers.map(({ businessType, amount, beforeBalance, afterBalance, beforeFrozen, afterFrozen }) => ({ businessType, amount, beforeBalance, afterBalance, beforeFrozen, afterFrozen })), [
    { businessType: 'FREEZE', amount: 7_000, beforeBalance: 8_000, afterBalance: 8_000, beforeFrozen: 1_000, afterFrozen: 8_000 },
    { businessType: 'CAPTURE', amount: 7_000, beforeBalance: 8_000, afterBalance: 1_000, beforeFrozen: 8_000, afterFrozen: 1_000 },
  ]);
  assert.equal(state.allocations.length, 2); assert.equal(state.allocations.reduce((sum, entry) => sum + entry.welfareCardAmount + entry.cashAmount, 0), 7_000);
  assert.equal(state.order.paymentStatus, 'PAID'); assert.equal(state.order.orderStatus, 'PAID'); assert.equal(state.order.cashAmount, 0);
  assert.equal(state.inventoryLogs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 2);
  assert.equal(state.order.supplierFulfillments.every(({ activationStatus }) => activationStatus === 'ACTIVE'), true);
  assert.equal(state.events.length, 1); assert.equal(state.outboxes.length, 1); assert.equal(state.commands.size, 1);
  assert.equal(state.paymentTransactions.length, 0);
  assert.doesNotMatch(JSON.stringify(state.outboxes[0].payload), /supplyPrice|supplierPayable|margin|accountId|balanceAmount|consumerUserId/iu);
});

test('M3-P055 same-key concurrency produces one mutation and one exact replay', async () => {
  const { prisma, state } = fixture();
  const repository = new PrismaWelfareCardPaymentRepository(prisma);
  const results = await Promise.all([repository.payFull(command()), repository.payFull(command())]);
  assert.deepEqual(results.map((entry) => entry.kind), ['OK', 'OK']);
  assert.deepEqual(results.map((entry) => entry.replayed).sort(), [false, true]);
  assert.equal(state.ledgers.length, 2); assert.equal(state.allocations.length, 2); assert.equal(state.outboxes.length, 1); assert.equal(state.commands.size, 1);
});

test('M3-P055 a late transaction failure rolls back balances, ledger, allocation, inventory, order and outbox together', async () => {
  const { prisma, state } = fixture({ failAtOutbox: true });
  const repository = new PrismaWelfareCardPaymentRepository(prisma);
  await assert.rejects(repository.payFull(command()), /SIMULATED_OUTBOX_FAILURE/u);
  assert.deepEqual({ balance: state.account.balanceAmount, frozen: state.account.frozenAmount, version: state.account.version }, { balance: 8_000, frozen: 1_000, version: 0 });
  assert.equal(state.ledgers.length, 0); assert.equal(state.allocations.length, 0); assert.equal(state.commands.size, 0);
  assert.equal(state.inventoryLogs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 0);
  assert.equal(state.order.paymentStatus, 'PENDING'); assert.equal(state.order.orderStatus, 'PENDING_PAYMENT');
  assert.equal(state.outboxes.length, 0);
});

test('M3-P055 repository closes wrong-owner, scope and balance failures before any mutation', async () => {
  const owner = fixture();
  const repository = new PrismaWelfareCardPaymentRepository(owner.prisma);
  assert.deepEqual(await repository.payFull(command({ consumerUserId: '10000000-0000-4000-8000-000000000009' })), { kind: 'ACCESS_DENIED' });
  owner.state.account.program.scopeType = 'PRODUCT'; owner.state.account.program.scopeRules = { schemaVersion: 1, includedIds: ['31000000-0000-4000-8000-000000000001'], excludedIds: [] };
  assert.deepEqual(await repository.payFull(command()), { kind: 'ACCOUNT_NOT_ELIGIBLE' });
  owner.state.account.program.scopeType = 'ALL_PRODUCTS'; owner.state.account.program.scopeRules = { schemaVersion: 1, includedIds: [], excludedIds: [] }; owner.state.account.balanceAmount = 6_999; owner.state.account.frozenAmount = 0;
  assert.deepEqual(await repository.payFull(command()), { kind: 'INSUFFICIENT_BALANCE' });
  assert.equal(owner.state.ledgers.length, 0); assert.equal(owner.state.allocations.length, 0); assert.equal(owner.state.order.paymentStatus, 'PENDING');
});

test('M3-P055 repository rejects incomplete or pre-activated supplier fulfillment topology before any debit', async () => {
  const missing = fixture();
  missing.state.order.supplierFulfillments.pop();
  assert.deepEqual(await new PrismaWelfareCardPaymentRepository(missing.prisma).payFull(command()), { kind: 'STATE_CONFLICT' });
  assert.equal(missing.state.ledgers.length, 0);

  const preActivated = fixture();
  preActivated.state.order.supplierFulfillments[0].activationStatus = 'ACTIVE';
  assert.deepEqual(await new PrismaWelfareCardPaymentRepository(preActivated.prisma).payFull(command()), { kind: 'STATE_CONFLICT' });
  assert.equal(preActivated.state.ledgers.length, 0);
});
