import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
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
  ApiParam,
  ApiPreconditionRequiredResponse,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import {
  ENTERPRISE_ONBOARDING_ACTOR_RESOLVER,
  type EnterpriseOnboardingActorResolver,
} from './enterprise-onboarding.actor.js';
import {
  EnterpriseRegistrationCreatedResponseDto,
  EnterpriseRegistrationPageResponseDto,
  EnterpriseRegistrationPatchRequestDto,
  EnterpriseRegistrationRequestDto,
  EnterpriseRegistrationResponseDto,
  EnterpriseReviewRequestDto,
  EnterpriseSubmitReviewRequestDto,
  EnterpriseSuspendRequestDto,
} from './enterprise-onboarding.dto.js';
import { EnterpriseOnboardingService } from './enterprise-onboarding.service.js';

const markReplay = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

@ApiExtraModels(
  ApiErrorResponseDto,
  EnterpriseRegistrationRequestDto,
  EnterpriseRegistrationCreatedResponseDto,
  EnterpriseRegistrationPatchRequestDto,
  EnterpriseRegistrationResponseDto,
  EnterpriseSubmitReviewRequestDto,
)
@ApiTags('enterprise-registration')
@Controller('v1/enterprise/registrations')
export class EnterpriseRegistrationController {
  constructor(
    @Inject(EnterpriseOnboardingService)
    private readonly service: EnterpriseOnboardingService,
  ) {}

  @Post()
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @ApiOperation({
    operationId: 'enterpriseRegistration.create',
    summary: 'Create an enterprise certification draft after mobile verification',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: EnterpriseRegistrationRequestDto })
  @ApiCreatedResponse({ type: EnterpriseRegistrationCreatedResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async register(
    @Body() body: EnterpriseRegistrationRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EnterpriseRegistrationCreatedResponseDto> {
    const result = await this.service.register(body, idempotencyKey);
    markReplay(response, result.replayed);
    return result.body;
  }

  @Get('me')
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @ApiOperation({
    operationId: 'enterpriseRegistration.getOwn',
    summary: 'Read the enterprise certification bound to a registration credential',
  })
  @ApiHeader({ name: 'Authorization', required: true })
  @ApiOkResponse({ type: EnterpriseRegistrationResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async getOwn(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<EnterpriseRegistrationResponseDto> {
    return this.service.getOwn(authorization);
  }

  @Patch('me')
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @ApiOperation({
    operationId: 'enterpriseRegistration.patchOwn',
    summary: 'Save enterprise certification draft or correction fields',
  })
  @ApiHeader({ name: 'Authorization', required: true })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: EnterpriseRegistrationPatchRequestDto })
  @ApiOkResponse({ type: EnterpriseRegistrationResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async patchOwn(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: EnterpriseRegistrationPatchRequestDto & Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EnterpriseRegistrationResponseDto> {
    const result = await this.service.patchOwn(authorization, body, idempotencyKey);
    markReplay(response, result.replayed);
    return result.body;
  }

  @Post('me/submit-review')
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @ApiOperation({
    operationId: 'enterpriseRegistration.submitOwn',
    summary: 'Submit or resubmit an enterprise certification for company review',
  })
  @ApiHeader({ name: 'Authorization', required: true })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: EnterpriseSubmitReviewRequestDto })
  @ApiCreatedResponse({ type: EnterpriseRegistrationResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async submitOwn(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: EnterpriseSubmitReviewRequestDto & Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EnterpriseRegistrationResponseDto> {
    const result = await this.service.submitOwn(authorization, body, idempotencyKey);
    markReplay(response, result.replayed);
    return result.body;
  }
}

@ApiExtraModels(
  ApiErrorResponseDto,
  EnterpriseRegistrationPageResponseDto,
  EnterpriseRegistrationResponseDto,
  EnterpriseReviewRequestDto,
  EnterpriseSuspendRequestDto,
)
@ApiTags('company-enterprise-certification')
@Controller('v1/company/enterprise-registrations')
export class CompanyEnterpriseRegistrationController {
  constructor(
    @Inject(EnterpriseOnboardingService)
    private readonly service: EnterpriseOnboardingService,
    @Inject(ENTERPRISE_ONBOARDING_ACTOR_RESOLVER)
    private readonly actorResolver: EnterpriseOnboardingActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @ApiOperation({
    operationId: 'companyEnterpriseRegistration.list',
    summary: 'List enterprise certifications for the fixed company reviewer workspace',
  })
  @ApiOkResponse({ type: EnterpriseRegistrationPageResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(
    @Req() request: Request,
    @Query() query: Record<string, unknown>,
  ): Promise<EnterpriseRegistrationPageResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    return this.service.listForCompany(actor, query);
  }

  @Post(':enterpriseId/review')
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @ApiOperation({
    operationId: 'companyEnterpriseRegistration.review',
    summary: 'Request correction, approve, or reject an enterprise certification',
  })
  @ApiParam({ format: 'uuid', name: 'enterpriseId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: EnterpriseReviewRequestDto })
  @ApiCreatedResponse({ type: EnterpriseRegistrationResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async review(
    @Req() request: Request,
    @Param('enterpriseId') enterpriseId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: EnterpriseReviewRequestDto & Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EnterpriseRegistrationResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.reviewForCompany(
      actor,
      enterpriseId,
      body,
      idempotencyKey,
    );
    markReplay(response, result.replayed);
    return result.body;
  }

  @Post(':enterpriseId/suspend')
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @ApiOperation({
    operationId: 'companyEnterpriseRegistration.suspend',
    summary: 'Suspend an active enterprise without rewriting certification history',
  })
  @ApiParam({ format: 'uuid', name: 'enterpriseId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: EnterpriseSuspendRequestDto })
  @ApiCreatedResponse({ type: EnterpriseRegistrationResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async suspend(
    @Req() request: Request,
    @Param('enterpriseId') enterpriseId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: EnterpriseSuspendRequestDto & Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EnterpriseRegistrationResponseDto> {
    const actor = await this.actorResolver.resolve(request);
    const result = await this.service.suspendForCompany(
      actor,
      enterpriseId,
      body,
      idempotencyKey,
    );
    markReplay(response, result.replayed);
    return result.body;
  }
}
