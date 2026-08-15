import type { Response } from 'express';

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import {
  assertRefundActor,
  REFUND_ACTOR_RESOLVER,
  type RefundActorResolver,
} from './refund.actor.js';
import { RefundCreateRequestDto, RefundResponseDto } from './refund.dto.js';
import { RefundService } from './refund.service.js';

interface RequestContext {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly requestId?: string;
}

const cookieHeader = (request: RequestContext): string | undefined => {
  const value = request.headers.cookie;
  return typeof value === 'string' ? value : undefined;
};

@ApiTags('refunds')
@ApiExtraModels(ApiErrorResponseDto, RefundCreateRequestDto, RefundResponseDto)
@Controller('v1/aftersales')
export class RefundController {
  constructor(
    @Inject(REFUND_ACTOR_RESOLVER) private readonly actors: RefundActorResolver,
    @Inject(RefundService) private readonly service: RefundService,
  ) {}

  @Post(':afterSaleId/refund')
  @HttpCode(201)
  @ApiOperation({ operationId: 'refunds.createOriginalStructureRefund', summary: 'Initiate an approved refund using immutable original payment allocations' })
  @ApiParam({ name: 'afterSaleId', format: 'uuid', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: RefundCreateRequestDto })
  @ApiCreatedResponse({ type: RefundResponseDto })
  @ApiAcceptedResponse({ type: RefundResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async create(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
    @Param('afterSaleId') afterSaleId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: RefundCreateRequestDto,
  ): Promise<RefundResponseDto> {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const actor = assertRefundActor(await this.actors.resolve(cookieHeader(request)));
    const result = await this.service.create(
      actor,
      afterSaleId,
      body,
      idempotencyKey,
      request.requestId ?? 'request-id-unavailable',
    );
    if (result.replayed) response.status(200);
    else if (result.accepted) response.status(202);
    return result.body;
  }
}
