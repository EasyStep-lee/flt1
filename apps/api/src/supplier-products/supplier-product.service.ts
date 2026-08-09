import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';
import type { SupplierProductActor } from './supplier-product.actor.js';
import {
  normalizeSupplierProductDraft,
  normalizeSupplierProductJson,
  normalizeSupplierProductPatch,
  requestHash,
  requireIdempotencyKey,
  requireRequestId,
  requireSupplierProductId,
  requireVersion,
  type JsonObject,
} from './supplier-product.policy.js';
import {
  SUPPLIER_PRODUCT_REPOSITORY,
  type MaterializeApprovedProductCommand,
  type SupplierProductFailureKind,
  type SupplierProductRecord,
  type SupplierProductRepository,
} from './supplier-product.repository.js';

export interface SupplierProductResponse {
  readonly id: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly name: string;
  readonly brand: string | null;
  readonly attributes: JsonObject;
  readonly qualificationReferenceCount: number;
  readonly isRetailEnabled: boolean;
  readonly isEnterpriseProcurementEnabled: boolean;
  readonly enterpriseMinOrderQty: number;
  readonly enterprisePackageMultiple: number;
  readonly preparationMinutes: number;
  readonly status: string;
  readonly version: number;
  readonly skus: readonly {
    readonly id: string;
    readonly supplierSkuCode: string;
    readonly attributes: JsonObject;
    readonly initialStock: number;
    readonly status: string;
  }[];
}

export interface SupplierProductMutationResponse<T> {
  readonly body: T;
  readonly replayed: boolean;
}

export type MaterializeApprovedProductResponse =
  | { readonly kind: 'PRODUCT_APPROVAL_INCOMPLETE' }
  | {
      readonly kind: 'OK';
      readonly productId: string;
      readonly supplierProductId: string;
      readonly saleStatus: 'ACTIVE';
      readonly skuIds: readonly string[];
      readonly replayed: boolean;
    };

const asBody = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request body must be an object');
  }
  return value as Record<string, unknown>;
};

const throwFailure = (kind: SupplierProductFailureKind): never => {
  const failures: Record<
    Exclude<SupplierProductFailureKind, 'PRODUCT_APPROVAL_INCOMPLETE'>,
    readonly [number, ApiErrorCode, string]
  > = {
    APPROVAL_NOT_FOUND: [404, 'APPROVAL_NOT_FOUND', 'Approval task was not found'],
    APPROVAL_STATE_INVALID: [409, 'APPROVAL_STATE_INVALID', 'Approval state is invalid'],
    APPROVAL_VERSION_CONFLICT: [409, 'APPROVAL_VERSION_CONFLICT', 'Approval version changed'],
    AUDIT_REQUIRED: [503, 'AUDIT_REQUIRED', 'Audit write is required'],
    COMPANY_INVARIANT: [409, 'SINGLE_MERCHANT_VIOLATION', 'Single merchant invariant failed'],
    DUPLICATE: [409, 'SUPPLIER_PRODUCT_DUPLICATE', 'Supplier product already exists'],
    IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts'],
    NOT_FOUND: [404, 'SUPPLIER_PRODUCT_NOT_FOUND', 'Supplier product was not found'],
    STATE_INVALID: [409, 'STATE_TRANSITION_INVALID', 'Supplier product state is invalid'],
    SUPPLIER_INACTIVE: [403, 'SUPPLIER_INACTIVE', 'Supplier is not active'],
    SELF_APPROVAL_FORBIDDEN: [403, 'SELF_APPROVAL_FORBIDDEN', 'Self approval is forbidden'],
    VERSION_CONFLICT: [409, 'VERSION_CONFLICT', 'Supplier product version changed'],
  };
  if (kind === 'PRODUCT_APPROVAL_INCOMPLETE') {
    throw new SafeApiError(
      409,
      'PRODUCT_APPROVAL_INCOMPLETE',
      'Material and initial prices must both be approved',
    );
  }
  const [status, code, message] = failures[kind];
  throw new SafeApiError(status, code, message);
};

const toResponse = (record: SupplierProductRecord): SupplierProductResponse => ({
  id: record.id,
  categoryId: record.categoryId,
  templateVersion: record.templateVersion,
  name: record.name,
  brand: record.brand,
  attributes: structuredClone(record.attributes),
  qualificationReferenceCount: record.qualificationSnapshot.references.length,
  isRetailEnabled: record.isRetailEnabled,
  isEnterpriseProcurementEnabled: record.isEnterpriseProcurementEnabled,
  enterpriseMinOrderQty: record.enterpriseMinOrderQty,
  enterprisePackageMultiple: record.enterprisePackageMultiple,
  preparationMinutes: record.preparationMinutes,
  status: record.status,
  version: record.version,
  skus: record.skus.map((sku) => ({
    id: sku.id,
    supplierSkuCode: sku.supplierSkuCode,
    attributes: structuredClone(sku.attributes),
    initialStock: sku.initialStock,
    status: sku.status,
  })),
});

@Injectable()
export class SupplierProductService {
  constructor(
    @Inject(SUPPLIER_PRODUCT_REPOSITORY)
    private readonly repository: SupplierProductRepository,
  ) {}

  async createDraft(
    actor: SupplierProductActor,
    body: unknown,
    idempotencyKeyValue: string | undefined,
  ): Promise<SupplierProductMutationResponse<SupplierProductResponse>> {
    const input = normalizeSupplierProductDraft(body);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const result = await this.repository.createDraft({
      ...input,
      supplierId: actor.supplierId,
      actorIdentityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId,
      idempotencyKey,
      requestHash: requestHash(input),
    });
    if (result.kind === 'OK') {
      return { body: toResponse(result.value), replayed: result.replayed };
    }
    return throwFailure(result.kind);
  }

  async patchDraft(
    actor: SupplierProductActor,
    supplierProductIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: string | undefined,
  ): Promise<SupplierProductMutationResponse<SupplierProductResponse>> {
    const supplierProductId = requireSupplierProductId(supplierProductIdValue);
    const body = asBody(bodyValue);
    if (!Object.prototype.hasOwnProperty.call(body, 'version')) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'version is required');
    }
    const { version, ...patchBody } = body;
    const patch = normalizeSupplierProductPatch(patchBody);
    const expectedVersion = requireVersion(version);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const result = await this.repository.patchDraft({
      supplierId: actor.supplierId,
      supplierProductId,
      expectedVersion,
      actorIdentityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId,
      idempotencyKey,
      requestHash: requestHash({ expectedVersion, patch }),
      patch,
    });
    if (result.kind === 'OK') {
      return { body: toResponse(result.value), replayed: result.replayed };
    }
    return throwFailure(result.kind);
  }

  async submitMaterial(
    actor: SupplierProductActor,
    supplierProductIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: string | undefined,
  ): Promise<
    SupplierProductMutationResponse<{
      readonly id: string;
      readonly approvalType: 'PRODUCT_MATERIAL';
      readonly objectType: 'SUPPLIER_PRODUCT';
      readonly objectId: string;
      readonly status: 'PENDING';
      readonly assignedAccountTypeCode: 'COMPANY_PRODUCT_OPS';
      readonly version: number;
    }>
  > {
    const supplierProductId = requireSupplierProductId(supplierProductIdValue);
    const body = asBody(bodyValue);
    if (
      Object.keys(body).some((key) => !['requestId', 'version'].includes(key)) ||
      !Object.prototype.hasOwnProperty.call(body, 'version') ||
      !Object.prototype.hasOwnProperty.call(body, 'requestId')
    ) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Submission body is invalid');
    }
    const expectedVersion = requireVersion(body.version);
    const requestId = requireRequestId(body.requestId);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const result = await this.repository.submitMaterial({
      supplierId: actor.supplierId,
      supplierProductId,
      expectedVersion,
      requestId,
      actorIdentityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId,
      idempotencyKey,
      requestHash: requestHash({ expectedVersion, requestId }),
    });
    if (result.kind === 'OK') {
      return { body: { ...result.value.approvalTask }, replayed: result.replayed };
    }
    return throwFailure(result.kind);
  }

  async materializeApprovedProduct(
    commandValue: MaterializeApprovedProductCommand,
  ): Promise<MaterializeApprovedProductResponse> {
    const command: MaterializeApprovedProductCommand = {
      supplierProductId: requireSupplierProductId(commandValue.supplierProductId),
      materialVersion: requireVersion(commandValue.materialVersion),
      priceVersion: requireVersion(commandValue.priceVersion),
      idempotencyKey: requireIdempotencyKey(commandValue.idempotencyKey),
      detailSnapshot: normalizeSupplierProductJson(
        commandValue.detailSnapshot,
        'detailSnapshot',
      ),
      afterSaleSnapshot: normalizeSupplierProductJson(
        commandValue.afterSaleSnapshot,
        'afterSaleSnapshot',
      ),
      deliveryRuleId: requireSupplierProductId(commandValue.deliveryRuleId, 'deliveryRuleId'),
      requestHash: '',
    };
    const persistedCommand = {
      ...command,
      requestHash: requestHash({
        supplierProductId: command.supplierProductId,
        materialVersion: command.materialVersion,
        priceVersion: command.priceVersion,
        detailSnapshot: command.detailSnapshot,
        afterSaleSnapshot: command.afterSaleSnapshot,
        deliveryRuleId: command.deliveryRuleId,
      }),
    };
    const result = await this.repository.materializeApproved(persistedCommand);
    if (result.kind === 'OK') {
      return { kind: 'OK', ...result.value, replayed: result.replayed };
    }
    if (result.kind === 'PRODUCT_APPROVAL_INCOMPLETE') return { kind: result.kind };
    return throwFailure(result.kind);
  }
}
