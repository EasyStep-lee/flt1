import { expect, test } from '@playwright/test';

import type { CreateOrderCommand } from '../../../apps/api/src/orders/order.repository.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const enterpriseCustomerId = '10000000-0000-4000-8000-000000000029';
const enterpriseUserId = '10000000-0000-4000-8000-000000000129';
const addressId = '10000000-0000-4000-8000-000000000229';
const invoiceId = '10000000-0000-4000-8000-000000000329';
const records = [1, 2].map((index) => ({
  skuId: `30000000-0000-4000-8000-00000000000${index}`,
  productId: `40000000-0000-4000-8000-00000000000${index}`,
  supplierId: `20000000-0000-4000-8000-00000000000${index}`,
  companyId,
  productName: `企业商品${index}`,
  categoryId: `50000000-0000-4000-8000-00000000000${index}`,
  templateVersion: 1,
  afterSaleSnapshot: { provider: 'COMPANY_UNIFIED' },
  status: 'ACTIVE' as const,
  productStatus: 'ACTIVE' as const,
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  retailSalePrice: 1500,
  enterpriseSalePrice: 1200,
  approvedSupplyPrice: 800,
}));

class EnterpriseOrderRepository {
  readonly writes: CreateOrderCommand[] = [];
  private readonly replay = new Map<string, { hash: string; order: unknown }>();

  async findOrderableSkus(_company: string, skuIds: readonly string[]) {
    return records.filter(({ skuId }) => skuIds.includes(skuId));
  }

  async createOrder(command: CreateOrderCommand) {
    const key = `${command.idempotencyScope}:${command.idempotencyKey}`;
    const previous = this.replay.get(key);
    if (previous) return previous.hash === command.requestHash
      ? { kind: 'REPLAY' as const, order: previous.order as never }
      : { kind: 'IDEMPOTENCY_CONFLICT' as const };
    this.writes.push(structuredClone(command));
    const order = {
      ...command,
      orderId: '60000000-0000-4000-8000-000000000029',
      orderNo: 'FS2026081500000029',
      items: command.items.map((item, index) => ({ ...item, orderItemId: `70000000-0000-4000-8000-00000000000${index + 1}` })),
      supplierFulfillments: command.supplierFulfillments.map((item, index) => ({ ...item, fulfillmentOrderId: `80000000-0000-4000-8000-00000000000${index + 1}` })),
      enterpriseProcurement: {
        enterpriseOrderId: '90000000-0000-4000-8000-000000000029',
        paymentMethod: command.enterpriseProcurement!.paymentMethod,
        remittanceReviewStatus: 'NOT_SUBMITTED' as const,
        status: 'PENDING_PAYMENT' as const,
        address: { consignee: '企业收货人', mobile: '13800138000', region: '江苏省南京市', fullAddress: '江东中路100号', deliveryNote: null },
        invoiceProfile: { title: '南京示例企业有限公司', taxNumber: '91320100MA1ABC2D3X', registeredAddress: null, registeredPhone: null, bankName: null, bankAccountMasked: '**** **** **** 2020' },
      },
    };
    this.replay.set(key, { hash: command.requestHash, order });
    return { kind: 'CREATED' as const, order };
  }

  async releaseOrderInventory() { return { kind: 'STATE_CONFLICT' as const }; }
}

test('P0-029 enterprise checkout creates one cross-supplier company order with masked immutable profiles', async () => {
  const { OrderService } = await import(new URL('../../../apps/api/dist/orders/order.service.js', import.meta.url).href);
  const repository = new EnterpriseOrderRepository();
  const service = new OrderService(repository);
  const actor = { kind: 'ENTERPRISE' as const, companyId, enterpriseCustomerId, enterpriseUserId, status: 'ACTIVE' as const, permissions: ['PURCHASE'] };
  const body = { items: records.map(({ skuId }) => ({ skuId, quantity: 1 })), enterpriseAddressId: addressId, invoiceProfileId: invoiceId, paymentMethod: 'BANK_TRANSFER' as const };
  const result = await service.createEnterprise(actor, body, 'p0-029-enterprise-order', 'p0-029-create');

  expect(result.body.supplierFulfillments).toHaveLength(2);
  expect(result.body.enterpriseProcurement).toMatchObject({ paymentMethod: 'BANK_TRANSFER', nextAction: 'SUBMIT_REMITTANCE_PROOF', address: { mobileMasked: '138****8000' }, invoiceProfile: { taxNumberMasked: '9132********2D3X' } });
  expect(repository.writes[0]?.enterpriseProcurement).toEqual({ enterpriseAddressId: addressId, invoiceProfileId: invoiceId, paymentMethod: 'BANK_TRANSFER', purchaserUserId: enterpriseUserId });
  expect(JSON.stringify(result.body)).not.toMatch(/supplyPrice|enterpriseCustomerId|purchaserUserId|13800138000|91320100MA1ABC2D3X|DeliveryTask/iu);

  await expect(service.createEnterprise(actor, { ...body, paymentMethod: 'WECHAT_PAY' as const }, 'p0-029-enterprise-order', 'p0-029-conflict'))
    .rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_CONFLICT' });
  expect(repository.writes).toHaveLength(1);
});
