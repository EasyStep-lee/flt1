import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaOrderRepository } from '../../dist/orders/prisma-order.repository.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const command = () => ({
  companyId: '10000000-0000-4000-8000-000000000001',
  consumerUserId: '10000000-0000-4000-8000-000000000002',
  enterpriseCustomerId: null,
  orderType: 'CONSUMER',
  goodsAmount: 5800,
  deliveryFee: 0,
  discountAmount: 0,
  totalAmount: 5800,
  welfareCardAmount: 0,
  cashAmount: 5800,
  paymentStatus: 'PENDING',
  orderStatus: 'PENDING_PAYMENT',
  idempotencyScope: 'CONSUMER:10000000-0000-4000-8000-000000000002',
  idempotencyKey: 'repository-order-0001',
  requestHash: 'a'.repeat(64),
  requestId: 'request-m3-p022-repository',
  actorId: '10000000-0000-4000-8000-000000000002',
  items: [
    {
      supplierId: '20000000-0000-4000-8000-000000000001',
      productId: '40000000-0000-4000-8000-000000000001',
      skuId: '30000000-0000-4000-8000-000000000001',
      productName: '商品甲', categoryId: '50000000-0000-4000-8000-000000000001', templateVersion: 1,
      afterSaleSnapshot: { owner: 'COMPANY' }, quantity: 1, salePrice: 1200, supplyPrice: 700, totalAmount: 1200,
    },
    {
      supplierId: '20000000-0000-4000-8000-000000000002',
      productId: '40000000-0000-4000-8000-000000000002',
      skuId: '30000000-0000-4000-8000-000000000002',
      productName: '商品乙', categoryId: '50000000-0000-4000-8000-000000000002', templateVersion: 1,
      afterSaleSnapshot: { owner: 'COMPANY' }, quantity: 2, salePrice: 2300, supplyPrice: 1400, totalAmount: 4600,
    },
  ],
  supplierFulfillments: [
    { supplierId: '20000000-0000-4000-8000-000000000001', itemCount: 1, goodsAmount: 1200, status: 'PENDING_PAYMENT' },
    { supplierId: '20000000-0000-4000-8000-000000000002', itemCount: 1, goodsAmount: 4600, status: 'PENDING_PAYMENT' },
  ],
});

const fixture = () => {
  const writes = { order: null, fulfillments: null, items: null, event: null };
  const tx = {
    buyerOrder: {
      findUnique: async () => null,
      create: async ({ data }) => { writes.order = clone(data); },
      findUniqueOrThrow: async () => ({
        ...writes.order,
        createdAt: new Date(), updatedAt: new Date(),
        items: writes.items.map((item) => ({ ...item, createdAt: new Date() })),
        supplierFulfillments: writes.fulfillments.map((item) => ({ ...item, createdAt: new Date(), updatedAt: new Date() })),
        events: [{ ...writes.event, id: '70000000-0000-4000-8000-000000000001', occurredAt: new Date() }],
      }),
    },
    supplierFulfillmentOrder: { createMany: async ({ data }) => { writes.fulfillments = clone(data); } },
    buyerOrderItem: { createMany: async ({ data }) => { writes.items = clone(data); } },
    buyerOrderEvent: { create: async ({ data }) => { writes.event = clone(data); } },
  };
  const prisma = {
    $transaction: async (callback) => callback(tx),
    buyerOrder: { findUnique: async () => null },
    sku: { findMany: async () => [] },
  };
  return { prisma, writes };
};

test('M3-P022 Prisma repository writes one aggregate, internal supply snapshots and a public-safe immutable event', async () => {
  const { prisma, writes } = fixture();
  const repository = new PrismaOrderRepository(prisma);
  const result = await repository.createOrder(command());
  assert.equal(result.kind, 'CREATED');
  assert.equal(writes.fulfillments.length, 2);
  assert.equal(new Set(writes.fulfillments.map(({ supplierId }) => supplierId)).size, 2);
  assert.deepEqual(writes.items.map(({ supplyPriceSnapshot }) => supplyPriceSnapshot), [700, 1400]);
  assert.equal(writes.items[0].buyerOrderId, writes.order.id);
  assert.equal(writes.event.event, 'CREATED');
  assert.equal(writes.event.toStatus, 'PENDING_PAYMENT');
  assert.doesNotMatch(JSON.stringify(writes.event.snapshot), /supply|margin|payable/iu);
  assert.equal(result.order.items[0].supplyPrice, 700);
  assert.equal('inventoryBalance' in writes, false);
});

test('M3-P022 Prisma orderable query derives company and active scopes server-side', async () => {
  let query;
  const prisma = {
    sku: {
      findMany: async (input) => {
        query = input;
        return [{
          id: '30000000-0000-4000-8000-000000000001', status: 'ACTIVE', approvedSupplyPrice: 700,
          currentRetailSalePrice: 1200, currentEnterpriseSalePrice: 1100,
          product: {
            id: '40000000-0000-4000-8000-000000000001', companyId: '10000000-0000-4000-8000-000000000001',
            supplierId: '20000000-0000-4000-8000-000000000001', categoryId: '50000000-0000-4000-8000-000000000001',
            templateVersion: 1, name: '商品甲', saleStatus: 'ACTIVE', isRetailEnabled: true,
            isEnterpriseProcurementEnabled: true, afterSaleSnapshot: { owner: 'COMPANY' },
          },
        }];
      },
    },
  };
  const repository = new PrismaOrderRepository(prisma);
  const records = await repository.findOrderableSkus(
    '10000000-0000-4000-8000-000000000001',
    ['30000000-0000-4000-8000-000000000001'],
  );
  assert.equal(records.length, 1);
  assert.equal(query.where.product.companyId, '10000000-0000-4000-8000-000000000001');
  assert.equal(query.where.product.company.status, 'ACTIVE');
  assert.equal(query.where.product.supplier.status, 'ACTIVE');
  assert.equal(query.where.product.category.status, 'ENABLED');
});
