import { Body, Controller, Get, Header, Headers, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiExtraModels, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import { WELFARE_CARD_ACTOR_RESOLVER, type WelfareCardActorResolver } from './welfare-card.actor.js';
import { CreateWelfareBatchRequestDto, CreateWelfareProgramRequestDto, WelfareBatchResponseDto, WelfareProgramPageResponseDto, WelfareProgramResponseDto } from './welfare-card.dto.js';
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
