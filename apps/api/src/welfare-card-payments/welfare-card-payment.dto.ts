import { ApiProperty } from '@nestjs/swagger';

export class WelfareCardFullPaymentRequestDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly accountId!: string;
}

export class WelfareCardFullPaymentResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly orderId!: string;
  @ApiProperty({ maxLength: 32, type: String }) readonly orderNo!: string;
  @ApiProperty({ enum: ['PAID'] }) readonly paymentStatus!: 'PAID';
  @ApiProperty({ enum: ['PAID'] }) readonly orderStatus!: 'PAID';
  @ApiProperty({ enum: ['WELFARE_CARD'] }) readonly paymentMode!: 'WELFARE_CARD';
  @ApiProperty({ description: 'Captured welfare-card amount in integer cents', minimum: 1, type: Number })
  readonly welfareCardAmount!: number;
  @ApiProperty({ description: 'External payable amount; always zero for this endpoint', enum: [0] })
  readonly cashAmount!: 0;
  @ApiProperty({ format: 'date-time', type: String }) readonly paidAt!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly itemCount!: number;
  @ApiProperty({ minimum: 1, type: Number }) readonly supplierFulfillmentCount!: number;
}
