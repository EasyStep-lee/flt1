import { Inject, Injectable } from '@nestjs/common';

import {
  CATEGORY_TEMPLATE_REPOSITORY,
  type CategoryTemplateRepository,
} from '../category-templates/category-template.repository.js';
import type { CompanyProductApprovalActor } from '../company-product-approvals/company-product-approval.actor.js';
import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';
import {
  SUPPLIER_PRODUCT_REPOSITORY,
  type SupplierProductRepository,
} from '../supplier-products/supplier-product.repository.js';
import {
  categoryRequestHash,
  normalizeCategoryCreate,
  normalizeCategoryPatch,
  normalizeCategoryStatus,
  requireCategoryId,
  requireCategoryIdempotencyKey,
  requireCategoryVersion,
} from './category.policy.js';
import {
  CATEGORY_REPOSITORY,
  type CategoryFailureKind,
  type CategoryMutationResult,
  type CategoryRecord,
  type CategoryRepository,
  type CategoryTreeNode,
  type DeletedCategoryRecord,
} from './category.repository.js';

export interface CategoryMutationResponse<T> {
  readonly body: T;
  readonly replayed: boolean;
}
const publicRecord = (value: CategoryRecord): Omit<CategoryRecord, 'companyId'> => ({
  id: value.id,
  parentId: value.parentId,
  name: value.name,
  level: value.level,
  sortWeight: value.sortWeight,
  status: value.status,
  version: value.version,
});

const throwFailure = (kind: CategoryFailureKind): never => {
  const failures: Record<CategoryFailureKind, readonly [number, ApiErrorCode, string]> = {
    AUDIT_REQUIRED: [503, 'AUDIT_REQUIRED', 'Category audit write is required'],
    CATEGORY_DISABLED: [422, 'CATEGORY_DISABLED', 'Category is disabled'],
    CATEGORY_DUPLICATE: [409, 'CATEGORY_DUPLICATE', 'Category name already exists in this level'],
    CATEGORY_LEVEL_INVALID: [422, 'CATEGORY_LEVEL_INVALID', 'Category level is invalid'],
    CATEGORY_NOT_FOUND: [404, 'CATEGORY_NOT_FOUND', 'Category was not found'],
    CATEGORY_NOT_LEAF: [422, 'CATEGORY_NOT_LEAF', 'Product must bind an enabled leaf category'],
    CATEGORY_PARENT_INVALID: [422, 'CATEGORY_PARENT_INVALID', 'Category parent is invalid'],
    CATEGORY_REFERENCED: [409, 'CATEGORY_REFERENCED', 'Referenced category cannot be deleted'],
    COMPANY_INACTIVE: [409, 'SINGLE_MERCHANT_VIOLATION', 'Company is not active'],
    IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts'],
    VERSION_CONFLICT: [409, 'VERSION_CONFLICT', 'Category version changed'],
  };
  const [status, code, message] = failures[kind];
  throw new SafeApiError(status, code, message);
};

const unwrap = <T>(result: CategoryMutationResult<T>): { value: T; replayed: boolean } => {
  if (result.kind === 'OK') return result;
  return throwFailure(result.kind);
};

@Injectable()
export class CategoryService {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly repository: CategoryRepository,
    @Inject(CATEGORY_TEMPLATE_REPOSITORY)
    private readonly templates: CategoryTemplateRepository,
    @Inject(SUPPLIER_PRODUCT_REPOSITORY)
    private readonly supplierProducts: SupplierProductRepository,
  ) {}

  async list(actor: CompanyProductApprovalActor, statusValue: unknown) {
    const status = normalizeCategoryStatus(statusValue);
    const values = await this.repository.list(actor.companyId, status);
    const sorted = [...values].sort(
      (left, right) =>
        left.sortWeight - right.sortWeight ||
        left.name.localeCompare(right.name, 'zh-CN') ||
        left.id.localeCompare(right.id),
    );
    const childrenByParent = new Map<string | null, CategoryRecord[]>();
    for (const value of sorted) {
      const children = childrenByParent.get(value.parentId) ?? [];
      children.push(value);
      childrenByParent.set(value.parentId, children);
    }
    const build = (parentId: string | null): readonly CategoryTreeNode[] =>
      (childrenByParent.get(parentId) ?? []).map((value) => ({
        ...publicRecord(value),
        children: build(value.id),
      }));
    return { items: build(null), total: values.length };
  }

  async create(
    actor: CompanyProductApprovalActor,
    body: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ): Promise<CategoryMutationResponse<Omit<CategoryRecord, 'companyId'>>> {
    const input = normalizeCategoryCreate(body);
    const idempotencyKey = requireCategoryIdempotencyKey(idempotencyKeyValue);
    const result = unwrap(
      await this.repository.create({
        ...input,
        companyId: actor.companyId,
        actorIdentityId: actor.identityId,
        functionalAccountId: actor.functionalAccountId,
        idempotencyKey,
        requestHash: categoryRequestHash(input),
        requestId,
        ip,
      }),
    );
    return { body: publicRecord(result.value), replayed: result.replayed };
  }

  async patch(
    actor: CompanyProductApprovalActor,
    categoryIdValue: unknown,
    body: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ): Promise<CategoryMutationResponse<Omit<CategoryRecord, 'companyId'>>> {
    const categoryId = requireCategoryId(categoryIdValue);
    const { expectedVersion, patch } = normalizeCategoryPatch(body);
    const idempotencyKey = requireCategoryIdempotencyKey(idempotencyKeyValue);
    const result = unwrap(
      await this.repository.patch({
        categoryId,
        companyId: actor.companyId,
        expectedVersion,
        patch,
        actorIdentityId: actor.identityId,
        functionalAccountId: actor.functionalAccountId,
        idempotencyKey,
        requestHash: categoryRequestHash({ categoryId, expectedVersion, patch }),
        requestId,
        ip,
      }),
    );
    return { body: publicRecord(result.value), replayed: result.replayed };
  }

  async delete(
    actor: CompanyProductApprovalActor,
    categoryIdValue: unknown,
    versionValue: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ): Promise<CategoryMutationResponse<DeletedCategoryRecord>> {
    const categoryId = requireCategoryId(categoryIdValue);
    const expectedVersion = requireCategoryVersion(versionValue);
    const idempotencyKey = requireCategoryIdempotencyKey(idempotencyKeyValue);
    const externallyReferenced =
      (await this.supplierProducts.categoryIsReferenced(categoryId)) ||
      (await this.templates.categoryIsReferenced(categoryId));
    const result = unwrap(
      await this.repository.delete({
        categoryId,
        companyId: actor.companyId,
        expectedVersion,
        externallyReferenced,
        actorIdentityId: actor.identityId,
        functionalAccountId: actor.functionalAccountId,
        idempotencyKey,
        requestHash: categoryRequestHash({ categoryId, expectedVersion }),
        requestId,
        ip,
      }),
    );
    return { body: result.value, replayed: result.replayed };
  }

  async validateSupplierAssignment(
    supplierId: string,
    categoryId: string,
  ): Promise<CategoryRecord> {
    const result = await this.repository.validateSupplierAssignment(supplierId, categoryId);
    if (result.kind === 'OK') return result.value;
    return throwFailure(result.kind);
  }
}
