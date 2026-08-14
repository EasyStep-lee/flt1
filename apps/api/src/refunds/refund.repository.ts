import type { RefundActor } from './refund.actor.js';

export const REFUND_REPOSITORY = Symbol('REFUND_REPOSITORY');

export interface RefundRecord {
  readonly refundId: string;
  readonly afterSaleId: string;
  readonly orderId: string;
  readonly orderItemId: string;
  readonly refundNo: string;
  readonly status: 'PROCESSING' | 'PARTIAL_CHANNEL_DONE' | 'SUCCEEDED' | 'UNKNOWN' | 'FAILED';
  readonly authorizationVersion: number;
  readonly welfareCardRefundAmount: number;
  readonly cashRefundAmount: number;
  readonly welfareChannelStatus: 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'UNKNOWN' | 'FAILED';
  readonly wechatChannelStatus: 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'UNKNOWN' | 'FAILED';
  readonly originalWelfareCardAccountId: string | null;
  readonly originalPaymentTransactionId: string | null;
  readonly originalWechatOutTradeNo: string | null;
  readonly originalWechatTransactionId: string | null;
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

export interface BeginRefundCommand {
  readonly afterSaleId: string;
  readonly actor: RefundActor;
  readonly authorizationVersion: number;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
}

export type BeginRefundResult =
  | { readonly kind: 'CREATED' | 'CONTINUE' | 'REPLAY'; readonly refund: RefundRecord }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'SAME_NATURAL_PERSON' }
  | { readonly kind: 'VERSION_CONFLICT' }
  | { readonly kind: 'ALLOCATION_INVALID' }
  | { readonly kind: 'OVERPAID' }
  | { readonly kind: 'STATE_CONFLICT' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'CONCURRENT_CONFLICT' };

export interface RefundRepository {
  begin(command: BeginRefundCommand): Promise<BeginRefundResult>;
  claimChannel(
    refundId: string,
    channel: 'WELFARE' | 'WECHAT',
  ): Promise<{ readonly kind: 'CLAIMED' | 'BUSY' | 'DONE'; readonly refund: RefundRecord }>;
  recordWelfareResult(
    refundId: string,
    result: 'SUCCEEDED' | 'UNKNOWN',
    requestId?: string,
  ): Promise<RefundRecord>;
  recordWechatResult(
    refundId: string,
    result: 'SUCCEEDED' | 'UNKNOWN',
    requestId?: string,
    externalRefundNo?: string,
  ): Promise<RefundRecord>;
}
