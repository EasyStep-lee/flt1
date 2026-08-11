import type { AuditLogRepository } from '../audit/audit-log.repository.js';
import type { CategoryRepository } from '../categories/category.repository.js';
import type {
  CategoryTemplateDefinition,
  CategoryTemplateStatus,
} from './category-template.policy.js';

export const CATEGORY_TEMPLATE_REPOSITORY = Symbol('CATEGORY_TEMPLATE_REPOSITORY');

export interface CategoryTemplateRecord extends CategoryTemplateDefinition {
  readonly id: string;
  readonly companyId: string;
  readonly categoryId: string;
  readonly version: number;
  readonly revision: number;
  readonly status: CategoryTemplateStatus;
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly retiredAt: string | null;
}

export interface CategoryTemplateCommandContext {
  readonly actorIdentityId: string;
  readonly companyId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly ip: string | null;
  readonly requestHash: string;
  readonly requestId: string;
}

export interface CreateCategoryTemplateCommand
  extends CategoryTemplateCommandContext,
    CategoryTemplateDefinition {
  readonly categoryId: string;
}

export interface PatchCategoryTemplateCommand extends CategoryTemplateCommandContext {
  readonly templateId: string;
  readonly expectedRevision: number;
  readonly definition: CategoryTemplateDefinition;
}

export interface PublishCategoryTemplateCommand extends CategoryTemplateCommandContext {
  readonly templateId: string;
  readonly expectedRevision: number;
}

export type CategoryTemplateFailureKind =
  | 'AUDIT_REQUIRED'
  | 'CATEGORY_DISABLED'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_NOT_LEAF'
  | 'FRESH_HISTORY_REWRITE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'TEMPLATE_DRAFT_EXISTS'
  | 'TEMPLATE_IMMUTABLE'
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_VERSION_INACTIVE'
  | 'VERSION_CONFLICT';

export type CategoryTemplateMutationResult<T> =
  | { readonly kind: 'OK'; readonly replayed: boolean; readonly value: T }
  | { readonly kind: CategoryTemplateFailureKind };

export type CategoryTemplateListResult =
  | {
      readonly kind: 'OK';
      readonly activeVersion: number | null;
      readonly items: readonly CategoryTemplateRecord[];
    }
  | { readonly kind: Extract<CategoryTemplateFailureKind, 'CATEGORY_NOT_FOUND'> };

export interface CategoryTemplateRepository {
  list(companyId: string, categoryId: string): Promise<CategoryTemplateListResult>;
  createDraft(
    command: CreateCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>>;
  patchDraft(
    command: PatchCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>>;
  publish(
    command: PublishCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>>;
  validateCurrent(
    companyId: string,
    categoryId: string,
    version: number,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>>;
  categoryIsReferenced(categoryId: string): Promise<boolean>;
}

export interface InMemoryCategoryTemplateRepositoryOptions {
  readonly auditLogRepository: AuditLogRepository;
  readonly categoryRepository: CategoryRepository;
}
