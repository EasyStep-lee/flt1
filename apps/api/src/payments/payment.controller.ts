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
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import { SafeApiError } from '../http/api-error.js';
import { ORDER_ACTOR_RESOLVER, type OrderActorResolver } from '../orders/order.actor.js';
import {
  WechatNotificationAcknowledgementDto,
  WechatPaymentNotificationDto,
  WechatPrepayRequestDto,
  WechatPrepayResponseDto,
  WelfareCardWechatPaymentRequestDto,
  WelfareCardWechatPaymentResponseDto,
  WelfareCardWechatCancellationRequestDto,
  WelfareCardWechatCancellationResponseDto,
} from './payment.dto.js';
import { PaymentService } from './payment.service.js';

interface RequestContext {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly requestId?: string;
}

const cookieHeader = (request: RequestContext): string | undefined => {
  const value = request.headers.cookie;
  return typeof value === 'string' ? value : undefined;
};

@ApiTags('payments')
@ApiExtraModels(ApiErrorResponseDto, WechatPrepayRequestDto, WechatPrepayResponseDto)
@Controller('v1/orders')
export class WechatPrepayController {
  constructor(
    @Inject(ORDER_ACTOR_RESOLVER) private readonly actors: OrderActorResolver,
    @Inject(PaymentService) private readonly service: PaymentService,
  ) {}

  @Post(':orderId/wechat-prepay')
  @HttpCode(201)
  @ApiOperation({ operationId: 'payments.createWechatPrepay', summary: 'Create or replay a WeChat prepay for an owned order' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: WechatPrepayRequestDto })
  @ApiCreatedResponse({ type: WechatPrepayResponseDto })
  @ApiOkResponse({ description: 'Idempotent replay', type: WechatPrepayResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async create(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: WechatPrepayRequestDto,
  ): Promise<WechatPrepayResponseDto> {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const cookie = cookieHeader(request);
    const actor = (await this.actors.resolveConsumer(cookie)) ?? (await this.actors.resolveEnterprise(cookie));
    if (!actor) throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Buyer session is required');
    if (actor.status !== 'ACTIVE' || (actor.kind === 'ENTERPRISE' && !actor.permissions.includes('PURCHASE'))) {
      throw new SafeApiError(403, 'ACCESS_DENIED', 'Buyer cannot create payments');
    }
    const result = await this.service.createWechatPrepay(
      actor,
      orderId,
      body,
      idempotencyKey,
      request.requestId ?? 'request-id-unavailable',
    );
    if (result.replayed) response.status(200);
    return result.body;
  }
}

@ApiTags('payments')
@ApiExtraModels(
  ApiErrorResponseDto,
  WelfareCardWechatPaymentRequestDto,
  WelfareCardWechatPaymentResponseDto,
  WelfareCardWechatCancellationRequestDto,
  WelfareCardWechatCancellationResponseDto,
)
@Controller('v1/consumer/orders')
export class ConsumerWelfareCardWechatPaymentController {
  constructor(
    @Inject(ORDER_ACTOR_RESOLVER) private readonly actors: OrderActorResolver,
    @Inject(PaymentService) private readonly service: PaymentService,
  ) {}

  @Post(':orderId/welfare-card-wechat-payment')
  @HttpCode(201)
  @ApiOperation({ operationId: 'payments.createWelfareCardWechatPayment', summary: 'Freeze the automatic welfare deduction and create one WeChat prepay for the difference' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: WelfareCardWechatPaymentRequestDto })
  @ApiCreatedResponse({ type: WelfareCardWechatPaymentResponseDto })
  @ApiOkResponse({ description: 'Idempotent replay', type: WelfareCardWechatPaymentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async create(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: WelfareCardWechatPaymentRequestDto,
  ): Promise<WelfareCardWechatPaymentResponseDto> {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const actor = await this.actors.resolveConsumer(cookieHeader(request));
    if (!actor) throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Consumer session is required');
    if (actor.status !== 'ACTIVE') throw new SafeApiError(403, 'ACCOUNT_SUSPENDED', 'Consumer account is not active');
    const result = await this.service.createWelfareCardWechatPrepay(
      actor,
      orderId,
      body,
      idempotencyKey,
      request.requestId ?? 'request-id-unavailable',
    );
    if (result.replayed) response.status(200);
    return result.body;
  }

  @Post(':orderId/welfare-card-wechat-payment/cancel')
  @HttpCode(200)
  @ApiOperation({ operationId: 'payments.cancelWelfareCardWechatPayment', summary: 'Query WeChat before safely resolving a mixed-payment cancellation' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: WelfareCardWechatCancellationRequestDto })
  @ApiOkResponse({ type: WelfareCardWechatCancellationResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async cancel(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: WelfareCardWechatCancellationRequestDto,
  ): Promise<WelfareCardWechatCancellationResponseDto> {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const actor = await this.actors.resolveConsumer(cookieHeader(request));
    if (!actor) throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Consumer session is required');
    if (actor.status !== 'ACTIVE') throw new SafeApiError(403, 'ACCOUNT_SUSPENDED', 'Consumer account is not active');
    return this.service.cancelWelfareCardWechatPayment(
      actor,
      orderId,
      body,
      idempotencyKey,
      request.requestId ?? 'request-id-unavailable',
    );
  }
}

@ApiTags('payment-notifications')
@ApiExtraModels(ApiErrorResponseDto, WechatPaymentNotificationDto, WechatNotificationAcknowledgementDto)
@Controller('v1/payment-notifications')
export class WechatPaymentNotificationController {
  constructor(@Inject(PaymentService) private readonly service: PaymentService) {}

  @Post('wechat')
  @HttpCode(200)
  @ApiOperation({ operationId: 'payments.confirmWechatNotification', summary: 'Verify and idempotently process a WeChat Pay notification' })
  @ApiBody({ type: WechatPaymentNotificationDto })
  @ApiOkResponse({ type: WechatNotificationAcknowledgementDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async confirm(
    @Req() request: RequestContext,
    @Body() body: WechatPaymentNotificationDto,
  ): Promise<WechatNotificationAcknowledgementDto> {
    return this.service.confirmWechatNotification(
      request.headers,
      body,
      request.requestId ?? 'request-id-unavailable',
    );
  }
}
