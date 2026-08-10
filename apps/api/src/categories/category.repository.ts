import type { AppendAuditLogCommand, AuditLogRepository } from '../audit/audit-log.repository.js';
import type { CategoryCreateInput, CategoryPatchInput, CategoryStatus } from './category.policy.js';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export interface CategoryCompanyRecord {
  readonly id: string;
  readonly status: 'ACTIVE' | 'SUSPENDED';
}

export interface CategorySupplierRecord {
  readonly id: string;
  readonly companyId: string;
  readonly status: string;
}

export interface CategoryRecord {
  readonly id: string;
  readonly companyId: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly level: 1 | 2 | 3;
  readonly sortWeight: number;
  readonly status: CategoryStatus;
  readonly version: number;
}

export interface CategoryTreeNode extends Omit<CategoryRecord, 'companyId'> {
  readonly children: readonly CategoryTreeNode[];
}

export interface CategoryCommandContext {
  readonly actorIdentityId: string;
  readonly companyId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly ip: string | null;
  readonly requestHash: string;
  readonly requestId: string;
}

export interface CreateCategoryCommand extends CategoryCommandContext, CategoryCreateInput {}

export interface PatchCategoryCommand extends CategoryCommandContext {
  readonly categoryId: string;
  readonly expectedVersion: number;
  readonly patch: CategoryPatchInput;
}

export interface DeleteCategoryCommand extends CategoryCommandContext {
  readonly categoryId: string;
  readonly expectedVersion: number;
  readonly externallyReferenced: boolean;
}

export interface DeletedCategoryRecord {
  readonly id: string;
  readonly deleted: true;
  readonly version: number;
}

export type CategoryFailureKind =
  | 'AUDIT_REQUIRED'
  | 'CATEGORY_DISABLED'
  | 'CATEGORY_DUPLICATE'
  | 'CATEGORY_LEVEL_INVALID'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_NOT_LEAF'
  | 'CATEGORY_PARENT_INVALID'
  | 'CATEGORY_REFERENCED'
  | 'COMPANY_INACTIVE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT';

export type CategoryMutationResult<T> =
  | { readonly kind: 'OK'; readonly replayed: boolean; readonly value: T }
  | { readonly kind: CategoryFailureKind };

export type CategoryAssignmentResult =
  | { readonly kind: 'OK'; readonly value: CategoryRecord }
  | { readonly kind: Extract<CategoryFailureKind, 'CATEGORY_DISABLED' | 'CATEGORY_NOT_FOUND' | 'CATEGORY_NOT_LEAF'> };

export interface CategoryRepository {
  list(companyId: string, status?: CategoryStatus): Promise<readonly CategoryRecord[]>;
  findForCompany(companyId: string, categoryId: string): Promise<CategoryRecord | null>;
  hasChildren(companyId: string, categoryId: string): Promise<boolean>;
  create(command: CreateCategoryCommand): Promise<CategoryMutationResult<CategoryRecord>>;
  patch(command: PatchCategoryCommand): Promise<CategoryMutationResult<CategoryRecord>>;
  delete(command: DeleteCategoryCommand): Promise<CategoryMutationResult<DeletedCategoryRecord>>;
  validateSupplierAssignment(
    supplierId: string,
    categoryId: string,
  ): Promise<CategoryAssignmentResult>;
}

export interface InMemoryCategoryRepositoryOptions {
  readonly auditLogRepository: AuditLogRepository;
  readonly companies: readonly CategoryCompanyRecord[];
  readonly suppliers: readonly CategorySupplierRecord[];
}

export type CategoryAuditCommand = AppendAuditLogCommand;
