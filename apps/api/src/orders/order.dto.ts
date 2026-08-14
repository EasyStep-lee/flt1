import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderItemRequestDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly skuId!: string;
  @ApiProperty({ maximum: 9999, minimum: 1, type: Number }) readonly quantity!: number;
}

export class CreateOrderRequestDto {
  @ApiProperty({ maxItems: 100, minItems: 1, type: () => [CreateOrderItemRequestDto] })
  readonly items!: readonly CreateOrderItemRequestDto[];
}

export class BuyerOrderItemResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly orderItemId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly productId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly skuId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierId!: string;
  @ApiProperty({ maxLength: 200, type: String }) readonly productName!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly quantity!: number;
  @ApiProperty({ description: 'Channel sale price snapshot in integer cents', minimum: 0, type: Number })
  readonly salePrice!: number;
  @ApiProperty({ description: 'Line amount in integer cents', minimum: 0, type: Number })
  readonly totalAmount!: number;
}

export class SupplierFulfillmentOrderResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly fulfillmentOrderId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierId!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly itemCount!: number;
  @ApiProperty({ description: 'Supplier group sale amount in integer cents', minimum: 0, type: Number })
  readonly goodsAmount!: number;
  @ApiProperty({ enum: ['PENDING_PAYMENT'] }) readonly status!: 'PENDING_PAYMENT';
}

export class CreateBuyerOrderResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly orderId!: string;
  @ApiProperty({ maxLength: 32, type: String }) readonly orderNo!: string;
  @ApiProperty({ enum: ['CONSUMER', 'ENTERPRISE'] })
  readonly orderType!: 'CONSUMER' | 'ENTERPRISE';
  @ApiProperty({ example: '江苏福礼团供应链科技有限公司', type: String })
  readonly sellerName!: '江苏福礼团供应链科技有限公司';
  @ApiProperty({ enum: ['COMPANY_UNIFIED'] }) readonly checkoutMode!: 'COMPANY_UNIFIED';
  @ApiProperty({ minimum: 0, type: Number }) readonly goodsAmount!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly deliveryFee!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly discountAmount!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly totalAmount!: number;
  @ApiProperty({ enum: ['PENDING'] }) readonly paymentStatus!: 'PENDING';
  @ApiProperty({ enum: ['PENDING_PAYMENT'] }) readonly orderStatus!: 'PENDING_PAYMENT';
  @ApiProperty({ type: () => [BuyerOrderItemResponseDto] })
  readonly items!: readonly BuyerOrderItemResponseDto[];
  @ApiProperty({ type: () => [SupplierFulfillmentOrderResponseDto] })
  readonly supplierFulfillments!: readonly SupplierFulfillmentOrderResponseDto[];
}
