import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import type { AuditActor } from '../audit/audit-log.actor.js';
import { assertAuditRequestId } from '../audit/audit-log.policy.js';
import {
  COMPANY_SECOND_VERIFIER,
  type CompanySecondVerifier,
} from '../company-auth/company-auth.security.js';
import { SafeApiError } from '../http/api-error.js';
import type {
  ClaimSensitiveApprovalRequestDto,
  CreateSensitiveApprovalRequestDto,
  DecideSensitiveApprovalRequestDto,
  SensitiveApprovalPageResponseDto,
  SensitiveApprovalTaskResponseDto,
} from './sensitive-approval.dto.js';
import {
  SENSITIVE_APPROVAL_REPOSITORY,
  type SensitiveApprovalMutationResult,
  type SensitiveApprovalRecord,
  type SensitiveApprovalRepository,
} from './sensitive-approval.repository.js';

const ownershipKeys = new Set([
  'companyId',
  'supplierId',
  'functionalAccountId',
  'applicantId',
  'reviewedBy',
]);

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const assertKeys = (body: Record<string, unknown>, allowed: readonly string[]): void => {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(body)) {
    if (ownershipKeys.has(key)) {
      throw new SafeApiError(403, 'FIELD_FORBIDDEN', 'Ownership is session derived');
    }
    if (!allowedKeys.has(key)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request body is invalid');
    }
  }
};

const requiredText = (
  value: unknown,
  minimum: number,
  maximum: number,
): string => {
  if (typeof value !== 'string') {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Text value is invalid');
  }
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Text value is invalid');
  }
  return normalized;
};

const version = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Version is invalid');
  }
  return Number(value);
};

const idempotencyKey = (value: string | undefined): string => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new SafeApiError(
      428,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key is required',
    );
  }
  if (normalized.length < 8 || normalized.length > 128) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Idempotency-Key is invalid');
  }
  return normalized;
};

const assertPermission = (actor: AuditActor, permission: string): void => {
  if (!actor.permissionCodes.includes(permission)) {
    throw new SafeApiError(403, 'ACCESS_DENIED', 'Permission is required');
  }
};

const assertWorkspace = (actor: AuditActor, review = false): void => {
  if (actor.accountTypeCode === 'COMPANY_SUPER_ADMIN') {
    throw new SafeApiError(
      428,
      'SECOND_REVIEW_REQUIRED',
      'Super administrator cannot bypass independent review',
    );
  }
  const companyAudit =
    actor.ownerType === 'COMPANY' &&
    actor.accountTypeCode === 'COMPANY_AUDIT' &&
    actor.workspaceRoute === '/company-admin/workspaces/audit';
  const supplierAudit =
    !review &&
    actor.ownerType === 'SUPPLIER' &&
    actor.accountTypeCode === 'SUPPLIER_AUDIT' &&
    actor.workspaceRoute === '/supplier/workspaces/audit' &&
    actor.supplierId !== null;
  if (!companyAudit && !supplierAudit) {
    throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', 'Audit workspace is required');
  }
};

const body = (record: SensitiveApprovalRecord): SensitiveApprovalTaskResponseDto => ({
  id: record.id,
  approvalType: record.approvalType,
  resource: record.resource,
  status: record.status,
  version: record.version,
  reviewOpinion: record.reviewOpinion,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const unwrap = (
  result: SensitiveApprovalMutationResult,
): { readonly body: SensitiveApprovalTaskResponseDto; readonly replayed: boolean } => {
  if (result.kind === 'OK') {
    return { body: body(result.value), replayed: result.replayed };
  }
  if (result.kind === 'AUDIT_REQUIRED') {
    throw new SafeApiError(503, 'AUDIT_REQUIRED', 'Mandatory audit persistence failed');
  }
  if (result.kind === 'IDEMPOTENCY_CONFLICT') {
    throw new SafeApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key conflicts');
  }
  if (result.kind === 'NOT_FOUND') {
    throw new SafeApiError(404, 'APPROVAL_NOT_FOUND', 'Approval task was not found');
  }
  if (result.kind === 'SAME_NATURAL_PERSON') {
    throw new SafeApiError(
      403,
      'SAME_NATURAL_PERSON_REVIEW',
      'The applicant cannot review through another account',
    );
  }
  if (result.kind === 'VERSION_CONFLICT') {
    throw new SafeApiError(
      409,
      'APPROVAL_VERSION_CONFLICT',
      'Approval version changed',
    );
  }
  throw new SafeApiError(409, 'APPROVAL_STATE_INVALID', 'Approval state is invalid');
};

@Injectable()
export class SensitiveApprovalService {
  constructor(
    @Inject(SENSITIVE_APPROVAL_REPOSITORY)
    private readonly repository: SensitiveApprovalRepository,
    @Inject(COMPANY_SECOND_VERIFIER)
    private readonly secondVerifier: CompanySecondVerifier,
  ) {}

  async create(
    actor: AuditActor,
    input: CreateSensitiveApprovalRequestDto & Record<string, unknown>,
    keyValue: string | undefined,
    requestIdValue: string | undefined,
    ip: string | null,
  ) {
    assertWorkspace(actor);
    assertPermission(actor, 'sensitive_export.request');
    assertKeys(input, ['reason', 'resource']);
    if (input.resource !== 'AUDIT_EVENTS') {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Resource is invalid');
    }
    const reason = requiredText(input.reason, 2, 500);
    const key = idempotencyKey(keyValue);
    const requestId = assertAuditRequestId(requestIdValue);
    return unwrap(
      await this.repository.create({
        actor,
        idempotencyKey: key,
        requestHash: hash({ resource: input.resource, reason }),
        requestId,
        ip,
        resource: 'AUDIT_EVENTS',
        reason,
      }),
    );
  }

  async list(actor: AuditActor): Promise<SensitiveApprovalPageResponseDto> {
    assertWorkspace(actor);
    assertPermission(actor, 'sensitive_export.request');
    const items = (await this.repository.list(actor)).map(body);
    return { items, total: items.length };
  }

  async claim(
    actor: AuditActor,
    taskId: string,
    input: ClaimSensitiveApprovalRequestDto & Record<string, unknown>,
    keyValue: string | undefined,
    requestIdValue: string | undefined,
    ip: string | null,
  ) {
    assertWorkspace(actor, true);
    assertPermission(actor, 'sensitive_export.review');
    assertKeys(input, ['version']);
    const expectedVersion = version(input.version);
    const key = idempotencyKey(keyValue);
    return unwrap(
      await this.repository.claim({
        actor,
        taskId,
        expectedVersion,
        idempotencyKey: key,
        requestHash: hash({ taskId, expectedVersion }),
        requestId: assertAuditRequestId(requestIdValue),
        ip,
      }),
    );
  }

  async decide(
    actor: AuditActor,
    taskId: string,
    input: DecideSensitiveApprovalRequestDto & Record<string, unknown>,
    keyValue: string | undefined,
    requestIdValue: string | undefined,
    ip: string | null,
  ) {
    assertWorkspace(actor, true);
    assertPermission(actor, 'sensitive_export.review');
    assertKeys(input, ['decision', 'opinion', 'secondVerificationCode', 'version']);
    if (input.decision !== 'APPROVE' && input.decision !== 'REJECT') {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Decision is invalid');
    }
    const opinion = requiredText(input.opinion, 2, 1000);
    const code = requiredText(input.secondVerificationCode, 4, 64);
    const expectedVersion = version(input.version);
    if (!(await this.secondVerifier.verify({ code, userId: actor.identityId }))) {
      throw new SafeApiError(
        428,
        'SECOND_VERIFICATION_REQUIRED',
        'Second verification is required',
      );
    }
    const key = idempotencyKey(keyValue);
    return unwrap(
      await this.repository.decide({
        actor,
        taskId,
        expectedVersion,
        decision: input.decision,
        opinion,
        idempotencyKey: key,
        requestHash: hash({ taskId, expectedVersion, decision: input.decision, opinion }),
        requestId: assertAuditRequestId(requestIdValue),
        ip,
      }),
    );
  }
}
