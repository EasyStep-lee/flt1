import type { WelfareScopeRules, WelfareScopeType } from './welfare-card-scope.policy.js';

export const WELFARE_CARD_REPOSITORY = Symbol('WELFARE_CARD_REPOSITORY');
export type WelfareFundingType = 'ENTERPRISE_GRANT' | 'COMPANY_GIFT' | 'PHYSICAL_CARD_OR_CODE';
export type WelfareClaimMode = 'ENTERPRISE_ASSIGNED' | 'COMPANY_ASSIGNED' | 'PHYSICAL_CARD_OR_CODE';

export interface WelfareHistoryRecord {
  readonly event: 'PROGRAM_CREATED' | 'BATCH_CREATED';
  readonly resultingVersion: number;
  readonly occurredAt: string;
}

export interface WelfareBatchRecord {
  readonly id: string;
  readonly companyId: string;
  readonly programId: string;
  readonly enterpriseCustomerId: string | null;
  readonly batchNo: string;
  readonly totalAmount: number;
  readonly unitAmount: number;
  readonly issueCount: number;
  readonly claimMode: WelfareClaimMode;
  readonly agreementVersion: number;
  readonly status: 'DRAFT';
  readonly version: number;
  readonly createdAt: string;
  readonly history: readonly WelfareHistoryRecord[];
}

export interface WelfareProgramRecord {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly fundingType: WelfareFundingType;
  readonly issuerType: 'COMPANY';
  readonly scopeType: WelfareScopeType;
  readonly scopeRules: WelfareScopeRules;
  readonly canPayDeliveryFee: boolean;
  readonly refundPolicy: string;
  readonly complianceStatus: 'DRAFT';
  readonly status: 'DRAFT';
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly WelfareHistoryRecord[];
  readonly batches?: readonly WelfareBatchRecord[];
}

interface WelfareCommandBase {
  readonly companyId: string;
  readonly actorIdentityId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly ip: string | null;
}

export interface CreateWelfareProgramCommand extends WelfareCommandBase {
  readonly name: string;
  readonly fundingType: WelfareFundingType;
  readonly scopeType: WelfareProgramRecord['scopeType'];
  readonly scopeRules: WelfareProgramRecord['scopeRules'];
  readonly canPayDeliveryFee: boolean;
  readonly refundPolicy: string;
}

export interface CreateWelfareBatchCommand extends WelfareCommandBase {
  readonly programId: string;
  readonly enterpriseCustomerId: string | null;
  readonly batchNo: string;
  readonly totalAmount: number;
  readonly unitAmount: number;
  readonly issueCount: number;
  readonly claimMode: WelfareClaimMode;
  readonly agreementVersion: number;
}

export type WelfareCardBindingMethod = 'CARD_PASSWORD' | 'REDEMPTION_CODE' | 'SCAN_CODE';

export interface WelfareCardAccountRecord {
  readonly id: string;
  readonly companyId: string;
  readonly consumerUserId: string;
  readonly programId: string;
  readonly programName: string;
  readonly batchId: string;
  readonly batchNo: string;
  readonly cardNo: string;
  readonly balanceAmount: number;
  readonly frozenAmount: number;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CLOSED';
  readonly version: number;
  readonly claimedAt: string;
}

export interface WelfareCardEligibilityAccountRecord extends WelfareCardAccountRecord {
  readonly scopeType: WelfareProgramRecord['scopeType'];
  readonly scopeRules: WelfareProgramRecord['scopeRules'];
  readonly canPayDeliveryFee: boolean;
}

export type WelfareCardLedgerBusinessType =
  | 'CLAIM' | 'GRANT' | 'GIFT' | 'FREEZE' | 'RELEASE' | 'CAPTURE'
  | 'REFUND' | 'REVERSAL' | 'ADJUSTMENT';

export interface WelfareCardLedgerRecord {
  readonly id: string;
  readonly accountId: string;
  readonly sequence: number;
  readonly businessType: WelfareCardLedgerBusinessType;
  readonly direction: 'CREDIT' | 'DEBIT';
  readonly amount: number;
  readonly beforeBalance: number;
  readonly afterBalance: number;
  readonly beforeFrozen: number;
  readonly afterFrozen: number;
  readonly orderId: string | null;
  readonly refundId: string | null;
  readonly adjustmentId: string | null;
  readonly occurredAt: string;
}

export interface WelfareCardLedgerView {
  readonly account: WelfareCardAccountRecord;
  readonly items: readonly WelfareCardLedgerRecord[];
}

export interface WelfareCardAdjustmentRecord {
  readonly id: string;
  readonly accountId: string;
  readonly businessType: 'ADJUSTMENT' | 'REVERSAL';
  readonly direction: 'CREDIT' | 'DEBIT';
  readonly amount: number;
  readonly reversalOfLedgerId: string | null;
  readonly reason: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly version: number;
  readonly applicantIdentityId: string;
  readonly applicantFunctionalAccountId: string;
  readonly reviewerIdentityId: string | null;
  readonly reviewerFunctionalAccountId: string | null;
  readonly reviewOpinion: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWelfareCardAdjustmentCommand {
  readonly companyId: string;
  readonly accountId: string;
  readonly businessType: 'ADJUSTMENT' | 'REVERSAL';
  readonly direction: 'CREDIT' | 'DEBIT' | null;
  readonly amount: number | null;
  readonly reversalOfLedgerId: string | null;
  readonly reason: string;
  readonly actorIdentityId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly ip: string | null;
}

export interface DecideWelfareCardAdjustmentCommand {
  readonly companyId: string;
  readonly adjustmentId: string;
  readonly reviewerIdentityId: string;
  readonly functionalAccountId: string;
  readonly expectedVersion: number;
  readonly decision: 'APPROVE' | 'REJECT';
  readonly opinion: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly ip: string | null;
}

export type WelfareCardLedgerLookupResult =
  | { readonly kind: 'OK'; readonly value: WelfareCardLedgerView }
  | { readonly kind: 'NOT_FOUND' | 'INCONSISTENT' };

export type WelfareCardAdjustmentMutationResult =
  | { readonly kind: 'OK'; readonly value: WelfareCardAdjustmentRecord; readonly replayed: boolean }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' | 'NOT_FOUND' | 'REVERSAL_INVALID' | 'SAME_NATURAL_PERSON' | 'STATE_INVALID' | 'VERSION_CONFLICT' | 'INSUFFICIENT_BALANCE' };

export interface BindWelfareCardCommand {
  readonly companyId: string;
  readonly consumerUserId: string;
  readonly method: WelfareCardBindingMethod;
  readonly cardNo: string;
  readonly secret: string;
  readonly agreementVersion: number;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
}

export type WelfareCardBindingResult =
  | { readonly kind: 'OK'; readonly value: WelfareCardAccountRecord; readonly replayed: boolean }
  | { readonly kind: 'CARD_CODE_INVALID'; readonly reason: 'CREDENTIAL' | 'STATE' | 'AGREEMENT' }
  | { readonly kind: 'CARD_ALREADY_CLAIMED' }
  | { readonly kind: 'CARD_RECIPIENT_MISMATCH' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' };

export type WelfareMutationResult<T> =
  | { readonly kind: 'OK'; readonly value: T | { readonly duplicate: true }; readonly replayed: boolean }
  | { readonly kind: 'NOT_FOUND' | 'IDEMPOTENCY_CONFLICT' | 'DUPLICATE' };

export interface WelfareCardRepository {
  listPrograms(companyId: string): Promise<readonly WelfareProgramRecord[]>;
  createProgram(command: CreateWelfareProgramCommand): Promise<WelfareMutationResult<WelfareProgramRecord>>;
  createBatch(command: CreateWelfareBatchCommand): Promise<WelfareMutationResult<WelfareBatchRecord>>;
  bindCard(command: BindWelfareCardCommand): Promise<WelfareCardBindingResult>;
  listEligibilityAccounts(companyId: string, consumerUserId: string): Promise<readonly WelfareCardEligibilityAccountRecord[]>;
  getConsumerLedger(companyId: string, consumerUserId: string, accountId: string): Promise<WelfareCardLedgerLookupResult>;
  listCompanyAccounts(companyId: string): Promise<readonly WelfareCardAccountRecord[]>;
  getCompanyLedger(companyId: string, accountId: string): Promise<WelfareCardLedgerLookupResult>;
  listAdjustments(companyId: string): Promise<readonly WelfareCardAdjustmentRecord[]>;
  createAdjustment(command: CreateWelfareCardAdjustmentCommand): Promise<WelfareCardAdjustmentMutationResult>;
  decideAdjustment(command: DecideWelfareCardAdjustmentCommand): Promise<WelfareCardAdjustmentMutationResult>;
}
