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
  externalPaymentMethod: null,
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
    { supplierId: '20000000-0000-4000-8000-000000000001', itemCount: 1, goodsAmount: 1200, supplyAmount: 700, status: 'PENDING_PAYMENT' },
    { supplierId: '20000000-0000-4000-8000-000000000002', itemCount: 1, goodsAmount: 4600, supplyAmount: 2800, status: 'PENDING_PAYMENT' },
  ],
  enterpriseProcurement: null,
});

const fixture = ({ firstAvailableQty = 5, secondAvailableQty = 5 } = {}) => {
  const writes = {
    order: null,
    fulfillments: null,
    items: null,
    event: null,
    procurementOrder: null,
    inventoryLogs: [],
    inventoryCommands: [],
    balances: new Map([
      ['30000000-0000-4000-8000-000000000001', {
        id: '60000000-0000-4000-8000-000000000001', skuId: '30000000-0000-4000-8000-000000000001',
        availableQty: firstAvailableQty, reservedQty: 0, soldQty: 0, damagedQty: 0, version: 0,
      }],
      ['30000000-0000-4000-8000-000000000002', {
        id: '60000000-0000-4000-8000-000000000002', skuId: '30000000-0000-4000-8000-000000000002',
        availableQty: secondAvailableQty, reservedQty: 0, soldQty: 0, damagedQty: 0, version: 0,
      }],
    ]),
  };
  let transactionTail = Promise.resolve();
  const storedOrder = () => writes.order
    ? {
        ...writes.order,
        createdAt: new Date(), updatedAt: new Date(),
        items: (writes.items ?? []).map((item) => ({ ...item, createdAt: new Date() })),
        supplierFulfillments: (writes.fulfillments ?? []).map((item) => ({
          ...item, createdAt: new Date(), updatedAt: new Date(),
        })),
        events: writes.event
          ? [{ ...writes.event, id: '70000000-0000-4000-8000-000000000001', occurredAt: new Date() }]
          : [],
        enterpriseProcurementOrder: writes.procurementOrder
          ? { ...writes.procurementOrder, createdAt: new Date(), updatedAt: new Date() }
          : null,
      }
    : null;
  const tx = {
    buyerOrder: {
      findUnique: async ({ where }) => {
        if (where.id) {
          return writes.order?.id === where.id ? storedOrder() : null;
        }
        if (where.idempotencyScope_idempotencyKey) {
          const key = where.idempotencyScope_idempotencyKey;
          return writes.order?.idempotencyScope === key.idempotencyScope
            && writes.order?.idempotencyKey === key.idempotencyKey
            ? storedOrder()
            : null;
        }
        return null;
      },
      create: async ({ data }) => { writes.order = clone(data); },
      findUniqueOrThrow: async () => storedOrder(),
    },
    enterpriseCustomer: {
      findUnique: async () => ({ companyId: command().companyId, status: 'ACTIVE', procurementProfile: { status: 'ACTIVE', defaultAddressId: '10000000-0000-4000-8000-000000000229', defaultInvoiceProfileId: '10000000-0000-4000-8000-000000000329' } }),
    },
    enterpriseUser: {
      findUnique: async () => ({ enterpriseCustomerId: '10000000-0000-4000-8000-000000000029', role: 'ENTERPRISE_PURCHASER', status: 'ACTIVE' }),
    },
    enterpriseAddress: {
      findUnique: async () => ({
        enterpriseCustomerId: '10000000-0000-4000-8000-000000000029',
        consignee: '企业收货人', mobile: '13800138000', region: '江苏省南京市', fullAddress: '江东中路100号', deliveryNote: '工作日',
      }),
    },
    enterpriseInvoiceProfile: {
      findUnique: async () => ({
        enterpriseCustomerId: '10000000-0000-4000-8000-000000000029',
        title: '南京示例企业有限公司', taxNumber: '91320100MA1ABC2D3X', registeredAddress: '南京市建邺区',
        registeredPhone: '025-88886666', bankName: '示例银行', bankAccountMasked: '**** **** **** 2020',
      }),
    },
    enterpriseProcurementOrder: {
      create: async ({ data }) => {
        writes.procurementOrder = {
          id: '71000000-0000-4000-8000-000000000029',
          remittanceReviewStatus: 'NOT_SUBMITTED', status: 'PENDING_PAYMENT', version: 0, ...clone(data),
        };
        return clone(writes.procurementOrder);
      },
    },
    supplier: {
      findMany: async ({ where }) => where.id.in.map((id, index) => ({
        id,
        pickupAddress: `江苏省连云港市示例取货点${index + 1}`,
        pickupLat: { toString: () => `34.600000${index}` },
        pickupLng: { toString: () => `119.200000${index}` },
      })),
    },
    supplierFulfillmentOrder: { createMany: async ({ data }) => { writes.fulfillments = clone(data); } },
    buyerOrderItem: { createMany: async ({ data }) => { writes.items = clone(data); } },
    buyerOrderEvent: { create: async ({ data }) => { writes.event = clone(data); } },
    inventoryBalance: {
      findUnique: async ({ where }) => clone(writes.balances.get(where.skuId) ?? null),
      updateMany: async ({ where, data }) => {
        const balance = [...writes.balances.values()].find((item) => item.id === where.id);
        const minimumAvailable = typeof where.availableQty === 'object' ? where.availableQty.gte : where.availableQty;
        if (!balance || balance.version !== where.version || balance.availableQty < minimumAvailable) return { count: 0 };
        balance.availableQty += data.availableQty?.increment ?? 0;
        balance.availableQty -= data.availableQty?.decrement ?? 0;
        balance.reservedQty += data.reservedQty?.increment ?? 0;
        balance.reservedQty -= data.reservedQty?.decrement ?? 0;
        balance.version += data.version?.increment ?? 0;
        return { count: 1 };
      },
    },
    inventoryChangeLog: {
      findFirst: async ({ where }) => writes.inventoryLogs.find((item) =>
        item.skuId === where.skuId && item.referenceType === where.referenceType && item.referenceId === where.referenceId,
      ) ?? null,
      create: async ({ data }) => {
        writes.inventoryLogs.push(clone(data));
        return clone(data);
      },
    },
    inventoryCommand: {
      findUnique: async ({ where }) => writes.inventoryCommands.find((item) =>
        item.scope === where.scope_idempotencyKey.scope && item.idempotencyKey === where.scope_idempotencyKey.idempotencyKey,
      ) ?? null,
      create: async ({ data }) => { writes.inventoryCommands.push(clone(data)); },
    },
  };
  const prisma = {
    $transaction: async (callback) => {
      const previous = transactionTail;
      let unlock;
      transactionTail = new Promise((resolve) => { unlock = resolve; });
      await previous;
      const before = clone({
        order: writes.order,
        fulfillments: writes.fulfillments,
        items: writes.items,
        event: writes.event,
        procurementOrder: writes.procurementOrder,
        inventoryLogs: writes.inventoryLogs,
        inventoryCommands: writes.inventoryCommands,
        balances: [...writes.balances.entries()],
      });
      try {
        return await callback(tx);
      } catch (error) {
        writes.order = before.order;
        writes.fulfillments = before.fulfillments;
        writes.items = before.items;
        writes.event = before.event;
        writes.procurementOrder = before.procurementOrder;
        writes.inventoryLogs = before.inventoryLogs;
        writes.inventoryCommands = before.inventoryCommands;
        writes.balances = new Map(before.balances);
        throw error;
      } finally {
        unlock();
      }
    },
    buyerOrder: { findUnique: async () => null },
    sku: { findMany: async () => [] },
  };
  return { prisma, writes };
};

test('M3-P023 Prisma repository atomically reserves every order SKU and appends immutable inventory evidence', async () => {
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
  assert.deepEqual(
    [...writes.balances.values()].map(({ availableQty, reservedQty, version }) => ({ availableQty, reservedQty, version })),
    [
      { availableQty: 4, reservedQty: 1, version: 1 },
      { availableQty: 3, reservedQty: 2, version: 1 },
    ],
  );
  assert.deepEqual(writes.inventoryLogs.map(({ type, availableDelta, reservedDelta }) => ({ type, availableDelta, reservedDelta })), [
    { type: 'RESERVE', availableDelta: -1, reservedDelta: 1 },
    { type: 'RESERVE', availableDelta: -2, reservedDelta: 2 },
  ]);
  assert.equal(writes.inventoryCommands.length, 1);
  assert.equal(writes.inventoryCommands[0].scope, 'order-reserve');
});

test('M3-P029 Prisma repository atomically freezes enterprise owner, address, invoice and payment route', async () => {
  const { prisma, writes } = fixture();
  const repository = new PrismaOrderRepository(prisma);
  const enterpriseCommand = {
    ...command(),
    consumerUserId: null,
    enterpriseCustomerId: '10000000-0000-4000-8000-000000000029',
    orderType: 'ENTERPRISE',
    externalPaymentMethod: 'BANK_TRANSFER',
    idempotencyScope: 'ENTERPRISE:10000000-0000-4000-8000-000000000029',
    actorId: '10000000-0000-4000-8000-000000000129',
    enterpriseProcurement: {
      enterpriseAddressId: '10000000-0000-4000-8000-000000000229',
      invoiceProfileId: '10000000-0000-4000-8000-000000000329',
      paymentMethod: 'BANK_TRANSFER',
      purchaserUserId: '10000000-0000-4000-8000-000000000129',
    },
  };
  const result = await repository.createOrder(enterpriseCommand);
  assert.equal(result.kind, 'CREATED');
  assert.equal(writes.order.externalPaymentMethod, 'BANK_TRANSFER');
  assert.equal(writes.procurementOrder.enterpriseCustomerId, enterpriseCommand.enterpriseCustomerId);
  assert.equal(writes.procurementOrder.purchaserUserId, enterpriseCommand.actorId);
  assert.equal(writes.procurementOrder.enterpriseAddressSnapshot.schemaVersion, 1);
  assert.equal(writes.procurementOrder.invoiceProfileSnapshot.schemaVersion, 1);
  assert.equal(result.order.enterpriseProcurement.paymentMethod, 'BANK_TRANSFER');
  assert.equal(result.order.enterpriseProcurement.address.mobile, '13800138000');
});

test('M3-P029 idempotency replay returns the original enterprise checkout result after payment advances', async () => {
  const { prisma, writes } = fixture();
  const repository = new PrismaOrderRepository(prisma);
  const enterpriseCommand = {
    ...command(),
    consumerUserId: null,
    enterpriseCustomerId: '10000000-0000-4000-8000-000000000029',
    orderType: 'ENTERPRISE',
    externalPaymentMethod: 'BANK_TRANSFER',
    idempotencyScope: 'ENTERPRISE:10000000-0000-4000-8000-000000000029',
    actorId: '10000000-0000-4000-8000-000000000129',
    enterpriseProcurement: {
      enterpriseAddressId: '10000000-0000-4000-8000-000000000229',
      invoiceProfileId: '10000000-0000-4000-8000-000000000329',
      paymentMethod: 'BANK_TRANSFER',
      purchaserUserId: '10000000-0000-4000-8000-000000000129',
    },
  };
  const created = await repository.createOrder(enterpriseCommand);
  assert.equal(created.kind, 'CREATED');

  writes.order.paymentStatus = 'PAID';
  writes.order.orderStatus = 'PAID';
  writes.fulfillments.forEach((fulfillment) => { fulfillment.status = 'PENDING_PREPARATION'; });
  writes.procurementOrder.remittanceReviewStatus = 'CONFIRMED';
  writes.procurementOrder.status = 'PAID';

  const replay = await repository.createOrder(enterpriseCommand);
  assert.equal(replay.kind, 'REPLAY');
  assert.deepEqual(replay.order, created.order);
});

test('M3-P023 insufficient inventory rolls back the entire order and every earlier reservation', async () => {
  const { prisma, writes } = fixture({ secondAvailableQty: 1 });
  const repository = new PrismaOrderRepository(prisma);
  const result = await repository.createOrder(command());
  assert.deepEqual(result, {
    kind: 'INVENTORY_INSUFFICIENT',
    skuId: '30000000-0000-4000-8000-000000000002',
  });
  assert.equal(writes.order, null);
  assert.equal(writes.inventoryLogs.length, 0);
  assert.deepEqual(
    [...writes.balances.values()].map(({ availableQty, reservedQty, version }) => ({ availableQty, reservedQty, version })),
    [
      { availableQty: 5, reservedQty: 0, version: 0 },
      { availableQty: 1, reservedQty: 0, version: 0 },
    ],
  );
});

test('M3-P023 concurrent orders cannot oversell the same shared SKU balance', async () => {
  const { prisma, writes } = fixture({ firstAvailableQty: 1, secondAvailableQty: 2 });
  const repository = new PrismaOrderRepository(prisma);
  const competing = { ...command(), idempotencyKey: 'repository-order-0002', requestHash: 'b'.repeat(64) };
  const results = await Promise.all([repository.createOrder(command()), repository.createOrder(competing)]);
  assert.deepEqual(results.map(({ kind }) => kind).sort(), ['CREATED', 'INVENTORY_INSUFFICIENT']);
  assert.deepEqual(
    [...writes.balances.values()].map(({ availableQty, reservedQty }) => ({ availableQty, reservedQty })),
    [{ availableQty: 0, reservedQty: 1 }, { availableQty: 0, reservedQty: 2 }],
  );
  assert.equal(writes.inventoryLogs.filter(({ type }) => type === 'RESERVE').length, 2);
});

test('M3-P023 explicit timeout release is atomic and idempotent while UNKNOWN payment state is fail-closed', async () => {
  const first = fixture();
  const repository = new PrismaOrderRepository(first.prisma);
  const created = await repository.createOrder(command());
  assert.equal(created.kind, 'CREATED');
  const releaseCommand = {
    orderId: created.order.orderId,
    reason: 'PAYMENT_TIMEOUT',
    idempotencyKey: 'release-timeout-0001',
  };
  assert.deepEqual(await repository.releaseOrderInventory(releaseCommand), { kind: 'RELEASED' });
  assert.deepEqual(await repository.releaseOrderInventory(releaseCommand), { kind: 'REPLAY' });
  assert.deepEqual(
    [...first.writes.balances.values()].map(({ availableQty, reservedQty }) => ({ availableQty, reservedQty })),
    [{ availableQty: 5, reservedQty: 0 }, { availableQty: 5, reservedQty: 0 }],
  );

  const unknown = fixture();
  const unknownRepository = new PrismaOrderRepository(unknown.prisma);
  const unknownCreated = await unknownRepository.createOrder(command());
  unknown.writes.order.paymentStatus = 'UNKNOWN';
  assert.deepEqual(
    await unknownRepository.releaseOrderInventory({ ...releaseCommand, orderId: unknownCreated.order.orderId }),
    { kind: 'STATE_CONFLICT' },
  );
  assert.deepEqual(
    [...unknown.writes.balances.values()].map(({ availableQty, reservedQty }) => ({ availableQty, reservedQty })),
    [{ availableQty: 4, reservedQty: 1 }, { availableQty: 3, reservedQty: 2 }],
  );
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
