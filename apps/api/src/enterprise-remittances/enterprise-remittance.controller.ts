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
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
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
} from '../orders/order.actor.js';
import {
  assertCompanyFinanceActor,
  COMPANY_FINANCE_ACTOR_RESOLVER,
  type CompanyFinanceActorResolver,
} from './enterprise-remittance.actor.js';
import {
  EnterpriseRemittanceProofRequestDto,
  EnterpriseRemittanceResponseDto,
  EnterpriseRemittanceReviewRequestDto,
} from './enterprise-remittance.dto.js';
import { EnterpriseRemittanceService } from './enterprise-remittance.service.js';

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

@ApiTags('enterprise-remittance')
@ApiExtraModels(ApiErrorResponseDto, EnterpriseRemittanceProofRequestDto, EnterpriseRemittanceResponseDto)
@Controller('v1/enterprise/orders')
export class EnterpriseRemittanceController {
  constructor(
    @Inject(ORDER_ACTOR_RESOLVER) private readonly actors: OrderActorResolver,
    @Inject(EnterpriseRemittanceService) private readonly service: EnterpriseRemittanceService,
  ) {}

  @Post(':orderId/remittance-proof')
  @HttpCode(201)
  @ApiOperation({ operationId: 'enterpriseRemittance.submitProof', summary: 'Submit company bank-remittance proof for an enterprise order' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: EnterpriseRemittanceProofRequestDto })
  @ApiCreatedResponse({ type: EnterpriseRemittanceResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async submit(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: EnterpriseRemittanceProofRequestDto,
  ): Promise<EnterpriseRemittanceResponseDto> {
    setPrivateResponse(response);
    const actor = await this.actors.resolveEnterprise(cookieHeader(request));
    if (!actor) throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Enterprise session is required');
    const result = await this.service.submit(
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

@ApiTags('company-enterprise-remittance')
@ApiExtraModels(ApiErrorResponseDto, EnterpriseRemittanceReviewRequestDto, EnterpriseRemittanceResponseDto)
@Controller('v1/company/enterprise-orders')
export class CompanyEnterpriseRemittanceController {
  constructor(
    @Inject(COMPANY_FINANCE_ACTOR_RESOLVER) private readonly actors: CompanyFinanceActorResolver,
    @Inject(EnterpriseRemittanceService) private readonly service: EnterpriseRemittanceService,
  ) {}

  @Post(':orderId/remittance-review')
  @HttpCode(200)
  @ApiOperation({ operationId: 'enterpriseRemittance.reviewProof', summary: 'Review enterprise remittance in the company finance workspace' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: EnterpriseRemittanceReviewRequestDto })
  @ApiOkResponse({ type: EnterpriseRemittanceResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async review(
    @Req() request: RequestContext,
    @Res({ passthrough: true }) response: Response,
    @Param('orderId') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: EnterpriseRemittanceReviewRequestDto,
  ): Promise<EnterpriseRemittanceResponseDto> {
    setPrivateResponse(response);
    const actor = assertCompanyFinanceActor(await this.actors.resolve(cookieHeader(request)));
    const result = await this.service.review(
      actor,
      orderId,
      body,
      idempotencyKey,
      request.requestId ?? 'request-id-unavailable',
    );
    return result.body;
  }
}
