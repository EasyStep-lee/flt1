import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import {
  RefundAdapterError,
  WELFARE_REFUND_ADAPTER,
  WECHAT_REFUND_ADAPTER,
  type WelfareRefundAdapter,
  type WechatRefundAdapter,
} from './refund.adapter.js';
import type { RefundActor } from './refund.actor.js';
import {
  REFUND_REPOSITORY,
  type RefundRecord,
  type RefundRepository,
} from './refund.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

const requireAfterSaleId = (value: unknown): string => {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'afterSaleId must be a UUID');
  }
  return value;
};

const requireIdempotencyKey = (value: unknown): string => {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY.test(value)) {
    throw new SafeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required');
  }
  return value;
};

const normalizeBody = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Refund body must be an object');
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(['authorizationVersion', 'reason']);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Refund amount, channel allocation and ownership are server-owned');
  }
  if (!Number.isSafeInteger(body.authorizationVersion) || Number(body.authorizationVersion) < 1) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'authorizationVersion must be a positive integer');
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length < 2 || body.reason.trim().length > 500) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'reason must contain 2 to 500 characters');
  }
  return { authorizationVersion: Number(body.authorizationVersion), reason: body.reason.trim() };
};

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const response = (refund: RefundRecord) => ({
  refundId: refund.refundId,
  afterSaleId: refund.afterSaleId,
  orderId: refund.orderId,
  orderItemId: refund.orderItemId,
  refundNo: refund.refundNo,
  status: refund.status,
  welfareCardRefundAmount: refund.welfareCardRefundAmount,
  cashRefundAmount: refund.cashRefundAmount,
  welfareChannelStatus: refund.welfareChannelStatus,
  wechatChannelStatus: refund.wechatChannelStatus,
});

const mapAdapterError = (error: unknown): never => {
  if (!(error instanceof RefundAdapterError)) throw error;
  throw new SafeApiError(
    error.code === 'EXTERNAL_SERVICE_UNAVAILABLE' ? 503 : 409,
    error.code,
    error.message,
  );
};

@Injectable()
export class RefundService {
  constructor(
    @Inject(REFUND_REPOSITORY) private readonly repository: RefundRepository,
    @Inject(WELFARE_REFUND_ADAPTER) private readonly welfareAdapter: WelfareRefundAdapter,
    @Inject(WECHAT_REFUND_ADAPTER) private readonly wechatAdapter: WechatRefundAdapter,
  ) {}

  async create(
    actor: RefundActor,
    afterSaleIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
  ) {
    const afterSaleId = requireAfterSaleId(afterSaleIdValue);
    const body = normalizeBody(bodyValue);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const requestHash = hash({
      afterSaleId,
      companyId: actor.companyId,
      functionalAccountId: actor.functionalAccountId,
      ...body,
    });
    const begin = await this.repository.begin({
      afterSaleId,
      actor,
      ...body,
      idempotencyKey,
      requestHash,
      requestId,
    });
    if (begin.kind === 'NOT_FOUND') throw new SafeApiError(404, 'REFUND_AUTHORIZATION_NOT_FOUND', 'Approved refund authorization was not found');
    if (begin.kind === 'SAME_NATURAL_PERSON') throw new SafeApiError(409, 'SAME_NATURAL_PERSON_REVIEW_FORBIDDEN', 'The approving natural person cannot initiate the same refund');
    if (begin.kind === 'VERSION_CONFLICT' || begin.kind === 'CONCURRENT_CONFLICT') {
      throw new SafeApiError(409, 'REFUND_STATE_CONFLICT', 'Refund authorization changed concurrently');
    }
    if (begin.kind === 'ALLOCATION_INVALID') throw new SafeApiError(409, 'REFUND_ALLOCATION_INVALID', 'Original payment allocation is incomplete or invalid');
    if (begin.kind === 'OVERPAID') throw new SafeApiError(409, 'REFUND_OVERPAID', 'Cumulative refund exceeds the original paid amount');
    if (begin.kind === 'STATE_CONFLICT') throw new SafeApiError(409, 'REFUND_STATE_CONFLICT', 'Order or refund authorization cannot be refunded in its current state');
    if (begin.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'REFUND_DUPLICATE', 'Idempotency-Key conflicts with the original refund request');
    if (begin.kind === 'REPLAY' || begin.refund.status === 'UNKNOWN' || begin.refund.status === 'SUCCEEDED') {
      return { body: response(begin.refund), replayed: true, accepted: false };
    }

    let current = begin.refund;
    if (current.welfareCardRefundAmount > 0 && current.welfareChannelStatus === 'PENDING') {
      const originalWelfareCardAccountId = current.originalWelfareCardAccountId;
      if (!originalWelfareCardAccountId) {
        throw new SafeApiError(409, 'REFUND_ALLOCATION_INVALID', 'Original welfare-card account is missing');
      }
      const claim = await this.repository.claimChannel(current.refundId, 'WELFARE');
      current = claim.refund;
      if (claim.kind !== 'CLAIMED') {
        return { body: response(current), replayed: true, accepted: current.status === 'PROCESSING' };
      }
      try {
        const welfareResult = await this.welfareAdapter.refund({
          refundId: current.refundId,
          refundNo: current.refundNo,
          refundAmount: current.welfareCardRefundAmount,
          originalWelfareCardAccountId,
        });
        current = await this.repository.recordWelfareResult(
          current.refundId,
          welfareResult.kind,
          requestId,
        );
      } catch (error) {
        current = await this.repository.recordWelfareResult(
          current.refundId,
          'UNKNOWN',
          requestId,
        );
        return mapAdapterError(error);
      }
      if (current.status === 'UNKNOWN') {
        return { body: response(current), replayed: false, accepted: true };
      }
    }
    if (
      current.welfareCardRefundAmount > 0 &&
      current.welfareChannelStatus !== 'SUCCEEDED'
    ) {
      return { body: response(current), replayed: true, accepted: true };
    }

    if (current.cashRefundAmount > 0 && current.wechatChannelStatus === 'PENDING') {
      const originalPaymentTransactionId = current.originalPaymentTransactionId;
      const originalWechatOutTradeNo = current.originalWechatOutTradeNo;
      const originalWechatTransactionId = current.originalWechatTransactionId;
      const originalWechatTotalAmount = current.originalWechatTotalAmount;
      if (
        !originalPaymentTransactionId ||
        !originalWechatOutTradeNo ||
        !originalWechatTransactionId ||
        !Number.isSafeInteger(originalWechatTotalAmount) ||
        Number(originalWechatTotalAmount) <= 0 ||
        current.cashRefundAmount > Number(originalWechatTotalAmount)
      ) {
        throw new SafeApiError(409, 'REFUND_ALLOCATION_INVALID', 'Original WeChat payment transaction is missing or amount-invalid');
      }
      const claim = await this.repository.claimChannel(current.refundId, 'WECHAT');
      current = claim.refund;
      if (claim.kind !== 'CLAIMED') {
        return { body: response(current), replayed: true, accepted: current.status === 'PROCESSING' || current.status === 'PARTIAL_CHANNEL_DONE' };
      }
      try {
        const wechatResult = await this.wechatAdapter.refund({
          refundId: current.refundId,
          refundNo: current.refundNo,
          refundAmount: current.cashRefundAmount,
          originalPaymentTransactionId,
          originalWechatOutTradeNo,
          originalWechatTransactionId,
          originalWechatTotalAmount: Number(originalWechatTotalAmount),
        });
        current = await this.repository.recordWechatResult(
          current.refundId,
          wechatResult.kind,
          requestId,
          wechatResult.externalRefundNo,
        );
      } catch (error) {
        current = await this.repository.recordWechatResult(
          current.refundId,
          'UNKNOWN',
          requestId,
        );
        return mapAdapterError(error);
      }
    }
    if (current.cashRefundAmount > 0 && current.wechatChannelStatus === 'PROCESSING') {
      return { body: response(current), replayed: true, accepted: true };
    }
    return { body: response(current), replayed: false, accepted: current.status === 'UNKNOWN' };
  }
}
