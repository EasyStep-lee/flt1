import { Inject, Injectable } from '@nestjs/common';

import type { CategoryTemplateRecord } from '../category-templates/category-template.repository.js';
import { CategoryTemplateService } from '../category-templates/category-template.service.js';
import type { CompanyProductApprovalActor } from '../company-product-approvals/company-product-approval.actor.js';
import {
  COMPANY_SECOND_VERIFIER,
  type CompanySecondVerifier,
} from '../company-auth/company-auth.security.js';
import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';
import type { SupplierProductRecord } from '../supplier-products/supplier-product.repository.js';
import {
  assertRegulatedTemplateCompliant,
  normalizeRegulatedCategoryDisable,
  normalizeRegulatedCategoryEnable,
  regulatedCategoryRequestHash,
  requireRegulatedCategoryId,
  requireRegulatedCategoryIdempotencyKey,
} from './regulated-category.policy.js';
import {
  REGULATED_CATEGORY_REPOSITORY,
  type RegulatedCategoryControlRecord,
  type RegulatedCategoryFailureKind,
  type RegulatedCategoryMutationResult,
  type RegulatedCategoryRepository,
} from './regulated-category.repository.js';

const toResponse = (value: RegulatedCategoryControlRecord) => ({
  id: value.id,
  categoryId: value.categoryId,
  status: value.status,
  companyQualificationReferenceCount: value.companyQualificationSnapshot.references.length,
  qualificationValidUntil: value.qualificationValidUntil,
  version: value.version,
  enabledAt: value.enabledAt,
  disabledAt: value.disabledAt,
});

const failureMap: Record<RegulatedCategoryFailureKind, readonly [number, ApiErrorCode, string]> = {
  AUDIT_REQUIRED: [503, 'AUDIT_REQUIRED', 'Regulated category audit write is required'],
  CATEGORY_TEMPLATE_INVALID: [422, 'CATEGORY_TEMPLATE_INVALID', 'Published high-risk template is required'],
  CONTROL_NOT_FOUND: [404, 'CATEGORY_NOT_FOUND', 'Regulated category control was not found'],
  IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts'],
  VERSION_CONFLICT: [409, 'VERSION_CONFLICT', 'Regulated category control version changed'],
};

const unwrap = (result: RegulatedCategoryMutationResult) => {
  if (result.kind === 'OK') return result;
  const [status, code, message] = failureMap[result.kind];
  throw new SafeApiError(status, code, message);
};

@Injectable()
export class RegulatedCategoryService {
  constructor(
    @Inject(REGULATED_CATEGORY_REPOSITORY)
    private readonly repository: RegulatedCategoryRepository,
    @Inject(CategoryTemplateService)
    private readonly templates: CategoryTemplateService,
    @Inject(COMPANY_SECOND_VERIFIER)
    private readonly secondVerifier: CompanySecondVerifier,
  ) {}

  async list(actor: CompanyProductApprovalActor) {
    this.assertActor(actor);
    const items = (await this.repository.list(actor.companyId)).map(toResponse);
    return { items, total: items.length };
  }

  async enable(
    actor: CompanyProductApprovalActor,
    categoryIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ) {
    this.assertActor(actor);
    const categoryId = requireRegulatedCategoryId(categoryIdValue);
    const input = normalizeRegulatedCategoryEnable(bodyValue);
    await this.verify(actor, input.secondVerificationCode);
    await this.requireCurrentCompliantTemplate(actor, categoryId);
    const idempotencyKey = requireRegulatedCategoryIdempotencyKey(idempotencyKeyValue);
    const result = unwrap(
      await this.repository.enable({
        categoryId,
        companyId: actor.companyId,
        actorIdentityId: actor.identityId,
        functionalAccountId: actor.functionalAccountId,
        expectedVersion: input.expectedVersion,
        companyQualificationReferences: input.companyQualificationReferences,
        qualificationValidUntil: input.qualificationValidUntil,
        idempotencyKey,
        requestHash: regulatedCategoryRequestHash({ categoryId, ...input, secondVerificationCode: undefined }),
        requestId,
        ip,
      }),
    );
    return { body: toResponse(result.value), replayed: result.replayed };
  }

  async disable(
    actor: CompanyProductApprovalActor,
    categoryIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ) {
    this.assertActor(actor);
    const categoryId = requireRegulatedCategoryId(categoryIdValue);
    const input = normalizeRegulatedCategoryDisable(bodyValue);
    await this.verify(actor, input.secondVerificationCode);
    const idempotencyKey = requireRegulatedCategoryIdempotencyKey(idempotencyKeyValue);
    const result = unwrap(
      await this.repository.disable({
        categoryId,
        companyId: actor.companyId,
        actorIdentityId: actor.identityId,
        functionalAccountId: actor.functionalAccountId,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
        idempotencyKey,
        requestHash: regulatedCategoryRequestHash({ categoryId, ...input, secondVerificationCode: undefined }),
        requestId,
        ip,
      }),
    );
    return { body: toResponse(result.value), replayed: result.replayed };
  }

  async assertProductEligible(
    companyId: string,
    categoryId: string,
    template: CategoryTemplateRecord,
    product: Pick<SupplierProductRecord, 'qualificationSnapshot' | 'qualificationValidUntil'>,
  ): Promise<void> {
    if (template.regulatoryMode !== 'HIGH_RISK') return;
    assertRegulatedTemplateCompliant(template);
    const control = await this.repository.find(companyId, categoryId);
    if (!control || control.status !== 'ENABLED') {
      throw new SafeApiError(409, 'REGULATED_CATEGORY_DISABLED', 'High-risk category is disabled');
    }
    const now = Date.now();
    const companyExpiry = control.qualificationValidUntil
      ? new Date(control.qualificationValidUntil).getTime()
      : Number.NaN;
    const productExpiry = product.qualificationValidUntil
      ? new Date(product.qualificationValidUntil).getTime()
      : Number.NaN;
    const requiredCount = template.qualificationRules.rules.filter(({ required }) => required).length;
    if (
      control.companyQualificationSnapshot.references.length < 1 ||
      !Number.isFinite(companyExpiry) ||
      companyExpiry <= now ||
      product.qualificationSnapshot.references.length < requiredCount ||
      !Number.isFinite(productExpiry) ||
      productExpiry <= now
    ) {
      throw new SafeApiError(422, 'QUALIFICATION_REQUIRED', 'Valid company and product qualification is required');
    }
  }

  private assertActor(actor: CompanyProductApprovalActor): void {
    if (actor.accountTypeCode !== 'COMPANY_PRODUCT_OPS') {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权管理强监管开关');
    }
  }

  private async verify(actor: CompanyProductApprovalActor, code: string): Promise<void> {
    if (!(await this.secondVerifier.verify({ code, userId: actor.identityId }))) {
      throw new SafeApiError(428, 'SECOND_VERIFICATION_REQUIRED', 'Second verification is required');
    }
  }

  private async requireCurrentCompliantTemplate(
    actor: CompanyProductApprovalActor,
    categoryId: string,
  ): Promise<void> {
    const listed = await this.templates.list(actor, categoryId);
    const current = listed.items.find(({ status }) => status === 'PUBLISHED');
    if (!current) {
      throw new SafeApiError(422, 'CATEGORY_TEMPLATE_INVALID', 'Published high-risk template is required');
    }
    assertRegulatedTemplateCompliant(current);
  }
}
