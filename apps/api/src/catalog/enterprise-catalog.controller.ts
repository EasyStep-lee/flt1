import { Controller, Get, Header, Headers, Inject, Param, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import {
  EnterpriseFoodSkuResponseDto,
  EnterpriseCatalogPageResponseDto,
  EnterpriseCatalogProductResponseDto,
  EnterpriseCatalogQueryDto,
  CatalogMediaResponseDto,
  EnterpriseProductDetailResponseDto,
  PublicFoodDetailFieldResponseDto,
  PublicFoodDetailModuleResponseDto,
  PublicGiftBoxItemResponseDto,
} from './public-catalog.dto.js';
import { EnterpriseCatalogService } from './enterprise-catalog.service.js';
import type { EnterpriseProductDetailResponse } from './enterprise-catalog.service.js';
import type { EnterpriseCatalogPageResponse } from './enterprise-catalog.service.js';

@ApiTags('enterprise-catalog')
@ApiExtraModels(
  ApiErrorResponseDto,
  CatalogMediaResponseDto,
  EnterpriseCatalogQueryDto,
  EnterpriseCatalogProductResponseDto,
  EnterpriseCatalogPageResponseDto,
  EnterpriseFoodSkuResponseDto,
  EnterpriseProductDetailResponseDto,
  PublicFoodDetailFieldResponseDto,
  PublicFoodDetailModuleResponseDto,
  PublicGiftBoxItemResponseDto,
)
@Controller('v1/enterprise/catalog')
export class EnterpriseCatalogController {
  constructor(
    @Inject(EnterpriseCatalogService)
    private readonly service: EnterpriseCatalogService,
  ) {}

  @Get('products')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiSecurity('enterpriseSession')
  @ApiOperation({
    operationId: 'enterpriseCatalog.listProducts',
    summary: 'List enterprise-enabled Product and SKU resources from the unified company shelf',
  })
  @ApiOkResponse({ type: EnterpriseCatalogPageResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, maximum: 10000 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 50 })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  listProducts(
    @Query() query: EnterpriseCatalogQueryDto & Record<string, unknown>,
    @Headers('cookie') cookieHeader: string | undefined,
  ): Promise<EnterpriseCatalogPageResponse> {
    return this.service.listProducts(query, cookieHeader);
  }

  @Get('products/:productId')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiSecurity('enterpriseSession')
  @ApiOperation({
    operationId: 'enterpriseCatalog.getProductDetail',
    summary: 'Get an enterprise-only product detail with the procurement selling price',
  })
  @ApiParam({ format: 'uuid', name: 'productId', type: String })
  @ApiOkResponse({ type: EnterpriseProductDetailResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  getProductDetail(
    @Param('productId') productId: string,
    @Headers('cookie') cookieHeader: string | undefined,
  ): Promise<EnterpriseProductDetailResponse> {
    return this.service.getProductDetail(productId, cookieHeader);
  }
}
