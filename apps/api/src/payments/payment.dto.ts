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
  @ApiProperty({ example: '江苏福礼团供应链科技有限公司', type: String })
  readonly collectorName!: '江苏福礼团供应链科技有限公司';
  @ApiProperty({ enum: ['COMPANY_UNIFIED'] }) readonly checkoutMode!: 'COMPANY_UNIFIED';
  @ApiProperty({ description: 'WeChat amount in integer cents', minimum: 1, type: Number })
  readonly amount!: number;
  @ApiProperty({ maxLength: 32, type: String }) readonly outTradeNo!: string;
  @ApiProperty({ type: String }) readonly prepayId!: string;
  @ApiProperty({ type: MiniappPaymentPayloadDto }) readonly clientPayment!: MiniappPaymentPayloadDto;
}

export class WelfareCardWechatPaymentRequestDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly accountId!: string;
}

export class WelfareCardWechatPaymentResponseDto extends WechatPrepayResponseDto {
  @ApiProperty({ enum: ['WELFARE_CARD_WECHAT'] }) readonly paymentMode!: 'WELFARE_CARD_WECHAT';
  @ApiProperty({ description: 'Frozen welfare-card amount in integer cents', minimum: 1, type: Number })
  readonly welfareCardAmount!: number;
  @ApiProperty({ description: 'WeChat difference in integer cents', minimum: 1, type: Number })
  readonly cashAmount!: number;
  @ApiProperty({ description: 'Server-owned order total in integer cents', minimum: 2, type: Number })
  readonly totalAmount!: number;
}

export class WechatPaymentNotificationDto {
  @ApiProperty({ additionalProperties: true, type: Object }) readonly resource!: Readonly<Record<string, unknown>>;
  @ApiProperty({ type: String }) readonly id!: string;
}

export class WechatNotificationAcknowledgementDto {
  @ApiProperty({ enum: ['SUCCESS'] }) readonly code!: 'SUCCESS';
  @ApiProperty({ example: '成功', type: String }) readonly message!: '成功';
}
