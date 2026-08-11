import { randomUUID } from 'node:crypto';

import type {
  DisableRegulatedCategoryCommand,
  EnableRegulatedCategoryCommand,
  InMemoryRegulatedCategoryRepositoryOptions,
  RegulatedCategoryControlRecord,
  RegulatedCategoryMutationResult,
  RegulatedCategoryRepository,
} from './regulated-category.repository.js';

interface StoredCommand {
  readonly requestHash: string;
  readonly value: RegulatedCategoryControlRecord;
}

export class InMemoryRegulatedCategoryRepository implements RegulatedCategoryRepository {
  private readonly controls = new Map<string, RegulatedCategoryControlRecord>();
  private readonly commands = new Map<string, StoredCommand>();
  private readonly histories: RegulatedCategoryControlRecord[] = [];

  constructor(private readonly options: InMemoryRegulatedCategoryRepositoryOptions = {}) {}

  list(companyId: string): Promise<readonly RegulatedCategoryControlRecord[]> {
    return Promise.resolve(
      [...this.controls.values()]
        .filter((value) => value.companyId === companyId)
        .sort((left, right) => left.categoryId.localeCompare(right.categoryId))
        .map((value) => structuredClone(value)),
    );
  }

  find(companyId: string, categoryId: string): Promise<RegulatedCategoryControlRecord | null> {
    const value = this.controls.get(`${companyId}:${categoryId}`);
    return Promise.resolve(value ? structuredClone(value) : null);
  }

  async enable(command: EnableRegulatedCategoryCommand): Promise<RegulatedCategoryMutationResult> {
    const scope = `ENABLE:${command.companyId}:${command.categoryId}`;
    const replay = this.replay(scope, command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const key = `${command.companyId}:${command.categoryId}`;
    const existing = this.controls.get(key);
    if ((existing?.version ?? 0) !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
    const now = new Date().toISOString();
    const value: RegulatedCategoryControlRecord = {
      id: existing?.id ?? randomUUID(),
      companyId: command.companyId,
      categoryId: command.categoryId,
      status: 'ENABLED',
      companyQualificationSnapshot: {
        schemaVersion: '1.0',
        references: structuredClone(command.companyQualificationReferences),
      },
      qualificationValidUntil: command.qualificationValidUntil,
      version: (existing?.version ?? 0) + 1,
      enabledAt: now,
      disabledAt: null,
    };
    if (!(await this.audit(command, value, 'REGULATED_CATEGORY_ENABLED', existing ?? null))) {
      return { kind: 'AUDIT_REQUIRED' };
    }
    this.controls.set(key, value);
    this.histories.push(structuredClone(value));
    this.commands.set(`${scope}:${command.idempotencyKey}`, {
      requestHash: command.requestHash,
      value: structuredClone(value),
    });
    return { kind: 'OK', replayed: false, value: structuredClone(value) };
  }

  async disable(command: DisableRegulatedCategoryCommand): Promise<RegulatedCategoryMutationResult> {
    const scope = `DISABLE:${command.companyId}:${command.categoryId}`;
    const replay = this.replay(scope, command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const key = `${command.companyId}:${command.categoryId}`;
    const existing = this.controls.get(key);
    if (!existing) return { kind: 'CONTROL_NOT_FOUND' };
    if (existing.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
    const value: RegulatedCategoryControlRecord = {
      ...existing,
      status: 'DISABLED',
      version: existing.version + 1,
      enabledAt: null,
      disabledAt: new Date().toISOString(),
    };
    if (!(await this.audit(command, value, 'REGULATED_CATEGORY_DISABLED', existing))) {
      return { kind: 'AUDIT_REQUIRED' };
    }
    this.controls.set(key, value);
    this.histories.push(structuredClone(value));
    this.commands.set(`${scope}:${command.idempotencyKey}`, {
      requestHash: command.requestHash,
      value: structuredClone(value),
    });
    return { kind: 'OK', replayed: false, value: structuredClone(value) };
  }

  historyCount(): number {
    return this.histories.length;
  }

  private replay(scope: string, key: string, hash: string): RegulatedCategoryMutationResult | null {
    const command = this.commands.get(`${scope}:${key}`);
    if (!command) return null;
    return command.requestHash === hash
      ? { kind: 'OK', replayed: true, value: structuredClone(command.value) }
      : { kind: 'IDEMPOTENCY_CONFLICT' };
  }

  private async audit(
    command: EnableRegulatedCategoryCommand | DisableRegulatedCategoryCommand,
    value: RegulatedCategoryControlRecord,
    action: string,
    before: RegulatedCategoryControlRecord | null,
  ): Promise<boolean> {
    if (!this.options.auditLogRepository) return true;
    try {
      await this.options.auditLogRepository.append({
        actorType: 'COMPANY_USER',
        actorId: command.actorIdentityId,
        functionalAccountId: command.functionalAccountId,
        action,
        objectType: 'REGULATED_CATEGORY_CONTROL',
        objectId: value.id,
        beforeSnapshot: before,
        afterSnapshot: {
          categoryId: value.categoryId,
          status: value.status,
          companyQualificationReferenceCount: value.companyQualificationSnapshot.references.length,
          qualificationValidUntil: value.qualificationValidUntil,
          version: value.version,
        },
        requestId: command.requestId,
        ip: command.ip,
      });
      return true;
    } catch {
      return false;
    }
  }
}
