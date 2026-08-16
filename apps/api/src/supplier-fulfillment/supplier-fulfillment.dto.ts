import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierFulfillmentItemDto {
  @ApiProperty({ format: 'uuid', type: String }) orderItemId!: string;
  @ApiProperty({ type: String }) productName!: string;
  @ApiProperty({ type: String }) skuLabel!: string;
  @ApiProperty({ minimum: 1, type: Number }) quantity!: number;
}
export class SupplierFulfillmentPickupPointDto {
  @ApiProperty({ type: String }) address!: string;
}

export class SupplierFulfillmentNodeDto {
  @ApiProperty({ format: 'uuid', type: String }) id!: string;
  @ApiProperty({ enum: ['ACCEPT', 'REPORT_SHORTAGE', 'START_PREPARING', 'MARK_READY', 'HANDOVER'], type: String }) node!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty({ minimum: 1, type: Number }) resultingVersion!: number;
  @ApiProperty({ format: 'date-time', type: String }) occurredAt!: string;
}

export class SupplierSubOrderResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) id!: string;
  @ApiProperty({ type: String }) orderNo!: string;
  @ApiProperty({ type: String }) subOrderNo!: string;
  @ApiProperty({ enum: ['CONSUMER', 'ENTERPRISE'], type: String }) channelType!: string;
  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_HANDOVER', 'HANDED_OVER', 'COMPLETED', 'CANCELLED'], type: String }) preparationStatus!: string;
  @ApiProperty({ enum: ['NOT_READY', 'READY', 'HANDED_OVER'], type: String }) handoverStatus!: string;
  @ApiProperty({ type: () => SupplierFulfillmentPickupPointDto }) pickupPoint!: SupplierFulfillmentPickupPointDto;
  @ApiProperty({ isArray: true, type: () => SupplierFulfillmentItemDto }) items!: SupplierFulfillmentItemDto[];
  @ApiProperty({ isArray: true, type: () => SupplierFulfillmentNodeDto }) nodes!: SupplierFulfillmentNodeDto[];
  @ApiProperty({ minimum: 0, type: Number }) version!: number;
  @ApiProperty({ format: 'date-time', type: String }) createdAt!: string;
  @ApiProperty({ format: 'date-time', type: String }) updatedAt!: string;
}

export class SupplierSubOrderPageResponseDto {
  @ApiProperty({ isArray: true, type: () => SupplierSubOrderResponseDto }) items!: SupplierSubOrderResponseDto[];
  @ApiProperty({ minimum: 0, type: Number }) total!: number;
  @ApiProperty({ minimum: 1, type: Number }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100, type: Number }) pageSize!: number;
}

export class FulfillmentShortageItemRequestDto {
  @ApiProperty({ format: 'uuid', type: String }) orderItemId!: string;
  @ApiProperty({ minimum: 1, type: Number }) quantity!: number;
}

export class FulfillmentNodeRequestDto {
  @ApiProperty({ enum: ['ACCEPT', 'REPORT_SHORTAGE', 'START_PREPARING', 'MARK_READY', 'HANDOVER'], type: String }) node!: string;
  @ApiProperty({ minimum: 0, type: Number }) expectedVersion!: number;
  @ApiPropertyOptional({ maxLength: 1000, minLength: 2, type: String }) reason?: string;
  @ApiPropertyOptional({ isArray: true, type: () => FulfillmentShortageItemRequestDto }) shortages?: FulfillmentShortageItemRequestDto[];
  @ApiPropertyOptional({ enum: ['RUNNER', 'COMPANY_LOGISTICS'], type: String }) handoverParty?: string;
  @ApiPropertyOptional({ maxLength: 191, minLength: 2, type: String }) handoverReference?: string;
}
