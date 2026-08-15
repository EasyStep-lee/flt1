export const ENTERPRISE_CUSTOMER_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'CORRECTION_REQUIRED',
  'ACTIVE',
  'SUSPENDED',
  'REJECTED',
] as const;

export type EnterpriseCustomerStatus = (typeof ENTERPRISE_CUSTOMER_STATUSES)[number];

export const ENTERPRISE_REVIEW_DECISIONS = [
  'REQUEST_CORRECTION',
  'APPROVE',
  'REJECT',
] as const;

export type EnterpriseReviewDecision = (typeof ENTERPRISE_REVIEW_DECISIONS)[number];

export const ENTERPRISE_CORRECTION_FIELDS = [
  'LEGAL_NAME',
  'CREDIT_CODE',
  'REGISTERED_ADDRESS',
  'ENTERPRISE_TYPE',
  'BUSINESS_LICENSE',
  'CONTACT',
  'INVOICE_PROFILE',
  'SHIPPING_ADDRESS',
  'AGREEMENT',
] as const;

export type EnterpriseCorrectionField = (typeof ENTERPRISE_CORRECTION_FIELDS)[number];

const creditCodePattern = /^[0-9A-HJ-NPQRTUWXY]{18}$/u;

export const normalizeCreditCode = (value: string): string =>
  value.trim().toUpperCase();

export const isValidCreditCode = (value: string): boolean =>
  creditCodePattern.test(value);

export const maskCreditCode = (value: string): string =>
  value.length < 8 ? '****' : `${value.slice(0, 4)}**********${value.slice(-4)}`;

export const maskMobile = (value: string): string =>
  value.length < 7 ? '****' : `${value.slice(0, 3)}****${value.slice(-4)}`;

export const maskTaxNumber = (value: string): string =>
  value.length < 8 ? '****' : `${value.slice(0, 4)}********${value.slice(-4)}`;

export const maskBankAccount = (value: string): string => {
  const digits = value.replace(/\s+/gu, '');
  return digits.length < 4 ? '****' : `**** **** **** ${digits.slice(-4)}`;
};

export const canEnterpriseApplicantEdit = (status: EnterpriseCustomerStatus): boolean =>
  status === 'DRAFT' || status === 'CORRECTION_REQUIRED';

export const canEnterpriseApplicantSubmit = (
  status: EnterpriseCustomerStatus,
): boolean => status === 'DRAFT' || status === 'CORRECTION_REQUIRED';

export const resolveEnterpriseReviewStatus = (
  status: EnterpriseCustomerStatus,
  decision: EnterpriseReviewDecision,
): EnterpriseCustomerStatus | null => {
  if (status !== 'PENDING_REVIEW') return null;
  if (decision === 'REQUEST_CORRECTION') return 'CORRECTION_REQUIRED';
  if (decision === 'APPROVE') return 'ACTIVE';
  return 'REJECTED';
};

export const resolveEnterpriseNextAction = (
  status: EnterpriseCustomerStatus,
): 'COMPLETE_PROFILE' | 'CORRECT_AND_RESUBMIT' | 'REVIEW_IN_PROGRESS' | 'ENTER_WORKSPACE' | 'CONTACT_SUPPORT' => {
  if (status === 'DRAFT') return 'COMPLETE_PROFILE';
  if (status === 'CORRECTION_REQUIRED') return 'CORRECT_AND_RESUBMIT';
  if (status === 'ACTIVE') return 'ENTER_WORKSPACE';
  if (status === 'SUSPENDED' || status === 'REJECTED') return 'CONTACT_SUPPORT';
  return 'REVIEW_IN_PROGRESS';
};
