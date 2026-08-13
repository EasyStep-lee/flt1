export const PRICE_CHANGE_REPOSITORY = Symbol('PRICE_CHANGE_REPOSITORY');

export type SupplyPriceChangeStatus =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EFFECTIVE'
  | 'CANCELLED';

export type PriceType = 'SUPPLY' | 'RETAIL' | 'ENTERPRISE';

export interface ListedSkuPriceRecord {
  readonly id: string;
  readonly companyId: string;
  readonly supplierId: string;
  readonly productName: string;
  readonly code: string;
  readonly approvedSupplyPrice: number;
  readonly currentRetailSalePrice: number;
  readonly currentEnterpriseSalePrice: number;
  readonly supplyPriceVersion: number;
  readonly retailPriceVersion: number;
  readonly enterprisePriceVersion: number;
}

export interface SupplyPriceChangeRecord {
  readonly id: string;
  readonly companyId: string;
  readonly supplierId: string;
  readonly skuId: string;
  readonly skuCode: string;
  readonly productName: string;
  readonly oldSupplyPrice: number;
  readonly requestedSupplyPrice: number;
  readonly currentApprovedSupplyPrice: number;
  readonly baseSupplyPriceVersion: number;
  readonly requestedEffectiveAt: string;
  readonly effectiveAt: string | null;
  readonly status: SupplyPriceChangeStatus;
  readonly reason: string;
  readonly applicantIdentityId: string;
  readonly reviewerIdentityId: string | null;
  readonly reviewOpinion: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SupplyPriceReviewHistoryRecord {
  readonly event: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'EFFECT' | 'CANCEL';
  readonly fromStatus: SupplyPriceChangeStatus | null;
  readonly toStatus: SupplyPriceChangeStatus;
  readonly version: number;
  readonly opinion: string | null;
  readonly occurredAt: string;
}

export interface SalePriceChangeResult {
  readonly skuId: string;
  readonly currentRetailSalePrice: number;
  readonly currentEnterpriseSalePrice: number;
  readonly retailPriceVersion: number;
  readonly enterprisePriceVersion: number;
  readonly effectiveAt: string;
  readonly reviewCreated: false;
  readonly scheduled: boolean;
}

export interface PriceEffectJob {
  readonly id: string;
  readonly effectiveAt: string;
}

export interface PriceMutationResult<T> {
  readonly body: T;
  readonly replayed: boolean;
  readonly jobs: readonly PriceEffectJob[];
}

export interface PriceMutationContext {
  readonly identityId: string;
  readonly functionalAccountId: string;
  readonly requestId: string;
  readonly ip: string | null;
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

export interface SubmitSupplyPriceChangeCommand extends PriceMutationContext {
  readonly supplierId: string;
  readonly skuId: string;
  readonly requestedSupplyPrice: number;
  readonly reason: string;
  readonly effectiveAt: string;
  readonly version: number;
}

export interface PatchSalePricesCommand extends PriceMutationContext {
  readonly supplierId: string;
  readonly skuId: string;
  readonly retailSalePrice?: number;
  readonly enterpriseSalePrice?: number;
  readonly retailPriceVersion?: number;
  readonly enterprisePriceVersion?: number;
  readonly reason: string;
  readonly effectiveAt: string;
}

export interface DecideSupplyPriceChangeCommand extends PriceMutationContext {
  readonly companyId: string;
  readonly taskId: string;
  readonly decision: 'APPROVE' | 'REJECT';
  readonly opinion: string;
  readonly version: number;
}

export interface PriceChangeRepository {
  listSupplierSkus(supplierId: string): Promise<readonly ListedSkuPriceRecord[]>;
  listSupplierSupplyReviews(supplierId: string): Promise<readonly SupplyPriceChangeRecord[]>;
  listCompanySupplyReviews(companyId: string): Promise<readonly SupplyPriceChangeRecord[]>;
  findCompanySupplyReview(companyId: string, taskId: string): Promise<SupplyPriceChangeRecord | null>;
  listSupplyReviewHistory(companyId: string, taskId: string): Promise<readonly SupplyPriceReviewHistoryRecord[] | null>;
  submitSupplyChange(command: SubmitSupplyPriceChangeCommand): Promise<PriceMutationResult<SupplyPriceChangeRecord>>;
  patchSalePrices(command: PatchSalePricesCommand): Promise<PriceMutationResult<SalePriceChangeResult>>;
  decideSupplyChange(command: DecideSupplyPriceChangeCommand): Promise<PriceMutationResult<SupplyPriceChangeRecord>>;
  effect(jobId: string, now?: Date): Promise<void>;
  markEffectFailed(jobId: string, errorCode: string, now?: Date): Promise<void>;
  listPendingEffects(): Promise<readonly PriceEffectJob[]>;
}
