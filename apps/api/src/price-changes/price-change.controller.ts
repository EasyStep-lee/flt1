import { Body, Controller, Get, Header, Headers, HttpCode, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiExtraModels, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Response } from 'express';

import { COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER, type CompanyProductApprovalActorResolver } from '../company-product-approvals/company-product-approval.actor.js';
import { ProductApprovalDecisionRequestDto } from '../company-product-approvals/company-product-approval.dto.js';
import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import { SUPPLIER_PRICING_ACTOR_RESOLVER, type SupplierPricingActorResolver } from '../supplier-pricing/supplier-pricing.actor.js';
import { ListedSkuPricePageDto, SalePriceChangeRequestDto, SalePriceChangeResponseDto, SupplyPriceChangeDto, SupplyPriceChangePageDto, SupplyPriceChangeRequestDto, SupplyPriceReviewHistoryItemDto, SupplyPriceReviewHistoryPageDto } from './price-change.dto.js';
import { PriceChangeService } from './price-change.service.js';

const replayHeader = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

@ApiExtraModels(ApiErrorResponseDto, ListedSkuPricePageDto, SupplyPriceChangeRequestDto, SupplyPriceChangeDto, SalePriceChangeRequestDto, SalePriceChangeResponseDto)
@ApiTags('supplier-post-listing-pricing')
@Controller('v1/supplier/pricing/skus')
export class SupplierListedPricingController {
  constructor(
    @Inject(PriceChangeService) private readonly service: PriceChangeService,
    @Inject(SUPPLIER_PRICING_ACTOR_RESOLVER) private readonly actorResolver: SupplierPricingActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierListedPricing.list', summary: 'List own listed SKU prices and versions' })
  @ApiOkResponse({ type: ListedSkuPricePageDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId): Promise<ListedSkuPricePageDto> {
    return this.service.listSupplier(await this.actorResolver.resolve(request));
  }

  @Post(':skuId/supply-price-change')
  @ApiOperation({ operationId: 'supplierListedPricing.submitSupplyPriceChange', summary: 'Submit a reviewed supply price change while the old price remains effective' })
  @ApiParam({ format: 'uuid', name: 'skuId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SupplyPriceChangeRequestDto })
  @ApiCreatedResponse({ type: SupplyPriceChangeDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async submitSupply(
    @Req() request: RequestWithId,
    @Param('skuId') skuId: string,
    @Body() body: SupplyPriceChangeRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplyPriceChangeDto> {
    const result = await this.service.submitSupply(await this.actorResolver.resolve(request), skuId, body, idempotencyKey, request.requestId!, request.ip ?? null);
    replayHeader(response, result.replayed);
    return result.body;
  }

  @Patch(':skuId/sale-prices')
  @HttpCode(200)
  @ApiOperation({ operationId: 'supplierListedPricing.patchSalePrices', summary: 'Version retail and enterprise sale prices without creating an approval task' })
  @ApiParam({ format: 'uuid', name: 'skuId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SalePriceChangeRequestDto })
  @ApiOkResponse({ type: SalePriceChangeResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async patchSales(
    @Req() request: RequestWithId,
    @Param('skuId') skuId: string,
    @Body() body: SalePriceChangeRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SalePriceChangeResponseDto> {
    const result = await this.service.patchSales(await this.actorResolver.resolve(request), skuId, body, idempotencyKey, request.requestId!, request.ip ?? null);
    replayHeader(response, result.replayed);
    return result.body;
  }
}

@ApiExtraModels(ApiErrorResponseDto, SupplyPriceChangeDto, SupplyPriceChangePageDto)
@ApiTags('supplier-post-listing-pricing')
@Controller('v1/supplier/pricing/supply-price-changes')
export class SupplierSupplyPriceChangeController {
  constructor(
    @Inject(PriceChangeService) private readonly service: PriceChangeService,
    @Inject(SUPPLIER_PRICING_ACTOR_RESOLVER) private readonly actorResolver: SupplierPricingActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierListedPricing.listSupplyPriceChanges', summary: 'List current-supplier supply price applications and review outcomes' })
  @ApiOkResponse({ type: SupplyPriceChangePageDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId): Promise<SupplyPriceChangePageDto> {
    return this.service.listSupplierSupplyReviews(await this.actorResolver.resolve(request));
  }
}

@ApiExtraModels(ApiErrorResponseDto, ProductApprovalDecisionRequestDto, SupplyPriceChangeDto, SupplyPriceChangePageDto, SupplyPriceReviewHistoryItemDto, SupplyPriceReviewHistoryPageDto)
@ApiTags('company-price-reviews')
@Controller('v1/company/price-reviews/supply-price-changes')
export class CompanySupplyPriceReviewController {
  constructor(
    @Inject(PriceChangeService) private readonly service: PriceChangeService,
    @Inject(COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER) private readonly actorResolver: CompanyProductApprovalActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companySupplyPriceReviews.list', summary: 'List supply price changes for the independent price-review role' })
  @ApiOkResponse({ type: SupplyPriceChangePageDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId): Promise<SupplyPriceChangePageDto> {
    return this.service.listCompany(await this.actorResolver.resolve(request, 'COMPANY_PRICE_REVIEW'));
  }

  @Get(':taskId/history')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companySupplyPriceReviews.history', summary: 'Read the append-only decision and effect history for one company-scoped review' })
  @ApiParam({ format: 'uuid', name: 'taskId', type: String })
  @ApiOkResponse({ type: SupplyPriceReviewHistoryPageDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async history(
    @Req() request: RequestWithId,
    @Param('taskId') taskId: string,
  ): Promise<SupplyPriceReviewHistoryPageDto> {
    return this.service.listCompanyHistory(
      await this.actorResolver.resolve(request, 'COMPANY_PRICE_REVIEW'),
      taskId,
    );
  }

  @Post(':taskId/decision')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companySupplyPriceReviews.decide', summary: 'Approve or reject a post-listing supply price change' })
  @ApiParam({ format: 'uuid', name: 'taskId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: ProductApprovalDecisionRequestDto })
  @ApiOkResponse({ type: SupplyPriceChangeDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async decide(
    @Req() request: RequestWithId,
    @Param('taskId') taskId: string,
    @Body() body: ProductApprovalDecisionRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplyPriceChangeDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRICE_REVIEW');
    const result = await this.service.decideSupply(
      actor,
      taskId,
      body,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }
}
