import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SUPPLIER_PRODUCT_STATUSES, type SupplierProductStatus } from './supplier-product.policy.js';

export class SupplierProductSkuDraftRequestDto {
  @ApiProperty({ maxLength: 64, type: String })
  readonly supplierSkuCode!: string;

  @ApiProperty({ additionalProperties: true, type: Object })
  readonly attributes!: Readonly<Record<string, unknown>>;

  @ApiProperty({ minimum: 0, type: Number })
  readonly initialStock!: number;
}

export class SupplierProductDraftRequestDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly categoryId!: string;

  @ApiProperty({ minimum: 1, type: Number })
  readonly templateVersion!: number;

  @ApiProperty({ maxLength: 200, type: String })
  readonly name!: string;

  @ApiProperty({ maxLength: 120, nullable: true, type: String })
  readonly brand!: string | null;

  @ApiProperty({ additionalProperties: true, type: Object })
  readonly attributes!: Readonly<Record<string, unknown>>;

  @ApiProperty({ items: { type: 'string' }, maxItems: 50, type: [String] })
  readonly qualificationReferences!: readonly string[];

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  readonly qualificationValidUntil?: string | null;

  @ApiProperty({ type: Boolean })
  readonly isRetailEnabled!: boolean;

  @ApiProperty({ type: Boolean })
  readonly isEnterpriseProcurementEnabled!: boolean;

  @ApiProperty({ minimum: 0, type: Number })
  readonly enterpriseMinOrderQty!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly enterprisePackageMultiple!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly preparationMinutes!: number;

  @ApiProperty({ type: () => [SupplierProductSkuDraftRequestDto] })
  readonly skus!: readonly SupplierProductSkuDraftRequestDto[];
}

export class SupplierProductPatchRequestDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiPropertyOptional({ format: 'uuid', type: String })
  readonly categoryId?: string;

  @ApiPropertyOptional({ minimum: 1, type: Number })
  readonly templateVersion?: number;

  @ApiPropertyOptional({ maxLength: 200, type: String })
  readonly name?: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true, type: String })
  readonly brand?: string | null;

  @ApiPropertyOptional({ additionalProperties: true, type: Object })
  readonly attributes?: Readonly<Record<string, unknown>>;

  @ApiPropertyOptional({ items: { type: 'string' }, maxItems: 50, type: [String] })
  readonly qualificationReferences?: readonly string[];

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  readonly qualificationValidUntil?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  readonly isRetailEnabled?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  readonly isEnterpriseProcurementEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, type: Number })
  readonly enterpriseMinOrderQty?: number;

  @ApiPropertyOptional({ minimum: 0, type: Number })
  readonly enterprisePackageMultiple?: number;

  @ApiPropertyOptional({ minimum: 0, type: Number })
  readonly preparationMinutes?: number;

  @ApiPropertyOptional({ type: () => [SupplierProductSkuDraftRequestDto] })
  readonly skus?: readonly SupplierProductSkuDraftRequestDto[];
}

export class SupplierProductSkuResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly id!: string;

  @ApiProperty({ maxLength: 64, type: String })
  readonly supplierSkuCode!: string;

  @ApiProperty({ additionalProperties: true, type: Object })
  readonly attributes!: Readonly<Record<string, unknown>>;

  @ApiProperty({ minimum: 0, type: Number })
  readonly initialStock!: number;

  @ApiProperty({ enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'], type: String })
  readonly status!: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

export class SupplierProductResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly id!: string;

  @ApiProperty({ format: 'uuid', type: String })
  readonly categoryId!: string;

  @ApiProperty({ minimum: 1, type: Number })
  readonly templateVersion!: number;

  @ApiProperty({ maxLength: 200, type: String })
  readonly name!: string;

  @ApiProperty({ maxLength: 120, nullable: true, type: String })
  readonly brand!: string | null;

  @ApiProperty({ additionalProperties: true, type: Object })
  readonly attributes!: Readonly<Record<string, unknown>>;

  @ApiProperty({ minimum: 0, type: Number })
  readonly qualificationReferenceCount!: number;

  @ApiProperty({ format: 'date-time', nullable: true, required: true, type: String })
  readonly qualificationValidUntil!: string | null;

  @ApiProperty({ type: Boolean })
  readonly isRetailEnabled!: boolean;

  @ApiProperty({ type: Boolean })
  readonly isEnterpriseProcurementEnabled!: boolean;

  @ApiProperty({ minimum: 0, type: Number })
  readonly enterpriseMinOrderQty!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly enterprisePackageMultiple!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly preparationMinutes!: number;

  @ApiProperty({ enum: SUPPLIER_PRODUCT_STATUSES, type: String })
  readonly status!: SupplierProductStatus;

  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiProperty({ type: () => [SupplierProductSkuResponseDto] })
  readonly skus!: readonly SupplierProductSkuResponseDto[];
}

export class SubmitProductMaterialRequestDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiProperty({ format: 'uuid', type: String })
  readonly requestId!: string;
}

export class ProductMaterialApprovalResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly id!: string;

  @ApiProperty({ enum: ['PRODUCT_MATERIAL'], type: String })
  readonly approvalType!: 'PRODUCT_MATERIAL';

  @ApiProperty({ enum: ['SUPPLIER_PRODUCT'], type: String })
  readonly objectType!: 'SUPPLIER_PRODUCT';

  @ApiProperty({ format: 'uuid', type: String })
  readonly objectId!: string;

  @ApiProperty({ enum: ['PENDING'], type: String })
  readonly status!: 'PENDING';

  @ApiProperty({ enum: ['COMPANY_PRODUCT_OPS'], type: String })
  readonly assignedAccountTypeCode!: 'COMPANY_PRODUCT_OPS';

  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;
}

export class SupplierProductChannelVisibilityRequestDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiProperty({ type: Boolean })
  readonly isRetailEnabled!: boolean;

  @ApiProperty({ type: Boolean })
  readonly isEnterpriseProcurementEnabled!: boolean;

  @ApiProperty({ minimum: 0, type: Number })
  readonly enterpriseMinOrderQty!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly enterprisePackageMultiple!: number;

  @ApiProperty({ maxLength: 1000, minLength: 1, type: String })
  readonly reason!: string;
}

export class SupplierProductChannelVisibilityResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly supplierProductId!: string;

  @ApiProperty({ format: 'uuid', type: String })
  readonly productId!: string;

  @ApiProperty({ minimum: 0, type: Number })
  readonly supplierProductVersion!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly productVersion!: number;

  @ApiProperty({ type: Boolean })
  readonly isRetailEnabled!: boolean;

  @ApiProperty({ type: Boolean })
  readonly isEnterpriseProcurementEnabled!: boolean;

  @ApiProperty({ minimum: 0, type: Number })
  readonly enterpriseMinOrderQty!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly enterprisePackageMultiple!: number;
}

export class ProductChannelVisibilitySnapshotDto {
  @ApiProperty({ type: Boolean }) readonly isRetailEnabled!: boolean;
  @ApiProperty({ type: Boolean }) readonly isEnterpriseProcurementEnabled!: boolean;
  @ApiProperty({ minimum: 0, type: Number }) readonly enterpriseMinOrderQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly enterprisePackageMultiple!: number;
}

export class ProductChannelVisibilityHistoryItemDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly productId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierProductId!: string;
  @ApiProperty({ enum: ['INITIAL', 'CHANGE'] }) readonly event!: 'INITIAL' | 'CHANGE';
  @ApiProperty({ minimum: 0, type: Number }) readonly fromVersion!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly toVersion!: number;
  @ApiProperty({ type: ProductChannelVisibilitySnapshotDto })
  readonly before!: ProductChannelVisibilitySnapshotDto;
  @ApiProperty({ type: ProductChannelVisibilitySnapshotDto })
  readonly after!: ProductChannelVisibilitySnapshotDto;
  @ApiProperty({ maxLength: 1000, type: String }) readonly reason!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly occurredAt!: string;
}

export class ProductChannelVisibilityHistoryPageDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierProductId!: string;
  @ApiProperty({ type: [ProductChannelVisibilityHistoryItemDto] })
  readonly items!: readonly ProductChannelVisibilityHistoryItemDto[];
}
