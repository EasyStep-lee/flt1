import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type { PaymentActor, PaymentRecord, PaymentRepository, WelfareCardWechatPaymentRecord } from './payment.repository.js';
import { PAYMENT_REPOSITORY } from './payment.repository.js';
import {
  WECHAT_PAYMENT_ADAPTER,
  type WechatPaymentAdapter,
  WechatPaymentAdapterError,
} from './wechat-payment.adapter.js';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const requireIdempotencyKey = (value: unknown): string => {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY.test(value)) {
    throw new SafeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required');
  }
  return value;
};

const requireOrderId = (value: unknown): string => {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'orderId must be a UUID');
  }
  return value;
};

const requireEmptyBody = (value: unknown): void => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Prepay body must be an object');
  }
  if (Object.keys(value as Record<string, unknown>).length > 0) {
    throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Payment amount and scope are server-owned');
  }
};

const requireAccountId = (value: unknown): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Payment body must be an object');
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== 'accountId')) {
    throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Buyer ownership and payment amounts are server-owned');
  }
  if (typeof body.accountId !== 'string' || !UUID.test(body.accountId)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'accountId must be a UUID');
  }
  return body.accountId;
};

const toResponse = (payment: PaymentRecord & { readonly response: NonNullable<PaymentRecord['response']> }) => ({
  paymentTransactionId: payment.paymentTransactionId,
  orderId: payment.orderId,
  channel: 'WECHAT_PAY' as const,
  status: 'PREPAY_CREATED' as const,
  collectorName: payment.collectorName,
  checkoutMode: 'COMPANY_UNIFIED' as const,
  amount: payment.amount,
  outTradeNo: payment.outTradeNo,
  prepayId: payment.response.prepayId,
  clientPayment: payment.response.clientPayment,
});

const toMixedResponse = (
  payment: WelfareCardWechatPaymentRecord & { readonly response: NonNullable<PaymentRecord['response']> },
) => ({
  ...toResponse(payment),
  paymentMode: 'WELFARE_CARD_WECHAT' as const,
  welfareCardAmount: payment.welfareCardAmount,
  cashAmount: payment.cashAmount,
  totalAmount: payment.totalAmount,
});

const mapAdapterError = (error: unknown): never => {
  if (!(error instanceof WechatPaymentAdapterError)) throw error;
  const status = error.code === 'EXTERNAL_SERVICE_UNAVAILABLE' ? 503 : error.code === 'PAYMENT_NOTIFICATION_INVALID' ? 401 : 409;
  throw new SafeApiError(status, error.code, error.message);
};

@Injectable()
export class PaymentService {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly repository: PaymentRepository,
    @Inject(WECHAT_PAYMENT_ADAPTER) private readonly adapter: WechatPaymentAdapter,
  ) {}

  async createWechatPrepay(
    actor: PaymentActor,
    orderIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
  ) {
    const orderId = requireOrderId(orderIdValue);
    requireEmptyBody(bodyValue);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const buyerReference = actor.kind === 'CONSUMER' ? actor.consumerUserId : actor.enterpriseCustomerId;
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ actorKind: actor.kind, buyerReference, orderId }))
      .digest('hex');
    const begin = await this.repository.beginWechatPrepay({
      orderId,
      actor,
      idempotencyKey,
      requestHash,
      requestId,
    });
    if (begin.kind === 'NOT_FOUND') throw new SafeApiError(404, 'ORDER_NOT_FOUND', 'Order was not found');
    if (begin.kind === 'ACCESS_DENIED') throw new SafeApiError(403, 'ACCESS_DENIED', 'Order does not belong to this buyer');
    if (begin.kind === 'STATE_CONFLICT') throw new SafeApiError(409, 'PAYMENT_STATE_INVALID', 'Order cannot create a WeChat prepay');
    if (begin.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'PAYMENT_IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts with the original payment');
    if (begin.kind === 'CONCURRENT_CONFLICT') throw new SafeApiError(409, 'PAYMENT_CONCURRENT_CONFLICT', 'Payment changed concurrently; retry safely');
    if (begin.kind === 'REPLAY') return { body: toResponse(begin.payment), replayed: true };

    let external;
    try {
      external = await this.adapter.createPrepay({
        outTradeNo: begin.payment.outTradeNo,
        amount: begin.payment.amount,
        description: '福礼团订单',
        payerReference: buyerReference,
        merchantConfigRef: begin.payment.merchantConfigRef,
        collectorLegalName: begin.payment.collectorName,
      });
    } catch (error) {
      return mapAdapterError(error);
    }
    const completed = await this.repository.completeWechatPrepay({
      paymentTransactionId: begin.payment.paymentTransactionId,
      idempotencyKey,
      requestHash,
      response: external,
    });
    if (completed.kind === 'STATE_CONFLICT') throw new SafeApiError(409, 'PAYMENT_STATE_INVALID', 'Payment state changed before prepay completed');
    if (completed.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'PAYMENT_IDEMPOTENCY_CONFLICT', 'Payment completion conflicts with the original request');
    return { body: toResponse(completed.payment), replayed: completed.kind === 'REPLAY' };
  }

  async createWelfareCardWechatPrepay(
    actor: Extract<PaymentActor, { readonly kind: 'CONSUMER' }>,
    orderIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
  ) {
    const orderId = requireOrderId(orderIdValue);
    const accountId = requireAccountId(bodyValue);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ actorKind: actor.kind, consumerUserId: actor.consumerUserId, orderId, accountId, mode: 'WELFARE_CARD_WECHAT' }))
      .digest('hex');
    const begin = await this.repository.beginWelfareCardWechatPrepay({ orderId, accountId, actor, idempotencyKey, requestHash, requestId });
    if (begin.kind === 'NOT_FOUND') throw new SafeApiError(404, 'ORDER_NOT_FOUND', 'Order was not found');
    if (begin.kind === 'ACCESS_DENIED') throw new SafeApiError(403, 'ACCESS_DENIED', 'Order or welfare account does not belong to this buyer');
    if (begin.kind === 'ACCOUNT_NOT_ELIGIBLE') throw new SafeApiError(409, 'WELFARE_CARD_NOT_ELIGIBLE', 'Welfare account is not eligible for this order');
    if (begin.kind === 'NOT_APPLICABLE') throw new SafeApiError(409, 'WELFARE_CARD_MIXED_PAYMENT_NOT_APPLICABLE', 'Order must have both a welfare deduction and a WeChat difference');
    if (begin.kind === 'STATE_CONFLICT') throw new SafeApiError(409, 'PAYMENT_STATE_INVALID', 'Order cannot create a mixed payment');
    if (begin.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'PAYMENT_IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts with the original payment');
    if (begin.kind === 'CONCURRENT_CONFLICT') throw new SafeApiError(409, 'PAYMENT_CONCURRENT_CONFLICT', 'Payment changed concurrently; retry safely');
    if (begin.kind === 'REPLAY') return { body: toMixedResponse(begin.payment), replayed: true };

    let external;
    try {
      external = await this.adapter.createPrepay({
        outTradeNo: begin.payment.outTradeNo,
        amount: begin.payment.cashAmount,
        description: '福礼团订单',
        payerReference: actor.consumerUserId,
        merchantConfigRef: begin.payment.merchantConfigRef,
        collectorLegalName: begin.payment.collectorName,
      });
    } catch (error) {
      return mapAdapterError(error);
    }
    const completed = await this.repository.completeWechatPrepay({
      paymentTransactionId: begin.payment.paymentTransactionId,
      idempotencyKey,
      requestHash,
      response: external,
    });
    if (completed.kind === 'STATE_CONFLICT') throw new SafeApiError(409, 'PAYMENT_STATE_INVALID', 'Payment state changed before prepay completed');
    if (completed.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'PAYMENT_IDEMPOTENCY_CONFLICT', 'Payment completion conflicts with the original request');
    return {
      body: toMixedResponse({
        ...completed.payment,
        welfareCardAmount: begin.payment.welfareCardAmount,
        cashAmount: begin.payment.cashAmount,
        totalAmount: begin.payment.totalAmount,
      }),
      replayed: completed.kind === 'REPLAY',
    };
  }

  async confirmWechatNotification(
    headers: Readonly<Record<string, string | string[] | undefined>>,
    body: unknown,
    requestId: string,
  ) {
    let notification;
    try {
      notification = await this.adapter.verifyNotification(headers, body);
    } catch (error) {
      return mapAdapterError(error);
    }
    if (!Number.isSafeInteger(notification.amount) || notification.amount <= 0) {
      throw new SafeApiError(422, 'PAYMENT_NOTIFICATION_INVALID', 'Notification amount must be positive integer cents');
    }
    const result = await this.repository.confirmWechatPayment({ notification, requestId });
    if (result.kind === 'NOT_FOUND') throw new SafeApiError(404, 'PAYMENT_TRANSACTION_NOT_FOUND', 'Payment transaction was not found');
    if (result.kind === 'AMOUNT_MISMATCH') throw new SafeApiError(409, 'PAYMENT_AMOUNT_MISMATCH', 'Notification amount does not match the order');
    if (result.kind === 'STATE_CONFLICT') throw new SafeApiError(409, 'PAYMENT_STATE_INVALID', 'Payment notification conflicts with current state');
    if (result.kind === 'TRANSACTION_CONFLICT') throw new SafeApiError(409, 'PAYMENT_TRANSACTION_CONFLICT', 'WeChat transaction conflicts with another payment');
    if (result.kind === 'CONCURRENT_CONFLICT') throw new SafeApiError(409, 'PAYMENT_CONCURRENT_CONFLICT', 'Payment changed concurrently; WeChat may retry');
    return { code: 'SUCCESS' as const, message: '成功' as const };
  }
}
