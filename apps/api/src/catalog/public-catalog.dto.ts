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

export class PublicFoodDetailFieldResponseDto {
  @ApiProperty({ maxLength: 64, type: String }) readonly key!: string;
  @ApiProperty({ maxLength: 80, type: String }) readonly label!: string;
  @ApiProperty({ maxLength: 500, type: String }) readonly value!: string;
}

export class PublicFoodDetailModuleResponseDto {
  @ApiProperty({ maxLength: 64, type: String }) readonly key!: string;
  @ApiProperty({ maxLength: 80, type: String }) readonly title!: string;
  @ApiProperty({ enum: ['AFTER_SALE', 'FIELDS', 'FIXED_NOTICE'] })
  readonly kind!: 'AFTER_SALE' | 'FIELDS' | 'FIXED_NOTICE';
  @ApiProperty({ type: [PublicFoodDetailFieldResponseDto] })
  readonly fields!: readonly PublicFoodDetailFieldResponseDto[];
  @ApiProperty({ maxLength: 500, nullable: true, required: true, type: String })
  readonly notice!: string | null;
}

export class PublicFoodSkuResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly skuId!: string;
  @ApiProperty({ description: 'Retail price in integer cents', minimum: 0, type: Number })
  readonly retailSalePrice!: number;
  @ApiProperty({ type: [PublicFoodDetailFieldResponseDto] })
  readonly specifications!: readonly PublicFoodDetailFieldResponseDto[];
}

export class PublicFoodProductDetailResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly productId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly supplierId!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly categoryId!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly templateVersion!: number;
  @ApiProperty({ enum: ['FOOD', 'FRESH'] }) readonly templateProfile!: 'FOOD' | 'FRESH';
  @ApiProperty({ maxLength: 200, type: String }) readonly name!: string;
  @ApiProperty({ maxLength: 120, nullable: true, required: true, type: String })
  readonly brand!: string | null;
  @ApiProperty({ example: '江苏福礼团供应链科技有限公司', type: String })
  readonly sellerName!: '江苏福礼团供应链科技有限公司';
  @ApiProperty({ enum: ['COMPANY_UNIFIED'] }) readonly checkoutMode!: 'COMPANY_UNIFIED';
  @ApiProperty({ description: 'Minimum active SKU retail price in integer cents', minimum: 0, type: Number })
  readonly retailSalePrice!: number;
  @ApiProperty({ type: [PublicFoodSkuResponseDto] })
  readonly skus!: readonly PublicFoodSkuResponseDto[];
  @ApiProperty({ type: [PublicFoodDetailModuleResponseDto] })
  readonly detailModules!: readonly PublicFoodDetailModuleResponseDto[];
}
