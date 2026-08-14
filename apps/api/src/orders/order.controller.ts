import type { Response } from 'express';

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import { SafeApiError } from '../http/api-error.js';
import {
  ORDER_ACTOR_RESOLVER,
  type OrderActorResolver,
} from './order.actor.js';
import { CreateBuyerOrderResponseDto, CreateOrderRequestDto } from './order.dto.js';
import { OrderService } from './order.service.js';

interface RequestContext {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly requestId?: string;
}

const cookieHeader = (request: RequestContext): string | undefined => {
  const value = request.headers.cookie;
  return typeof value === 'string' ? value : undefined;
};

const setPrivateResponse = (response: Response): void => {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
};

@ApiTags('consumer-orders')
@ApiExtraModels(ApiErrorResponseDto, CreateOrderRequestDto, CreateBuyerOrderResponseDto)
@Controller('v1/consumer/orders')
export class ConsumerOrderController {
  constructor(
    @Inject(ORDER_ACTOR_RESOLVER) private readonly actors: OrderActorResolver,
    @Inject(OrderService) private readonly service: OrderService,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ operationId: 'orders.createConsumerOrder', summary: 'Create one company consumer order across suppliers' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CreateOrderRequestDto })
  @ApiCreatedResponse({ type: CreateBuyerOrderResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async create(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateOrderRequestDto,
  ): Promise<CreateBuyerOrderResponseDto> {
    setPrivateResponse(response);
    const actor = await this.actors.resolveConsumer(cookieHeader(request));
    if (!actor) throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Consumer session is required');
    const result = await this.service.createConsumer(
      actor,
      body,
      idempotencyKey,
      request.requestId ?? 'request-id-unavailable',
    );
    if (result.replayed) response.status(200);
    return result.body;
  }
}

@ApiTags('enterprise-orders')
@ApiExtraModels(ApiErrorResponseDto, CreateOrderRequestDto, CreateBuyerOrderResponseDto)
@Controller('v1/enterprise/orders')
export class EnterpriseOrderController {
  constructor(
    @Inject(ORDER_ACTOR_RESOLVER) private readonly actors: OrderActorResolver,
    @Inject(OrderService) private readonly service: OrderService,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ operationId: 'orders.createEnterpriseOrder', summary: 'Create one company enterprise order across suppliers' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CreateOrderRequestDto })
  @ApiCreatedResponse({ type: CreateBuyerOrderResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async create(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateOrderRequestDto,
  ): Promise<CreateBuyerOrderResponseDto> {
    setPrivateResponse(response);
    const actor = await this.actors.resolveEnterprise(cookieHeader(request));
    if (!actor) throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Enterprise session is required');
    const result = await this.service.createEnterprise(
      actor,
      body,
      idempotencyKey,
      request.requestId ?? 'request-id-unavailable',
    );
    if (result.replayed) response.status(200);
    return result.body;
  }
}
