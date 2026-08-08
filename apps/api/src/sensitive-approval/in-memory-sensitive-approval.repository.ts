import type { AuditLogRepository } from '../audit/audit-log.repository.js';
import type {
  ClaimSensitiveApprovalCommand,
  CreateSensitiveApprovalCommand,
  DecideSensitiveApprovalCommand,
  SensitiveApprovalMutationResult,
  SensitiveApprovalRecord,
  SensitiveApprovalRepository,
} from './sensitive-approval.repository.js';

const clone = <T>(value: T): T => structuredClone(value);

export class InMemorySensitiveApprovalRepository
  implements SensitiveApprovalRepository
{
  private readonly tasks = new Map<string, SensitiveApprovalRecord>();
  private readonly commands = new Map<
    string,
    { readonly requestHash: string; readonly value: SensitiveApprovalRecord }
  >();
  private readonly inFlight = new Map<
    string,
    {
      readonly requestHash: string;
      readonly result: Promise<SensitiveApprovalMutationResult>;
    }
  >();

  constructor(private readonly auditRepository: AuditLogRepository) {}

  private replay(
    scope: string,
    key: string,
    hash: string,
  ): SensitiveApprovalMutationResult | null {
    const prior = this.commands.get(`${scope}:${key}`);
    if (!prior) return null;
    if (prior.requestHash !== hash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', replayed: true, value: clone(prior.value) };
  }

  private remember(
    scope: string,
    key: string,
    hash: string,
    value: SensitiveApprovalRecord,
  ): void {
    this.commands.set(`${scope}:${key}`, { requestHash: hash, value: clone(value) });
  }

  private async runIdempotent(
    scope: string,
    key: string,
    requestHash: string,
    operation: () => Promise<SensitiveApprovalMutationResult>,
  ): Promise<SensitiveApprovalMutationResult> {
    const replay = this.replay(scope, key, requestHash);
    if (replay) return replay;
    const commandKey = `${scope}:${key}`;
    const pending = this.inFlight.get(commandKey);
    if (pending) {
      if (pending.requestHash !== requestHash) {
        return { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      const result = await pending.result;
      return result.kind === 'OK'
        ? { kind: 'OK', replayed: true, value: clone(result.value) }
        : result;
    }
    const result = operation();
    this.inFlight.set(commandKey, { requestHash, result });
    try {
      const completed = await result;
      if (completed.kind === 'OK') {
        this.remember(scope, key, requestHash, completed.value);
      }
      return completed;
    } finally {
      this.inFlight.delete(commandKey);
    }
  }

  private async appendAudit(
    command:
      | CreateSensitiveApprovalCommand
      | ClaimSensitiveApprovalCommand
      | DecideSensitiveApprovalCommand,
    action: string,
    task: SensitiveApprovalRecord,
    beforeSnapshot: unknown,
  ): Promise<boolean> {
    try {
      await this.auditRepository.append({
        actorType: command.actor.identityType,
        actorId: command.actor.identityId,
        supplierId: command.actor.supplierId,
        functionalAccountId: command.actor.functionalAccountId,
        action,
        objectType: 'sensitive_export_approval',
        objectId: task.id,
        beforeSnapshot,
        afterSnapshot: {
          approvalType: task.approvalType,
          resource: task.resource,
          status: task.status,
          version: task.version,
        },
        requestId: command.requestId,
        ip: command.ip,
      });
      return true;
    } catch {
      return false;
    }
  }

  async create(
    command: CreateSensitiveApprovalCommand,
  ): Promise<SensitiveApprovalMutationResult> {
    const scope = `create:${command.actor.ownerType}:${command.actor.supplierId ?? command.actor.companyId}:${command.actor.identityId}`;
    return this.runIdempotent(
      scope,
      command.idempotencyKey,
      command.requestHash,
      async () => {
        const now = new Date().toISOString();
        const task: SensitiveApprovalRecord = {
          id: crypto.randomUUID(),
          approvalType: 'SENSITIVE_EXPORT',
          resource: command.resource,
          reason: command.reason,
          status: 'PENDING',
          version: 0,
          reviewOpinion: null,
          applicantIdentityType: command.actor.identityType,
          applicantIdentityId: command.actor.identityId,
          applicantFunctionalAccountId: command.actor.functionalAccountId,
          supplierId: command.actor.supplierId,
          reviewerIdentityType: null,
          reviewerIdentityId: null,
          reviewerFunctionalAccountId: null,
          createdAt: now,
          updatedAt: now,
        };
        this.tasks.set(task.id, task);
        if (
          !(await this.appendAudit(
            command,
            'sensitive_export.requested',
            task,
            {},
          ))
        ) {
          this.tasks.delete(task.id);
          return { kind: 'AUDIT_REQUIRED' };
        }
        return { kind: 'OK', replayed: false, value: clone(task) };
      },
    );
  }

  list(actor: CreateSensitiveApprovalCommand['actor']): Promise<readonly SensitiveApprovalRecord[]> {
    const values = [...this.tasks.values()]
      .filter(
        (task) => actor.ownerType === 'COMPANY' || task.supplierId === actor.supplierId,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return Promise.resolve(values.map(clone));
  }

  async claim(
    command: ClaimSensitiveApprovalCommand,
  ): Promise<SensitiveApprovalMutationResult> {
    const scope = `claim:${command.taskId}:${command.actor.identityId}`;
    return this.runIdempotent(
      scope,
      command.idempotencyKey,
      command.requestHash,
      async () => {
        const current = this.tasks.get(command.taskId);
        if (!current) return { kind: 'NOT_FOUND' };
        if (
          current.applicantIdentityType === command.actor.identityType &&
          current.applicantIdentityId === command.actor.identityId
        ) {
          return { kind: 'SAME_NATURAL_PERSON' };
        }
        if (current.status !== 'PENDING') return { kind: 'STATE_INVALID' };
        if (current.version !== command.expectedVersion) {
          return { kind: 'VERSION_CONFLICT' };
        }
        const next: SensitiveApprovalRecord = {
          ...current,
          status: 'IN_REVIEW',
          version: current.version + 1,
          reviewerIdentityType: command.actor.identityType,
          reviewerIdentityId: command.actor.identityId,
          reviewerFunctionalAccountId: command.actor.functionalAccountId,
          updatedAt: new Date().toISOString(),
        };
        this.tasks.set(next.id, next);
        if (
          !(await this.appendAudit(command, 'sensitive_export.claimed', next, {
            status: current.status,
            version: current.version,
          }))
        ) {
          this.tasks.set(current.id, current);
          return { kind: 'AUDIT_REQUIRED' };
        }
        return { kind: 'OK', replayed: false, value: clone(next) };
      },
    );
  }

  async decide(
    command: DecideSensitiveApprovalCommand,
  ): Promise<SensitiveApprovalMutationResult> {
    const scope = `decision:${command.taskId}:${command.actor.identityId}`;
    return this.runIdempotent(
      scope,
      command.idempotencyKey,
      command.requestHash,
      async () => {
        const current = this.tasks.get(command.taskId);
        if (!current) return { kind: 'NOT_FOUND' };
        if (current.status !== 'IN_REVIEW') return { kind: 'VERSION_CONFLICT' };
        if (current.version !== command.expectedVersion) {
          return { kind: 'VERSION_CONFLICT' };
        }
        if (
          current.reviewerIdentityType !== command.actor.identityType ||
          current.reviewerIdentityId !== command.actor.identityId
        ) {
          return { kind: 'STATE_INVALID' };
        }
        const next: SensitiveApprovalRecord = {
          ...current,
          status: command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          version: current.version + 1,
          reviewOpinion: command.opinion,
          updatedAt: new Date().toISOString(),
        };
        this.tasks.set(next.id, next);
        if (
          !(await this.appendAudit(
            command,
            command.decision === 'APPROVE'
              ? 'sensitive_export.approved'
              : 'sensitive_export.rejected',
            next,
            { status: current.status, version: current.version },
          ))
        ) {
          this.tasks.set(current.id, current);
          return { kind: 'AUDIT_REQUIRED' };
        }
        return { kind: 'OK', replayed: false, value: clone(next) };
      },
    );
  }
}
