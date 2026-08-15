import type {
  EnterpriseCorrectionField,
  EnterpriseCustomerStatus,
  EnterpriseReviewDecision,
} from './enterprise-onboarding.policy.js';

export const ENTERPRISE_ONBOARDING_REPOSITORY = Symbol(
  'ENTERPRISE_ONBOARDING_REPOSITORY',
);

export interface EnterpriseAddressRecord {
  readonly id: string;
  readonly consignee: string;
  readonly mobile: string;
  readonly region: string;
  readonly fullAddress: string;
  readonly deliveryNote?: string;
  readonly isDefault: boolean;
}

export interface EnterpriseInvoiceProfileRecord {
  readonly id: string;
  readonly title: string;
  readonly taxNumber: string;
  readonly registeredAddress?: string;
  readonly registeredPhone?: string;
  readonly bankName?: string;
  readonly bankAccountMasked?: string;
}

export interface EnterpriseOnboardingRecord {
  readonly id: string;
  readonly companyId: string;
  readonly applicantIdentityId: string;
  readonly legalName: string;
  readonly creditCode: string;
  readonly registeredAddress?: string;
  readonly enterpriseType?: string;
  readonly licenseObjectKey?: string;
  readonly licenseValidUntil?: string;
  readonly administratorName: string;
  readonly administratorMobile: string;
  readonly administratorEmail?: string;
  readonly administratorTitle?: string;
  readonly agreementVersion: string;
  readonly agreementStatus: 'NOT_SIGNED' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
  readonly status: EnterpriseCustomerStatus;
  readonly version: number;
  readonly correctionFields: readonly EnterpriseCorrectionField[];
  readonly reviewOpinion?: string;
  readonly addresses: readonly EnterpriseAddressRecord[];
  readonly invoiceProfile?: EnterpriseInvoiceProfileRecord;
  readonly createdAt: string;
  readonly submittedAt?: string;
}

export interface EnterpriseProfilePatch {
  readonly legalName?: string;
  readonly creditCode?: string;
  readonly registeredAddress?: string;
  readonly enterpriseType?: string;
  readonly licenseObjectKey?: string;
  readonly licenseValidUntil?: string | null;
  readonly administratorName?: string;
  readonly administratorEmail?: string;
  readonly administratorTitle?: string;
  readonly addresses?: readonly Omit<EnterpriseAddressRecord, 'id'>[];
  readonly invoiceProfile?: Omit<EnterpriseInvoiceProfileRecord, 'id'>;
}

export type EnterpriseMutationFailureKind =
  | 'COMPANY_INVARIANT'
  | 'DUPLICATE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NOT_FOUND'
  | 'SELF_APPROVAL'
  | 'STATE_CONFLICT'
  | 'VERSION_CONFLICT';

export type EnterpriseMutationResult =
  | { readonly kind: 'OK'; readonly replayed: boolean; readonly value: EnterpriseOnboardingRecord }
  | { readonly kind: EnterpriseMutationFailureKind };

export interface RegisterEnterpriseCommand {
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly applicantIdentityId: string;
  readonly legalName: string;
  readonly creditCode: string;
  readonly administratorName: string;
  readonly administratorMobile: string;
  readonly administratorEmail?: string;
  readonly administratorTitle?: string;
  readonly agreementVersion: string;
  readonly profile: EnterpriseProfilePatch;
}

export interface PatchEnterpriseCommand {
  readonly enterpriseId: string;
  readonly applicantIdentityId: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly patch: EnterpriseProfilePatch;
}

export interface SubmitEnterpriseCommand {
  readonly enterpriseId: string;
  readonly applicantIdentityId: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

export interface ReviewEnterpriseCommand {
  readonly enterpriseId: string;
  readonly companyId: string;
  readonly reviewerIdentityId: string;
  readonly expectedVersion: number;
  readonly decision: EnterpriseReviewDecision;
  readonly opinion: string;
  readonly correctionFields: readonly EnterpriseCorrectionField[];
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

export interface SuspendEnterpriseCommand {
  readonly enterpriseId: string;
  readonly companyId: string;
  readonly reviewerIdentityId: string;
  readonly expectedVersion: number;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

export interface EnterpriseListQuery {
  readonly companyId: string;
  readonly status?: EnterpriseCustomerStatus;
  readonly keyword?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface EnterpriseListResult {
  readonly items: readonly EnterpriseOnboardingRecord[];
  readonly total: number;
}

export interface EnterpriseOnboardingRepository {
  register(command: RegisterEnterpriseCommand): Promise<EnterpriseMutationResult>;
  findById(id: string): Promise<EnterpriseOnboardingRecord | null>;
  patch(command: PatchEnterpriseCommand): Promise<EnterpriseMutationResult>;
  submit(command: SubmitEnterpriseCommand): Promise<EnterpriseMutationResult>;
  review(command: ReviewEnterpriseCommand): Promise<EnterpriseMutationResult>;
  suspend(command: SuspendEnterpriseCommand): Promise<EnterpriseMutationResult>;
  list(query: EnterpriseListQuery): Promise<EnterpriseListResult>;
}
