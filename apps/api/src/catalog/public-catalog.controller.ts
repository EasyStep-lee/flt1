import { Controller, Get, Header, Inject, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import {
  PublicProductCardResponseDto,
  PublicProductPageResponseDto,
  SupplierProductQueryDto,
} from './public-catalog.dto.js';
import { PublicCatalogService } from './public-catalog.service.js';

@ApiTags('public-catalog')
@ApiExtraModels(
  ApiErrorResponseDto,
  PublicProductCardResponseDto,
  PublicProductPageResponseDto,
  SupplierProductQueryDto,
)
@Controller('v1/catalog/suppliers')
export class PublicCatalogController {
  constructor(
    @Inject(PublicCatalogService) private readonly service: PublicCatalogService,
  ) {}

  @Get(':supplierId/products')
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=30')
  @ApiOperation({
    operationId: 'catalog.listSupplierProducts',
    summary: 'List same-source products from the unified company shelf',
  })
  @ApiParam({ format: 'uuid', name: 'supplierId', type: String })
  @ApiOkResponse({ type: PublicProductPageResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  listSupplierProducts(
    @Param('supplierId') supplierId: string,
    @Query() query: SupplierProductQueryDto & Record<string, unknown>,
  ): Promise<PublicProductPageResponseDto> {
    return this.service.listSupplierProducts(supplierId, query);
  }
}
