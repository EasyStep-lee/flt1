export const WELFARE_CARD_PAYMENT_REPOSITORY = Symbol('WELFARE_CARD_PAYMENT_REPOSITORY');

export interface WelfareCardFullPaymentRecord {
  readonly orderId: string;
  readonly orderNo: string;
  readonly paymentStatus: 'PAID';
  readonly orderStatus: 'PAID';
  readonly paymentMode: 'WELFARE_CARD';
  readonly welfareCardAmount: number;
  readonly cashAmount: 0;
  readonly paidAt: string;
  readonly itemCount: number;
  readonly supplierFulfillmentCount: number;
}

export interface WelfareCardFullPaymentCommand {
  readonly companyId: string;
  readonly consumerUserId: string;
  readonly orderId: string;
  readonly accountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
}

export type WelfareCardFullPaymentResult =
  | { readonly kind: 'OK'; readonly replayed: boolean; readonly value: WelfareCardFullPaymentRecord }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'ACCESS_DENIED' }
  | { readonly kind: 'ACCOUNT_NOT_ELIGIBLE' }
  | { readonly kind: 'INSUFFICIENT_BALANCE' }
  | { readonly kind: 'STATE_CONFLICT' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'CONCURRENT_CONFLICT' };

export interface WelfareCardPaymentRepository {
  payFull(command: WelfareCardFullPaymentCommand): Promise<WelfareCardFullPaymentResult>;
}
