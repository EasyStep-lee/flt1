import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierProductQueryDto {
  @ApiPropertyOptional({ format: 'uuid', type: String })
  readonly excludeProductId?: string;

  @ApiPropertyOptional({ default: 1, maximum: 10000, minimum: 1, type: Number })
  readonly page?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50, minimum: 1, type: Number })
  readonly pageSize?: string;
}
export class PublicProductCardResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly productId!: string;

  @ApiProperty({ maxLength: 200, type: String })
  readonly name!: string;

  @ApiProperty({ description: 'Minimum active SKU retail price in integer cents', minimum: 0, type: Number })
  readonly retailSalePrice!: number;

  @ApiProperty({ minimum: 1, type: Number })
  readonly activeSkuCount!: number;
}

export class PublicProductPageResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly supplierId!: string;

  @ApiProperty({ example: '该供应来源的更多商品', type: String })
  readonly sourceLabel!: '该供应来源的更多商品';

  @ApiProperty({ example: '江苏福礼团供应链科技有限公司', type: String })
  readonly sellerName!: '江苏福礼团供应链科技有限公司';

  @ApiProperty({ enum: ['COMPANY_UNIFIED'], type: String })
  readonly checkoutMode!: 'COMPANY_UNIFIED';

  @ApiProperty({ minimum: 1, type: Number })
  readonly page!: number;

  @ApiProperty({ maximum: 50, minimum: 1, type: Number })
  readonly pageSize!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly total!: number;

  @ApiProperty({ type: () => [PublicProductCardResponseDto] })
  readonly items!: readonly PublicProductCardResponseDto[];
}
