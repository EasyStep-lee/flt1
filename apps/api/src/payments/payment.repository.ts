import type { ConsumerOrderActor, EnterpriseOrderActor } from '../orders/order.actor.js';
import type { WechatPrepayResponse, VerifiedWechatNotification } from './wechat-payment.adapter.js';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export type PaymentActor = ConsumerOrderActor | EnterpriseOrderActor;

export interface PaymentRecord {
  readonly paymentTransactionId: string;
  readonly orderId: string;
  readonly merchantConfigRef: string;
  readonly collectorName: '江苏福礼团供应链科技有限公司';
  readonly amount: number;
  readonly outTradeNo: string;
  readonly status: 'CREATED' | 'PREPAY_CREATED' | 'PAID';
  readonly response?: WechatPrepayResponse;
}

export interface BeginWechatPrepayCommand {
  readonly orderId: string;
  readonly actor: PaymentActor;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
}

export type BeginWechatPrepayResult =
  | { readonly kind: 'NEEDS_PREPAY'; readonly payment: PaymentRecord }
  | { readonly kind: 'REPLAY'; readonly payment: PaymentRecord & { readonly response: WechatPrepayResponse } }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'ACCESS_DENIED' }
  | { readonly kind: 'STATE_CONFLICT' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'CONCURRENT_CONFLICT' };

export interface CompleteWechatPrepayCommand {
  readonly paymentTransactionId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly response: WechatPrepayResponse;
}

export type CompleteWechatPrepayResult =
  | { readonly kind: 'COMPLETED'; readonly payment: PaymentRecord & { readonly response: WechatPrepayResponse } }
  | { readonly kind: 'REPLAY'; readonly payment: PaymentRecord & { readonly response: WechatPrepayResponse } }
  | { readonly kind: 'STATE_CONFLICT' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' };

export interface ConfirmWechatPaymentCommand {
  readonly notification: VerifiedWechatNotification;
  readonly requestId: string;
}

export type ConfirmWechatPaymentResult =
  | { readonly kind: 'PAID'; readonly orderId: string; readonly paymentTransactionId: string }
  | { readonly kind: 'REPLAY'; readonly orderId: string; readonly paymentTransactionId: string }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'AMOUNT_MISMATCH' }
  | { readonly kind: 'STATE_CONFLICT' }
  | { readonly kind: 'TRANSACTION_CONFLICT' }
  | { readonly kind: 'CONCURRENT_CONFLICT' };

export interface PaymentRepository {
  beginWechatPrepay(command: BeginWechatPrepayCommand): Promise<BeginWechatPrepayResult>;
  completeWechatPrepay(command: CompleteWechatPrepayCommand): Promise<CompleteWechatPrepayResult>;
  confirmWechatPayment(command: ConfirmWechatPaymentCommand): Promise<ConfirmWechatPaymentResult>;
}
