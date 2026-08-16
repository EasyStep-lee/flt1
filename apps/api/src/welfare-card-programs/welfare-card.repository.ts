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
  readonly scopeType: 'ALL_PRODUCTS' | 'CATEGORY' | 'PRODUCT' | 'SKU';
  readonly scopeRules: Readonly<{ schemaVersion: 1; includedIds: readonly string[]; excludedIds: readonly string[] }>;
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

export type WelfareMutationResult<T> =
  | { readonly kind: 'OK'; readonly value: T | { readonly duplicate: true }; readonly replayed: boolean }
  | { readonly kind: 'NOT_FOUND' | 'IDEMPOTENCY_CONFLICT' | 'DUPLICATE' };

export interface WelfareCardRepository {
  listPrograms(companyId: string): Promise<readonly WelfareProgramRecord[]>;
  createProgram(command: CreateWelfareProgramCommand): Promise<WelfareMutationResult<WelfareProgramRecord>>;
  createBatch(command: CreateWelfareBatchCommand): Promise<WelfareMutationResult<WelfareBatchRecord>>;
}
