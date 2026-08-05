import type {
  SupplierOnboardingEvent,
  SupplierQualificationSnapshot,
  SupplierStatus,
} from './supplier-onboarding.policy.js';

export const SUPPLIER_ONBOARDING_REPOSITORY = Symbol(
  'SUPPLIER_ONBOARDING_REPOSITORY',
);

export interface OnboardingCompanyRecord {
  readonly id: string;
  readonly legalName: string;
  readonly platformName: string;
  readonly status: 'ACTIVE' | 'SUSPENDED';
}

export interface SupplierOnboardingRecord {
  readonly id: string;
  readonly companyId: string;
  readonly legalName: string;
  readonly creditCode: string;
  readonly status: SupplierStatus;
  readonly pickupAddress: string | null;
  readonly pickupLat: number | null;
  readonly pickupLng: number | null;
  readonly settlementAccountMasked: string | null;
  readonly qualificationSnapshot: SupplierQualificationSnapshot;
  readonly version: number;
  readonly submittedAt: string | null;
}

export interface ApprovalTaskRecord {
  readonly id: string;
  readonly approvalType: 'SUPPLIER_ONBOARDING';
  readonly objectType: 'SUPPLIER';
  readonly objectId: string;
  readonly applicantType: 'SUPPLIER_USER';
  readonly applicantId: string;
  readonly status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  readonly assignedAccountTypeCode: 'COMPANY_SUPPLIER_OPS';
  readonly reviewedBy: string | null;
  readonly reviewOpinion: string | null;
  readonly version: number;
}

export interface SupplierStatusHistoryRecord {
  readonly id: string;
  readonly supplierId: string;
  readonly fromStatus: SupplierStatus | null;
  readonly toStatus: SupplierStatus;
  readonly event: SupplierOnboardingEvent;
  readonly actorIdentityId: string | null;
  readonly version: number;
  readonly occurredAt: string;
}

export interface RegisterSupplierCommand {
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly legalName: string;
  readonly creditCode: string;
  readonly pickupAddress: string | null;
  readonly pickupLat: number | null;
  readonly pickupLng: number | null;
  readonly qualificationSnapshot: SupplierQualificationSnapshot;
}

export interface PatchSupplierCommand {
  readonly supplierId: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly pickupAddress?: string | null;
  readonly pickupLat?: number | null;
  readonly pickupLng?: number | null;
  readonly qualificationSnapshot?: SupplierQualificationSnapshot;
}

export interface SubmitSupplierCommand {
  readonly supplierId: string;
  readonly applicantIdentityId: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly event: 'SUBMIT' | 'RESUBMIT';
}

export interface ReviewSupplierCommand {
  readonly companyId: string;
  readonly supplierId: string;
  readonly reviewerIdentityId: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly decision: 'REQUEST_CORRECTION' | 'APPROVE';
  readonly opinion: string;
}

export interface SupplierListQuery {
  readonly companyId: string;
  readonly status?: SupplierStatus;
  readonly keyword?: string;
  readonly page: number;
  readonly pageSize: number;
}

export type SupplierMutationFailureKind =
  | 'APPROVAL_VERSION_CONFLICT'
  | 'COMPANY_INVARIANT'
  | 'DUPLICATE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NOT_FOUND'
  | 'SAME_NATURAL_PERSON'
  | 'STATE_INVALID'
  | 'VERSION_CONFLICT';

export type SupplierMutationResult<T> =
  | { readonly kind: 'OK'; readonly value: T; readonly replayed: boolean }
  | { readonly kind: SupplierMutationFailureKind };

export interface SupplierOnboardingRepository {
  register(
    command: RegisterSupplierCommand,
  ): Promise<SupplierMutationResult<SupplierOnboardingRecord>>;
  findSupplier(supplierId: string): Promise<SupplierOnboardingRecord | null>;
  patchSupplier(
    command: PatchSupplierCommand,
  ): Promise<SupplierMutationResult<SupplierOnboardingRecord>>;
  submitSupplier(
    command: SubmitSupplierCommand,
  ): Promise<
    SupplierMutationResult<{
      readonly supplier: SupplierOnboardingRecord;
      readonly approvalTask: ApprovalTaskRecord;
    }>
  >;
  listSuppliers(query: SupplierListQuery): Promise<{
    readonly items: readonly SupplierOnboardingRecord[];
    readonly total: number;
  }>;
  reviewSupplier(
    command: ReviewSupplierCommand,
  ): Promise<SupplierMutationResult<SupplierOnboardingRecord>>;
}
