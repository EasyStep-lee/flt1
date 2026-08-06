import { Controller, Get, Header, Inject, Query, Req } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import {
  AUDIT_ACTOR_RESOLVER,
  type AuditActorResolver,
} from './audit-log.actor.js';
import {
  AuditEventPageResponseDto,
  AuditEventResponseDto,
  AuditQueryDto,
} from './audit-log.dto.js';
import { AuditLogService } from './audit-log.service.js';

@ApiExtraModels(
  ApiErrorResponseDto,
  AuditEventPageResponseDto,
  AuditEventResponseDto,
  AuditQueryDto,
)
@ApiTags('audit')
@Controller('v1/audit/events')
export class AuditLogController {
  constructor(
    @Inject(AuditLogService) private readonly service: AuditLogService,
    @Inject(AUDIT_ACTOR_RESOLVER) private readonly actorResolver: AuditActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'auditEvents.list', summary: 'List immutable audit events' })
  @ApiQuery({ maxLength: 128, name: 'action', required: false, type: String })
  @ApiQuery({ maxLength: 128, name: 'objectType', required: false, type: String })
  @ApiQuery({ maxLength: 64, name: 'objectId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: AuditEventPageResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async list(
    @Req() request: Request,
    @Query() query: AuditQueryDto & Record<string, unknown>,
  ): Promise<AuditEventPageResponseDto> {
    return this.service.list(await this.actorResolver.resolve(request), query);
  }
}
