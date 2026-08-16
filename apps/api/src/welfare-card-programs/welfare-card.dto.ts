import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WelfareScopeRulesDto {
  @ApiProperty({ enum: [1], type: Number }) readonly schemaVersion!: 1;
  @ApiProperty({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly includedIds!: readonly string[];
  @ApiProperty({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly excludedIds!: readonly string[];
}

export class CreateWelfareProgramRequestDto {
  @ApiProperty({ maxLength: 191, minLength: 2, type: String }) readonly name!: string;
  @ApiProperty({ enum: ['ENTERPRISE_GRANT', 'COMPANY_GIFT', 'PHYSICAL_CARD_OR_CODE'], type: String }) readonly fundingType!: string;
  @ApiProperty({ enum: ['ALL_PRODUCTS', 'CATEGORY', 'PRODUCT', 'SKU'], type: String }) readonly scopeType!: string;
  @ApiProperty({ type: WelfareScopeRulesDto }) readonly scopeRules!: WelfareScopeRulesDto;
  @ApiProperty({ type: Boolean }) readonly canPayDeliveryFee!: boolean;
  @ApiProperty({ maxLength: 500, minLength: 2, type: String }) readonly refundPolicy!: string;
}

export class CreateWelfareBatchRequestDto {
  @ApiPropertyOptional({ format: 'uuid', type: String }) readonly enterpriseCustomerId?: string;
  @ApiProperty({ maxLength: 64, minLength: 2, type: String }) readonly batchNo!: string;
  @ApiProperty({ description: 'Integer cents', minimum: 1, type: Number }) readonly totalAmount!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 1, type: Number }) readonly unitAmount!: number;
  @ApiProperty({ minimum: 1, type: Number }) readonly issueCount!: number;
  @ApiProperty({ enum: ['ENTERPRISE_ASSIGNED', 'COMPANY_ASSIGNED', 'PHYSICAL_CARD_OR_CODE'], type: String }) readonly claimMode!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly agreementVersion!: number;
}

export class WelfareHistoryResponseDto {
  @ApiProperty({ enum: ['PROGRAM_CREATED', 'BATCH_CREATED'], type: String }) readonly event!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly resultingVersion!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly occurredAt!: string;
}

export class WelfareBatchResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ type: String }) readonly batchNo!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly totalAmount!: number;
  @ApiProperty({ minimum: 1, type: Number }) readonly unitAmount!: number;
  @ApiProperty({ minimum: 1, type: Number }) readonly issueCount!: number;
  @ApiProperty({ enum: ['ENTERPRISE_ASSIGNED', 'COMPANY_ASSIGNED', 'PHYSICAL_CARD_OR_CODE'], type: String }) readonly claimMode!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly agreementVersion!: number;
  @ApiProperty({ enum: ['DRAFT'], type: String }) readonly status!: 'DRAFT';
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly createdAt!: string;
  @ApiProperty({ type: () => [WelfareHistoryResponseDto] }) readonly history!: readonly WelfareHistoryResponseDto[];
}

export class WelfareProgramResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ type: String }) readonly name!: string;
  @ApiProperty({ enum: ['ENTERPRISE_GRANT', 'COMPANY_GIFT', 'PHYSICAL_CARD_OR_CODE'], type: String }) readonly fundingType!: string;
  @ApiProperty({ enum: ['COMPANY'], type: String }) readonly issuerType!: 'COMPANY';
  @ApiProperty({ enum: ['ALL_PRODUCTS', 'CATEGORY', 'PRODUCT', 'SKU'], type: String }) readonly scopeType!: string;
  @ApiProperty({ type: WelfareScopeRulesDto }) readonly scopeRules!: WelfareScopeRulesDto;
  @ApiProperty({ type: Boolean }) readonly canPayDeliveryFee!: boolean;
  @ApiProperty({ type: String }) readonly refundPolicy!: string;
  @ApiProperty({ enum: ['DRAFT'], type: String }) readonly complianceStatus!: 'DRAFT';
  @ApiProperty({ enum: ['DRAFT'], type: String }) readonly status!: 'DRAFT';
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly createdAt!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly updatedAt!: string;
  @ApiProperty({ type: () => [WelfareHistoryResponseDto] }) readonly history!: readonly WelfareHistoryResponseDto[];
  @ApiProperty({ type: () => [WelfareBatchResponseDto] }) readonly batches!: readonly WelfareBatchResponseDto[];
}

export class WelfareProgramPageResponseDto {
  @ApiProperty({ type: () => [WelfareProgramResponseDto] }) readonly items!: readonly WelfareProgramResponseDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}
