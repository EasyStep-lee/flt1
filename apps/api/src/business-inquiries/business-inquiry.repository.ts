import type { BusinessInquiryResponseDto } from './business-inquiry.dto.js';

export interface BusinessInquiryPayload {
  readonly contactName: string;
  readonly enterpriseName: string;
  readonly mobile: string;
  readonly demandSummary: string;
  readonly consentToUse: true;
}

export interface SubmitBusinessInquiryCommand {
  readonly payload: BusinessInquiryPayload;
  readonly contactMobileEncrypted: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly sourceFingerprint: string;
}

export type BusinessInquiryMutationResult =
  | {
      readonly kind: 'OK';
      readonly replayed: boolean;
      readonly value: BusinessInquiryResponseDto;
    }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'SINGLE_MERCHANT_VIOLATION' }
  | { readonly kind: 'AUDIT_REQUIRED' };

export interface BusinessInquiryRepository {
  submit(command: SubmitBusinessInquiryCommand): Promise<BusinessInquiryMutationResult>;
}

export const BUSINESS_INQUIRY_REPOSITORY = Symbol('BUSINESS_INQUIRY_REPOSITORY');
