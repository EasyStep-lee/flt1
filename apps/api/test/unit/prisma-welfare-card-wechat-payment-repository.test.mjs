import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaPaymentRepository } from '../../dist/payments/prisma-payment.repository.js';

const clone = (value) => globalThis.structuredClone(value);
const orderId = '70000000-0000-4000-8000-000000000001';
const accountId = '60000000-0000-4000-8000-000000000001';
const command = () => ({
  orderId, accountId,
  actor: { kind: 'CONSUMER', companyId: '10000000-0000-4000-8000-000000000001', consumerUserId: '10000000-0000-4000-8000-000000000002', status: 'ACTIVE' },
  idempotencyKey: 'welfare-wechat-repository-0001', requestHash: 'a'.repeat(64), requestId: 'request-mixed-0001',
});

const fixture = () => {
  const state = {
    order: {
      id: orderId, companyId: '10000000-0000-4000-8000-000000000001', orderType: 'CONSUMER',
      consumerUserId: '10000000-0000-4000-8000-000000000002', enterpriseCustomerId: null,
      orderStatus: 'PENDING_PAYMENT', paymentStatus: 'PENDING', totalAmount: 7_000, goodsAmount: 7_000,
      welfareCardAmount: 0, welfareCardAccountId: null, cashAmount: 7_000, externalPaymentMethod: null,
      deliveryFee: 0, discountAmount: 0, version: 0,
      company: { legalName: '江苏福礼团供应链科技有限公司', wechatPayConfigRef: 'secrets://wechat-pay/company-primary' },
      items: [
        { id: '72000000-0000-4000-8000-000000000001', lineNo: 1, supplierId: '20000000-0000-4000-8000-000000000001', productId: '30000000-0000-4000-8000-000000000001', skuId: '40000000-0000-4000-8000-000000000001', lineAmount: 4_000, productSnapshot: { categoryId: '50000000-0000-4000-8000-000000000001' } },
        { id: '72000000-0000-4000-8000-000000000002', lineNo: 2, supplierId: '20000000-0000-4000-8000-000000000002', productId: '30000000-0000-4000-8000-000000000002', skuId: '40000000-0000-4000-8000-000000000002', lineAmount: 3_000, productSnapshot: { categoryId: '50000000-0000-4000-8000-000000000002' } },
      ],
      supplierFulfillments: [
        { supplierId: '20000000-0000-4000-8000-000000000001', activationStatus: 'PENDING_PAYMENT' },
        { supplierId: '20000000-0000-4000-8000-000000000002', activationStatus: 'PENDING_PAYMENT' },
      ], paymentAllocations: [],
    },
    account: {
      id: accountId, consumerUserId: '10000000-0000-4000-8000-000000000002', status: 'ACTIVE',
      balanceAmount: 4_000, frozenAmount: 0, version: 0,
      program: { companyId: '10000000-0000-4000-8000-000000000001', status: 'ACTIVE', complianceStatus: 'APPROVED', scopeType: 'ALL_PRODUCTS', scopeRules: { schemaVersion: 1, includedIds: [], excludedIds: [] } },
      batch: { companyId: '10000000-0000-4000-8000-000000000001', status: 'ISSUED' },
      cardCode: { status: 'CLAIMED', claimedByConsumerUserId: '10000000-0000-4000-8000-000000000002' },
    },
    payment: null, attempt: null, ledgers: [], allocations: [],
    inventoryLogs: [
      { skuId: '40000000-0000-4000-8000-000000000001', referenceType: 'ORDER_RESERVATION', referenceId: orderId },
      { skuId: '40000000-0000-4000-8000-000000000002', referenceType: 'ORDER_RESERVATION', referenceId: orderId },
    ],
  };
  const paymentWithIncludes = () => state.payment ? {
    ...clone(state.payment), attempts: state.attempt ? [clone(state.attempt)] : [],
    order: { company: clone(state.order.company) },
  } : null;
  const tx = {
    buyerOrder: {
      findUnique: async ({ where }) => where.id === orderId ? clone(state.order) : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== orderId || where.version !== state.order.version) return { count: 0 };
        Object.assign(state.order, {
          welfareCardAmount: data.welfareCardAmount, welfareCardAccountId: data.welfareCardAccountId,
          cashAmount: data.cashAmount, externalPaymentMethod: data.externalPaymentMethod,
          version: state.order.version + data.version.increment,
        });
        return { count: 1 };
      },
    },
    paymentTransaction: {
      findUnique: async () => paymentWithIncludes(),
      create: async ({ data }) => { state.payment = { ...clone(data), version: 0 }; return clone(state.payment); },
    },
    paymentAttempt: { create: async ({ data }) => { state.attempt = { ...clone(data), responseSnapshot: null, createdAt: new Date() }; return clone(state.attempt); } },
    welfareCardAccount: {
      findUnique: async ({ where }) => where.id === accountId ? clone(state.account) : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== accountId || where.version !== state.account.version || where.balanceAmount !== state.account.balanceAmount || where.frozenAmount !== state.account.frozenAmount) return { count: 0 };
        state.account.frozenAmount += data.frozenAmount.increment; state.account.version += data.version.increment;
        return { count: 1 };
      },
    },
    welfareCardLedger: { create: async ({ data }) => { state.ledgers.push(clone(data)); return clone(data); } },
    orderPaymentAllocation: { createMany: async ({ data }) => { state.allocations.push(...clone(data)); return { count: data.length }; } },
    inventoryChangeLog: { findFirst: async ({ where }) => clone(state.inventoryLogs.find((entry) => entry.skuId === where.skuId && entry.referenceType === where.referenceType && entry.referenceId === where.referenceId) ?? null) },
  };
  const prisma = {
    $transaction: async (callback) => callback(tx),
    paymentTransaction: { findUnique: async () => paymentWithIncludes() },
  };
  return { prisma, state };
};

test('M3-P056 begin transaction freezes the automatic maximum, splits lines and creates one WeChat difference transaction', async () => {
  const { prisma, state } = fixture();
  const repository = new PrismaPaymentRepository(prisma);
  const result = await repository.beginWelfareCardWechatPrepay(command());
  assert.equal(result.kind, 'NEEDS_PREPAY');
  assert.deepEqual({ welfare: result.payment.welfareCardAmount, cash: result.payment.cashAmount, total: result.payment.totalAmount, amount: result.payment.amount }, { welfare: 4_000, cash: 3_000, total: 7_000, amount: 3_000 });
  assert.equal(state.account.balanceAmount, 4_000); assert.equal(state.account.frozenAmount, 4_000);
  assert.deepEqual(state.ledgers.map(({ businessType, amount, beforeBalance, afterBalance, beforeFrozen, afterFrozen }) => ({ businessType, amount, beforeBalance, afterBalance, beforeFrozen, afterFrozen })), [
    { businessType: 'FREEZE', amount: 4_000, beforeBalance: 4_000, afterBalance: 4_000, beforeFrozen: 0, afterFrozen: 4_000 },
  ]);
  assert.equal(state.allocations.reduce((sum, entry) => sum + entry.welfareCardAmount, 0), 4_000);
  assert.equal(state.allocations.reduce((sum, entry) => sum + entry.cashAmount, 0), 3_000);
  assert.equal(state.order.welfareCardAmount + state.order.cashAmount, state.order.totalAmount);
  assert.equal(state.payment.amount, state.order.cashAmount);
});
