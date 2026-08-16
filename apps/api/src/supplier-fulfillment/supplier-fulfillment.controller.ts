import { Body, Controller, Get, Header, Headers, HttpCode, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBody, ApiConflictResponse, ApiExtraModels, ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import { SUPPLIER_FULFILLMENT_ACTOR_RESOLVER, type SupplierFulfillmentActorResolver } from './supplier-fulfillment.actor.js';
import { FulfillmentNodeRequestDto, SupplierSubOrderPageResponseDto, SupplierSubOrderResponseDto } from './supplier-fulfillment.dto.js';
import { SupplierFulfillmentService } from './supplier-fulfillment.service.js';

@ApiTags('supplier-fulfillment')
@ApiExtraModels(ApiErrorResponseDto, FulfillmentNodeRequestDto, SupplierSubOrderPageResponseDto, SupplierSubOrderResponseDto)
@Controller('v1/supplier/fulfillment-sub-orders')
export class SupplierFulfillmentController {
  constructor(
    @Inject(SupplierFulfillmentService) private readonly service: SupplierFulfillmentService,
    @Inject(SUPPLIER_FULFILLMENT_ACTOR_RESOLVER) private readonly actorResolver: SupplierFulfillmentActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierFulfillment.list', summary: 'List active fulfillment suborders in the current supplier scope' })
  @ApiOkResponse({ type: SupplierSubOrderPageResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiQuery({ name: 'channelType', required: false, enum: ['CONSUMER', 'ENTERPRISE'] })
  @ApiQuery({ name: 'preparationStatus', required: false, enum: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_HANDOVER', 'HANDED_OVER', 'COMPLETED', 'CANCELLED'] })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId, @Query() query: Record<string, unknown>): Promise<SupplierSubOrderPageResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    return this.service.list(actor, query) as Promise<SupplierSubOrderPageResponseDto>;
  }

  @Post(':subOrderId/nodes')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierFulfillment.appendNode', summary: 'Append one idempotent supplier preparation node' })
  @ApiParam({ format: 'uuid', name: 'subOrderId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: FulfillmentNodeRequestDto })
  @ApiOkResponse({ type: SupplierSubOrderResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async appendNode(
    @Req() request: RequestWithId,
    @Param('subOrderId') subOrderId: string,
    @Body() body: FulfillmentNodeRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplierSubOrderResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.appendNode(actor, subOrderId, body, idempotencyKey, request.requestId ?? 'request-id-unavailable', request.ip ?? null);
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    return result.body as SupplierSubOrderResponseDto;
  }
}
