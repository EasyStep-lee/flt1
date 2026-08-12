import { Inject, Injectable } from '@nestjs/common';

import type { CompanyProductApprovalActor } from '../company-product-approvals/company-product-approval.actor.js';
import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';
import {
  categoryTemplateRequestHash,
  normalizeCategoryTemplateDefinition,
  normalizeCategoryTemplatePatch,
  normalizeCategoryTemplatePublish,
  requireCategoryTemplateCategoryId,
  requireCategoryTemplateId,
  requireCategoryTemplateIdempotencyKey,
} from './category-template.policy.js';
import {
  CATEGORY_TEMPLATE_REPOSITORY,
  type CategoryTemplateFailureKind,
  type CategoryTemplateMutationResult,
  type CategoryTemplateRecord,
  type CategoryTemplateRepository,
} from './category-template.repository.js';

export interface CategoryTemplateMutationResponse<T> {
  readonly body: T;
  readonly replayed: boolean;
}

export type CategoryTemplateResponse = Omit<CategoryTemplateRecord, 'companyId'>;

const toResponse = (value: CategoryTemplateRecord): CategoryTemplateResponse => ({
  id: value.id,
  categoryId: value.categoryId,
  version: value.version,
  revision: value.revision,
  status: value.status,
  regulatoryMode: value.regulatoryMode,
  profile: value.profile,
  fieldSchema: structuredClone(value.fieldSchema),
  skuDimensions: structuredClone(value.skuDimensions),
  qualificationRules: structuredClone(value.qualificationRules),
  detailModules: structuredClone(value.detailModules),
  afterSaleRules: structuredClone(value.afterSaleRules),
  createdAt: value.createdAt,
  publishedAt: value.publishedAt,
  retiredAt: value.retiredAt,
});

const throwFailure = (kind: CategoryTemplateFailureKind): never => {
  const failures: Record<CategoryTemplateFailureKind, readonly [number, ApiErrorCode, string]> = {
    APPAREL_HISTORY_REWRITE: [
      409,
      'APPAREL_HISTORY_REWRITE',
      'Published apparel template versions are immutable',
    ],
    DIGITAL_HISTORY_REWRITE: [
      409,
      'DIGITAL_HISTORY_REWRITE',
      'Published digital template versions are immutable',
    ],
    AUDIT_REQUIRED: [503, 'AUDIT_REQUIRED', 'Category template audit write is required'],
    CATEGORY_DISABLED: [422, 'CATEGORY_DISABLED', 'Category is disabled'],
    CATEGORY_NOT_FOUND: [404, 'CATEGORY_NOT_FOUND', 'Category was not found'],
    CATEGORY_NOT_LEAF: [422, 'CATEGORY_NOT_LEAF', 'Template must bind an enabled leaf category'],
    FRESH_HISTORY_REWRITE: [
      409,
      'FRESH_HISTORY_REWRITE',
      'Published fresh template versions are immutable',
    ],
    IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts'],
    TEMPLATE_DRAFT_EXISTS: [409, 'TEMPLATE_DRAFT_EXISTS', 'A category template draft already exists'],
    TEMPLATE_IMMUTABLE: [409, 'TEMPLATE_IMMUTABLE', 'Published template versions are immutable'],
    TEMPLATE_NOT_FOUND: [404, 'TEMPLATE_NOT_FOUND', 'Category template was not found'],
    TEMPLATE_VERSION_INACTIVE: [
      422,
      'TEMPLATE_VERSION_INACTIVE',
      'Supplier product must use the current published template version',
    ],
    TEMPLATE_VERSION_IMMUTABLE: [
      409,
      'TEMPLATE_VERSION_IMMUTABLE',
      'Published gift-box template versions are immutable',
    ],
    VERSION_CONFLICT: [409, 'VERSION_CONFLICT', 'Category template revision changed'],
  };
  const [status, code, message] = failures[kind];
  throw new SafeApiError(status, code, message);
};

const unwrap = <T>(
  result: CategoryTemplateMutationResult<T>,
): { readonly replayed: boolean; readonly value: T } => {
  if (result.kind === 'OK') return result;
  return throwFailure(result.kind);
};

@Injectable()
export class CategoryTemplateService {
  constructor(
    @Inject(CATEGORY_TEMPLATE_REPOSITORY)
    private readonly repository: CategoryTemplateRepository,
  ) {}

  async list(actor: CompanyProductApprovalActor, categoryIdValue: unknown) {
    const categoryId = requireCategoryTemplateCategoryId(categoryIdValue);
    const result = await this.repository.list(actor.companyId, categoryId);
    if (result.kind !== 'OK') return throwFailure(result.kind);
    return {
      categoryId,
      activeVersion: result.activeVersion,
      items: result.items.map(toResponse),
      total: result.items.length,
    };
  }

  async createDraft(
    actor: CompanyProductApprovalActor,
    categoryIdValue: unknown,
    body: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ): Promise<CategoryTemplateMutationResponse<CategoryTemplateResponse>> {
    const categoryId = requireCategoryTemplateCategoryId(categoryIdValue);
    const definition = normalizeCategoryTemplateDefinition(body);
    const idempotencyKey = requireCategoryTemplateIdempotencyKey(idempotencyKeyValue);
    const result = unwrap(
      await this.repository.createDraft({
        ...definition,
        categoryId,
        companyId: actor.companyId,
        actorIdentityId: actor.identityId,
        functionalAccountId: actor.functionalAccountId,
        idempotencyKey,
        requestHash: categoryTemplateRequestHash({ categoryId, definition }),
        requestId,
        ip,
      }),
    );
    return { body: toResponse(result.value), replayed: result.replayed };
  }

  async patchDraft(
    actor: CompanyProductApprovalActor,
    templateIdValue: unknown,
    body: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ): Promise<CategoryTemplateMutationResponse<CategoryTemplateResponse>> {
    const templateId = requireCategoryTemplateId(templateIdValue);
    const { expectedRevision, definition } = normalizeCategoryTemplatePatch(body);
    const idempotencyKey = requireCategoryTemplateIdempotencyKey(idempotencyKeyValue);
    const result = unwrap(
      await this.repository.patchDraft({
        templateId,
        expectedRevision,
        definition,
        companyId: actor.companyId,
        actorIdentityId: actor.identityId,
        functionalAccountId: actor.functionalAccountId,
        idempotencyKey,
        requestHash: categoryTemplateRequestHash({ templateId, expectedRevision, definition }),
        requestId,
        ip,
      }),
    );
    return { body: toResponse(result.value), replayed: result.replayed };
  }

  async publish(
    actor: CompanyProductApprovalActor,
    templateIdValue: unknown,
    body: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ): Promise<CategoryTemplateMutationResponse<CategoryTemplateResponse>> {
    const templateId = requireCategoryTemplateId(templateIdValue);
    const expectedRevision = normalizeCategoryTemplatePublish(body);
    const idempotencyKey = requireCategoryTemplateIdempotencyKey(idempotencyKeyValue);
    const result = unwrap(
      await this.repository.publish({
        templateId,
        expectedRevision,
        companyId: actor.companyId,
        actorIdentityId: actor.identityId,
        functionalAccountId: actor.functionalAccountId,
        idempotencyKey,
        requestHash: categoryTemplateRequestHash({ templateId, expectedRevision }),
        requestId,
        ip,
      }),
    );
    return { body: toResponse(result.value), replayed: result.replayed };
  }

  async validateAssignment(
    companyId: string,
    categoryId: string,
    version: number,
  ): Promise<CategoryTemplateRecord> {
    const result = await this.repository.validateCurrent(companyId, categoryId, version);
    if (result.kind !== 'OK') return throwFailure(result.kind);
    return result.value;
  }

  categoryIsReferenced(categoryId: string): Promise<boolean> {
    return this.repository.categoryIsReferenced(categoryId);
  }
}
