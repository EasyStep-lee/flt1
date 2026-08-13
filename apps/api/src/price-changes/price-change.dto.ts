import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplyPriceChangeRequestDto {
  @ApiProperty({ minimum: 0, type: Number }) readonly requestedSupplyPrice!: number;
  @ApiProperty({ maxLength: 1000, minLength: 2, type: String }) readonly reason!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly effectiveAt!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ type: String }) readonly secondVerificationCode!: string;
}

export class SalePriceChangeRequestDto {
  @ApiPropertyOptional({ minimum: 0, type: Number }) readonly retailSalePrice?: number;
  @ApiPropertyOptional({ minimum: 0, type: Number }) readonly enterpriseSalePrice?: number;
  @ApiPropertyOptional({ minimum: 0, type: Number }) readonly retailPriceVersion?: number;
  @ApiPropertyOptional({ minimum: 0, type: Number }) readonly enterprisePriceVersion?: number;
  @ApiProperty({ maxLength: 1000, minLength: 2, type: String }) readonly reason!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly effectiveAt!: string;
  @ApiProperty({ type: String }) readonly secondVerificationCode!: string;
}

export class SupplyPriceDecisionRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], type: String }) readonly decision!: 'APPROVE' | 'REJECT';
  @ApiProperty({ maxLength: 1000, minLength: 2, type: String }) readonly opinion!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly version!: number;
  @ApiProperty({ type: String }) readonly secondVerificationCode!: string;
}

export class SupplyPriceChangeDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ enum: ['SUPPLY_PRICE_CHANGE'], type: String }) readonly approvalType!: 'SUPPLY_PRICE_CHANGE';
  @ApiProperty({ format: 'uuid', type: String }) readonly skuId!: string;
  @ApiProperty({ type: String }) readonly skuCode!: string;
  @ApiProperty({ type: String }) readonly productName!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly oldSupplyPrice!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly requestedSupplyPrice!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly currentApprovedSupplyPrice!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly requestedEffectiveAt!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String }) readonly effectiveAt!: string | null;
  @ApiProperty({ enum: ['SUBMITTED', 'APPROVED', 'REJECTED', 'EFFECTIVE', 'CANCELLED'], type: String }) readonly status!: string;
  @ApiProperty({ type: String }) readonly reason!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) readonly reviewOpinion!: string | null;
  @ApiProperty({ minimum: 1, type: Number }) readonly version!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly createdAt!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly updatedAt!: string;
}

export class SupplyPriceChangePageDto {
  @ApiProperty({ isArray: true, type: () => SupplyPriceChangeDto }) readonly items!: readonly SupplyPriceChangeDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}

export class SupplyPriceReviewHistoryItemDto {
  @ApiProperty({ enum: ['SUBMIT', 'APPROVE', 'REJECT', 'EFFECT', 'CANCEL'], type: String }) readonly event!: string;
  @ApiPropertyOptional({ enum: ['SUBMITTED', 'APPROVED', 'REJECTED', 'EFFECTIVE', 'CANCELLED'], nullable: true, type: String }) readonly fromStatus!: string | null;
  @ApiProperty({ enum: ['SUBMITTED', 'APPROVED', 'REJECTED', 'EFFECTIVE', 'CANCELLED'], type: String }) readonly toStatus!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly version!: number;
  @ApiPropertyOptional({ nullable: true, type: String }) readonly opinion!: string | null;
  @ApiProperty({ format: 'date-time', type: String }) readonly occurredAt!: string;
}

export class SupplyPriceReviewHistoryPageDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly taskId!: string;
  @ApiProperty({ isArray: true, type: () => SupplyPriceReviewHistoryItemDto }) readonly items!: readonly SupplyPriceReviewHistoryItemDto[];
}

export class SalePriceChangeResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly skuId!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly currentRetailSalePrice!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly currentEnterpriseSalePrice!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly retailPriceVersion!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly enterprisePriceVersion!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly effectiveAt!: string;
  @ApiProperty({ type: Boolean }) readonly reviewCreated!: false;
  @ApiProperty({ type: Boolean }) readonly scheduled!: boolean;
}

export class ListedSkuPriceDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ type: String }) readonly productName!: string;
  @ApiProperty({ type: String }) readonly code!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly approvedSupplyPrice!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly currentRetailSalePrice!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly currentEnterpriseSalePrice!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly supplyPriceVersion!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly retailPriceVersion!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly enterprisePriceVersion!: number;
}

export class ListedSkuPricePageDto {
  @ApiProperty({ isArray: true, type: () => ListedSkuPriceDto }) readonly items!: readonly ListedSkuPriceDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}
