import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPreconditionRequiredResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import {
  SUPPLIER_PRODUCT_ACTOR_RESOLVER,
  type SupplierProductActorResolver,
} from './supplier-product.actor.js';
import {
  ProductMaterialApprovalResponseDto,
  ProductChannelVisibilityHistoryItemDto,
  ProductChannelVisibilityHistoryPageDto,
  ProductChannelVisibilitySnapshotDto,
  SubmitProductMaterialRequestDto,
  SupplierProductDraftRequestDto,
  SupplierProductPatchRequestDto,
  SupplierProductResponseDto,
  SupplierProductChannelVisibilityRequestDto,
  SupplierProductChannelVisibilityResponseDto,
} from './supplier-product.dto.js';
import { SupplierProductService } from './supplier-product.service.js';

const replayHeader = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

@ApiTags('supplier-products')
@ApiExtraModels(
  ApiErrorResponseDto,
  ProductMaterialApprovalResponseDto,
  ProductChannelVisibilityHistoryItemDto,
  ProductChannelVisibilityHistoryPageDto,
  ProductChannelVisibilitySnapshotDto,
  SubmitProductMaterialRequestDto,
  SupplierProductDraftRequestDto,
  SupplierProductPatchRequestDto,
  SupplierProductResponseDto,
  SupplierProductChannelVisibilityRequestDto,
  SupplierProductChannelVisibilityResponseDto,
)
@Controller('v1/supplier/products')
export class SupplierProductController {
  constructor(
    @Inject(SupplierProductService) private readonly service: SupplierProductService,
    @Inject(SUPPLIER_PRODUCT_ACTOR_RESOLVER)
    private readonly actorResolver: SupplierProductActorResolver,
  ) {}

  @Post()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierProducts.create', summary: 'Create a supplier product draft' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SupplierProductDraftRequestDto })
  @ApiCreatedResponse({ type: SupplierProductResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async create(
    @Req() request: Request,
    @Body() body: SupplierProductDraftRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplierProductResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.createDraft(actor, body, idempotencyKey);
    replayHeader(response, result.replayed);
    return result.body as SupplierProductResponseDto;
  }

  @Patch(':supplierProductId')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierProducts.patch', summary: 'Patch an owned supplier product draft' })
  @ApiParam({ format: 'uuid', name: 'supplierProductId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SupplierProductPatchRequestDto })
  @ApiOkResponse({ type: SupplierProductResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async patch(
    @Req() request: Request,
    @Param('supplierProductId') supplierProductId: string,
    @Body() body: SupplierProductPatchRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplierProductResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.patchDraft(
      actor,
      supplierProductId,
      body,
      idempotencyKey,
    );
    replayHeader(response, result.replayed);
    return result.body as SupplierProductResponseDto;
  }

  @Patch(':supplierProductId/channel-visibility')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'supplierProducts.changeChannelVisibility',
    summary: 'Change ACTIVE product channel visibility without duplicating Product/Sku resources',
  })
  @ApiParam({ format: 'uuid', name: 'supplierProductId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SupplierProductChannelVisibilityRequestDto })
  @ApiOkResponse({ type: SupplierProductChannelVisibilityResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async changeChannelVisibility(
    @Req() request: Request,
    @Param('supplierProductId') supplierProductId: string,
    @Body() body: SupplierProductChannelVisibilityRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplierProductChannelVisibilityResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.changeChannelVisibility(
      actor,
      supplierProductId,
      body,
      idempotencyKey,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }

  @Get(':supplierProductId/channel-visibility-history')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'supplierProducts.listChannelVisibilityHistory',
    summary: 'List immutable channel visibility history for an owned supplier product',
  })
  @ApiParam({ format: 'uuid', name: 'supplierProductId', type: String })
  @ApiOkResponse({ type: ProductChannelVisibilityHistoryPageDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async listChannelVisibilityHistory(
    @Req() request: Request,
    @Param('supplierProductId') supplierProductId: string,
  ): Promise<ProductChannelVisibilityHistoryPageDto> {
    const actor = await this.actorResolver.resolve(request);
    return this.service.listChannelVisibilityHistory(actor, supplierProductId);
  }

  @Post(':supplierProductId/submit-material')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierProducts.submitMaterial', summary: 'Submit product material for company review' })
  @ApiParam({ format: 'uuid', name: 'supplierProductId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SubmitProductMaterialRequestDto })
  @ApiCreatedResponse({ type: ProductMaterialApprovalResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async submitMaterial(
    @Req() request: Request,
    @Param('supplierProductId') supplierProductId: string,
    @Body() body: SubmitProductMaterialRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProductMaterialApprovalResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.submitMaterial(
      actor,
      supplierProductId,
      body,
      idempotencyKey,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }
}
