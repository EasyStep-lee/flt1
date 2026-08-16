export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export type BuyerOrderType = 'CONSUMER' | 'ENTERPRISE';
export type EnterpriseProcurementPaymentMethod = 'WECHAT_PAY' | 'BANK_TRANSFER';

export interface EnterpriseAddressSnapshot {
  readonly consignee: string;
  readonly mobile: string;
  readonly region: string;
  readonly fullAddress: string;
  readonly deliveryNote: string | null;
}

export interface EnterpriseInvoiceProfileSnapshot {
  readonly title: string;
  readonly taxNumber: string;
  readonly registeredAddress: string | null;
  readonly registeredPhone: string | null;
  readonly bankName: string | null;
  readonly bankAccountMasked: string | null;
}

export interface EnterpriseProcurementCommand {
  readonly enterpriseAddressId: string | null;
  readonly invoiceProfileId: string | null;
  readonly paymentMethod: EnterpriseProcurementPaymentMethod;
  readonly purchaserUserId: string;
}

export interface EnterpriseProcurementRecord {
  readonly enterpriseOrderId: string;
  readonly paymentMethod: EnterpriseProcurementPaymentMethod;
  readonly remittanceReviewStatus: 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';
  readonly status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMING' | 'PAID' | 'FULFILLING' | 'COMPLETED' | 'CANCELLED';
  readonly address: EnterpriseAddressSnapshot;
  readonly invoiceProfile: EnterpriseInvoiceProfileSnapshot;
}

export interface OrderableSkuRecord {
  readonly skuId: string;
  readonly productId: string;
  readonly supplierId: string;
  readonly companyId: string;
  readonly productName: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly afterSaleSnapshot: Readonly<Record<string, unknown>>;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  readonly productStatus: 'ACTIVE' | 'OFF_SHELF' | 'ARCHIVED';
  readonly isRetailEnabled: boolean;
  readonly isEnterpriseProcurementEnabled: boolean;
  readonly retailSalePrice: number;
  readonly enterpriseSalePrice: number;
  readonly approvedSupplyPrice: number;
}

export interface CreateOrderItemCommand {
  readonly supplierId: string;
  readonly productId: string;
  readonly skuId: string;
  readonly productName: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly afterSaleSnapshot: Readonly<Record<string, unknown>>;
  readonly quantity: number;
  readonly salePrice: number;
  readonly supplyPrice: number;
  readonly totalAmount: number;
}

export interface CreateSupplierFulfillmentCommand {
  readonly supplierId: string;
  readonly itemCount: number;
  readonly goodsAmount: number;
  readonly supplyAmount: number;
  readonly status: 'PENDING_PAYMENT';
}

export interface CreateOrderCommand {
  readonly companyId: string;
  readonly consumerUserId: string | null;
  readonly enterpriseCustomerId: string | null;
  readonly orderType: BuyerOrderType;
  readonly goodsAmount: number;
  readonly deliveryFee: 0;
  readonly discountAmount: 0;
  readonly totalAmount: number;
  readonly welfareCardAmount: 0;
  readonly cashAmount: number;
  readonly externalPaymentMethod: EnterpriseProcurementPaymentMethod | null;
  readonly paymentStatus: 'PENDING';
  readonly orderStatus: 'PENDING_PAYMENT';
  readonly idempotencyScope: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly actorId: string;
  readonly items: readonly CreateOrderItemCommand[];
  readonly supplierFulfillments: readonly CreateSupplierFulfillmentCommand[];
  readonly enterpriseProcurement: EnterpriseProcurementCommand | null;
}

export interface OrderAggregateRecord extends Omit<CreateOrderCommand, 'enterpriseProcurement'> {
  readonly orderId: string;
  readonly orderNo: string;
  readonly items: readonly (CreateOrderItemCommand & { readonly orderItemId: string })[];
  readonly supplierFulfillments: readonly (
    CreateSupplierFulfillmentCommand & { readonly fulfillmentOrderId: string }
  )[];
  readonly enterpriseProcurement: EnterpriseProcurementRecord | null;
}

export type CreateOrderResult =
  | { readonly kind: 'CREATED'; readonly order: OrderAggregateRecord }
  | { readonly kind: 'REPLAY'; readonly order: OrderAggregateRecord }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'INVENTORY_INSUFFICIENT'; readonly skuId: string }
  | { readonly kind: 'INVENTORY_RESERVATION_CONFLICT' }
  | { readonly kind: 'ENTERPRISE_NOT_ACTIVE' }
  | { readonly kind: 'ENTERPRISE_SCOPE_FORBIDDEN' }
  | { readonly kind: 'ENTERPRISE_PROFILE_INCOMPLETE' }
  | { readonly kind: 'SUPPLIER_PICKUP_POINT_INCOMPLETE' };

export type ReleaseOrderInventoryReason = 'USER_CANCELLED' | 'PAYMENT_FAILED' | 'PAYMENT_TIMEOUT';

export interface ReleaseOrderInventoryCommand {
  readonly orderId: string;
  readonly reason: ReleaseOrderInventoryReason;
  readonly idempotencyKey: string;
}

export type ReleaseOrderInventoryResult =
  | { readonly kind: 'RELEASED' }
  | { readonly kind: 'REPLAY' }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'STATE_CONFLICT' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'INVENTORY_RESERVATION_CONFLICT' };

export interface OrderRepository {
  findOrderableSkus(companyId: string, skuIds: readonly string[]): Promise<readonly OrderableSkuRecord[]>;
  createOrder(command: CreateOrderCommand): Promise<CreateOrderResult>;
  releaseOrderInventory(command: ReleaseOrderInventoryCommand): Promise<ReleaseOrderInventoryResult>;
}
