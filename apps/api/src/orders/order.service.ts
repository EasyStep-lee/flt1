import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import { maskMobile, maskTaxNumber } from '../enterprise-onboarding/enterprise-onboarding.policy.js';
import type { ConsumerOrderActor, EnterpriseOrderActor } from './order.actor.js';
import {
  ORDER_REPOSITORY,
  type BuyerOrderType,
  type CreateOrderCommand,
  type OrderAggregateRecord,
  type OrderRepository,
} from './order.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const SELLER_NAME = '江苏福礼团供应链科技有限公司' as const;

interface NormalizedOrderBody {
  readonly items: readonly { readonly skuId: string; readonly quantity: number }[];
  readonly enterpriseAddressId?: string;
  readonly invoiceProfileId?: string;
  readonly paymentMethod?: 'WECHAT_PAY' | 'BANK_TRANSFER';
}

const normalizeBody = (
  value: unknown,
  orderType: BuyerOrderType,
): NormalizedOrderBody => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Order body must be an object');
  }
  const body = value as Record<string, unknown>;
  const permittedFields = orderType === 'CONSUMER'
    ? new Set(['items'])
    : new Set(['items', 'enterpriseAddressId', 'invoiceProfileId', 'paymentMethod']);
  if (Object.keys(body).some((key) => !permittedFields.has(key))) {
    throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Client-owned scope fields are forbidden');
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Order items must contain 1 to 100 entries');
  }
  const seen = new Set<string>();
  const items = body.items.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Order item must be an object');
    }
    const item = raw as Record<string, unknown>;
    if (Object.keys(item).some((key) => key !== 'skuId' && key !== 'quantity')) {
      throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Order item contains forbidden fields');
    }
    if (typeof item.skuId !== 'string' || !UUID.test(item.skuId)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'skuId must be a UUID');
    }
    if (!Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 9999) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'quantity must be an integer from 1 to 9999');
    }
    if (seen.has(item.skuId)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Duplicate skuId is forbidden');
    }
    seen.add(item.skuId);
    return { skuId: item.skuId, quantity: Number(item.quantity) };
  });
  if (orderType === 'ENTERPRISE') {
    const hasCheckoutSelection = body.enterpriseAddressId !== undefined ||
      body.invoiceProfileId !== undefined || body.paymentMethod !== undefined;
    if (!hasCheckoutSelection) return { items };
    if (
      typeof body.enterpriseAddressId !== 'string' || !UUID.test(body.enterpriseAddressId) ||
      typeof body.invoiceProfileId !== 'string' || !UUID.test(body.invoiceProfileId) ||
      (body.paymentMethod !== 'WECHAT_PAY' && body.paymentMethod !== 'BANK_TRANSFER')
    ) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Enterprise checkout profile and payment method are required');
    }
    return {
      items,
      enterpriseAddressId: body.enterpriseAddressId,
      invoiceProfileId: body.invoiceProfileId,
      paymentMethod: body.paymentMethod,
    };
  }
  return { items };
};

const requireIdempotencyKey = (value: unknown): string => {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY.test(value)) {
    throw new SafeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required');
  }
  return value;
};

const safeMultiply = (left: number, right: number): number => {
  const value = left * right;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Order amount exceeds the supported range');
  }
  return value;
};

const enterpriseNextAction = (
  order: NonNullable<OrderAggregateRecord['enterpriseProcurement']>,
): 'SUBMIT_REMITTANCE_PROOF' | 'START_WECHAT_PAYMENT' | 'WAIT_FOR_PAYMENT_CONFIRMATION' | 'VIEW_ORDER' => {
  if (order.status === 'PENDING_PAYMENT') {
    return order.paymentMethod === 'BANK_TRANSFER'
      ? 'SUBMIT_REMITTANCE_PROOF'
      : 'START_WECHAT_PAYMENT';
  }
  return order.status === 'PAYMENT_CONFIRMING'
    ? 'WAIT_FOR_PAYMENT_CONFIRMATION'
    : 'VIEW_ORDER';
};

const toCustomerResponse = (order: OrderAggregateRecord) => ({
  orderId: order.orderId,
  orderNo: order.orderNo,
  orderType: order.orderType,
  sellerName: SELLER_NAME,
  checkoutMode: 'COMPANY_UNIFIED' as const,
  goodsAmount: order.goodsAmount,
  deliveryFee: order.deliveryFee,
  discountAmount: order.discountAmount,
  totalAmount: order.totalAmount,
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
  items: order.items.map((item) => ({
    orderItemId: item.orderItemId,
    productId: item.productId,
    skuId: item.skuId,
    supplierId: item.supplierId,
    productName: item.productName,
    quantity: item.quantity,
    salePrice: item.salePrice,
    totalAmount: item.totalAmount,
  })),
  supplierFulfillments: order.supplierFulfillments.map((fulfillment) => ({
    fulfillmentOrderId: fulfillment.fulfillmentOrderId,
    supplierId: fulfillment.supplierId,
    itemCount: fulfillment.itemCount,
    goodsAmount: fulfillment.goodsAmount,
    status: fulfillment.status,
  })),
  ...(order.enterpriseProcurement
    ? {
        enterpriseProcurement: {
          enterpriseOrderId: order.enterpriseProcurement.enterpriseOrderId,
          paymentMethod: order.enterpriseProcurement.paymentMethod,
          remittanceReviewStatus: order.enterpriseProcurement.remittanceReviewStatus,
          status: order.enterpriseProcurement.status,
          nextAction: enterpriseNextAction(order.enterpriseProcurement),
          address: {
            consignee: order.enterpriseProcurement.address.consignee,
            mobileMasked: maskMobile(order.enterpriseProcurement.address.mobile),
            region: order.enterpriseProcurement.address.region,
            fullAddress: order.enterpriseProcurement.address.fullAddress,
            deliveryNote: order.enterpriseProcurement.address.deliveryNote,
          },
          invoiceProfile: {
            title: order.enterpriseProcurement.invoiceProfile.title,
            taxNumberMasked: maskTaxNumber(order.enterpriseProcurement.invoiceProfile.taxNumber),
            registeredAddress: order.enterpriseProcurement.invoiceProfile.registeredAddress,
            registeredPhoneMasked: order.enterpriseProcurement.invoiceProfile.registeredPhone
              ? maskMobile(order.enterpriseProcurement.invoiceProfile.registeredPhone)
              : null,
            bankName: order.enterpriseProcurement.invoiceProfile.bankName,
            bankAccountMasked: order.enterpriseProcurement.invoiceProfile.bankAccountMasked,
          },
        },
      }
    : {}),
});

@Injectable()
export class OrderService {
  constructor(@Inject(ORDER_REPOSITORY) private readonly repository: OrderRepository) {}

  createConsumer(
    actor: ConsumerOrderActor,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
  ) {
    if (actor.status !== 'ACTIVE') {
      throw new SafeApiError(403, 'ACCESS_DENIED', 'Consumer account is not active');
    }
    return this.create(actor, bodyValue, idempotencyKeyValue, requestId);
  }

  createEnterprise(
    actor: EnterpriseOrderActor,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
  ) {
    if (actor.status !== 'ACTIVE' || !actor.permissions.includes('PURCHASE')) {
      throw new SafeApiError(403, 'ACCESS_DENIED', 'Enterprise member cannot create orders');
    }
    return this.create(actor, bodyValue, idempotencyKeyValue, requestId);
  }

  private async create(
    actor: ConsumerOrderActor | EnterpriseOrderActor,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
  ) {
    const orderType: BuyerOrderType = actor.kind;
    const body = normalizeBody(bodyValue, orderType);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const records = await this.repository.findOrderableSkus(
      actor.companyId,
      body.items.map((item) => item.skuId),
    );
    const recordBySku = new Map(records.map((record) => [record.skuId, record]));
    if (records.length !== body.items.length) {
      throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'One or more products are not saleable');
    }
    const items = body.items.map((item) => {
      const record = recordBySku.get(item.skuId);
      const channelAllowed = actor.kind === 'CONSUMER'
        ? record?.isRetailEnabled
        : record?.isEnterpriseProcurementEnabled;
      if (
        !record ||
        record.companyId !== actor.companyId ||
        record.status !== 'ACTIVE' ||
        record.productStatus !== 'ACTIVE' ||
        !channelAllowed
      ) {
        throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'One or more products are not saleable');
      }
      const salePrice = actor.kind === 'CONSUMER'
        ? record.retailSalePrice
        : record.enterpriseSalePrice;
      if (!Number.isSafeInteger(salePrice) || salePrice < 0 || !Number.isSafeInteger(record.approvedSupplyPrice) || record.approvedSupplyPrice < 0) {
        throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product price is invalid');
      }
      return {
        supplierId: record.supplierId,
        productId: record.productId,
        skuId: record.skuId,
        productName: record.productName,
        categoryId: record.categoryId,
        templateVersion: record.templateVersion,
        afterSaleSnapshot: structuredClone(record.afterSaleSnapshot),
        quantity: item.quantity,
        salePrice,
        supplyPrice: record.approvedSupplyPrice,
        totalAmount: safeMultiply(salePrice, item.quantity),
      };
    });
    const goodsAmount = items.reduce((sum, item) => {
      const value = sum + item.totalAmount;
      if (!Number.isSafeInteger(value)) {
        throw new SafeApiError(422, 'VALIDATION_FAILED', 'Order amount exceeds the supported range');
      }
      return value;
    }, 0);
    const grouped = new Map<string, { itemCount: number; goodsAmount: number; supplyAmount: number }>();
    for (const item of items) {
      const current = grouped.get(item.supplierId) ?? { itemCount: 0, goodsAmount: 0, supplyAmount: 0 };
      const supplyLineAmount = safeMultiply(item.supplyPrice, item.quantity);
      const supplierGoodsAmount = current.goodsAmount + item.totalAmount;
      const supplierSupplyAmount = current.supplyAmount + supplyLineAmount;
      if (!Number.isSafeInteger(supplierGoodsAmount) || !Number.isSafeInteger(supplierSupplyAmount)) {
        throw new SafeApiError(422, 'VALIDATION_FAILED', 'Supplier fulfillment amount exceeds the supported range');
      }
      grouped.set(item.supplierId, {
        itemCount: current.itemCount + 1,
        goodsAmount: supplierGoodsAmount,
        supplyAmount: supplierSupplyAmount,
      });
    }
    const buyerId = actor.kind === 'CONSUMER' ? actor.consumerUserId : actor.enterpriseCustomerId;
    const canonical = JSON.stringify({
      orderType,
      buyerId,
      ...(actor.kind === 'ENTERPRISE'
        ? {
            enterpriseAddressId: body.enterpriseAddressId,
            invoiceProfileId: body.invoiceProfileId,
            paymentMethod: body.paymentMethod,
          }
        : {}),
      items: [...body.items].sort((left, right) => left.skuId.localeCompare(right.skuId)),
    });
    const command: CreateOrderCommand = {
      companyId: actor.companyId,
      consumerUserId: actor.kind === 'CONSUMER' ? actor.consumerUserId : null,
      enterpriseCustomerId: actor.kind === 'ENTERPRISE' ? actor.enterpriseCustomerId : null,
      orderType,
      goodsAmount,
      deliveryFee: 0,
      discountAmount: 0,
      totalAmount: goodsAmount,
      welfareCardAmount: 0,
      cashAmount: goodsAmount,
      externalPaymentMethod: actor.kind === 'ENTERPRISE' ? body.paymentMethod ?? 'WECHAT_PAY' : null,
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING_PAYMENT',
      idempotencyScope: `${orderType}:${buyerId}`,
      idempotencyKey,
      requestHash: createHash('sha256').update(canonical).digest('hex'),
      requestId,
      actorId: actor.kind === 'CONSUMER' ? actor.consumerUserId : actor.enterpriseUserId,
      items,
      supplierFulfillments: [...grouped.entries()].map(([supplierId, value]) => ({
        supplierId,
        ...value,
        status: 'PENDING_PAYMENT' as const,
      })),
      enterpriseProcurement: actor.kind === 'ENTERPRISE'
        ? {
            enterpriseAddressId: body.enterpriseAddressId ?? null,
            invoiceProfileId: body.invoiceProfileId ?? null,
            paymentMethod: body.paymentMethod ?? 'WECHAT_PAY',
            purchaserUserId: actor.enterpriseUserId,
          }
        : null,
    };
    const result = await this.repository.createOrder(command);
    if (result.kind === 'IDEMPOTENCY_CONFLICT') {
      throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts with the original order');
    }
    if (result.kind === 'INVENTORY_INSUFFICIENT') {
      throw new SafeApiError(409, 'INVENTORY_INSUFFICIENT', 'One or more products do not have enough inventory');
    }
    if (result.kind === 'INVENTORY_RESERVATION_CONFLICT') {
      throw new SafeApiError(409, 'INVENTORY_RESERVATION_CONFLICT', 'Inventory changed while the order was submitted');
    }
    if (result.kind === 'ENTERPRISE_NOT_ACTIVE') {
      throw new SafeApiError(403, 'ENTERPRISE_NOT_ACTIVE', 'Enterprise customer is not active');
    }
    if (result.kind === 'ENTERPRISE_SCOPE_FORBIDDEN') {
      throw new SafeApiError(403, 'ENTERPRISE_SCOPE_FORBIDDEN', 'Enterprise checkout profile belongs to another enterprise');
    }
    if (result.kind === 'ENTERPRISE_PROFILE_INCOMPLETE') {
      throw new SafeApiError(409, 'ENTERPRISE_PROFILE_INCOMPLETE', 'Enterprise checkout profile is incomplete');
    }
    if (result.kind === 'SUPPLIER_PICKUP_POINT_INCOMPLETE') {
      throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'One or more suppliers do not have an approved pickup point');
    }
    return { body: toCustomerResponse(result.order), replayed: result.kind === 'REPLAY' };
  }
}
