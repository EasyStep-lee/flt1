import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';
import {
  SUPPLIER_PRODUCT_REPOSITORY,
  type SupplierProductFailureKind,
  type SupplierProductRepository,
} from '../supplier-products/supplier-product.repository.js';
import type { SupplierPricingActor } from './supplier-pricing.actor.js';
import { normalizeInitialPriceCommand } from './supplier-pricing.policy.js';

const failureMap: Record<SupplierProductFailureKind, readonly [number, ApiErrorCode, string]> = {
  APPROVAL_NOT_FOUND: [403, 'SUPPLIER_SCOPE_FORBIDDEN', 'Supplier price scope is forbidden'],
  APPROVAL_STATE_INVALID: [409, 'INITIAL_PRICE_STATE_INVALID', 'Initial price state is invalid'],
  APPROVAL_VERSION_CONFLICT: [409, 'INITIAL_PRICE_STATE_INVALID', 'Initial price state changed'],
  AUDIT_REQUIRED: [503, 'AUDIT_REQUIRED', 'Initial price audit write is required'],
  COMPANY_INVARIANT: [409, 'SINGLE_MERCHANT_VIOLATION', 'Single merchant invariant failed'],
  DUPLICATE: [409, 'INITIAL_PRICE_REVIEW_PENDING', 'An initial price review is already pending'],
  DUPLICATE_CATALOG_RESOURCE: [409, 'DUPLICATE_CATALOG_RESOURCE', 'Catalog resource already exists'],
  IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts'],
  NOT_FOUND: [403, 'SUPPLIER_SCOPE_FORBIDDEN', 'Supplier price scope is forbidden'],
  NO_CHANGE: [422, 'VALIDATION_FAILED', 'No state change was requested'],
  PRICE_INVALID: [422, 'PRICE_INVALID', 'Initial price SKU set is invalid'],
  PRODUCT_APPROVAL_INCOMPLETE: [409, 'INITIAL_PRICE_STATE_INVALID', 'Initial price state is invalid'],
  SELF_APPROVAL_FORBIDDEN: [403, 'SELF_APPROVAL_FORBIDDEN', 'Self approval is forbidden'],
  STATE_INVALID: [409, 'INITIAL_PRICE_STATE_INVALID', 'Initial price state is invalid'],
  SUPPLIER_INACTIVE: [403, 'SUPPLIER_INACTIVE', 'Supplier is not active'],
  VERSION_CONFLICT: [409, 'INITIAL_PRICE_STATE_INVALID', 'Initial price state changed'],
};

@Injectable()
export class SupplierPricingService {
  constructor(
    @Inject(SUPPLIER_PRODUCT_REPOSITORY)
    private readonly repository: SupplierProductRepository,
  ) {}

  async list(actor: SupplierPricingActor) {
    if (actor.role !== 'SUPPLIER_PRICING') {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权查看价格页面');
    }
    const items = await this.repository.listSupplierInitialPricingProducts(actor.supplierId);
    return { items, total: items.length };
  }

  async submitInitialPrices(
    actor: SupplierPricingActor,
    supplierProductIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: string | undefined,
    requestId: string,
    ip: string | null,
  ) {
    if (actor.role !== 'SUPPLIER_PRICING') {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权提交价格');
    }
    const command = normalizeInitialPriceCommand(
      supplierProductIdValue,
      bodyValue,
      idempotencyKeyValue,
    );
    const result = await this.repository.stageInitialPrices({
      supplierId: actor.supplierId,
      supplierProductId: command.supplierProductId,
      applicantIdentityId: actor.identityId,
      applicantFunctionalAccountId: actor.functionalAccountId,
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      requestId,
      ip,
      prices: command.body.prices,
    });
    if (result.kind !== 'OK') {
      const [status, code, message] = failureMap[result.kind];
      throw new SafeApiError(status, code, message);
    }
    if (result.value.status !== 'PENDING') {
      throw new SafeApiError(
        409,
        'INITIAL_PRICE_STATE_INVALID',
        'Initial price submission did not create a pending review',
      );
    }
    return {
      body: {
        id: result.value.id,
        supplierProductId: result.value.supplierProductId,
        status: result.value.status,
        version: result.value.version,
        prices: result.value.skus.map((price) => ({
          supplierSkuCode: price.supplierSkuCode,
          requestedSupplyPrice: price.requestedSupplyPrice,
          requestedRetailSalePrice: price.requestedRetailSalePrice,
          requestedEnterpriseSalePrice: price.requestedEnterpriseSalePrice,
        })),
      },
      replayed: result.replayed,
    };
  }
}
