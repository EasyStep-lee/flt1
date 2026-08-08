import type { AuditActor } from '../audit/audit-log.actor.js';

export const SENSITIVE_APPROVAL_REPOSITORY = Symbol(
  'SENSITIVE_APPROVAL_REPOSITORY',
);

export type SensitiveApprovalStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface SensitiveApprovalRecord {
  readonly id: string;
  readonly approvalType: 'SENSITIVE_EXPORT';
  readonly resource: 'AUDIT_EVENTS';
  readonly reason: string;
  readonly status: SensitiveApprovalStatus;
  readonly version: number;
  readonly reviewOpinion: string | null;
  readonly applicantIdentityType: AuditActor['identityType'];
  readonly applicantIdentityId: string;
  readonly applicantFunctionalAccountId: string;
  readonly supplierId: string | null;
  readonly reviewerIdentityType: AuditActor['identityType'] | null;
  readonly reviewerIdentityId: string | null;
  readonly reviewerFunctionalAccountId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SensitiveApprovalMutationCommand {
  readonly actor: AuditActor;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly ip: string | null;
}

export interface CreateSensitiveApprovalCommand
  extends SensitiveApprovalMutationCommand {
  readonly resource: 'AUDIT_EVENTS';
  readonly reason: string;
}

export interface ClaimSensitiveApprovalCommand
  extends SensitiveApprovalMutationCommand {
  readonly taskId: string;
  readonly expectedVersion: number;
}

export interface DecideSensitiveApprovalCommand
  extends SensitiveApprovalMutationCommand {
  readonly taskId: string;
  readonly expectedVersion: number;
  readonly decision: 'APPROVE' | 'REJECT';
  readonly opinion: string;
}

export type SensitiveApprovalFailureKind =
  | 'AUDIT_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NOT_FOUND'
  | 'SAME_NATURAL_PERSON'
  | 'STATE_INVALID'
  | 'VERSION_CONFLICT';

export type SensitiveApprovalMutationResult =
  | {
      readonly kind: 'OK';
      readonly replayed: boolean;
      readonly value: SensitiveApprovalRecord;
    }
  | { readonly kind: SensitiveApprovalFailureKind };

export interface SensitiveApprovalRepository {
  create(
    command: CreateSensitiveApprovalCommand,
  ): Promise<SensitiveApprovalMutationResult>;
  list(actor: AuditActor): Promise<readonly SensitiveApprovalRecord[]>;
  claim(
    command: ClaimSensitiveApprovalCommand,
  ): Promise<SensitiveApprovalMutationResult>;
  decide(
    command: DecideSensitiveApprovalCommand,
  ): Promise<SensitiveApprovalMutationResult>;
}
