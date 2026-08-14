import { ApiProperty } from '@nestjs/swagger';

export class RefundCreateRequestDto {
  @ApiProperty({ description: 'Server-issued approved refund authorization version', minimum: 1, type: Number })
  readonly authorizationVersion!: number;

  @ApiProperty({ maxLength: 500, minLength: 2, type: String })
  readonly reason!: string;
}

export class RefundResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly refundId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly afterSaleId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly orderId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly orderItemId!: string;
  @ApiProperty({ maxLength: 32, type: String }) readonly refundNo!: string;
  @ApiProperty({ enum: ['PROCESSING', 'PARTIAL_CHANNEL_DONE', 'SUCCEEDED', 'UNKNOWN', 'FAILED'] })
  readonly status!: 'PROCESSING' | 'PARTIAL_CHANNEL_DONE' | 'SUCCEEDED' | 'UNKNOWN' | 'FAILED';
  @ApiProperty({ minimum: 0, type: Number }) readonly welfareCardRefundAmount!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly cashRefundAmount!: number;
  @ApiProperty({ enum: ['NOT_REQUIRED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'UNKNOWN', 'FAILED'] })
  readonly welfareChannelStatus!: 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'UNKNOWN' | 'FAILED';
  @ApiProperty({ enum: ['NOT_REQUIRED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'UNKNOWN', 'FAILED'] })
  readonly wechatChannelStatus!: 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'UNKNOWN' | 'FAILED';
}
