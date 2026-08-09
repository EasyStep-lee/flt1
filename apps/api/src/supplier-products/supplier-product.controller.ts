import {
  Body,
  Controller,
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
  SubmitProductMaterialRequestDto,
  SupplierProductDraftRequestDto,
  SupplierProductPatchRequestDto,
  SupplierProductResponseDto,
} from './supplier-product.dto.js';
import { SupplierProductService } from './supplier-product.service.js';

const replayHeader = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

@ApiTags('supplier-products')
@ApiExtraModels(
  ApiErrorResponseDto,
  ProductMaterialApprovalResponseDto,
  SubmitProductMaterialRequestDto,
  SupplierProductDraftRequestDto,
  SupplierProductPatchRequestDto,
  SupplierProductResponseDto,
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
