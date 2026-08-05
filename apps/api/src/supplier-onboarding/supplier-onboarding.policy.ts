import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';

export const SUPPLIER_STATUSES = Object.freeze([
  'DRAFT',
  'PENDING_REVIEW',
  'CORRECTION_REQUIRED',
  'ACTIVE',
  'SUSPENDED',
  'EXITING',
  'EXITED',
] as const);

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const SUPPLIER_ONBOARDING_EVENTS = Object.freeze([
  'REGISTER',
  'SUBMIT',
  'REQUEST_CORRECTION',
  'RESUBMIT',
  'APPROVE',
  'SUSPEND',
  'START_EXIT',
  'COMPLETE_EXIT',
] as const);

export type SupplierOnboardingEvent =
  (typeof SUPPLIER_ONBOARDING_EVENTS)[number];

export type SupplierOnboardingPolicyErrorCode = Extract<
  ApiErrorCode,
  'STATE_TRANSITION_INVALID' | 'VALIDATION_FAILED'
>;

export class SupplierOnboardingPolicyError extends SafeApiError {
  constructor(
    statusCode: 409 | 422,
    code: SupplierOnboardingPolicyErrorCode,
    message: string,
  ) {
    super(statusCode, code, message);
    this.name = 'SupplierOnboardingPolicyError';
  }
}

const transitions: Readonly<
  Partial<Record<SupplierStatus, Partial<Record<SupplierOnboardingEvent, SupplierStatus>>>>
> = Object.freeze({
  DRAFT: Object.freeze({ SUBMIT: 'PENDING_REVIEW' }),
  PENDING_REVIEW: Object.freeze({
    APPROVE: 'ACTIVE',
    REQUEST_CORRECTION: 'CORRECTION_REQUIRED',
  }),
  CORRECTION_REQUIRED: Object.freeze({ RESUBMIT: 'PENDING_REVIEW' }),
  ACTIVE: Object.freeze({ START_EXIT: 'EXITING', SUSPEND: 'SUSPENDED' }),
  EXITING: Object.freeze({ COMPLETE_EXIT: 'EXITED' }),
});

export const resolveSupplierTransition = (
  current: SupplierStatus,
  event: SupplierOnboardingEvent,
): SupplierStatus => {
  const next = transitions[current]?.[event];
  if (!next) {
    throw new SupplierOnboardingPolicyError(
      409,
      'STATE_TRANSITION_INVALID',
      'Supplier state transition is not allowed',
    );
  }
  return next;
};

export const normalizeCreditCode = (value: string): string =>
  value.trim().toUpperCase();

export const isValidCreditCode = (value: string): boolean =>
  /^[0-9A-HJ-NP-RTUWXY]{18}$/u.test(value);

export const maskCreditCode = (value: string): string =>
  `${value.slice(0, 4)}**********${value.slice(-4)}`;

export interface SupplierQualificationSnapshot {
  readonly schemaVersion: '1.0';
  readonly files: readonly string[];
  readonly applicant?: {
    readonly agreementVersion: string;
    readonly contactName: string;
    readonly email?: string;
    readonly mobile: string;
  };
}

export interface SupplierSubmissionCandidate {
  readonly pickupAddress: string | null;
  readonly pickupLat: number | null;
  readonly pickupLng: number | null;
  readonly qualificationSnapshot: SupplierQualificationSnapshot;
}

export interface SupplierSubmissionIssue {
  readonly field:
    | 'pickupAddress'
    | 'pickupLat'
    | 'pickupLng'
    | 'qualificationFiles';
  readonly reason: string;
}

export const collectSupplierSubmissionIssues = (
  supplier: SupplierSubmissionCandidate,
): readonly SupplierSubmissionIssue[] => {
  const issues: SupplierSubmissionIssue[] = [];
  if (supplier.qualificationSnapshot.files.length === 0) {
    issues.push({
      field: 'qualificationFiles',
      reason: 'At least one qualification file reference is required',
    });
  }
  if (!supplier.pickupAddress?.trim() || supplier.pickupAddress.length > 500) {
    issues.push({
      field: 'pickupAddress',
      reason: 'Pickup address is required and must not exceed 500 characters',
    });
  }
  if (
    supplier.pickupLat === null ||
    !Number.isFinite(supplier.pickupLat) ||
    supplier.pickupLat < -90 ||
    supplier.pickupLat > 90
  ) {
    issues.push({ field: 'pickupLat', reason: 'Pickup latitude is invalid' });
  }
  if (
    supplier.pickupLng === null ||
    !Number.isFinite(supplier.pickupLng) ||
    supplier.pickupLng < -180 ||
    supplier.pickupLng > 180
  ) {
    issues.push({ field: 'pickupLng', reason: 'Pickup longitude is invalid' });
  }
  return issues;
};
