import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPreconditionRequiredResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import {
  FUNCTIONAL_ACCOUNT_ACTOR_RESOLVER,
  type FunctionalAccountActorResolver,
} from './supplier-functional-account.actor.js';
import {
  CreateFunctionalAccountRequestDto,
  FunctionalAccountPageResponseDto,
  FunctionalAccountQueryDto,
  FunctionalAccountResponseDto,
} from './supplier-functional-account.dto.js';
import { SupplierFunctionalAccountService } from './supplier-functional-account.service.js';

@ApiExtraModels(
  ApiErrorResponseDto,
  CreateFunctionalAccountRequestDto,
  FunctionalAccountPageResponseDto,
  FunctionalAccountQueryDto,
  FunctionalAccountResponseDto,
)
@ApiTags('functional-accounts')
@Controller('v1/:ownerType/functional-accounts')
export class SupplierFunctionalAccountController {
  constructor(
    @Inject(SupplierFunctionalAccountService)
    private readonly service: SupplierFunctionalAccountService,
    @Inject(FUNCTIONAL_ACCOUNT_ACTOR_RESOLVER)
    private readonly actorResolver: FunctionalAccountActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'functionalAccounts.list',
    summary: 'List functional accounts in the authenticated owner scope',
  })
  @ApiParam({ enum: ['supplier', 'company'], name: 'ownerType', type: String })
  @ApiQuery({ enum: ['SUPPLIER_ACCOUNT_ADMIN', 'SUPPLIER_PRODUCT', 'SUPPLIER_PRICING', 'SUPPLIER_INVENTORY', 'SUPPLIER_FULFILLMENT', 'SUPPLIER_AFTERSALES', 'SUPPLIER_FINANCE', 'SUPPLIER_AUDIT'], name: 'accountTypeCode', required: false })
  @ApiQuery({ enum: ['PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'REVOKED'], name: 'status', required: false })
  @ApiQuery({ maxLength: 128, name: 'keyword', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: FunctionalAccountPageResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async list(
    @Req() request: Request,
    @Param('ownerType') ownerType: string,
    @Query() query: FunctionalAccountQueryDto & Record<string, unknown>,
  ): Promise<FunctionalAccountPageResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    return this.service.list(actor, ownerType, query);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'functionalAccounts.create',
    summary: 'Invite a supplier functional account after second verification',
  })
  @ApiParam({ enum: ['supplier', 'company'], name: 'ownerType', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CreateFunctionalAccountRequestDto })
  @ApiCreatedResponse({ type: FunctionalAccountResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async create(
    @Req() request: RequestWithId,
    @Param('ownerType') ownerType: string,
    @Body() body: CreateFunctionalAccountRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FunctionalAccountResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.create(
      actor,
      ownerType,
      body,
      idempotencyKey,
      request.requestId,
      request.ip,
    );
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    return result.body;
  }
}
