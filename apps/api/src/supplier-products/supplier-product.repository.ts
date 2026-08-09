import type {
  JsonObject,
  SupplierProductDraftInput,
  SupplierProductSkuStatus,
  SupplierProductStatus,
} from './supplier-product.policy.js';

export const SUPPLIER_PRODUCT_REPOSITORY = Symbol('SUPPLIER_PRODUCT_REPOSITORY');

export interface SupplierProductCompanyRecord {
  readonly id: string;
  readonly legalName: string;
  readonly platformName: string;
  readonly status: 'ACTIVE' | 'SUSPENDED';
}

export interface SupplierProductSupplierRecord {
  readonly id: string;
  readonly companyId: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'EXITING' | 'EXITED';
}

export interface SupplierProductSkuRecord {
  readonly id: string;
  readonly supplierProductId: string;
  readonly supplierSkuCode: string;
  readonly attributes: JsonObject;
  readonly requestedSupplyPrice: number | null;
  readonly requestedRetailSalePrice: number | null;
  readonly requestedEnterpriseSalePrice: number | null;
  readonly initialStock: number;
  readonly status: SupplierProductSkuStatus;
}

export interface SupplierProductRecord {
  readonly id: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly name: string;
  readonly brand: string | null;
  readonly attributes: JsonObject;
  readonly qualificationSnapshot: {
    readonly schemaVersion: '1.0';
    readonly references: readonly string[];
  };
  readonly isRetailEnabled: boolean;
  readonly isEnterpriseProcurementEnabled: boolean;
  readonly enterpriseMinOrderQty: number;
  readonly enterprisePackageMultiple: number;
  readonly preparationMinutes: number;
  readonly status: SupplierProductStatus;
  readonly version: number;
  readonly submittedAt: string | null;
  readonly skus: readonly SupplierProductSkuRecord[];
}

export interface ProductMaterialApprovalRecord {
  readonly id: string;
  readonly approvalType: 'PRODUCT_MATERIAL';
  readonly objectType: 'SUPPLIER_PRODUCT';
  readonly objectId: string;
  readonly status: 'PENDING';
  readonly assignedAccountTypeCode: 'COMPANY_PRODUCT_OPS';
  readonly version: number;
}

export type ProductApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ProductApprovalType = 'PRODUCT_MATERIAL' | 'PRODUCT_INITIAL_PRICE';

export interface ProductMaterialReviewRecord {
  readonly id: string;
  readonly approvalType: 'PRODUCT_MATERIAL';
  readonly supplierId: string;
  readonly supplierProductId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly attributes: JsonObject;
  readonly qualificationReferenceCount: number;
  readonly isRetailEnabled: boolean;
  readonly isEnterpriseProcurementEnabled: boolean;
  readonly preparationMinutes: number;
  readonly skus: readonly {
    readonly id: string;
    readonly supplierSkuCode: string;
    readonly attributes: JsonObject;
  }[];
  readonly status: ProductApprovalStatus;
  readonly version: number;
  readonly reviewOpinion: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InitialPriceReviewRecord {
  readonly id: string;
  readonly approvalType: 'PRODUCT_INITIAL_PRICE';
  readonly supplierId: string;
  readonly supplierProductId: string;
  readonly name: string;
  readonly skus: readonly {
    readonly id: string;
    readonly supplierSkuCode: string;
    readonly requestedSupplyPrice: number;
    readonly requestedRetailSalePrice: number;
    readonly requestedEnterpriseSalePrice: number;
  }[];
  readonly status: ProductApprovalStatus;
  readonly version: number;
  readonly reviewOpinion: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StageInitialPricesCommand {
  readonly supplierProductId: string;
  readonly applicantIdentityId: string;
  readonly applicantFunctionalAccountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly prices: readonly {
    readonly supplierSkuCode: string;
    readonly requestedSupplyPrice: number;
    readonly requestedRetailSalePrice: number;
    readonly requestedEnterpriseSalePrice: number;
  }[];
}

export interface DecideProductApprovalCommand {
  readonly companyId: string;
  readonly taskId: string;
  readonly approvalType: ProductApprovalType;
  readonly expectedVersion: number;
  readonly decision: 'APPROVE' | 'REJECT';
  readonly opinion: string;
  readonly actorIdentityId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly ip: string | null;
}

export interface ProductApprovalDecisionRecord {
  readonly id: string;
  readonly approvalType: ProductApprovalType;
  readonly supplierProductId: string;
  readonly status: 'APPROVED' | 'REJECTED';
  readonly version: number;
  readonly reviewOpinion: string;
}

export type ProductPublicationCandidate = MaterializeApprovedProductCommand;

export interface MaterializedProductRecord {
  readonly productId: string;
  readonly supplierProductId: string;
  readonly saleStatus: 'ACTIVE';
  readonly skuIds: readonly string[];
}

export interface SellableProductSummary {
  readonly productId: string;
  readonly supplierProductId: string;
  readonly saleStatus: 'ACTIVE';
  readonly skuCount: number;
}

export interface CreateSupplierProductCommand extends SupplierProductDraftInput {
  readonly supplierId: string;
  readonly actorIdentityId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

export interface PatchSupplierProductCommand {
  readonly supplierId: string;
  readonly supplierProductId: string;
  readonly expectedVersion: number;
  readonly actorIdentityId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly patch: Partial<SupplierProductDraftInput>;
}

export interface SubmitSupplierProductCommand {
  readonly supplierId: string;
  readonly supplierProductId: string;
  readonly expectedVersion: number;
  readonly requestId: string;
  readonly actorIdentityId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

export interface MaterializeApprovedProductCommand {
  readonly supplierProductId: string;
  readonly materialVersion: number;
  readonly priceVersion: number;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly detailSnapshot: JsonObject;
  readonly afterSaleSnapshot: JsonObject;
  readonly deliveryRuleId: string;
}

export type SupplierProductFailureKind =
  | 'APPROVAL_NOT_FOUND'
  | 'APPROVAL_STATE_INVALID'
  | 'APPROVAL_VERSION_CONFLICT'
  | 'AUDIT_REQUIRED'
  | 'COMPANY_INVARIANT'
  | 'DUPLICATE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NOT_FOUND'
  | 'PRODUCT_APPROVAL_INCOMPLETE'
  | 'STATE_INVALID'
  | 'SUPPLIER_INACTIVE'
  | 'SELF_APPROVAL_FORBIDDEN'
  | 'VERSION_CONFLICT';

export type SupplierProductMutationResult<T> =
  | { readonly kind: 'OK'; readonly value: T; readonly replayed: boolean }
  | { readonly kind: SupplierProductFailureKind };

export interface SupplierProductRepository {
  createDraft(
    command: CreateSupplierProductCommand,
  ): Promise<SupplierProductMutationResult<SupplierProductRecord>>;
  patchDraft(
    command: PatchSupplierProductCommand,
  ): Promise<SupplierProductMutationResult<SupplierProductRecord>>;
  submitMaterial(
    command: SubmitSupplierProductCommand,
  ): Promise<
    SupplierProductMutationResult<{
      readonly supplierProduct: SupplierProductRecord;
      readonly approvalTask: ProductMaterialApprovalRecord;
    }>
  >;
  stageInitialPrices(
    command: StageInitialPricesCommand,
  ): Promise<SupplierProductMutationResult<InitialPriceReviewRecord>>;
  listMaterialReviews(companyId: string): Promise<readonly ProductMaterialReviewRecord[]>;
  listInitialPriceReviews(companyId: string): Promise<readonly InitialPriceReviewRecord[]>;
  decideProductApproval(
    command: DecideProductApprovalCommand,
  ): Promise<SupplierProductMutationResult<ProductApprovalDecisionRecord>>;
  resolvePublicationCandidate(
    supplierProductId: string,
  ): Promise<ProductPublicationCandidate | null>;
  materializeApproved(
    command: MaterializeApprovedProductCommand,
  ): Promise<SupplierProductMutationResult<MaterializedProductRecord>>;
  findSellableProductBySupplierProductId(
    supplierProductId: string,
  ): Promise<SellableProductSummary | null>;
}
