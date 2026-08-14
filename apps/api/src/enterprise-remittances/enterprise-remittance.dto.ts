import { ApiProperty } from '@nestjs/swagger';

export class EnterpriseRemittanceProofRequestDto {
  @ApiProperty({ description: 'Declared company remittance amount in integer cents', minimum: 1, type: Number })
  readonly amount!: number;

  @ApiProperty({ maxLength: 512, type: String })
  readonly proofObjectKey!: string;
}

export class EnterpriseRemittanceReviewRequestDto {
  @ApiProperty({ enum: ['CONFIRM', 'REJECT'] })
  readonly decision!: 'CONFIRM' | 'REJECT';

  @ApiProperty({ description: 'Reviewed amount in integer cents', minimum: 1, type: Number })
  readonly amount!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiProperty({ maxLength: 500, minLength: 2, type: String })
  readonly reason!: string;
}

export class EnterpriseRemittanceResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly remittanceId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly orderId!: string;
  @ApiProperty({ maxLength: 32, type: String }) readonly orderNo!: string;
  @ApiProperty({ example: '江苏福礼团供应链科技有限公司', type: String })
  readonly sellerName!: '江苏福礼团供应链科技有限公司';
  @ApiProperty({ enum: ['COMPANY_UNIFIED'] }) readonly checkoutMode!: 'COMPANY_UNIFIED';
  @ApiProperty({ enum: ['BANK_TRANSFER'] }) readonly paymentMethod!: 'BANK_TRANSFER';
  @ApiProperty({ minimum: 1, type: Number }) readonly totalAmount!: number;
  @ApiProperty({ enum: ['PENDING', 'PAID'] }) readonly paymentStatus!: 'PENDING' | 'PAID';
  @ApiProperty({ enum: ['PENDING_PAYMENT', 'PAID'] }) readonly orderStatus!: 'PENDING_PAYMENT' | 'PAID';
  @ApiProperty({ enum: ['PENDING_REVIEW', 'CONFIRMED', 'REJECTED'] })
  readonly remittanceStatus!: 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ format: 'date-time', type: String }) readonly submittedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) readonly reviewedAt!: string | null;
}
