import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { assertAuditRequestId, sanitizeAuditSnapshot } from '../audit/audit-log.policy.js';
import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  ClaimSensitiveApprovalCommand,
  CreateSensitiveApprovalCommand,
  DecideSensitiveApprovalCommand,
  SensitiveApprovalMutationResult,
  SensitiveApprovalRecord,
  SensitiveApprovalRepository,
} from './sensitive-approval.repository.js';

const asJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const requestDetails = (snapshot: Prisma.JsonValue | null): {
  resource: 'AUDIT_EVENTS';
  reason: string;
} => {
  const value = snapshot as { resource?: unknown; reason?: unknown } | null;
  return {
    resource: 'AUDIT_EVENTS',
    reason: typeof value?.reason === 'string' ? value.reason : '',
  };
};

const toRecord = (task: {
  readonly id: string;
  readonly approvalType: string;
  readonly applicantType: 'COMPANY_USER' | 'SUPPLIER_USER' | 'ENTERPRISE_USER';
  readonly applicantId: string;
  readonly applicantFunctionalAccountId: string | null;
  readonly supplierId: string | null;
  readonly status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  readonly reviewedByType: 'COMPANY_USER' | 'SUPPLIER_USER' | 'ENTERPRISE_USER' | null;
  readonly reviewedBy: string | null;
  readonly reviewerFunctionalAccountId: string | null;
  readonly reviewOpinion: string | null;
  readonly requestSnapshot: Prisma.JsonValue | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): SensitiveApprovalRecord => {
  if (
    task.applicantType === 'ENTERPRISE_USER' ||
    task.reviewedByType === 'ENTERPRISE_USER'
  ) {
    throw new Error('SENSITIVE_APPROVAL_IDENTITY_TYPE_INVALID');
  }
  const details = requestDetails(task.requestSnapshot);
  return {
    id: task.id,
    approvalType: 'SENSITIVE_EXPORT',
    resource: details.resource,
    reason: details.reason,
    status: task.status,
    version: task.version,
    reviewOpinion: task.reviewOpinion,
    applicantIdentityType: task.applicantType,
    applicantIdentityId: task.applicantId,
    applicantFunctionalAccountId: task.applicantFunctionalAccountId ?? '',
    supplierId: task.supplierId,
    reviewerIdentityType: task.reviewedByType,
    reviewerIdentityId: task.reviewedBy,
    reviewerFunctionalAccountId: task.reviewerFunctionalAccountId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
};

const replayTaskId = (snapshot: Prisma.JsonValue): string | null => {
  const value = snapshot as { taskId?: unknown };
  return typeof value.taskId === 'string' ? value.taskId : null;
};

const isUniqueConflict = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

@Injectable()
export class PrismaSensitiveApprovalRepository
  implements SensitiveApprovalRepository
{
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async appendAudit(
    tx: Prisma.TransactionClient,
    command:
      | CreateSensitiveApprovalCommand
      | ClaimSensitiveApprovalCommand
      | DecideSensitiveApprovalCommand,
    action: string,
    task: SensitiveApprovalRecord,
    beforeSnapshot: unknown,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorType: command.actor.identityType,
        actorId: command.actor.identityId,
        supplierId: command.actor.supplierId,
        functionalAccountId: command.actor.functionalAccountId,
        action,
        objectType: 'sensitive_export_approval',
        objectId: task.id,
        beforeSnapshot: asJson(sanitizeAuditSnapshot(beforeSnapshot)),
        afterSnapshot: asJson(
          sanitizeAuditSnapshot({
            approvalType: task.approvalType,
            resource: task.resource,
            status: task.status,
            version: task.version,
          }),
        ),
        requestId: assertAuditRequestId(command.requestId),
        ip: command.ip,
      },
    });
  }

  private async replay(
    tx: Prisma.TransactionClient,
    scope: string,
    key: string,
    requestHash: string,
  ): Promise<SensitiveApprovalMutationResult | null> {
    const prior = await tx.approvalTaskCommand.findUnique({
      where: { scope_idempotencyKey: { scope, idempotencyKey: key } },
    });
    if (!prior) return null;
    if (prior.requestHash !== requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    const taskId = replayTaskId(prior.responseSnapshot);
    if (!taskId) return { kind: 'STATE_INVALID' };
    const task = await tx.approvalTask.findUnique({ where: { id: taskId } });
    return task
      ? { kind: 'OK', replayed: true, value: toRecord(task) }
      : { kind: 'NOT_FOUND' };
  }

  private async replayCommitted(
    scope: string,
    key: string,
    requestHash: string,
  ): Promise<SensitiveApprovalMutationResult | null> {
    const prior = await this.prisma.approvalTaskCommand.findUnique({
      where: { scope_idempotencyKey: { scope, idempotencyKey: key } },
    });
    if (!prior) return null;
    if (prior.requestHash !== requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    const taskId = replayTaskId(prior.responseSnapshot);
    if (!taskId) return { kind: 'STATE_INVALID' };
    const task = await this.prisma.approvalTask.findUnique({ where: { id: taskId } });
    return task
      ? { kind: 'OK', replayed: true, value: toRecord(task) }
      : { kind: 'NOT_FOUND' };
  }

  async create(
    command: CreateSensitiveApprovalCommand,
  ): Promise<SensitiveApprovalMutationResult> {
    const scope = `create:${command.actor.ownerType}:${command.actor.supplierId ?? command.actor.companyId}:${command.actor.identityId}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.replay(
          tx,
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
        const task = await tx.approvalTask.create({
          data: {
            approvalType: 'SENSITIVE_EXPORT',
            objectType: 'EXPORT_JOB',
            objectId: crypto.randomUUID(),
            applicantType: command.actor.identityType,
            applicantId: command.actor.identityId,
            applicantFunctionalAccountId: command.actor.functionalAccountId,
            supplierId: command.actor.supplierId,
            assignedAccountTypeCode: 'COMPANY_AUDIT',
            requestSnapshot: asJson({
              resource: command.resource,
              reason: command.reason,
            }),
          },
        });
        await tx.approvalTaskHistory.create({
          data: {
            approvalTaskId: task.id,
            fromStatus: null,
            toStatus: 'PENDING',
            event: 'CREATE',
            actorType: command.actor.identityType,
            actorId: command.actor.identityId,
            functionalAccountId: command.actor.functionalAccountId,
            version: 0,
          },
        });
        const record = toRecord(task);
        await this.appendAudit(tx, command, 'sensitive_export.requested', record, {});
        await tx.approvalTaskCommand.create({
          data: {
            scope,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            responseSnapshot: asJson({ taskId: task.id }),
          },
        });
        return { kind: 'OK', replayed: false, value: record };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const replay = await this.replayCommitted(
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
      }
      return { kind: 'AUDIT_REQUIRED' };
    }
  }

  async list(
    actor: CreateSensitiveApprovalCommand['actor'],
  ): Promise<readonly SensitiveApprovalRecord[]> {
    const tasks = await this.prisma.approvalTask.findMany({
      where: {
        approvalType: 'SENSITIVE_EXPORT',
        ...(actor.ownerType === 'SUPPLIER' ? { supplierId: actor.supplierId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return tasks.map(toRecord);
  }

  async claim(
    command: ClaimSensitiveApprovalCommand,
  ): Promise<SensitiveApprovalMutationResult> {
    const scope = `claim:${command.taskId}:${command.actor.identityId}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.replay(
          tx,
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
        const current = await tx.approvalTask.findUnique({
          where: { id: command.taskId },
        });
        if (!current || current.approvalType !== 'SENSITIVE_EXPORT') {
          return { kind: 'NOT_FOUND' };
        }
        if (
          current.applicantType === command.actor.identityType &&
          current.applicantId === command.actor.identityId
        ) {
          return { kind: 'SAME_NATURAL_PERSON' };
        }
        if (current.status !== 'PENDING') {
          const lateReplay = await this.replay(
            tx,
            scope,
            command.idempotencyKey,
            command.requestHash,
          );
          return lateReplay ?? { kind: 'STATE_INVALID' };
        }
        const updated = await tx.approvalTask.updateMany({
          where: {
            id: current.id,
            status: 'PENDING',
            version: command.expectedVersion,
          },
          data: {
            status: 'IN_REVIEW',
            reviewedByType: command.actor.identityType,
            reviewedBy: command.actor.identityId,
            reviewerFunctionalAccountId: command.actor.functionalAccountId,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          const lateReplay = await this.replay(
            tx,
            scope,
            command.idempotencyKey,
            command.requestHash,
          );
          return lateReplay ?? { kind: 'VERSION_CONFLICT' };
        }
        const task = await tx.approvalTask.findUniqueOrThrow({ where: { id: current.id } });
        await tx.approvalTaskHistory.create({
          data: {
            approvalTaskId: task.id,
            fromStatus: 'PENDING',
            toStatus: 'IN_REVIEW',
            event: 'CLAIM',
            actorType: command.actor.identityType,
            actorId: command.actor.identityId,
            functionalAccountId: command.actor.functionalAccountId,
            version: task.version,
          },
        });
        const record = toRecord(task);
        await this.appendAudit(tx, command, 'sensitive_export.claimed', record, {
          status: 'PENDING',
          version: current.version,
        });
        await tx.approvalTaskCommand.create({
          data: {
            scope,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            responseSnapshot: asJson({ taskId: task.id }),
          },
        });
        return { kind: 'OK', replayed: false, value: record };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const replay = await this.replayCommitted(
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
      }
      return { kind: 'AUDIT_REQUIRED' };
    }
  }

  async decide(
    command: DecideSensitiveApprovalCommand,
  ): Promise<SensitiveApprovalMutationResult> {
    const scope = `decision:${command.taskId}:${command.actor.identityId}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.replay(
          tx,
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
        const current = await tx.approvalTask.findUnique({
          where: { id: command.taskId },
        });
        if (!current || current.approvalType !== 'SENSITIVE_EXPORT') {
          return { kind: 'NOT_FOUND' };
        }
        if (
          current.status !== 'IN_REVIEW' ||
          current.reviewedByType !== command.actor.identityType ||
          current.reviewedBy !== command.actor.identityId
        ) {
          const lateReplay = await this.replay(
            tx,
            scope,
            command.idempotencyKey,
            command.requestHash,
          );
          return lateReplay ?? { kind: 'VERSION_CONFLICT' };
        }
        const toStatus = command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        const updated = await tx.approvalTask.updateMany({
          where: {
            id: current.id,
            status: 'IN_REVIEW',
            version: command.expectedVersion,
          },
          data: {
            status: toStatus,
            reviewOpinion: command.opinion,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          const lateReplay = await this.replay(
            tx,
            scope,
            command.idempotencyKey,
            command.requestHash,
          );
          return lateReplay ?? { kind: 'VERSION_CONFLICT' };
        }
        const task = await tx.approvalTask.findUniqueOrThrow({ where: { id: current.id } });
        await tx.approvalTaskHistory.create({
          data: {
            approvalTaskId: task.id,
            fromStatus: 'IN_REVIEW',
            toStatus,
            event: command.decision,
            actorType: command.actor.identityType,
            actorId: command.actor.identityId,
            functionalAccountId: command.actor.functionalAccountId,
            opinion: command.opinion,
            version: task.version,
          },
        });
        const record = toRecord(task);
        await this.appendAudit(
          tx,
          command,
          command.decision === 'APPROVE'
            ? 'sensitive_export.approved'
            : 'sensitive_export.rejected',
          record,
          { status: 'IN_REVIEW', version: current.version },
        );
        await tx.approvalTaskCommand.create({
          data: {
            scope,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            responseSnapshot: asJson({ taskId: task.id }),
          },
        });
        return { kind: 'OK', replayed: false, value: record };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const replay = await this.replayCommitted(
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
      }
      return { kind: 'AUDIT_REQUIRED' };
    }
  }
}
