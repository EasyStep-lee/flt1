import type { EnterpriseOrderActor } from '../orders/order.actor.js';
import type { CompanyFinanceActor } from './enterprise-remittance.actor.js';

export const ENTERPRISE_REMITTANCE_REPOSITORY = Symbol('ENTERPRISE_REMITTANCE_REPOSITORY');

export interface EnterpriseRemittanceRecord {
  readonly remittanceId: string;
  readonly orderId: string;
  readonly orderNo: string;
  readonly sellerName: '江苏福礼团供应链科技有限公司';
  readonly checkoutMode: 'COMPANY_UNIFIED';
  readonly paymentMethod: 'BANK_TRANSFER';
  readonly totalAmount: number;
  readonly paymentStatus: 'PENDING' | 'PAID';
  readonly orderStatus: 'PENDING_PAYMENT' | 'PAID';
  readonly remittanceStatus: 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';
  readonly version: number;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
}

export interface SubmitEnterpriseRemittanceCommand {
  readonly orderId: string;
  readonly actor: EnterpriseOrderActor;
  readonly amount: number;
  readonly proofObjectKey: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
}

export type SubmitEnterpriseRemittanceResult =
  | { readonly kind: 'SUBMITTED'; readonly remittance: EnterpriseRemittanceRecord }
  | { readonly kind: 'REPLAY'; readonly remittance: EnterpriseRemittanceRecord }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'ACCESS_DENIED' }
  | { readonly kind: 'AMOUNT_MISMATCH' }
  | { readonly kind: 'PAYMENT_METHOD_INVALID' }
  | { readonly kind: 'ALREADY_SUBMITTED' }
  | { readonly kind: 'STATE_CONFLICT' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'CONCURRENT_CONFLICT' };

export interface ReviewEnterpriseRemittanceCommand {
  readonly orderId: string;
  readonly actor: CompanyFinanceActor;
  readonly decision: 'CONFIRM' | 'REJECT';
  readonly amount: number;
  readonly expectedVersion: number;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
}

export type ReviewEnterpriseRemittanceResult =
  | { readonly kind: 'CONFIRMED'; readonly remittance: EnterpriseRemittanceRecord }
  | { readonly kind: 'REJECTED'; readonly remittance: EnterpriseRemittanceRecord }
  | { readonly kind: 'REPLAY'; readonly remittance: EnterpriseRemittanceRecord }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'ACCESS_DENIED' }
  | { readonly kind: 'AMOUNT_MISMATCH' }
  | { readonly kind: 'VERSION_CONFLICT' }
  | { readonly kind: 'STATE_CONFLICT' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'CONCURRENT_CONFLICT' };

export interface EnterpriseRemittanceRepository {
  submit(command: SubmitEnterpriseRemittanceCommand): Promise<SubmitEnterpriseRemittanceResult>;
  review(command: ReviewEnterpriseRemittanceCommand): Promise<ReviewEnterpriseRemittanceResult>;
}
