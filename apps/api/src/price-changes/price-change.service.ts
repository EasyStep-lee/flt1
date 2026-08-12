import { Inject, Injectable } from '@nestjs/common';

import type { CompanyProductApprovalActor } from '../company-product-approvals/company-product-approval.actor.js';
import { COMPANY_SECOND_VERIFIER, type CompanySecondVerifier } from '../company-auth/company-auth.security.js';
import { SafeApiError } from '../http/api-error.js';
import { SUPPLIER_SECOND_VERIFIER, type SupplierSecondVerifier } from '../supplier-auth/supplier-auth.security.js';
import type { SupplierPricingActor } from '../supplier-pricing/supplier-pricing.actor.js';
import {
  assertAllowedFields,
  hashPriceCommand,
  rejectOwnershipFields,
  requireEffectiveAt,
  requireIdempotencyKey,
  requireIntegerCents,
  requireText,
  requireVersion,
} from './price-change.policy.js';
import {
  PRICE_CHANGE_REPOSITORY,
  type PriceChangeRepository,
  type SalePriceChangeResult,
  type SupplyPriceChangeRecord,
} from './price-change.repository.js';
import {
  PRICE_EFFECT_SCHEDULER,
  type PriceEffectScheduler,
} from './price-effect.scheduler.js';

const supplierUserId = (actor: SupplierPricingActor): string => actor.functionalAccountId;
const companyUserId = (actor: CompanyProductApprovalActor): string => actor.functionalAccountId;

@Injectable()
export class PriceChangeService {
  constructor(
    @Inject(PRICE_CHANGE_REPOSITORY) private readonly repository: PriceChangeRepository,
    @Inject(PRICE_EFFECT_SCHEDULER) private readonly scheduler: PriceEffectScheduler,
    @Inject(SUPPLIER_SECOND_VERIFIER) private readonly supplierSecondVerifier: SupplierSecondVerifier,
    @Inject(COMPANY_SECOND_VERIFIER) private readonly companySecondVerifier: CompanySecondVerifier,
  ) {}

  async listSupplier(actor: SupplierPricingActor) {
    const items = await this.repository.listSupplierSkus(actor.supplierId);
    return {
      items: items.map((item) => ({
        id: item.id,
        productName: item.productName,
        code: item.code,
        approvedSupplyPrice: item.approvedSupplyPrice,
        currentRetailSalePrice: item.currentRetailSalePrice,
        currentEnterpriseSalePrice: item.currentEnterpriseSalePrice,
        supplyPriceVersion: item.supplyPriceVersion,
        retailPriceVersion: item.retailPriceVersion,
        enterprisePriceVersion: item.enterprisePriceVersion,
      })),
      total: items.length,
    };
  }

  async listCompany(actor: CompanyProductApprovalActor) {
    const items = await this.repository.listCompanySupplyReviews(actor.companyId);
    return { items: items.map((item) => this.toResponse(item)), total: items.length };
  }

  findCompanyReview(actor: CompanyProductApprovalActor, taskId: string): Promise<SupplyPriceChangeRecord | null> {
    return this.repository.findCompanySupplyReview(actor.companyId, taskId);
  }

  private async verifySupplier(actor: SupplierPricingActor, code: unknown): Promise<void> {
    if (typeof code !== 'string' || !(await this.supplierSecondVerifier.verify({ code, userId: supplierUserId(actor) }))) {
      throw new SafeApiError(403, 'SECOND_VERIFICATION_REQUIRED', 'Supplier price changes require second verification');
    }
  }

  private async verifyCompany(actor: CompanyProductApprovalActor, code: unknown): Promise<void> {
    if (typeof code !== 'string' || !(await this.companySecondVerifier.verify({ code, userId: companyUserId(actor) }))) {
      throw new SafeApiError(403, 'SECOND_VERIFICATION_REQUIRED', 'Supply price review requires second verification');
    }
  }

  async submitSupply(
    actor: SupplierPricingActor,
    skuId: string,
    body: Record<string, unknown>,
    idempotencyHeader: string | undefined,
    requestId: string,
    ip: string | null,
  ) {
    rejectOwnershipFields(body);
    assertAllowedFields(body, ['requestedSupplyPrice', 'reason', 'effectiveAt', 'version', 'secondVerificationCode']);
    await this.verifySupplier(actor, body.secondVerificationCode);
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const payload = {
      requestedSupplyPrice: requireIntegerCents(body.requestedSupplyPrice, 'requestedSupplyPrice'),
      reason: requireText(body.reason, 'reason'),
      effectiveAt: requireEffectiveAt(body.effectiveAt),
      version: requireVersion(body.version),
    };
    const result = await this.repository.submitSupplyChange({
      ...payload, supplierId: actor.supplierId, skuId, identityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId, requestId, ip, idempotencyKey,
      requestHash: hashPriceCommand(payload),
    });
    await this.schedule(result.jobs);
    return { ...result, body: this.toResponse(result.body) };
  }

  async patchSales(
    actor: SupplierPricingActor,
    skuId: string,
    body: Record<string, unknown>,
    idempotencyHeader: string | undefined,
    requestId: string,
    ip: string | null,
  ): Promise<{ body: SalePriceChangeResult; replayed: boolean }> {
    rejectOwnershipFields(body);
    assertAllowedFields(body, ['retailSalePrice', 'enterpriseSalePrice', 'retailPriceVersion', 'enterprisePriceVersion', 'reason', 'effectiveAt', 'secondVerificationCode']);
    await this.verifySupplier(actor, body.secondVerificationCode);
    const hasRetail = body.retailSalePrice !== undefined;
    const hasEnterprise = body.enterpriseSalePrice !== undefined;
    if (!hasRetail && !hasEnterprise) throw new SafeApiError(422, 'PRICE_INVALID', 'At least one sale price is required');
    const payload = {
      ...(hasRetail ? {
        retailSalePrice: requireIntegerCents(body.retailSalePrice, 'retailSalePrice'),
        retailPriceVersion: requireVersion(body.retailPriceVersion, 'retailPriceVersion'),
      } : {}),
      ...(hasEnterprise ? {
        enterpriseSalePrice: requireIntegerCents(body.enterpriseSalePrice, 'enterpriseSalePrice'),
        enterprisePriceVersion: requireVersion(body.enterprisePriceVersion, 'enterprisePriceVersion'),
      } : {}),
      reason: requireText(body.reason, 'reason'),
      effectiveAt: requireEffectiveAt(body.effectiveAt),
    };
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const result = await this.repository.patchSalePrices({
      ...payload, supplierId: actor.supplierId, skuId, identityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId, requestId, ip, idempotencyKey,
      requestHash: hashPriceCommand(payload),
    });
    await this.schedule(result.jobs);
    return { body: result.body, replayed: result.replayed };
  }

  async decideSupply(
    actor: CompanyProductApprovalActor,
    taskId: string,
    body: Record<string, unknown>,
    idempotencyHeader: string | undefined,
    requestId: string,
    ip: string | null,
  ) {
    rejectOwnershipFields(body);
    assertAllowedFields(body, ['decision', 'opinion', 'version', 'secondVerificationCode']);
    await this.verifyCompany(actor, body.secondVerificationCode);
    if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'decision must be APPROVE or REJECT');
    }
    const payload = {
      decision: body.decision,
      opinion: requireText(body.opinion, 'opinion'),
      version: requireVersion(body.version),
    } as const;
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const result = await this.repository.decideSupplyChange({
      ...payload, companyId: actor.companyId, taskId, identityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId, requestId, ip, idempotencyKey,
      requestHash: hashPriceCommand(payload),
    });
    await this.schedule(result.jobs);
    return { ...result, body: this.toResponse(result.body) };
  }

  private async schedule(jobs: readonly { id: string; effectiveAt: string }[]): Promise<void> {
    if (jobs.length === 0) return;
    try {
      await this.scheduler.schedule(jobs);
    } catch {
      throw new SafeApiError(503, 'PRICE_EFFECT_SCHEDULE_FAILED', 'Price effect was stored but scheduling is temporarily unavailable');
    }
  }

  private toResponse(item: SupplyPriceChangeRecord) {
    return {
      id: item.id,
      approvalType: 'SUPPLY_PRICE_CHANGE' as const,
      skuId: item.skuId,
      skuCode: item.skuCode,
      productName: item.productName,
      oldSupplyPrice: item.oldSupplyPrice,
      requestedSupplyPrice: item.requestedSupplyPrice,
      currentApprovedSupplyPrice: item.currentApprovedSupplyPrice,
      requestedEffectiveAt: item.requestedEffectiveAt,
      effectiveAt: item.effectiveAt,
      status: item.status,
      reason: item.reason,
      reviewOpinion: item.reviewOpinion,
      version: item.version,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
