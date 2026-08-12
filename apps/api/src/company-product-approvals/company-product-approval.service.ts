import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';
import { CategoryTemplateService } from '../category-templates/category-template.service.js';
import { RegulatedCategoryService } from '../regulated-categories/regulated-category.service.js';
import {
  requestHash,
  requireIdempotencyKey,
  requireSupplierProductId,
  requireVersion,
} from '../supplier-products/supplier-product.policy.js';
import {
  SUPPLIER_PRODUCT_REPOSITORY,
  type ProductApprovalType,
  type SupplierProductFailureKind,
  type SupplierProductRepository,
} from '../supplier-products/supplier-product.repository.js';
import { SupplierProductService } from '../supplier-products/supplier-product.service.js';
import type { CompanyProductApprovalActor } from './company-product-approval.actor.js';

const asDecision = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Decision body must be an object');
  }
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !['decision', 'opinion', 'version'].includes(key)) ||
    !['APPROVE', 'REJECT'].includes(String(body.decision)) ||
    typeof body.opinion !== 'string' ||
    body.opinion.trim().length < 2 ||
    body.opinion.trim().length > 1000
  ) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Decision body is invalid');
  }
  return {
    decision: body.decision as 'APPROVE' | 'REJECT',
    opinion: body.opinion.trim(),
    version: requireVersion(body.version),
  };
};

const failureMap: Record<SupplierProductFailureKind, readonly [number, ApiErrorCode, string]> = {
  APPROVAL_NOT_FOUND: [404, 'APPROVAL_NOT_FOUND', 'Approval task was not found'],
  APPROVAL_STATE_INVALID: [409, 'APPROVAL_STATE_INVALID', 'Approval task state is invalid'],
  APPROVAL_VERSION_CONFLICT: [409, 'APPROVAL_VERSION_CONFLICT', 'Approval task version changed'],
  AUDIT_REQUIRED: [503, 'AUDIT_REQUIRED', 'Approval audit write is required'],
  COMPANY_INVARIANT: [409, 'SINGLE_MERCHANT_VIOLATION', 'Single merchant invariant failed'],
  DUPLICATE: [409, 'SUPPLIER_PRODUCT_DUPLICATE', 'Approval task already exists'],
  DUPLICATE_CATALOG_RESOURCE: [409, 'DUPLICATE_CATALOG_RESOURCE', 'Catalog resource already exists'],
  IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts'],
  NOT_FOUND: [404, 'APPROVAL_NOT_FOUND', 'Approval task was not found'],
  NO_CHANGE: [422, 'VALIDATION_FAILED', 'No state change was requested'],
  PRICE_INVALID: [422, 'PRICE_INVALID', 'Price snapshot is invalid'],
  PRODUCT_APPROVAL_INCOMPLETE: [409, 'PRODUCT_APPROVAL_INCOMPLETE', 'Both approvals are required'],
  SELF_APPROVAL_FORBIDDEN: [403, 'SELF_APPROVAL_FORBIDDEN', 'The applicant cannot review their own request'],
  STATE_INVALID: [409, 'APPROVAL_STATE_INVALID', 'Approval task state is invalid'],
  SUPPLIER_INACTIVE: [403, 'SUPPLIER_INACTIVE', 'Supplier is not active'],
  VERSION_CONFLICT: [409, 'APPROVAL_VERSION_CONFLICT', 'Approval task version changed'],
};

@Injectable()
export class CompanyProductApprovalService {
  constructor(
    @Inject(SUPPLIER_PRODUCT_REPOSITORY)
    private readonly repository: SupplierProductRepository,
    @Inject(SupplierProductService)
    private readonly supplierProductService: SupplierProductService,
    @Inject(CategoryTemplateService)
    private readonly categoryTemplates: CategoryTemplateService,
    @Inject(RegulatedCategoryService)
    private readonly regulatedCategories: RegulatedCategoryService,
  ) {}

  async listMaterial(actor: CompanyProductApprovalActor) {
    if (actor.accountTypeCode !== 'COMPANY_PRODUCT_OPS') {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权访问资料审核');
    }
    const items = await this.repository.listMaterialReviews(actor.companyId);
    return { items, total: items.length };
  }

  async listPrices(actor: CompanyProductApprovalActor) {
    if (actor.accountTypeCode !== 'COMPANY_PRICE_REVIEW') {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权访问价格审核');
    }
    const items = await this.repository.listInitialPriceReviews(actor.companyId);
    return { items, total: items.length };
  }

  async decide(
    actor: CompanyProductApprovalActor,
    approvalType: ProductApprovalType,
    taskIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ) {
    const requiredRole =
      approvalType === 'PRODUCT_MATERIAL' ? 'COMPANY_PRODUCT_OPS' : 'COMPANY_PRICE_REVIEW';
    if (actor.accountTypeCode !== requiredRole) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权执行该审核');
    }
    const taskId = requireSupplierProductId(taskIdValue, 'taskId');
    const body = asDecision(bodyValue);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    if (
      approvalType === 'PRODUCT_MATERIAL' &&
      body.decision === 'APPROVE'
    ) {
      const review = (await this.repository.listMaterialReviews(actor.companyId)).find(
        ({ id }) => id === taskId,
      );
      if (review) {
        const product = await this.repository.findOwnedProduct(
          review.supplierProductId,
          review.supplierId,
        );
        if (product) {
          const template = await this.categoryTemplates.validateAssignment(
            actor.companyId,
            review.categoryId,
            review.templateVersion,
          );
          await this.regulatedCategories.assertProductEligible(
            actor.companyId,
            review.categoryId,
            template,
            product,
          );
        }
      }
    }
    const result = await this.repository.decideProductApproval({
      companyId: actor.companyId,
      taskId,
      approvalType,
      expectedVersion: body.version,
      decision: body.decision,
      opinion: body.opinion,
      actorIdentityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId,
      idempotencyKey,
      requestHash: requestHash({ approvalType, taskId, ...body }),
      requestId,
      ip,
    });
    if (result.kind !== 'OK') {
      const [status, code, message] = failureMap[result.kind];
      throw new SafeApiError(status, code, message);
    }

    let publicationStatus: 'ACTIVE' | 'REJECTED' | 'WAITING_OTHER_APPROVAL' =
      result.value.status === 'REJECTED' ? 'REJECTED' : 'WAITING_OTHER_APPROVAL';
    let productId: string | null = null;
    if (result.value.status === 'APPROVED') {
      const existing = await this.repository.findSellableProductBySupplierProductId(
        result.value.supplierProductId,
      );
      if (existing) {
        publicationStatus = 'ACTIVE';
        productId = existing.productId;
      } else {
        const candidate = await this.repository.resolvePublicationCandidate(
          result.value.supplierProductId,
        );
        if (candidate) {
          const materialized = await this.supplierProductService.materializeApprovedProduct(candidate);
          if (materialized.kind === 'OK') {
            publicationStatus = 'ACTIVE';
            productId = materialized.productId;
          }
        }
      }
    }
    return {
      body: { ...result.value, publicationStatus, productId },
      replayed: result.replayed,
    };
  }
}
