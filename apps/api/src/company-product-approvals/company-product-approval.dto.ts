import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductApprovalDecisionRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], type: String })
  readonly decision!: 'APPROVE' | 'REJECT';

  @ApiProperty({ maxLength: 1000, minLength: 2, type: String })
  readonly opinion!: string;

  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
}

export class ProductMaterialReviewSkuDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ type: String }) readonly supplierSkuCode!: string;
  @ApiProperty({ additionalProperties: true, type: Object })
  readonly attributes!: Record<string, unknown>;
}

export class ProductMaterialReviewDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ enum: ['PRODUCT_MATERIAL'], type: String })
  readonly approvalType!: 'PRODUCT_MATERIAL';
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierProductId!: string;
  @ApiProperty({ type: String }) readonly name!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) readonly brand!: string | null;
  @ApiProperty({ format: 'uuid', type: String }) readonly categoryId!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly templateVersion!: number;
  @ApiProperty({ additionalProperties: true, type: Object })
  readonly attributes!: Record<string, unknown>;
  @ApiProperty({ minimum: 0, type: Number }) readonly qualificationReferenceCount!: number;
  @ApiProperty({ type: Boolean }) readonly isRetailEnabled!: boolean;
  @ApiProperty({ type: Boolean }) readonly isEnterpriseProcurementEnabled!: boolean;
  @ApiProperty({ minimum: 0, type: Number }) readonly preparationMinutes!: number;
  @ApiProperty({ isArray: true, type: () => ProductMaterialReviewSkuDto })
  readonly skus!: readonly ProductMaterialReviewSkuDto[];
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'], type: String })
  readonly status!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiPropertyOptional({ nullable: true, type: String }) readonly reviewOpinion!: string | null;
  @ApiProperty({ format: 'date-time', type: String }) readonly createdAt!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly updatedAt!: string;
}

export class ProductMaterialReviewPageDto {
  @ApiProperty({ isArray: true, type: () => ProductMaterialReviewDto })
  readonly items!: readonly ProductMaterialReviewDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}

export class InitialPriceReviewSkuDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ type: String }) readonly supplierSkuCode!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly requestedSupplyPrice!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly requestedRetailSalePrice!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly requestedEnterpriseSalePrice!: number;
}

export class InitialPriceReviewDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ enum: ['PRODUCT_INITIAL_PRICE'], type: String })
  readonly approvalType!: 'PRODUCT_INITIAL_PRICE';
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierProductId!: string;
  @ApiProperty({ type: String }) readonly name!: string;
  @ApiProperty({ isArray: true, type: () => InitialPriceReviewSkuDto })
  readonly skus!: readonly InitialPriceReviewSkuDto[];
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'], type: String })
  readonly status!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiPropertyOptional({ nullable: true, type: String }) readonly reviewOpinion!: string | null;
  @ApiProperty({ format: 'date-time', type: String }) readonly createdAt!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly updatedAt!: string;
}

export class InitialPriceReviewPageDto {
  @ApiProperty({ isArray: true, type: () => InitialPriceReviewDto })
  readonly items!: readonly InitialPriceReviewDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}

export class ProductApprovalDecisionResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ enum: ['PRODUCT_MATERIAL', 'PRODUCT_INITIAL_PRICE'], type: String })
  readonly approvalType!: 'PRODUCT_MATERIAL' | 'PRODUCT_INITIAL_PRICE';
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierProductId!: string;
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'], type: String }) readonly status!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ type: String }) readonly reviewOpinion!: string;
  @ApiProperty({ enum: ['ACTIVE', 'REJECTED', 'WAITING_OTHER_APPROVAL'], type: String })
  readonly publicationStatus!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  readonly productId!: string | null;
}
