import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type { AuditActor } from './audit-log.actor.js';
import type {
  AuditEventPageResponseDto,
  AuditQueryDto,
} from './audit-log.dto.js';
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepository,
} from './audit-log.repository.js';
import { sanitizeAuditSnapshot } from './audit-log.policy.js';
import {
  assertAuditQueryIsolation,
  omitRestrictedFields,
} from '../sensitive-data/sensitive-data.policy.js';

const optionalText = (value: unknown, maxLength: number): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Audit query is invalid');
  }
  return value.trim();
};

const pageNumber = (value: unknown, fallback: number, maximum?: number): number => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Pagination is invalid');
  }
  return parsed;
};

@Injectable()
export class AuditLogService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repository: AuditLogRepository,
  ) {}

  async list(
    actor: AuditActor,
    query: AuditQueryDto & Record<string, unknown>,
  ): Promise<AuditEventPageResponseDto> {
    if (
      actor.accountTypeCode !== 'COMPANY_AUDIT' ||
      actor.workspaceRoute !== '/company-admin/workspaces/audit'
    ) {
      throw new SafeApiError(
        403,
        'WORKSPACE_FORBIDDEN',
        'The company audit workspace is required',
      );
    }
    assertAuditQueryIsolation(query);
    const page = pageNumber(query.page, 1);
    const pageSize = pageNumber(query.pageSize, 20, 100);
    const action = optionalText(query.action, 128);
    const objectType = optionalText(query.objectType, 128);
    const objectId = optionalText(query.objectId, 64);
    const result = await this.repository.list({
      page,
      pageSize,
      ...(action ? { action } : {}),
      ...(objectType ? { objectType } : {}),
      ...(objectId ? { objectId } : {}),
    });
    return {
      page,
      pageSize,
      total: result.total,
      items: result.items.map((event) => ({
        id: event.id,
        actorType: event.actorType,
        actorId: event.actorId,
        action: event.action,
        objectType: event.objectType,
        objectId: event.objectId,
        beforeSnapshot: omitRestrictedFields(
          sanitizeAuditSnapshot(event.beforeSnapshot),
        ),
        afterSnapshot: omitRestrictedFields(
          sanitizeAuditSnapshot(event.afterSnapshot),
        ),
        requestId: event.requestId,
        occurredAt: event.occurredAt,
      })),
    };
  }
}
