import type { AuditLogRepository } from '../audit/audit-log.repository.js';

export const REGULATED_CATEGORY_REPOSITORY = Symbol('REGULATED_CATEGORY_REPOSITORY');

export interface RegulatedCategoryControlRecord {
  readonly id: string;
  readonly companyId: string;
  readonly categoryId: string;
  readonly status: 'DISABLED' | 'ENABLED';
  readonly companyQualificationSnapshot: {
    readonly schemaVersion: '1.0';
    readonly references: readonly string[];
  };
  readonly qualificationValidUntil: string | null;
  readonly version: number;
  readonly enabledAt: string | null;
  readonly disabledAt: string | null;
}

interface CommandContext {
  readonly actorIdentityId: string;
  readonly companyId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly ip: string | null;
  readonly requestHash: string;
  readonly requestId: string;
}

export interface EnableRegulatedCategoryCommand extends CommandContext {
  readonly categoryId: string;
  readonly expectedVersion: number;
  readonly companyQualificationReferences: readonly string[];
  readonly qualificationValidUntil: string;
}

export interface DisableRegulatedCategoryCommand extends CommandContext {
  readonly categoryId: string;
  readonly expectedVersion: number;
  readonly reason: string;
}

export type RegulatedCategoryFailureKind =
  | 'AUDIT_REQUIRED'
  | 'CATEGORY_TEMPLATE_INVALID'
  | 'CONTROL_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT';

export type RegulatedCategoryMutationResult =
  | { readonly kind: 'OK'; readonly replayed: boolean; readonly value: RegulatedCategoryControlRecord }
  | { readonly kind: RegulatedCategoryFailureKind };

export interface RegulatedCategoryRepository {
  list(companyId: string): Promise<readonly RegulatedCategoryControlRecord[]>;
  find(companyId: string, categoryId: string): Promise<RegulatedCategoryControlRecord | null>;
  enable(command: EnableRegulatedCategoryCommand): Promise<RegulatedCategoryMutationResult>;
  disable(command: DisableRegulatedCategoryCommand): Promise<RegulatedCategoryMutationResult>;
}

export interface InMemoryRegulatedCategoryRepositoryOptions {
  readonly auditLogRepository?: AuditLogRepository;
}
