import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import {
  SUPPLIER_PRICING_ACTOR_RESOLVER,
  type SupplierPricingActorResolver,
} from './supplier-pricing.actor.js';
import {
  InitialPriceReviewSummaryDto,
  InitialPriceRowRequestDto,
  InitialPricesRequestDto,
  InitialPricesResponseDto,
  SupplierInitialPriceSkuDto,
  SupplierInitialPricingPageDto,
  SupplierInitialPricingProductDto,
} from './supplier-pricing.dto.js';
import { SupplierPricingService } from './supplier-pricing.service.js';

const replayHeader = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

@ApiTags('supplier-pricing')
@ApiExtraModels(
  ApiErrorResponseDto,
  InitialPriceReviewSummaryDto,
  InitialPriceRowRequestDto,
  InitialPricesRequestDto,
  InitialPricesResponseDto,
  SupplierInitialPriceSkuDto,
  SupplierInitialPricingPageDto,
  SupplierInitialPricingProductDto,
)
@Controller('v1/supplier/pricing/products')
export class SupplierPricingController {
  constructor(
    @Inject(SupplierPricingService) private readonly service: SupplierPricingService,
    @Inject(SUPPLIER_PRICING_ACTOR_RESOLVER)
    private readonly actorResolver: SupplierPricingActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'supplierPricing.listInitialPricingProducts',
    summary: 'List current-supplier products and initial pricing review state',
  })
  @ApiOkResponse({ type: SupplierInitialPricingPageDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId): Promise<SupplierInitialPricingPageDto> {
    const actor = await this.actorResolver.resolve(request);
    return this.service.list(actor) as Promise<SupplierInitialPricingPageDto>;
  }

  @Put(':supplierProductId/initial-prices')
  @HttpCode(201)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'supplierPricing.submitInitialPrices',
    summary: 'Freeze and submit current-supplier initial three-price values',
  })
  @ApiParam({ format: 'uuid', name: 'supplierProductId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: InitialPricesRequestDto })
  @ApiCreatedResponse({ type: InitialPricesResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async submitInitialPrices(
    @Req() request: RequestWithId,
    @Param('supplierProductId') supplierProductId: string,
    @Body() body: InitialPricesRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InitialPricesResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.submitInitialPrices(
      actor,
      supplierProductId,
      body,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }
}
