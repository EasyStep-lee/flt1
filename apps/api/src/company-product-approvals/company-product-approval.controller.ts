import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
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
  COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER,
  type CompanyProductApprovalActorResolver,
} from './company-product-approval.actor.js';
import {
  InitialPriceReviewDto,
  InitialPriceReviewPageDto,
  InitialPriceReviewSkuDto,
  ProductApprovalDecisionRequestDto,
  ProductApprovalDecisionResponseDto,
  ProductMaterialReviewDto,
  ProductMaterialReviewPageDto,
  ProductMaterialReviewSkuDto,
} from './company-product-approval.dto.js';
import { CompanyProductApprovalService } from './company-product-approval.service.js';
import { SupplyPriceChangeDto } from '../price-changes/price-change.dto.js';
import { PriceChangeService } from '../price-changes/price-change.service.js';

const replayHeader = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

@ApiExtraModels(
  ApiErrorResponseDto,
  ProductApprovalDecisionRequestDto,
  ProductApprovalDecisionResponseDto,
  ProductMaterialReviewDto,
  ProductMaterialReviewPageDto,
  ProductMaterialReviewSkuDto,
  InitialPriceReviewDto,
  InitialPriceReviewPageDto,
  InitialPriceReviewSkuDto,
)
@ApiTags('company-product-material-reviews')
@Controller('v1/company/product-material-reviews')
export class CompanyProductMaterialReviewController {
  constructor(
    @Inject(CompanyProductApprovalService)
    private readonly service: CompanyProductApprovalService,
    @Inject(COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER)
    private readonly actorResolver: CompanyProductApprovalActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companyProductMaterialReviews.list', summary: 'List material reviews for product operations' })
  @ApiOkResponse({ type: ProductMaterialReviewPageDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId): Promise<ProductMaterialReviewPageDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    return this.service.listMaterial(actor) as Promise<ProductMaterialReviewPageDto>;
  }

  @Post(':taskId/decision')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companyProductMaterialReviews.decide', summary: 'Approve or reject material without price visibility' })
  @ApiParam({ format: 'uuid', name: 'taskId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: ProductApprovalDecisionRequestDto })
  @ApiOkResponse({ type: ProductApprovalDecisionResponseDto })
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
  ): Promise<ProductApprovalDecisionResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    const result = await this.service.decide(
      actor,
      'PRODUCT_MATERIAL',
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

@ApiTags('company-price-reviews')
@ApiExtraModels(ProductApprovalDecisionResponseDto, SupplyPriceChangeDto)
@Controller('v1/company/price-reviews')
export class CompanyInitialPriceReviewController {
  constructor(
    @Inject(CompanyProductApprovalService)
    private readonly service: CompanyProductApprovalService,
    @Inject(COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER)
    private readonly actorResolver: CompanyProductApprovalActorResolver,
    @Inject(PriceChangeService)
    private readonly priceChangeService: PriceChangeService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companyInitialPriceReviews.list', summary: 'List initial prices for the price-review role' })
  @ApiOkResponse({ type: InitialPriceReviewPageDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId): Promise<InitialPriceReviewPageDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRICE_REVIEW');
    return this.service.listPrices(actor) as Promise<InitialPriceReviewPageDto>;
  }

  @Post(':taskId/decision')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companyInitialPriceReviews.decide', summary: 'Approve or reject the frozen initial three-price snapshot' })
  @ApiParam({ format: 'uuid', name: 'taskId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: ProductApprovalDecisionRequestDto })
  @ApiOkResponse({ schema: { oneOf: [
    { $ref: '#/components/schemas/ProductApprovalDecisionResponseDto' },
    { $ref: '#/components/schemas/SupplyPriceChangeDto' },
  ] } })
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
  ): Promise<ProductApprovalDecisionResponseDto | SupplyPriceChangeDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRICE_REVIEW');
    if (await this.priceChangeService.findCompanyReview(actor, taskId)) {
      const priceResult = await this.priceChangeService.decideSupply(
        actor,
        taskId,
        body,
        idempotencyKey,
        request.requestId!,
        request.ip ?? null,
      );
      replayHeader(response, priceResult.replayed);
      return priceResult.body;
    }
    const result = await this.service.decide(
      actor,
      'PRODUCT_INITIAL_PRICE',
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
