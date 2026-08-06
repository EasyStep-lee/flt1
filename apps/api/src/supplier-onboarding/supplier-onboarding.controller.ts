import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiNotFoundResponse,
  ApiPreconditionRequiredResponse,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import { SafeApiError } from '../http/api-error.js';
import {
  SUPPLIER_ONBOARDING_ACTOR_RESOLVER,
  type CompanySupplierOpsActor,
  type SupplierAccountAdminActor,
  type SupplierOnboardingActorResolver,
} from './supplier-onboarding.actor.js';
import {
  ApprovalTaskResponseDto,
  SubmitReviewRequestDto,
  SupplierPageResponseDto,
  SupplierProfilePatchRequestDto,
  SupplierProfileResponseDto,
  SupplierQueryDto,
  SupplierRegistrationRequestDto,
  SupplierRegistrationResponseDto,
  SupplierResponseDto,
  SupplierReviewRequestDto,
} from './supplier-onboarding.dto.js';
import { SupplierOnboardingService } from './supplier-onboarding.service.js';

const setIdempotencyReplayHeader = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

const requireSupplierActor = (
  actor: Awaited<ReturnType<SupplierOnboardingActorResolver['resolve']>>,
): SupplierAccountAdminActor => {
  if (actor.role !== 'SUPPLIER_ACCOUNT_ADMIN') {
    throw new SafeApiError(403, 'ACCESS_DENIED', 'Supplier account admin is required');
  }
  return actor;
};

const requireCompanyActor = (
  actor: Awaited<ReturnType<SupplierOnboardingActorResolver['resolve']>>,
): CompanySupplierOpsActor => {
  if (actor.role !== 'COMPANY_SUPPLIER_OPS') {
    throw new SafeApiError(403, 'ACCESS_DENIED', 'Company supplier ops is required');
  }
  return actor;
};

@ApiExtraModels(
  ApiErrorResponseDto,
  SupplierRegistrationRequestDto,
  SupplierRegistrationResponseDto,
)
@ApiTags('supplier-registration')
@Controller('v1/suppliers/registrations')
export class SupplierRegistrationController {
  constructor(
    @Inject(SupplierOnboardingService)
    private readonly service: SupplierOnboardingService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store, max-age=0')
  @ApiOperation({
    operationId: 'supplierRegistration.create',
    summary: 'Create an editable supplier onboarding draft',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SupplierRegistrationRequestDto })
  @ApiCreatedResponse({ type: SupplierRegistrationResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async register(
    @Body() body: SupplierRegistrationRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplierRegistrationResponseDto> {
    const result = await this.service.register(body, idempotencyKey);
    setIdempotencyReplayHeader(response, result.replayed);
    return result.body;
  }
}

@ApiExtraModels(
  ApiErrorResponseDto,
  ApprovalTaskResponseDto,
  SubmitReviewRequestDto,
  SupplierProfilePatchRequestDto,
  SupplierProfileResponseDto,
)
@ApiTags('supplier-onboarding-self-service')
@Controller('v1/supplier/me')
export class SupplierSelfServiceController {
  constructor(
    @Inject(SupplierOnboardingService)
    private readonly service: SupplierOnboardingService,
    @Inject(SUPPLIER_ONBOARDING_ACTOR_RESOLVER)
    private readonly actorResolver: SupplierOnboardingActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'supplierOnboarding.getOwnProfile',
    summary: 'Get the supplier profile bound to the fixed functional session',
  })
  @ApiOkResponse({ type: SupplierProfileResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async getOwnProfile(@Req() request: Request): Promise<SupplierProfileResponseDto> {
    const actor = requireSupplierActor(
      await this.actorResolver.resolve(request, 'SUPPLIER_ACCOUNT_ADMIN'),
    );
    return this.service.getOwnProfile(actor);
  }

  @Patch()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'supplierOnboarding.patchOwnProfile',
    summary: 'Correct the authenticated supplier onboarding draft',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SupplierProfilePatchRequestDto })
  @ApiOkResponse({ type: SupplierProfileResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async patchOwnProfile(
    @Req() request: Request,
    @Body() body: SupplierProfilePatchRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplierProfileResponseDto> {
    const actor = requireSupplierActor(
      await this.actorResolver.resolve(request, 'SUPPLIER_ACCOUNT_ADMIN'),
    );
    const result = await this.service.patchOwnProfile(actor, body, idempotencyKey);
    setIdempotencyReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('submit-review')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'supplierOnboarding.submitOwnProfile',
    summary: 'Submit or resubmit the authenticated supplier for review',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SubmitReviewRequestDto })
  @ApiCreatedResponse({ type: ApprovalTaskResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async submitOwnProfile(
    @Req() request: Request,
    @Body() body: SubmitReviewRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApprovalTaskResponseDto> {
    const actor = requireSupplierActor(
      await this.actorResolver.resolve(request, 'SUPPLIER_ACCOUNT_ADMIN'),
    );
    const result = await this.service.submitOwnProfile(actor, body, idempotencyKey);
    setIdempotencyReplayHeader(response, result.replayed);
    return result.body;
  }
}

@ApiExtraModels(
  ApiErrorResponseDto,
  SupplierPageResponseDto,
  SupplierQueryDto,
  SupplierResponseDto,
  SupplierReviewRequestDto,
)
@ApiTags('company-supplier-onboarding')
@Controller('v1/company/suppliers')
export class CompanySupplierOnboardingController {
  constructor(
    @Inject(SupplierOnboardingService)
    private readonly service: SupplierOnboardingService,
    @Inject(SUPPLIER_ONBOARDING_ACTOR_RESOLVER)
    private readonly actorResolver: SupplierOnboardingActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'companySupplierOnboarding.list',
    summary: 'List supplier onboarding records for company supplier ops',
  })
  @ApiOkResponse({ type: SupplierPageResponseDto })
  @ApiQuery({ enum: ['DRAFT', 'PENDING_REVIEW', 'CORRECTION_REQUIRED', 'ACTIVE', 'SUSPENDED', 'EXITING', 'EXITED'], name: 'status', required: false })
  @ApiQuery({ maxLength: 128, name: 'keyword', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async list(
    @Req() request: Request,
    @Query() query: SupplierQueryDto & Record<string, unknown>,
  ): Promise<SupplierPageResponseDto> {
    const actor = requireCompanyActor(
      await this.actorResolver.resolve(request, 'COMPANY_SUPPLIER_OPS'),
    );
    return this.service.listForCompany(actor, query);
  }

  @Post(':supplierId/review')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'companySupplierOnboarding.review',
    summary: 'Request correction or approve a pending supplier',
  })
  @ApiParam({ format: 'uuid', name: 'supplierId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: SupplierReviewRequestDto })
  @ApiCreatedResponse({ type: SupplierResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async review(
    @Req() request: Request,
    @Param('supplierId') supplierId: string,
    @Body() body: SupplierReviewRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupplierResponseDto> {
    const actor = requireCompanyActor(
      await this.actorResolver.resolve(request, 'COMPANY_SUPPLIER_OPS'),
    );
    const result = await this.service.reviewForCompany(
      actor,
      supplierId,
      body,
      idempotencyKey,
    );
    setIdempotencyReplayHeader(response, result.replayed);
    return result.body;
  }
}
