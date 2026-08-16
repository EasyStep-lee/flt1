import { Body, Controller, Get, Header, Headers, HttpCode, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiExtraModels, ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import { SafeApiError } from '../http/api-error.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import { ORDER_ACTOR_RESOLVER, type OrderActorResolver } from '../orders/order.actor.js';
import { WELFARE_CARD_ACTOR_RESOLVER, type WelfareCardActorResolver } from './welfare-card.actor.js';
import { CreateWelfareBatchRequestDto, CreateWelfareProgramRequestDto, EligibleWelfareAccountsResponseDto, WelfareBatchResponseDto, WelfareCardAccountResponseDto, WelfareCardBindRequestDto, WelfareCardEligibilityQueryDto, WelfareProgramPageResponseDto, WelfareProgramResponseDto } from './welfare-card.dto.js';
import { WelfareCardService } from './welfare-card.service.js';

@ApiTags('company-welfare-card')
@ApiExtraModels(ApiErrorResponseDto, CreateWelfareProgramRequestDto, CreateWelfareBatchRequestDto, WelfareProgramResponseDto, WelfareBatchResponseDto)
@Controller('v1/company/welfare-card/programs')
export class WelfareCardController {
  constructor(
    @Inject(WelfareCardService) private readonly service: WelfareCardService,
    @Inject(WELFARE_CARD_ACTOR_RESOLVER) private readonly actorResolver: WelfareCardActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiOperation({ operationId: 'companyWelfareCard.listPrograms', summary: 'List company-owned welfare-card programs and draft batches' })
  @ApiOkResponse({ type: WelfareProgramPageResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId, @Query() query: Record<string, unknown>): Promise<WelfareProgramPageResponseDto> {
    return this.service.list(await this.actorResolver.resolve(request), query);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiOperation({ operationId: 'companyWelfareCard.createProgram', summary: 'Create one DRAFT company welfare-card program' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CreateWelfareProgramRequestDto })
  @ApiCreatedResponse({ type: WelfareProgramResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async createProgram(@Req() request: RequestWithId, @Body() body: CreateWelfareProgramRequestDto & Record<string, unknown>, @Headers('idempotency-key') key: string | undefined, @Res({ passthrough: true }) response: Response): Promise<WelfareProgramResponseDto> {
    const result = await this.service.createProgram(await this.actorResolver.resolve(request), body, key, request.requestId ?? 'request-id-unavailable', request.ip ?? null);
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    return result.body;
  }

  @Post(':programId/batches')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiOperation({ operationId: 'companyWelfareCard.createBatch', summary: 'Create one amount-conserving DRAFT welfare-card batch' })
  @ApiParam({ name: 'programId', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CreateWelfareBatchRequestDto })
  @ApiCreatedResponse({ type: WelfareBatchResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async createBatch(@Req() request: RequestWithId, @Param('programId') programId: string, @Body() body: CreateWelfareBatchRequestDto & Record<string, unknown>, @Headers('idempotency-key') key: string | undefined, @Res({ passthrough: true }) response: Response): Promise<WelfareBatchResponseDto> {
    const result = await this.service.createBatch(await this.actorResolver.resolve(request), programId, body, key, request.requestId ?? 'request-id-unavailable', request.ip ?? null);
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    return result.body;
  }
}

@ApiTags('consumer-welfare-card')
@ApiExtraModels(ApiErrorResponseDto, WelfareCardBindRequestDto, WelfareCardAccountResponseDto, WelfareCardEligibilityQueryDto, EligibleWelfareAccountsResponseDto)
@Controller('v1/consumer/welfare-card-accounts')
export class ConsumerWelfareCardController {
  constructor(
    @Inject(WelfareCardService) private readonly service: WelfareCardService,
    @Inject(ORDER_ACTOR_RESOLVER) private readonly actors: OrderActorResolver,
  ) {}

  @Get('eligible')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiOperation({ operationId: 'consumerWelfareCard.listEligibleAccounts', summary: 'List current consumer welfare-card accounts usable for the server-priced cart' })
  @ApiQuery({ format: 'uuid', isArray: true, name: 'skuId', required: true, type: String })
  @ApiQuery({ isArray: true, name: 'quantity', required: true, type: Number })
  @ApiOkResponse({ type: EligibleWelfareAccountsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async eligible(
    @Req() request: RequestWithId,
    @Query() query: WelfareCardEligibilityQueryDto & Record<string, unknown>,
  ): Promise<EligibleWelfareAccountsResponseDto> {
    const cookie = typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined;
    const actor = await this.actors.resolveConsumer(cookie);
    if (!actor) throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Consumer session is required');
    return this.service.listEligibleAccounts(actor, query);
  }

  @Post('bind')
  @HttpCode(201)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiOperation({ operationId: 'consumerWelfareCard.bindAccount', summary: 'Bind one issued welfare-card code to the verified consumer' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: WelfareCardBindRequestDto })
  @ApiCreatedResponse({ type: WelfareCardAccountResponseDto })
  @ApiOkResponse({ description: 'Exact idempotent replay', type: WelfareCardAccountResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async bind(
    @Req() request: RequestWithId,
    @Body() body: WelfareCardBindRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WelfareCardAccountResponseDto> {
    const cookie = typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined;
    const actor = await this.actors.resolveConsumer(cookie);
    if (!actor) throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Consumer session is required');
    const result = await this.service.bindCard(actor, body, key, request.requestId ?? 'request-id-unavailable');
    if (result.replayed) {
      response.status(200);
      response.setHeader('Idempotency-Replayed', 'true');
    }
    return result.body;
  }
}
