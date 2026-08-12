import { Body, Controller, Get, Header, Headers, HttpCode, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import { SUPPLIER_INVENTORY_ACTOR_RESOLVER, type SupplierInventoryActorResolver } from './inventory.actor.js';
import {
  SupplierInventoryAdjustmentRequestDto,
  SupplierInventoryBalanceDto,
  SupplierInventoryChangeDto,
  SupplierInventoryHistoryDto,
  SupplierInventoryMutationDto,
  SupplierInventoryPageDto,
} from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('supplier-inventory')
@ApiExtraModels(
  ApiErrorResponseDto,
  SupplierInventoryAdjustmentRequestDto,
  SupplierInventoryBalanceDto,
  SupplierInventoryChangeDto,
  SupplierInventoryHistoryDto,
  SupplierInventoryMutationDto,
  SupplierInventoryPageDto,
)
@Controller('v1/supplier/inventory')
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly service: InventoryService,
    @Inject(SUPPLIER_INVENTORY_ACTOR_RESOLVER) private readonly actorResolver: SupplierInventoryActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierInventory.list', summary: 'List the current supplier shared SKU inventory balances' })
  @ApiOkResponse({ type: SupplierInventoryPageDto })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiQuery({ name: 'warningOnly', required: false, type: Boolean })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId, @Query() query: Record<string, unknown>): Promise<SupplierInventoryPageDto> {
    const actor = await this.actorResolver.resolve(request);
    return this.service.list(actor, query) as Promise<SupplierInventoryPageDto>;
  }

  @Get(':skuId/history')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierInventory.history', summary: 'List append-only inventory history in the current supplier scope' })
  @ApiParam({ name: 'skuId', format: 'uuid', type: String })
  @ApiOkResponse({ type: SupplierInventoryHistoryDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async history(@Req() request: RequestWithId, @Param('skuId') skuId: string): Promise<SupplierInventoryHistoryDto> {
    const actor = await this.actorResolver.resolve(request);
    return this.service.history(actor, skuId) as Promise<SupplierInventoryHistoryDto>;
  }

  @Post(':skuId/adjustments')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'supplierInventory.adjust', summary: 'Append one idempotent inventory adjustment' })
  @ApiParam({ name: 'skuId', format: 'uuid', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SupplierInventoryAdjustmentRequestDto })
  @ApiOkResponse({ type: SupplierInventoryMutationDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async adjust(
    @Req() request: RequestWithId,
    @Param('skuId') skuId: string,
    @Body() body: SupplierInventoryAdjustmentRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplierInventoryMutationDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.adjust(
      actor,
      skuId,
      body,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    return result.body;
  }
}
