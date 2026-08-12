import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { SafeApiError } from '../http/api-error.js';
import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  DecideSupplyPriceChangeCommand,
  ListedSkuPriceRecord,
  PatchSalePricesCommand,
  PriceChangeRepository,
  PriceEffectJob,
  PriceMutationResult,
  SalePriceChangeResult,
  SubmitSupplyPriceChangeCommand,
  SupplyPriceChangeRecord,
} from './price-change.repository.js';

type Transaction = Prisma.TransactionClient;
type SkuWithProduct = Prisma.SkuGetPayload<{ include: { product: true } }>;
type RequestWithSku = Prisma.SupplyPriceChangeRequestGetPayload<{
  include: { sku: { include: { product: true } } };
}>;

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class PrismaPriceChangeRepository implements PriceChangeRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private skuRecord(sku: SkuWithProduct): ListedSkuPriceRecord {
    return {
      id: sku.id,
      companyId: sku.product.companyId,
      supplierId: sku.product.supplierId,
      productName: sku.product.name,
      code: sku.code,
      approvedSupplyPrice: sku.approvedSupplyPrice,
      currentRetailSalePrice: sku.currentRetailSalePrice,
      currentEnterpriseSalePrice: sku.currentEnterpriseSalePrice,
      supplyPriceVersion: sku.supplyPriceVersion,
      retailPriceVersion: sku.retailPriceVersion,
      enterprisePriceVersion: sku.enterprisePriceVersion,
    };
  }

  private requestRecord(item: RequestWithSku): SupplyPriceChangeRecord {
    return {
      id: item.id,
      companyId: item.companyId,
      supplierId: item.supplierId,
      skuId: item.skuId,
      skuCode: item.sku.code,
      productName: item.sku.product.name,
      oldSupplyPrice: item.oldSupplyPrice,
      requestedSupplyPrice: item.requestedSupplyPrice,
      currentApprovedSupplyPrice: item.sku.approvedSupplyPrice,
      baseSupplyPriceVersion: item.baseSupplyPriceVersion,
      requestedEffectiveAt: item.requestedEffectiveAt.toISOString(),
      effectiveAt: item.effectiveAt?.toISOString() ?? null,
      status: item.status,
      reason: item.reason,
      applicantIdentityId: item.applicantIdentityId,
      reviewerIdentityId: item.reviewerIdentityId,
      reviewOpinion: item.reviewOpinion,
      version: item.version,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  async listSupplierSkus(supplierId: string): Promise<readonly ListedSkuPriceRecord[]> {
    const rows = await this.prisma.sku.findMany({
      where: { status: 'ACTIVE', product: { supplierId, saleStatus: 'ACTIVE' } },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.skuRecord(row));
  }

  async listCompanySupplyReviews(companyId: string): Promise<readonly SupplyPriceChangeRecord[]> {
    const rows = await this.prisma.supplyPriceChangeRequest.findMany({
      where: { companyId },
      include: { sku: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.requestRecord(row));
  }

  async findCompanySupplyReview(companyId: string, taskId: string): Promise<SupplyPriceChangeRecord | null> {
    const row = await this.prisma.supplyPriceChangeRequest.findFirst({
      where: { id: taskId, companyId },
      include: { sku: { include: { product: true } } },
    });
    return row ? this.requestRecord(row) : null;
  }

  private async replay<T>(tx: Transaction, scope: string, key: string, hash: string): Promise<PriceMutationResult<T> | null> {
    const stored = await tx.priceChangeCommand.findUnique({
      where: { scope_idempotencyKey: { scope, idempotencyKey: key } },
    });
    if (!stored) return null;
    if (stored.requestHash !== hash) {
      throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key payload conflicts with the original request');
    }
    const snapshot = stored.responseSnapshot as unknown as PriceMutationResult<T>;
    return { ...snapshot, replayed: true };
  }

  private async remember<T>(tx: Transaction, scope: string, key: string, hash: string, result: PriceMutationResult<T>): Promise<void> {
    await tx.priceChangeCommand.create({
      data: { scope, idempotencyKey: key, requestHash: hash, responseSnapshot: json(result) },
    });
  }

  private async ownedSku(tx: Transaction, supplierId: string, skuId: string): Promise<SkuWithProduct> {
    const sku = await tx.sku.findFirst({
      where: { id: skuId, status: 'ACTIVE', product: { supplierId, saleStatus: 'ACTIVE' } },
      include: { product: true },
    });
    if (!sku) throw new SafeApiError(404, 'PRODUCT_NOT_FOUND', 'Listed SKU was not found in the supplier scope');
    return sku;
  }

  private async audit(
    tx: Transaction,
    command: {
      actorType: 'COMPANY_USER' | 'SUPPLIER_USER'; actorId: string;
      supplierId: string; functionalAccountId: string; action: string;
      objectId: string; before: unknown; after: unknown; requestId: string; ip: string | null;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorType: command.actorType,
        actorId: command.actorId,
        supplierId: command.supplierId,
        functionalAccountId: command.functionalAccountId,
        action: command.action,
        objectType: 'SKU_PRICE',
        objectId: command.objectId,
        beforeSnapshot: json(command.before),
        afterSnapshot: json(command.after),
        requestId: command.requestId,
        ip: command.ip,
      },
    });
  }

  async submitSupplyChange(command: SubmitSupplyPriceChangeCommand): Promise<PriceMutationResult<SupplyPriceChangeRecord>> {
    return this.prisma.$transaction(async (tx) => {
      const scope = `supply-submit:${command.supplierId}:${command.skuId}`;
      const replay = await this.replay<SupplyPriceChangeRecord>(tx, scope, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      const sku = await this.ownedSku(tx, command.supplierId, command.skuId);
      if (sku.supplyPriceVersion !== command.version) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Supply price version has changed');
      const pending = await tx.supplyPriceChangeRequest.findFirst({
        where: { skuId: sku.id, status: { in: ['SUBMITTED', 'APPROVED'] } },
      });
      if (pending) throw new SafeApiError(409, 'PRICE_CHANGE_PENDING', 'A supply price change is already pending');
      const created = await tx.supplyPriceChangeRequest.create({
        data: {
          companyId: sku.product.companyId,
          supplierId: sku.product.supplierId,
          skuId: sku.id,
          oldSupplyPrice: sku.approvedSupplyPrice,
          requestedSupplyPrice: command.requestedSupplyPrice,
          baseSupplyPriceVersion: sku.supplyPriceVersion,
          requestedEffectiveAt: new Date(command.effectiveAt),
          reason: command.reason,
          applicantIdentityId: command.identityId,
          applicantFunctionalAccountId: command.functionalAccountId,
        },
      });
      await tx.supplyPriceChangeHistory.create({
        data: {
          requestId: created.id, event: 'SUBMIT', fromStatus: null, toStatus: 'SUBMITTED', version: 1,
          snapshot: json({ oldSupplyPrice: sku.approvedSupplyPrice, requestedSupplyPrice: command.requestedSupplyPrice,
            requestedEffectiveAt: command.effectiveAt, reason: command.reason }),
          actorIdentityId: command.identityId, functionalAccountId: command.functionalAccountId,
        },
      });
      await this.audit(tx, {
        actorType: 'SUPPLIER_USER', actorId: command.identityId, supplierId: command.supplierId,
        functionalAccountId: command.functionalAccountId, action: 'SUPPLY_PRICE_CHANGE_SUBMIT', objectId: created.id,
        before: { approvedSupplyPrice: sku.approvedSupplyPrice, version: sku.supplyPriceVersion },
        after: { requestedSupplyPrice: command.requestedSupplyPrice, status: 'SUBMITTED' },
        requestId: command.requestId, ip: command.ip,
      });
      const body = this.requestRecord({ ...created, sku } as RequestWithSku);
      const result: PriceMutationResult<SupplyPriceChangeRecord> = { body, replayed: false, jobs: [] };
      await this.remember(tx, scope, command.idempotencyKey, command.requestHash, result);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async patchSalePrices(command: PatchSalePricesCommand): Promise<PriceMutationResult<SalePriceChangeResult>> {
    return this.prisma.$transaction(async (tx) => {
      const scope = `sale-patch:${command.supplierId}:${command.skuId}`;
      const replay = await this.replay<SalePriceChangeResult>(tx, scope, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      const sku = await this.ownedSku(tx, command.supplierId, command.skuId);
      if (command.retailSalePrice !== undefined && sku.retailPriceVersion !== command.retailPriceVersion) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Retail price version has changed');
      if (command.enterpriseSalePrice !== undefined && sku.enterprisePriceVersion !== command.enterprisePriceVersion) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Enterprise price version has changed');
      const effectiveAt = new Date(command.effectiveAt);
      const due = effectiveAt.getTime() <= Date.now();
      const jobs: PriceEffectJob[] = [];
      let current = sku;
      if (due) {
        const changed = await tx.sku.updateMany({
          where: {
            id: sku.id,
            ...(command.retailSalePrice === undefined ? {} : { retailPriceVersion: command.retailPriceVersion }),
            ...(command.enterpriseSalePrice === undefined ? {} : { enterprisePriceVersion: command.enterprisePriceVersion }),
          },
          data: {
            ...(command.retailSalePrice === undefined ? {} : { currentRetailSalePrice: command.retailSalePrice, retailPriceVersion: { increment: 1 } }),
            ...(command.enterpriseSalePrice === undefined ? {} : { currentEnterpriseSalePrice: command.enterpriseSalePrice, enterprisePriceVersion: { increment: 1 } }),
          },
        });
        if (changed.count !== 1) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Sale price version changed concurrently');
        current = (await tx.sku.findUniqueOrThrow({ where: { id: sku.id }, include: { product: true } }));
        for (const [priceType, oldPrice, newPrice, oldVersion, newVersion] of [
          ['RETAIL', sku.currentRetailSalePrice, command.retailSalePrice, sku.retailPriceVersion, current.retailPriceVersion],
          ['ENTERPRISE', sku.currentEnterpriseSalePrice, command.enterpriseSalePrice, sku.enterprisePriceVersion, current.enterprisePriceVersion],
        ] as const) {
          if (newPrice === undefined) continue;
          await tx.priceChangeLog.create({ data: {
            companyId: sku.product.companyId, supplierId: sku.product.supplierId, skuId: sku.id,
            priceType, oldPrice, newPrice, oldVersion, newVersion, effectiveAt,
            changedByIdentityId: command.identityId, functionalAccountId: command.functionalAccountId,
            changeReason: command.reason, reviewStatus: 'NOT_REQUIRED',
          } });
        }
      } else {
        for (const [priceType, targetPrice, expectedVersion] of [
          ['RETAIL', command.retailSalePrice, command.retailPriceVersion],
          ['ENTERPRISE', command.enterpriseSalePrice, command.enterprisePriceVersion],
        ] as const) {
          if (targetPrice === undefined || expectedVersion === undefined) continue;
          const outbox = await tx.priceEffectOutbox.create({ data: {
            businessKey: `${scope}:${command.idempotencyKey}:${priceType}`,
            companyId: sku.product.companyId, supplierId: sku.product.supplierId, skuId: sku.id,
            priceType, targetPrice, expectedVersion, effectiveAt, changeReason: command.reason,
            changedByIdentityId: command.identityId, functionalAccountId: command.functionalAccountId,
            reviewStatus: 'NOT_REQUIRED',
          } });
          jobs.push({ id: outbox.id, effectiveAt: outbox.effectiveAt.toISOString() });
        }
      }
      await this.audit(tx, {
        actorType: 'SUPPLIER_USER', actorId: command.identityId, supplierId: command.supplierId,
        functionalAccountId: command.functionalAccountId, action: 'SALE_PRICE_CHANGE', objectId: sku.id,
        before: { retailSalePrice: sku.currentRetailSalePrice, enterpriseSalePrice: sku.currentEnterpriseSalePrice,
          retailPriceVersion: sku.retailPriceVersion, enterprisePriceVersion: sku.enterprisePriceVersion },
        after: { retailSalePrice: command.retailSalePrice, enterpriseSalePrice: command.enterpriseSalePrice,
          effectiveAt: command.effectiveAt, reviewCreated: false }, requestId: command.requestId, ip: command.ip,
      });
      const result: PriceMutationResult<SalePriceChangeResult> = {
        body: { skuId: sku.id, currentRetailSalePrice: current.currentRetailSalePrice,
          currentEnterpriseSalePrice: current.currentEnterpriseSalePrice,
          retailPriceVersion: current.retailPriceVersion, enterprisePriceVersion: current.enterprisePriceVersion,
          effectiveAt: command.effectiveAt, reviewCreated: false, scheduled: !due },
        replayed: false, jobs,
      };
      await this.remember(tx, scope, command.idempotencyKey, command.requestHash, result);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async decideSupplyChange(command: DecideSupplyPriceChangeCommand): Promise<PriceMutationResult<SupplyPriceChangeRecord>> {
    return this.prisma.$transaction(async (tx) => {
      const scope = `supply-decision:${command.companyId}:${command.taskId}`;
      const replay = await this.replay<SupplyPriceChangeRecord>(tx, scope, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      let request = await tx.supplyPriceChangeRequest.findFirst({
        where: { id: command.taskId, companyId: command.companyId },
        include: { sku: { include: { product: true } } },
      });
      if (!request) throw new SafeApiError(404, 'APPROVAL_NOT_FOUND', 'Supply price change review was not found');
      if (request.status !== 'SUBMITTED') throw new SafeApiError(409, 'APPROVAL_STATE_INVALID', 'Review is no longer pending');
      if (request.version !== command.version) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Review version has changed');
      if (request.applicantIdentityId === command.identityId) throw new SafeApiError(403, 'SELF_APPROVAL_FORBIDDEN', 'Applicant and reviewer must be different natural persons');
      const reviewedAt = new Date();
      const nextStatus = command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      await tx.supplyPriceChangeRequest.update({ where: { id: request.id }, data: {
        status: nextStatus, reviewerIdentityId: command.identityId,
        reviewerFunctionalAccountId: command.functionalAccountId, reviewOpinion: command.opinion,
        reviewedAt, version: { increment: 1 },
      } });
      await tx.supplyPriceChangeHistory.create({ data: {
        requestId: request.id, event: command.decision === 'APPROVE' ? 'APPROVE' : 'REJECT',
        fromStatus: 'SUBMITTED', toStatus: nextStatus, version: request.version + 1,
        snapshot: json({ decision: command.decision, opinion: command.opinion, reviewedAt: reviewedAt.toISOString() }),
        actorIdentityId: command.identityId, functionalAccountId: command.functionalAccountId,
      } });
      const jobs: PriceEffectJob[] = [];
      if (command.decision === 'APPROVE') {
        if (request.requestedEffectiveAt.getTime() <= reviewedAt.getTime()) {
          const changed = await tx.sku.updateMany({ where: { id: request.skuId, supplyPriceVersion: request.baseSupplyPriceVersion },
            data: { approvedSupplyPrice: request.requestedSupplyPrice, supplyPriceVersion: { increment: 1 } } });
          if (changed.count !== 1) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Supply price changed before approval effect');
          await tx.priceChangeLog.create({ data: {
            companyId: request.companyId, supplierId: request.supplierId, skuId: request.skuId,
            supplyPriceChangeRequestId: request.id, priceType: 'SUPPLY', oldPrice: request.oldSupplyPrice,
            newPrice: request.requestedSupplyPrice, oldVersion: request.baseSupplyPriceVersion,
            newVersion: request.baseSupplyPriceVersion + 1, effectiveAt: reviewedAt,
            changedByIdentityId: command.identityId, functionalAccountId: command.functionalAccountId,
            changeReason: request.reason, reviewStatus: 'APPROVED',
          } });
          await tx.supplyPriceChangeRequest.update({ where: { id: request.id }, data: {
            status: 'EFFECTIVE', effectiveAt: reviewedAt, version: { increment: 1 },
          } });
          await tx.supplyPriceChangeHistory.create({ data: {
            requestId: request.id, event: 'EFFECT', fromStatus: 'APPROVED', toStatus: 'EFFECTIVE',
            version: request.version + 2, snapshot: json({ effectiveAt: reviewedAt.toISOString(),
              approvedSupplyPrice: request.requestedSupplyPrice }), actorIdentityId: command.identityId,
            functionalAccountId: command.functionalAccountId,
          } });
        } else {
          const outbox = await tx.priceEffectOutbox.create({ data: {
            businessKey: `supply:${request.id}`, companyId: request.companyId, supplierId: request.supplierId,
            skuId: request.skuId, supplyPriceChangeRequestId: request.id, priceType: 'SUPPLY',
            targetPrice: request.requestedSupplyPrice, expectedVersion: request.baseSupplyPriceVersion,
            effectiveAt: request.requestedEffectiveAt, changeReason: request.reason,
            changedByIdentityId: command.identityId, functionalAccountId: command.functionalAccountId,
            reviewStatus: 'APPROVED',
          } });
          jobs.push({ id: outbox.id, effectiveAt: outbox.effectiveAt.toISOString() });
        }
      }
      await this.audit(tx, {
        actorType: 'COMPANY_USER', actorId: command.identityId, supplierId: request.supplierId,
        functionalAccountId: command.functionalAccountId, action: `SUPPLY_PRICE_CHANGE_${command.decision}`,
        objectId: request.id, before: { status: request.status, version: request.version },
        after: { status: nextStatus, opinion: command.opinion }, requestId: command.requestId, ip: command.ip,
      });
      request = await tx.supplyPriceChangeRequest.findUniqueOrThrow({
        where: { id: request.id }, include: { sku: { include: { product: true } } },
      });
      const result: PriceMutationResult<SupplyPriceChangeRecord> = {
        body: this.requestRecord(request), replayed: false, jobs,
      };
      await this.remember(tx, scope, command.idempotencyKey, command.requestHash, result);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async effect(jobId: string, now = new Date()): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const outbox = await tx.priceEffectOutbox.findUnique({ where: { id: jobId } });
      if (!outbox || outbox.status === 'EFFECTIVE') return;
      if (outbox.effectiveAt.getTime() > now.getTime()) throw new SafeApiError(409, 'STATE_TRANSITION_INVALID', 'Price effect is not due');
      const sku = await tx.sku.findUniqueOrThrow({ where: { id: outbox.skuId } });
      const versionField = outbox.priceType === 'SUPPLY' ? 'supplyPriceVersion'
        : outbox.priceType === 'RETAIL' ? 'retailPriceVersion' : 'enterprisePriceVersion';
      const priceField = outbox.priceType === 'SUPPLY' ? 'approvedSupplyPrice'
        : outbox.priceType === 'RETAIL' ? 'currentRetailSalePrice' : 'currentEnterpriseSalePrice';
      if (sku[versionField] !== outbox.expectedVersion) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Scheduled price version conflict');
      await tx.sku.update({ where: { id: sku.id }, data: {
        [priceField]: outbox.targetPrice, [versionField]: { increment: 1 },
      } });
      await tx.priceChangeLog.create({ data: {
        companyId: outbox.companyId, supplierId: outbox.supplierId, skuId: outbox.skuId,
        supplyPriceChangeRequestId: outbox.supplyPriceChangeRequestId, priceType: outbox.priceType,
        oldPrice: sku[priceField], newPrice: outbox.targetPrice, oldVersion: outbox.expectedVersion,
        newVersion: outbox.expectedVersion + 1, effectiveAt: now,
        changedByIdentityId: outbox.changedByIdentityId, functionalAccountId: outbox.functionalAccountId,
        changeReason: outbox.changeReason, reviewStatus: outbox.reviewStatus,
      } });
      if (outbox.supplyPriceChangeRequestId) {
        const request = await tx.supplyPriceChangeRequest.findUniqueOrThrow({ where: { id: outbox.supplyPriceChangeRequestId } });
        if (request.status !== 'APPROVED') throw new SafeApiError(409, 'APPROVAL_STATE_INVALID', 'Approved supply price request is required');
        await tx.supplyPriceChangeRequest.update({ where: { id: request.id }, data: {
          status: 'EFFECTIVE', effectiveAt: now, version: { increment: 1 },
        } });
        await tx.supplyPriceChangeHistory.create({ data: {
          requestId: request.id, event: 'EFFECT', fromStatus: 'APPROVED', toStatus: 'EFFECTIVE',
          version: request.version + 1, snapshot: json({ effectiveAt: now.toISOString(), approvedSupplyPrice: outbox.targetPrice }),
          actorIdentityId: outbox.changedByIdentityId, functionalAccountId: outbox.functionalAccountId,
        } });
      }
      await tx.priceEffectOutbox.update({ where: { id: outbox.id }, data: {
        status: 'EFFECTIVE', attempts: { increment: 1 }, processedAt: now, lastErrorCode: null,
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listPendingEffects(): Promise<readonly PriceEffectJob[]> {
    const rows = await this.prisma.priceEffectOutbox.findMany({ where: { status: 'PENDING' }, select: { id: true, effectiveAt: true } });
    return rows.map((row) => ({ id: row.id, effectiveAt: row.effectiveAt.toISOString() }));
  }

  async markEffectFailed(jobId: string, errorCode: string, now = new Date()): Promise<void> {
    await this.prisma.priceEffectOutbox.updateMany({
      where: { id: jobId, status: { not: 'EFFECTIVE' } },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastErrorCode: errorCode.slice(0, 128),
        processedAt: now,
      },
    });
  }
}
