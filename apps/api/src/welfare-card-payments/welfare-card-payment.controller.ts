import type { Response } from 'express';

import { Body, Controller, Headers, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import { SafeApiError } from '../http/api-error.js';
import { ORDER_ACTOR_RESOLVER, type OrderActorResolver } from '../orders/order.actor.js';
import { WelfareCardFullPaymentRequestDto, WelfareCardFullPaymentResponseDto } from './welfare-card-payment.dto.js';
import { WelfareCardPaymentService } from './welfare-card-payment.service.js';

interface RequestContext {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly requestId?: string;
}
const cookieHeader = (request: RequestContext): string | undefined => {
  const value = request.headers.cookie;
  return typeof value === 'string' ? value : undefined;
};

@ApiTags('consumer-welfare-card-payments')
@ApiExtraModels(ApiErrorResponseDto, WelfareCardFullPaymentRequestDto, WelfareCardFullPaymentResponseDto)
@Controller('v1/consumer/orders')
export class WelfareCardPaymentController {
  constructor(
    @Inject(ORDER_ACTOR_RESOLVER) private readonly actors: OrderActorResolver,
    @Inject(WelfareCardPaymentService) private readonly service: WelfareCardPaymentService,
  ) {}

  @Post(':orderId/welfare-card-full-payment')
  @HttpCode(201)
  @ApiOperation({ operationId: 'consumerWelfareCard.payFullOrder', summary: 'Pay an owned consumer order fully with one eligible welfare-card account' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ format: 'uuid', name: 'orderId', type: String })
  @ApiBody({ type: WelfareCardFullPaymentRequestDto })
  @ApiCreatedResponse({ type: WelfareCardFullPaymentResponseDto })
  @ApiOkResponse({ description: 'Exact idempotent replay', type: WelfareCardFullPaymentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async payFull(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: WelfareCardFullPaymentRequestDto & Record<string, unknown>,
  ): Promise<WelfareCardFullPaymentResponseDto> {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const actor = await this.actors.resolveConsumer(cookieHeader(request));
    if (!actor) throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Consumer session is required');
    const result = await this.service.payFull(actor, orderId, body, idempotencyKey, request.requestId ?? 'request-id-unavailable');
    if (result.replayed) response.status(200);
    return result.body;
  }
}
