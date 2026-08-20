import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WelfareScopeRulesDto {
  @ApiProperty({ enum: [1, 2], type: Number }) readonly schemaVersion!: 1 | 2;
  @ApiProperty({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly includedIds!: readonly string[];
  @ApiProperty({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly excludedIds!: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly categoryIncludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly productIncludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly skuIncludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly categoryExcludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly productExcludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly skuExcludedIds?: readonly string[];
}

export class WelfareScopeRulesRequestDto {
  @ApiProperty({ enum: [1, 2], type: Number }) readonly schemaVersion!: 1 | 2;
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly includedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly excludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly categoryIncludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly productIncludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly skuIncludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly categoryExcludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly productExcludedIds?: readonly string[];
  @ApiPropertyOptional({ items: { format: 'uuid', type: 'string' }, type: 'array' }) readonly skuExcludedIds?: readonly string[];
}

export class CreateWelfareProgramRequestDto {
  @ApiProperty({ maxLength: 191, minLength: 2, type: String }) readonly name!: string;
  @ApiProperty({ enum: ['ENTERPRISE_GRANT', 'COMPANY_GIFT', 'PHYSICAL_CARD_OR_CODE'], type: String }) readonly fundingType!: string;
  @ApiProperty({ enum: ['ALL_PRODUCTS', 'CATEGORY', 'PRODUCT', 'SKU', 'COMPOSITE'], type: String }) readonly scopeType!: string;
  @ApiProperty({ type: WelfareScopeRulesRequestDto }) readonly scopeRules!: WelfareScopeRulesRequestDto;
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
  @ApiProperty({ enum: ['ALL_PRODUCTS', 'CATEGORY', 'PRODUCT', 'SKU', 'COMPOSITE'], type: String }) readonly scopeType!: string;
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

export class WelfareItemApplicabilityResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly skuId!: string;
  @ApiProperty({ type: Boolean }) readonly eligible!: boolean;
  @ApiProperty({ description: 'Server-priced eligible line amount in integer cents', minimum: 0, type: Number }) readonly eligibleAmount!: number;
  @ApiProperty({
    enum: ['ALL_PRODUCTS', 'DEFAULT_INCLUDED', 'CATEGORY_INCLUDED', 'PRODUCT_INCLUDED', 'SKU_INCLUDED', 'CATEGORY_EXCLUDED', 'PRODUCT_EXCLUDED', 'SKU_EXCLUDED', 'OUTSIDE_WHITELIST'],
    type: String,
  }) readonly reason!: string;
}

export class WelfareDeliveryFeeApplicabilityResponseDto {
  @ApiProperty({ type: Boolean }) readonly eligible!: boolean;
  @ApiProperty({ description: 'Server-owned eligible delivery fee in integer cents', minimum: 0, type: Number }) readonly eligibleAmount!: number;
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
  @ApiProperty({ enum: ['ALL_PRODUCTS', 'CATEGORY', 'PRODUCT', 'SKU', 'COMPOSITE'], type: String }) readonly scopeType!: string;
  @ApiProperty({ type: String }) readonly scopeDescription!: string;
  @ApiProperty({ type: () => [WelfareItemApplicabilityResponseDto] }) readonly itemApplicability!: readonly WelfareItemApplicabilityResponseDto[];
  @ApiProperty({ type: () => WelfareDeliveryFeeApplicabilityResponseDto }) readonly deliveryFeeApplicability!: WelfareDeliveryFeeApplicabilityResponseDto;
  @ApiProperty({ description: 'Server-priced eligible amount in integer cents', minimum: 0, type: Number }) readonly eligibleAmount!: number;
  @ApiProperty({ description: 'min(availableAmount, eligibleAmount) in integer cents', minimum: 0, type: Number }) readonly maximumDeductibleAmount!: number;
}

export class EligibleWelfareAccountsResponseDto {
  @ApiProperty({ description: 'Server-priced goods amount in integer cents', minimum: 0, type: Number }) readonly goodsAmount!: number;
  @ApiProperty({ description: 'Server-owned delivery fee in integer cents', minimum: 0, type: Number }) readonly deliveryFee!: number;
  @ApiProperty({ description: 'Server-priced total in integer cents', minimum: 0, type: Number }) readonly totalAmount!: number;
  @ApiProperty({ type: () => [EligibleWelfareAccountResponseDto] }) readonly accounts!: readonly EligibleWelfareAccountResponseDto[];
}

export class WelfareCardLedgerItemResponseDto {
  @ApiProperty({ minimum: 1, type: Number }) readonly sequence!: number;
  @ApiProperty({ enum: ['CLAIM', 'GRANT', 'GIFT', 'FREEZE', 'RELEASE', 'CAPTURE', 'REFUND', 'REVERSAL', 'ADJUSTMENT'], type: String })
  readonly businessType!: string;
  @ApiProperty({ enum: ['CREDIT', 'DEBIT'], type: String }) readonly direction!: string;
  @ApiProperty({ description: 'Integer cents', minimum: 1, type: Number }) readonly amount!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly beforeBalance!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly afterBalance!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly beforeFrozen!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly afterFrozen!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly occurredAt!: string;
}

export class WelfareCardLedgerAccountResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ type: String }) readonly programName!: string;
  @ApiProperty({ type: String }) readonly batchNo!: string;
  @ApiProperty({ description: 'Only the last four card characters are visible', type: String }) readonly maskedCardNo!: string;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly balanceAmount!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly frozenAmount!: number;
  @ApiProperty({ description: 'Integer cents', minimum: 0, type: Number }) readonly availableAmount!: number;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'CLOSED'], type: String }) readonly status!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
}

export class ConsumerWelfareLedgerResponseDto {
  @ApiProperty({ type: () => WelfareCardLedgerAccountResponseDto }) readonly account!: WelfareCardLedgerAccountResponseDto;
  @ApiProperty({ type: () => [WelfareCardLedgerItemResponseDto] }) readonly items!: readonly WelfareCardLedgerItemResponseDto[];
}

export class CompanyWelfareAccountPageResponseDto {
  @ApiProperty({ type: () => [WelfareCardLedgerAccountResponseDto] }) readonly items!: readonly WelfareCardLedgerAccountResponseDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}

export class CreateWelfareCardAdjustmentRequestDto {
  @ApiProperty({ enum: ['ADJUSTMENT', 'REVERSAL'], type: String }) readonly businessType!: string;
  @ApiPropertyOptional({ enum: ['CREDIT', 'DEBIT'], type: String }) readonly direction?: string;
  @ApiPropertyOptional({ description: 'Required only for ADJUSTMENT; integer cents', minimum: 1, type: Number }) readonly amount?: number;
  @ApiPropertyOptional({ description: 'Required only for REVERSAL; server-owned ledger id', format: 'uuid', type: String }) readonly reversalOfLedgerId?: string;
  @ApiProperty({ maxLength: 500, minLength: 2, type: String }) readonly reason!: string;
}

export class DecideWelfareCardAdjustmentRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], type: String }) readonly decision!: string;
  @ApiProperty({ maxLength: 1000, minLength: 2, type: String }) readonly opinion!: string;
  @ApiProperty({ description: 'Never persisted or returned', maxLength: 64, minLength: 4, type: String }) readonly secondVerificationCode!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
}

export class WelfareCardAdjustmentResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly accountId!: string;
  @ApiProperty({ enum: ['ADJUSTMENT', 'REVERSAL'], type: String }) readonly businessType!: string;
  @ApiProperty({ enum: ['CREDIT', 'DEBIT'], type: String }) readonly direction!: string;
  @ApiProperty({ description: 'Integer cents', minimum: 1, type: Number }) readonly amount!: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }) readonly reversalOfLedgerId!: string | null;
  @ApiProperty({ type: String }) readonly reason!: string;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'], type: String }) readonly status!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiPropertyOptional({ nullable: true, type: String }) readonly reviewOpinion!: string | null;
  @ApiProperty({ format: 'date-time', type: String }) readonly createdAt!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly updatedAt!: string;
}

export class WelfareCardAdjustmentPageResponseDto {
  @ApiProperty({ type: () => [WelfareCardAdjustmentResponseDto] }) readonly items!: readonly WelfareCardAdjustmentResponseDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}
