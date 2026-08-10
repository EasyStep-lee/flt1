import { ApiProperty } from '@nestjs/swagger';

import { SUPPLIER_PRODUCT_STATUSES, type SupplierProductStatus } from '../supplier-products/supplier-product.policy.js';

export class InitialPriceRowRequestDto {
  @ApiProperty({ maxLength: 64, type: String })
  readonly supplierSkuCode!: string;

  @ApiProperty({ minimum: 0, type: Number })
  readonly requestedSupplyPrice!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly requestedRetailSalePrice!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly requestedEnterpriseSalePrice!: number;
}

export class InitialPricesRequestDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly requestId!: string;

  @ApiProperty({ isArray: true, type: () => InitialPriceRowRequestDto })
  readonly prices!: readonly InitialPriceRowRequestDto[];
}

export class InitialPriceReviewSummaryDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'], type: String })
  readonly status!: 'PENDING' | 'APPROVED' | 'REJECTED';
  @ApiProperty({ minimum: 1, type: Number }) readonly version!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly submittedAt!: string;
}

export class SupplierInitialPriceSkuDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ maxLength: 64, type: String })
  readonly supplierSkuCode!: string;
  @ApiProperty({ minimum: 0, nullable: true, type: Number })
  readonly requestedSupplyPrice!: number | null;
  @ApiProperty({ minimum: 0, nullable: true, type: Number })
  readonly requestedRetailSalePrice!: number | null;
  @ApiProperty({ minimum: 0, nullable: true, type: Number })
  readonly requestedEnterpriseSalePrice!: number | null;
}

export class SupplierInitialPricingProductDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierProductId!: string;
  @ApiProperty({ type: String }) readonly name!: string;
  @ApiProperty({ enum: SUPPLIER_PRODUCT_STATUSES, type: String })
  readonly status!: SupplierProductStatus;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ type: Boolean }) readonly initialPriceEditable!: boolean;
  @ApiProperty({ nullable: true, type: () => InitialPriceReviewSummaryDto })
  readonly latestReview!: InitialPriceReviewSummaryDto | null;
  @ApiProperty({ isArray: true, type: () => SupplierInitialPriceSkuDto })
  readonly skus!: readonly SupplierInitialPriceSkuDto[];
}

export class SupplierInitialPricingPageDto {
  @ApiProperty({ isArray: true, type: () => SupplierInitialPricingProductDto })
  readonly items!: readonly SupplierInitialPricingProductDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}

export class InitialPricesResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierProductId!: string;
  @ApiProperty({ enum: ['PENDING'], type: String }) readonly status!: 'PENDING';
  @ApiProperty({ minimum: 1, type: Number }) readonly version!: number;
  @ApiProperty({ isArray: true, type: () => InitialPriceRowRequestDto })
  readonly prices!: readonly InitialPriceRowRequestDto[];
}
