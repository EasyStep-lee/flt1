import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { COMPANY_LEGAL_NAME, PLATFORM_NAME } from './single-merchant.service.js';

export class PublicMerchantProfileQuery {
  @ApiPropertyOptional({
    enum: ['ALL', 'PAYMENT', 'REFUND', 'SALE'],
    example: 'ALL',
    type: String,
  })
  readonly context?: 'ALL' | 'PAYMENT' | 'REFUND' | 'SALE';
}

export class PublicMerchantSubjectsDto {
  @ApiProperty({ example: COMPANY_LEGAL_NAME, type: String })
  readonly seller!: typeof COMPANY_LEGAL_NAME;

  @ApiProperty({ example: COMPANY_LEGAL_NAME, type: String })
  readonly paymentPayee!: typeof COMPANY_LEGAL_NAME;

  @ApiProperty({ example: COMPANY_LEGAL_NAME, type: String })
  readonly refundOperator!: typeof COMPANY_LEGAL_NAME;
}

export class PublicMerchantProfileResponse {
  @ApiProperty({ example: PLATFORM_NAME, type: String })
  readonly platformName!: typeof PLATFORM_NAME;

  @ApiProperty({ example: COMPANY_LEGAL_NAME, type: String })
  readonly legalName!: typeof COMPANY_LEGAL_NAME;

  @ApiProperty({ type: () => PublicMerchantSubjectsDto })
  readonly subjects!: PublicMerchantSubjectsDto;
}
