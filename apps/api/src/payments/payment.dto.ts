import { ApiProperty } from '@nestjs/swagger';

export class WechatPrepayRequestDto {}

export class MiniappPaymentPayloadDto {
  @ApiProperty({ type: String }) readonly timeStamp!: string;
  @ApiProperty({ type: String }) readonly nonceStr!: string;
  @ApiProperty({ type: String }) readonly package!: string;
  @ApiProperty({ enum: ['RSA'] }) readonly signType!: 'RSA';
  @ApiProperty({ type: String }) readonly paySign!: string;
}

export class WechatPrepayResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly paymentTransactionId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly orderId!: string;
  @ApiProperty({ enum: ['WECHAT_PAY'] }) readonly channel!: 'WECHAT_PAY';
  @ApiProperty({ enum: ['PREPAY_CREATED'] }) readonly status!: 'PREPAY_CREATED';
  @ApiProperty({ description: 'WeChat amount in integer cents', minimum: 1, type: Number })
  readonly amount!: number;
  @ApiProperty({ maxLength: 32, type: String }) readonly outTradeNo!: string;
  @ApiProperty({ type: String }) readonly prepayId!: string;
  @ApiProperty({ type: MiniappPaymentPayloadDto }) readonly clientPayment!: MiniappPaymentPayloadDto;
}

export class WechatPaymentNotificationDto {
  @ApiProperty({ additionalProperties: true, type: Object }) readonly resource!: Readonly<Record<string, unknown>>;
  @ApiProperty({ type: String }) readonly id!: string;
}

export class WechatNotificationAcknowledgementDto {
  @ApiProperty({ enum: ['SUCCESS'] }) readonly code!: 'SUCCESS';
  @ApiProperty({ example: '成功', type: String }) readonly message!: '成功';
}
