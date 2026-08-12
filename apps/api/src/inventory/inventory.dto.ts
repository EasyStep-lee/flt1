import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierInventoryBalanceDto {
  @ApiProperty({ format: 'uuid', type: String }) skuId!: string;
  @ApiProperty({ type: String }) productName!: string;
  @ApiProperty({ type: String }) skuCode!: string;
  @ApiProperty({ type: String, enum: ['AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK'] }) status!: string;
  @ApiProperty({ minimum: 0, type: Number }) availableQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) reservedQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) soldQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) damagedQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) safetyStockQty!: number;
  @ApiProperty({ type: Boolean }) warning!: boolean;
  @ApiProperty({ minimum: 0, type: Number }) version!: number;
  @ApiProperty({ format: 'date-time', type: String }) updatedAt!: string;
}

export class SupplierInventoryPageDto {
  @ApiProperty({ type: () => SupplierInventoryBalanceDto, isArray: true }) items!: SupplierInventoryBalanceDto[];
  @ApiProperty({ minimum: 0, type: Number }) total!: number;
  @ApiProperty({ minimum: 1, type: Number }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100, type: Number }) pageSize!: number;
}

export class SupplierInventoryAdjustmentRequestDto {
  @ApiProperty({ type: String, enum: ['INCREASE', 'DECREASE', 'STOCKTAKE_GAIN', 'STOCKTAKE_LOSS', 'DAMAGE'] })
  type!: string;
  @ApiProperty({ type: String, enum: ['DELTA_AVAILABLE', 'SET_AVAILABLE'] }) mode!: string;
  @ApiProperty({ type: 'integer' }) quantity!: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 0 }) safetyStockQty?: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) expectedVersion!: number;
  @ApiProperty({ type: String, minLength: 2, maxLength: 1000 }) reason!: string;
}

export class SupplierInventoryChangeDto {
  @ApiProperty({ format: 'uuid', type: String }) id!: string;
  @ApiProperty({ format: 'uuid', type: String }) skuId!: string;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: Number }) availableDelta!: number;
  @ApiProperty({ type: Number }) reservedDelta!: number;
  @ApiProperty({ type: Number }) soldDelta!: number;
  @ApiProperty({ type: Number }) damagedDelta!: number;
  @ApiProperty({ minimum: 0, type: Number }) beforeAvailableQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) afterAvailableQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) beforeReservedQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) afterReservedQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) beforeSoldQty!: number;
  @ApiProperty({ minimum: 0, type: Number }) afterSoldQty!: number;
  @ApiProperty({ minimum: 1, type: Number }) resultingVersion!: number;
  @ApiProperty({ type: String }) reason!: string;
  @ApiProperty({ format: 'date-time', type: String }) occurredAt!: string;
}

export class SupplierInventoryHistoryDto {
  @ApiProperty({ type: () => SupplierInventoryChangeDto, isArray: true }) items!: SupplierInventoryChangeDto[];
  @ApiProperty({ minimum: 0, type: Number }) total!: number;
}

export class SupplierInventoryMutationDto {
  @ApiProperty({ type: () => SupplierInventoryBalanceDto }) balance!: SupplierInventoryBalanceDto;
  @ApiProperty({ type: () => SupplierInventoryChangeDto }) log!: SupplierInventoryChangeDto;
}
