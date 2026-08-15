import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaEnterpriseRemittanceRepository } from '../../dist/enterprise-remittances/prisma-enterprise-remittance.repository.js';

const clone = (value) => globalThis.structuredClone(value);
const orderId = '70000000-0000-4000-8000-000000000025';
const submissionId = '75000000-0000-4000-8000-000000000025';

const command = (overrides = {}) => ({
  orderId,
  actor: {
    accountTypeCode: 'COMPANY_FINANCE',
    companyId: '10000000-0000-4000-8000-000000000001',
    functionalAccountId: '30000000-0000-4000-8000-000000000025',
    identityId: '31000000-0000-4000-8000-000000000025',
    workspaceRoute: '/company-admin/workspaces/finance',
  },
  decision: 'CONFIRM',
  amount: 5800,
  expectedVersion: 0,
  reason: '银行流水与公司应收一致',
  idempotencyKey: 'repository-remittance-review-0025',
  requestHash: 'a'.repeat(64),
  requestId: 'repository-remittance-request-0025',
  ...overrides,
});

const fixture = () => {
  let tail = Promise.resolve();
  const state = {
    submission: {
      id: submissionId,
      buyerOrderId: orderId,
      submissionVersion: 1,
      amount: 5800,
      proofObjectKey: 'enterprise-remittance/2026/08/repository-0025.pdf',
      submittedByEnterpriseUserId: '21000000-0000-4000-8000-000000000001',
      idempotencyKey: 'repository-remittance-submit-0025',
      requestHash: 'b'.repeat(64),
      status: 'PENDING_REVIEW',
      version: 0,
      submittedAt: new Date('2026-08-14T09:00:00.000Z'),
      reviewedAt: null,
      review: null,
    },
    order: {
      id: orderId,
      orderNo: 'FS2026081400000025',
      companyId: '10000000-0000-4000-8000-000000000001',
      orderType: 'ENTERPRISE',
      enterpriseCustomerId: '20000000-0000-4000-8000-000000000001',
      consumerUserId: null,
      totalAmount: 5800,
      cashAmount: 5800,
      welfareCardAmount: 0,
      externalPaymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING_PAYMENT',
      version: 1,
      enterpriseProcurementOrder: {
        buyerOrderId: orderId,
        paymentMethod: 'BANK_TRANSFER',
        remittanceReviewStatus: 'PENDING_REVIEW',
        status: 'PAYMENT_CONFIRMING',
        version: 1,
      },
      paymentTransactions: [],
      items: [
        { id: '72000000-0000-4000-8000-000000000001', skuId: '30000000-0000-4000-8000-000000000001', supplierId: '20000000-0000-4000-8000-000000000011', quantity: 1 },
        { id: '72000000-0000-4000-8000-000000000002', skuId: '30000000-0000-4000-8000-000000000002', supplierId: '20000000-0000-4000-8000-000000000012', quantity: 2 },
      ],
      supplierFulfillments: [
        { id: '73000000-0000-4000-8000-000000000001', supplierId: '20000000-0000-4000-8000-000000000011', status: 'PENDING_PAYMENT' },
        { id: '73000000-0000-4000-8000-000000000002', supplierId: '20000000-0000-4000-8000-000000000012', status: 'PENDING_PAYMENT' },
      ],
    },
    balances: new Map([
      ['30000000-0000-4000-8000-000000000001', { id: '74000000-0000-4000-8000-000000000001', availableQty: 5, reservedQty: 1, soldQty: 0, damagedQty: 0, version: 1 }],
      ['30000000-0000-4000-8000-000000000002', { id: '74000000-0000-4000-8000-000000000002', availableQty: 4, reservedQty: 2, soldQty: 0, damagedQty: 0, version: 1 }],
    ]),
    logs: [
      { id: 'reserve-1', skuId: '30000000-0000-4000-8000-000000000001', referenceType: 'ORDER_RESERVATION', referenceId: orderId },
      { id: 'reserve-2', skuId: '30000000-0000-4000-8000-000000000002', referenceType: 'ORDER_RESERVATION', referenceId: orderId },
    ],
    inventoryCommands: [],
    events: [],
    outboxes: [],
  };

  const stored = () => ({ ...clone(state.submission), buyerOrder: clone(state.order), review: clone(state.submission.review) });
  const tx = {
    enterpriseRemittanceSubmission: {
      findFirst: async () => stored(),
      updateMany: async ({ where, data }) => {
        if (state.submission.id !== where.id || state.submission.version !== where.version || state.submission.status !== where.status) return { count: 0 };
        state.submission.status = data.status;
        state.submission.reviewedAt = data.reviewedAt;
        state.submission.version += data.version.increment;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => stored(),
    },
    enterpriseRemittanceReview: {
      create: async ({ data }) => {
        state.submission.review = { id: '76000000-0000-4000-8000-000000000025', ...clone(data) };
        return clone(state.submission.review);
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
        state.order.paymentStatus = data.paymentStatus;
        state.order.orderStatus = data.orderStatus;
        state.order.version += data.version.increment;
        return { count: 1 };
      },
    },
    enterpriseProcurementOrder: {
      updateMany: async ({ where, data }) => {
        const procurement = state.order.enterpriseProcurementOrder;
        if (
          procurement.buyerOrderId !== where.buyerOrderId ||
          procurement.version !== where.version ||
          procurement.status !== where.status ||
          (where.remittanceReviewStatus && procurement.remittanceReviewStatus !== where.remittanceReviewStatus)
        ) return { count: 0 };
        if (data.status) procurement.status = data.status;
        if (data.remittanceReviewStatus) procurement.remittanceReviewStatus = data.remittanceReviewStatus;
        procurement.version += data.version.increment;
        return { count: 1 };
      },
    },
    supplierFulfillmentOrder: {
      updateMany: async ({ data }) => {
        for (const fulfillment of state.order.supplierFulfillments) fulfillment.status = data.status;
        return { count: state.order.supplierFulfillments.length };
      },
    },
    inventoryCommand: { create: async ({ data }) => { state.inventoryCommands.push(clone(data)); return clone(data); } },
    buyerOrderEvent: { create: async ({ data }) => { state.events.push(clone(data)); return clone(data); } },
    paymentOutbox: { create: async ({ data }) => { state.outboxes.push(clone(data)); return clone(data); } },
  };
  const prisma = {
    $transaction: async (callback) => {
      const previous = tail;
      let release;
      tail = new Promise((resolve) => { release = resolve; });
      await previous;
      try { return await callback(tx); } finally { release(); }
    },
    enterpriseRemittanceSubmission: { findFirst: async () => stored() },
  };
  return { prisma, state };
};

test('M3-P025 Prisma company confirmation atomically confirms company receivable, reserved inventory, fulfillments and outbox', async () => {
  const { prisma, state } = fixture();
  const repository = new PrismaEnterpriseRemittanceRepository(prisma);
  const result = await repository.review(command());
  assert.equal(result.kind, 'CONFIRMED');
  assert.equal(result.remittance.sellerName, '江苏福礼团供应链科技有限公司');
  assert.equal(state.submission.status, 'CONFIRMED');
  assert.equal(state.order.paymentStatus, 'PAID');
  assert.equal(state.order.enterpriseProcurementOrder.status, 'PAID');
  assert.equal(state.order.enterpriseProcurementOrder.remittanceReviewStatus, 'CONFIRMED');
  assert.deepEqual([...state.balances.values()].map(({ reservedQty, soldQty }) => ({ reservedQty, soldQty })), [
    { reservedQty: 0, soldQty: 1 },
    { reservedQty: 0, soldQty: 2 },
  ]);
  assert.equal(state.logs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 2);
  assert.equal(state.inventoryCommands.length, 1);
  assert.equal(state.events[0].event, 'REMITTANCE_CONFIRMED');
  assert.equal(state.events[0].actorType, 'COMPANY');
  assert.equal(state.outboxes[0].eventType, 'BUYER_ORDER_PAID_V1');
  assert.doesNotMatch(JSON.stringify(state.outboxes), /supplyPrice|supplierPayable|bankAccount|proofObjectKey/iu);
});

test('M3-P025 duplicate and concurrent company confirmation produces one review, inventory and outbox mutation', async () => {
  const { prisma, state } = fixture();
  const repository = new PrismaEnterpriseRemittanceRepository(prisma);
  const results = await Promise.all([repository.review(command()), repository.review(command())]);
  assert.deepEqual(results.map(({ kind }) => kind).sort(), ['CONFIRMED', 'REPLAY']);
  assert.equal(state.logs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 2);
  assert.equal(state.inventoryCommands.length, 1);
  assert.equal(state.events.length, 1);
  assert.equal(state.outboxes.length, 1);
});

test('M3-P025 amount and version conflicts fail before any company receivable or inventory mutation', async () => {
  const first = fixture();
  const repository = new PrismaEnterpriseRemittanceRepository(first.prisma);
  assert.deepEqual(await repository.review(command({ amount: 5801 })), { kind: 'AMOUNT_MISMATCH' });
  assert.deepEqual(await repository.review(command({ expectedVersion: 1 })), { kind: 'VERSION_CONFLICT' });
  assert.equal(first.state.submission.status, 'PENDING_REVIEW');
  assert.equal(first.state.logs.filter(({ referenceType }) => referenceType === 'ORDER_CONFIRM').length, 0);
  assert.equal(first.state.outboxes.length, 0);
});
