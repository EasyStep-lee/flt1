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

export class WelfareCardBindRequestDto {
  @ApiProperty({ enum: ['CARD_PASSWORD', 'REDEMPTION_CODE', 'SCAN_CODE'], type: String }) readonly method!: string;
  @ApiProperty({ maxLength: 191, minLength: 4, type: String }) readonly cardNo!: string;
  @ApiProperty({ description: 'Sensitive card credential; never persisted or returned in plaintext', maxLength: 191, minLength: 6, type: String }) readonly secret!: string;
  @ApiProperty({ enum: [true], type: Boolean }) readonly agreementAccepted!: true;
  @ApiProperty({ minimum: 1, type: Number }) readonly agreementVersion!: number;
}

export class WelfareCardAccountResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ type: String }) readonly programName!: string;
  @ApiProperty({ type: String }) readonly batchNo!: string;
  @ApiProperty({ description: 'Only the last four card characters are visible', type: String }) readonly maskedCardNo!: string;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly balanceAmount!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly frozenAmount!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly availableAmount!: number;
  @ApiProperty({ enum: ['ACTIVE'], type: String }) readonly status!: 'ACTIVE';
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly claimedAt!: string;
}

export class WelfareCardEligibilityQueryDto {
  @ApiProperty({ format: 'uuid', isArray: true, maxItems: 100, minItems: 1, type: String })
  readonly skuId!: readonly string[];
  @ApiProperty({ isArray: true, items: { maximum: 9999, minimum: 1, type: 'integer' }, maxItems: 100, minItems: 1, type: Number })
  readonly quantity!: readonly number[];
}

export class EligibleWelfareAccountResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ type: String }) readonly programName!: string;
  @ApiProperty({ description: 'Only the last four card characters are visible', type: String }) readonly maskedCardNo!: string;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly balanceAmount!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly frozenAmount!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly availableAmount!: number;
  @ApiProperty({ enum: ['ACTIVE'], type: String }) readonly status!: 'ACTIVE';
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ enum: ['ALL_PRODUCTS', 'CATEGORY', 'PRODUCT', 'SKU'], type: String }) readonly scopeType!: string;
  @ApiProperty({ type: String }) readonly scopeDescription!: string;
  @ApiProperty({ description: 'Server-priced eligible amount in integer cents', minimum: 0, type: Number }) readonly eligibleAmount!: number;
  @ApiProperty({ description: 'min(availableAmount, eligibleAmount) in integer cents', minimum: 0, type: Number }) readonly maximumDeductibleAmount!: number;
}

export class EligibleWelfareAccountsResponseDto {
  @ApiProperty({ description: 'Server-priced goods amount in integer cents', minimum: 0, type: Number }) readonly goodsAmount!: number;
  @ApiProperty({ description: 'Server-owned delivery fee in integer cents', minimum: 0, type: Number }) readonly deliveryFee!: number;
  @ApiProperty({ description: 'Server-priced total in integer cents', minimum: 0, type: Number }) readonly totalAmount!: number;
  @ApiProperty({ type: () => [EligibleWelfareAccountResponseDto] }) readonly accounts!: readonly EligibleWelfareAccountResponseDto[];
}
