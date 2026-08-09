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
  | 'COMPANY_INVARIANT'
  | 'DUPLICATE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NOT_FOUND'
  | 'PRODUCT_APPROVAL_INCOMPLETE'
  | 'STATE_INVALID'
  | 'SUPPLIER_INACTIVE'
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
  materializeApproved(
    command: MaterializeApprovedProductCommand,
  ): Promise<SupplierProductMutationResult<MaterializedProductRecord>>;
  findSellableProductBySupplierProductId(
    supplierProductId: string,
  ): Promise<SellableProductSummary | null>;
}
