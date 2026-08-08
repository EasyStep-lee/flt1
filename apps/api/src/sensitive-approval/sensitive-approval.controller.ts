import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiBody,
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
import type { Response } from 'express';

import {
  AUDIT_ACTOR_RESOLVER,
  type AuditActorResolver,
} from '../audit/audit-log.actor.js';
import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import {
  ClaimSensitiveApprovalRequestDto,
  CreateSensitiveApprovalRequestDto,
  DecideSensitiveApprovalRequestDto,
  SensitiveApprovalPageResponseDto,
  SensitiveApprovalTaskResponseDto,
} from './sensitive-approval.dto.js';
import { SensitiveApprovalService } from './sensitive-approval.service.js';

const replayHeader = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

@ApiExtraModels(
  ApiErrorResponseDto,
  ClaimSensitiveApprovalRequestDto,
  CreateSensitiveApprovalRequestDto,
  DecideSensitiveApprovalRequestDto,
  SensitiveApprovalPageResponseDto,
  SensitiveApprovalTaskResponseDto,
)
@ApiTags('sensitive-approval')
@Controller('v1/audit/sensitive-export-approvals')
export class SensitiveApprovalController {
  constructor(
    @Inject(SensitiveApprovalService)
    private readonly service: SensitiveApprovalService,
    @Inject(AUDIT_ACTOR_RESOLVER)
    private readonly actorResolver: AuditActorResolver,
  ) {}

  @Post()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'sensitiveApproval.create', summary: 'Request an approved audit export operation' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CreateSensitiveApprovalRequestDto })
  @ApiCreatedResponse({ type: SensitiveApprovalTaskResponseDto })
  @ApiConflictResponse({ description: 'IDEMPOTENCY_CONFLICT', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ description: 'AUDIT_REQUIRED', status: 503, type: ApiErrorResponseDto })
  async create(
    @Req() request: RequestWithId,
    @Body() input: CreateSensitiveApprovalRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SensitiveApprovalTaskResponseDto> {
    const result = await this.service.create(
      await this.actorResolver.resolve(request),
      input,
      key,
      request.requestId,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'sensitiveApproval.list', summary: 'List server-scoped sensitive approval tasks' })
  @ApiOkResponse({ type: SensitiveApprovalPageResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  list(@Req() request: RequestWithId): Promise<SensitiveApprovalPageResponseDto> {
    return this.actorResolver.resolve(request).then((actor) => this.service.list(actor));
  }

  @Post(':taskId/claim')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'sensitiveApproval.claim', summary: 'Claim as an independent company auditor' })
  @ApiParam({ format: 'uuid', name: 'taskId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: ClaimSensitiveApprovalRequestDto })
  @ApiOkResponse({ type: SensitiveApprovalTaskResponseDto })
  @ApiConflictResponse({ description: 'APPROVAL_VERSION_CONFLICT', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'SAME_NATURAL_PERSON_REVIEW', type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ description: 'SECOND_REVIEW_REQUIRED', type: ApiErrorResponseDto })
  async claim(
    @Req() request: RequestWithId,
    @Param('taskId') taskId: string,
    @Body() input: ClaimSensitiveApprovalRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SensitiveApprovalTaskResponseDto> {
    const result = await this.service.claim(
      await this.actorResolver.resolve(request),
      taskId,
      input,
      key,
      request.requestId,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }

  @Post(':taskId/decision')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'sensitiveApproval.decide', summary: 'Approve or reject after second verification' })
  @ApiParam({ format: 'uuid', name: 'taskId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: DecideSensitiveApprovalRequestDto })
  @ApiOkResponse({ type: SensitiveApprovalTaskResponseDto })
  @ApiConflictResponse({ description: 'APPROVAL_VERSION_CONFLICT', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiPreconditionRequiredResponse({ description: 'SECOND_REVIEW_REQUIRED', type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async decide(
    @Req() request: RequestWithId,
    @Param('taskId') taskId: string,
    @Body() input: DecideSensitiveApprovalRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SensitiveApprovalTaskResponseDto> {
    const result = await this.service.decide(
      await this.actorResolver.resolve(request),
      taskId,
      input,
      key,
      request.requestId,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }
}
