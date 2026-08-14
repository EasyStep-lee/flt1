import { expect, test } from '@playwright/test';

import type { CreateOrderCommand } from '../../../apps/api/src/orders/order.repository.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const records = [1, 2, 3].map((index) => ({
  skuId: `30000000-0000-4000-8000-00000000000${index}`,
  productId: `40000000-0000-4000-8000-00000000000${index}`,
  supplierId: `20000000-0000-4000-8000-00000000000${index}`,
  companyId,
  productName: `商品${index}`,
  categoryId: `50000000-0000-4000-8000-00000000000${index}`,
  templateVersion: 1,
  afterSaleSnapshot: {},
  status: 'ACTIVE' as const,
  productStatus: 'ACTIVE' as const,
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  retailSalePrice: 1000,
  enterpriseSalePrice: 900,
  approvedSupplyPrice: 600,
}));

class AtomicInventoryOrderRepository {
  readonly stock = new Map(records.map(({ skuId }, index) => [skuId, index === 2 ? 0 : 5]));
  readonly reservations = new Map(records.map(({ skuId }) => [skuId, 0]));

  async findOrderableSkus(_company: string, skuIds: readonly string[]) {
    return records.filter(({ skuId }) => skuIds.includes(skuId));
  }

  async createOrder(command: CreateOrderCommand) {
    const before = new Map(this.stock);
    for (const item of command.items) {
      const available = this.stock.get(item.skuId) ?? 0;
      if (available < item.quantity) {
        this.stock.clear();
        for (const [skuId, quantity] of before) this.stock.set(skuId, quantity);
        return { kind: 'INVENTORY_INSUFFICIENT' as const, skuId: item.skuId };
      }
      this.stock.set(item.skuId, available - item.quantity);
    }
    for (const item of command.items) {
      this.reservations.set(item.skuId, (this.reservations.get(item.skuId) ?? 0) + item.quantity);
    }
    return {
      kind: 'CREATED' as const,
      order: {
        ...command,
        orderId: '60000000-0000-4000-8000-000000000001',
        orderNo: 'FS202608140000000001',
        items: command.items.map((item, index) => ({
          ...item,
          orderItemId: `70000000-0000-4000-8000-00000000000${index + 1}`,
        })),
        supplierFulfillments: command.supplierFulfillments.map((item, index) => ({
          ...item,
          fulfillmentOrderId: `80000000-0000-4000-8000-00000000000${index + 1}`,
        })),
      },
    };
  }

  async releaseOrderInventory() {
    return { kind: 'STATE_CONFLICT' as const };
  }
}

test('P0-023 cross-supplier submission reserves all shared SKU inventory or none', async () => {
  const { OrderService } = await import(
    new URL('../../../apps/api/dist/orders/order.service.js', import.meta.url).href
  );
  const repository = new AtomicInventoryOrderRepository();
  const service = new OrderService(repository);
  const actor = { kind: 'CONSUMER' as const, companyId, consumerUserId, status: 'ACTIVE' as const };
  const body = { items: records.map(({ skuId }) => ({ skuId, quantity: 1 })) };
  const before = [...repository.stock.entries()];

  await expect(service.createConsumer(actor, body, 'p0-023-insufficient-0001', 'p0-023-failure'))
    .rejects.toMatchObject({ statusCode: 409, code: 'INVENTORY_INSUFFICIENT' });
  expect([...repository.stock.entries()]).toEqual(before);
  expect([...repository.reservations.values()]).toEqual([0, 0, 0]);

  const exhaustedSku = records[2];
  if (!exhaustedSku) throw new Error('P0-023 fixture must contain the third supplier SKU');
  repository.stock.set(exhaustedSku.skuId, 5);
  const result = await service.createConsumer(actor, body, 'p0-023-success-0001', 'p0-023-success');
  expect([...repository.stock.values()]).toEqual([4, 4, 4]);
  expect([...repository.reservations.values()]).toEqual([1, 1, 1]);
  expect(result.body.supplierFulfillments).toHaveLength(3);
  expect(JSON.stringify(result.body)).not.toMatch(/supplyPrice|availableQty|reservedQty|version/iu);
});
