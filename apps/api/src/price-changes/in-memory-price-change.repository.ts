import { randomUUID } from 'node:crypto';

import type { AuditLogRepository } from '../audit/audit-log.repository.js';
import { SafeApiError } from '../http/api-error.js';
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
  SupplyPriceReviewHistoryRecord,
} from './price-change.repository.js';

interface StoredOutbox extends PriceEffectJob {
  readonly skuId: string;
  readonly priceType: 'SUPPLY' | 'RETAIL' | 'ENTERPRISE';
  readonly targetPrice: number;
  readonly expectedVersion: number;
  readonly requestId: string | null;
  readonly reason: string;
  readonly actorIdentityId: string;
  readonly functionalAccountId: string;
  status: 'PENDING' | 'EFFECTIVE' | 'FAILED';
}

interface StoredCommand {
  readonly hash: string;
  readonly result: PriceMutationResult<unknown>;
}

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryPriceChangeRepository implements PriceChangeRepository {
  private readonly skus = new Map<string, ListedSkuPriceRecord>();
  private readonly requests = new Map<string, SupplyPriceChangeRecord>();
  private readonly outboxes = new Map<string, StoredOutbox>();
  private readonly commands = new Map<string, StoredCommand>();
  private readonly history: unknown[] = [];
  private readonly supplyHistory = new Map<string, SupplyPriceReviewHistoryRecord[]>();
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(
    seeds: readonly ListedSkuPriceRecord[] = [],
    private readonly audit?: AuditLogRepository,
  ) {
    for (const seed of seeds) this.skus.set(seed.id, clone(seed));
  }

  private async serialized<T>(operation: () => Promise<T>): Promise<T> {
    let release: () => void = () => undefined;
    const previous = this.mutationTail;
    this.mutationTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  listSupplierSkus(supplierId: string): Promise<readonly ListedSkuPriceRecord[]> {
    return Promise.resolve(
      [...this.skus.values()].filter((sku) => sku.supplierId === supplierId).map(clone),
    );
  }

  listSupplierSupplyReviews(supplierId: string): Promise<readonly SupplyPriceChangeRecord[]> {
    return Promise.resolve(
      [...this.requests.values()].filter((item) => item.supplierId === supplierId).map(clone),
    );
  }

  listCompanySupplyReviews(companyId: string): Promise<readonly SupplyPriceChangeRecord[]> {
    return Promise.resolve(
      [...this.requests.values()].filter((item) => item.companyId === companyId).map(clone),
    );
  }

  findCompanySupplyReview(companyId: string, taskId: string): Promise<SupplyPriceChangeRecord | null> {
    const item = this.requests.get(taskId);
    return Promise.resolve(item?.companyId === companyId ? clone(item) : null);
  }

  listSupplyReviewHistory(
    companyId: string,
    taskId: string,
  ): Promise<readonly SupplyPriceReviewHistoryRecord[] | null> {
    const item = this.requests.get(taskId);
    if (!item || item.companyId !== companyId) return Promise.resolve(null);
    return Promise.resolve(clone(this.supplyHistory.get(taskId) ?? []));
  }

  private appendSupplyHistory(
    requestId: string,
    item: SupplyPriceReviewHistoryRecord,
  ): void {
    this.supplyHistory.set(requestId, [
      ...(this.supplyHistory.get(requestId) ?? []),
      clone(item),
    ]);
  }

  private replay<T>(scope: string, key: string, hash: string): PriceMutationResult<T> | null {
    const stored = this.commands.get(`${scope}:${key}`);
    if (!stored) return null;
    if (stored.hash !== hash) {
      throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key payload conflicts with the original request');
    }
    return { ...(clone(stored.result) as PriceMutationResult<T>), replayed: true };
  }

  private remember<T>(scope: string, key: string, hash: string, result: PriceMutationResult<T>): PriceMutationResult<T> {
    this.commands.set(`${scope}:${key}`, { hash, result: clone(result) });
    return clone(result);
  }

  private ownedSku(supplierId: string, skuId: string): ListedSkuPriceRecord {
    const sku = this.skus.get(skuId);
    if (!sku || sku.supplierId !== supplierId) {
      throw new SafeApiError(404, 'PRODUCT_NOT_FOUND', 'Listed SKU was not found in the supplier scope');
    }
    return sku;
  }

  private async appendAudit(input: {
    action: string;
    actorId: string;
    functionalAccountId: string;
    supplierId: string;
    objectId: string;
    beforeSnapshot: unknown;
    afterSnapshot: unknown;
    requestId: string;
    ip: string | null;
    actorType: 'COMPANY_USER' | 'SUPPLIER_USER';
  }): Promise<void> {
    if (!this.audit) return;
    try {
      await this.audit.append({ ...input, objectType: 'SKU_PRICE' });
    } catch {
      throw new SafeApiError(503, 'AUDIT_REQUIRED', 'Price mutation requires durable audit evidence');
    }
  }

  async submitSupplyChange(command: SubmitSupplyPriceChangeCommand): Promise<PriceMutationResult<SupplyPriceChangeRecord>> {
    return this.serialized(async () => {
    const scope = `supply-submit:${command.supplierId}:${command.skuId}`;
    const replay = this.replay<SupplyPriceChangeRecord>(scope, command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const sku = this.ownedSku(command.supplierId, command.skuId);
    if (sku.supplyPriceVersion !== command.version) {
      throw new SafeApiError(409, 'VERSION_CONFLICT', 'Supply price version has changed');
    }
    if ([...this.requests.values()].some((item) => item.skuId === sku.id && ['SUBMITTED', 'APPROVED'].includes(item.status))) {
      throw new SafeApiError(409, 'PRICE_CHANGE_PENDING', 'A supply price change is already pending');
    }
    const now = new Date().toISOString();
    const item: SupplyPriceChangeRecord = {
      id: randomUUID(),
      companyId: sku.companyId,
      supplierId: sku.supplierId,
      skuId: sku.id,
      skuCode: sku.code,
      productName: sku.productName,
      oldSupplyPrice: sku.approvedSupplyPrice,
      requestedSupplyPrice: command.requestedSupplyPrice,
      currentApprovedSupplyPrice: sku.approvedSupplyPrice,
      baseSupplyPriceVersion: sku.supplyPriceVersion,
      requestedEffectiveAt: command.effectiveAt,
      effectiveAt: null,
      status: 'SUBMITTED',
      reason: command.reason,
      applicantIdentityId: command.identityId,
      reviewerIdentityId: null,
      reviewOpinion: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.appendAudit({
      action: 'SUPPLY_PRICE_CHANGE_SUBMIT', actorId: command.identityId,
      functionalAccountId: command.functionalAccountId, supplierId: command.supplierId,
      objectId: item.id, beforeSnapshot: { approvedSupplyPrice: sku.approvedSupplyPrice, version: sku.supplyPriceVersion },
      afterSnapshot: { requestedSupplyPrice: command.requestedSupplyPrice, status: 'SUBMITTED' },
      requestId: command.requestId, ip: command.ip, actorType: 'SUPPLIER_USER',
    });
    this.requests.set(item.id, clone(item));
    this.history.push({ requestId: item.id, event: 'SUBMIT', version: 1, snapshot: clone(item) });
    this.appendSupplyHistory(item.id, {
      event: 'SUBMIT', fromStatus: null, toStatus: 'SUBMITTED', version: 1,
      opinion: null, occurredAt: now,
    });
      return this.remember(scope, command.idempotencyKey, command.requestHash, { body: item, replayed: false, jobs: [] });
    });
  }

  async patchSalePrices(command: PatchSalePricesCommand): Promise<PriceMutationResult<SalePriceChangeResult>> {
    return this.serialized(async () => {
    const scope = `sale-patch:${command.supplierId}:${command.skuId}`;
    const replay = this.replay<SalePriceChangeResult>(scope, command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const sku = this.ownedSku(command.supplierId, command.skuId);
    if (command.retailSalePrice !== undefined && sku.retailPriceVersion !== command.retailPriceVersion) {
      throw new SafeApiError(409, 'VERSION_CONFLICT', 'Retail price version has changed');
    }
    if (command.enterpriseSalePrice !== undefined && sku.enterprisePriceVersion !== command.enterprisePriceVersion) {
      throw new SafeApiError(409, 'VERSION_CONFLICT', 'Enterprise price version has changed');
    }
    const due = Date.parse(command.effectiveAt) <= Date.now();
    const jobs: StoredOutbox[] = [];
    for (const [priceType, targetPrice, expectedVersion] of [
      ['RETAIL', command.retailSalePrice, command.retailPriceVersion],
      ['ENTERPRISE', command.enterpriseSalePrice, command.enterprisePriceVersion],
    ] as const) {
      if (targetPrice === undefined || expectedVersion === undefined) continue;
      if (!due) {
        jobs.push({ id: randomUUID(), effectiveAt: command.effectiveAt, skuId: sku.id, priceType,
          targetPrice, expectedVersion, requestId: null, reason: command.reason,
          actorIdentityId: command.identityId, functionalAccountId: command.functionalAccountId,
          status: 'PENDING' });
      }
    }
    await this.appendAudit({
      action: 'SALE_PRICE_CHANGE', actorId: command.identityId,
      functionalAccountId: command.functionalAccountId, supplierId: command.supplierId,
      objectId: sku.id,
      beforeSnapshot: { retailSalePrice: sku.currentRetailSalePrice, enterpriseSalePrice: sku.currentEnterpriseSalePrice,
        retailPriceVersion: sku.retailPriceVersion, enterprisePriceVersion: sku.enterprisePriceVersion },
      afterSnapshot: { retailSalePrice: command.retailSalePrice, enterpriseSalePrice: command.enterpriseSalePrice,
        effectiveAt: command.effectiveAt, reviewCreated: false },
      requestId: command.requestId, ip: command.ip, actorType: 'SUPPLIER_USER',
    });
    let next = sku;
    if (due) {
      next = {
        ...sku,
        ...(command.retailSalePrice === undefined ? {} : {
          currentRetailSalePrice: command.retailSalePrice,
          retailPriceVersion: sku.retailPriceVersion + 1,
        }),
        ...(command.enterpriseSalePrice === undefined ? {} : {
          currentEnterpriseSalePrice: command.enterpriseSalePrice,
          enterprisePriceVersion: sku.enterprisePriceVersion + 1,
        }),
      };
      this.skus.set(sku.id, next);
      this.history.push({ skuId: sku.id, event: 'SALE_PRICE_EFFECT', before: clone(sku), after: clone(next), reason: command.reason });
    } else {
      for (const job of jobs) this.outboxes.set(job.id, job);
    }
    const body: SalePriceChangeResult = {
      skuId: sku.id,
      currentRetailSalePrice: next.currentRetailSalePrice,
      currentEnterpriseSalePrice: next.currentEnterpriseSalePrice,
      retailPriceVersion: next.retailPriceVersion,
      enterprisePriceVersion: next.enterprisePriceVersion,
      effectiveAt: command.effectiveAt,
      reviewCreated: false,
      scheduled: !due,
    };
      return this.remember(scope, command.idempotencyKey, command.requestHash, {
        body, replayed: false, jobs: jobs.map(({ id, effectiveAt }) => ({ id, effectiveAt })),
      });
    });
  }

  async decideSupplyChange(command: DecideSupplyPriceChangeCommand): Promise<PriceMutationResult<SupplyPriceChangeRecord>> {
    return this.serialized(async () => {
    const scope = `supply-decision:${command.companyId}:${command.taskId}`;
    const replay = this.replay<SupplyPriceChangeRecord>(scope, command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const current = this.requests.get(command.taskId);
    if (!current || current.companyId !== command.companyId) {
      throw new SafeApiError(404, 'APPROVAL_NOT_FOUND', 'Supply price change review was not found');
    }
    if (current.status !== 'SUBMITTED') throw new SafeApiError(409, 'APPROVAL_STATE_INVALID', 'Review is no longer pending');
    if (current.version !== command.version) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Review version has changed');
    if (current.applicantIdentityId === command.identityId) {
      throw new SafeApiError(403, 'SELF_APPROVAL_FORBIDDEN', 'Applicant and reviewer must be different natural persons');
    }
    const sku = this.skus.get(current.skuId)!;
    const now = new Date();
    const due = Date.parse(current.requestedEffectiveAt) <= now.getTime();
    const jobs: StoredOutbox[] = [];
    let next: SupplyPriceChangeRecord = {
      ...current,
      reviewerIdentityId: command.identityId,
      reviewOpinion: command.opinion,
      status: command.decision === 'REJECT' ? 'REJECTED' : 'APPROVED',
      version: current.version + 1,
      updatedAt: now.toISOString(),
    };
    if (command.decision === 'APPROVE' && due) {
      const updatedSku = { ...sku, approvedSupplyPrice: current.requestedSupplyPrice, supplyPriceVersion: sku.supplyPriceVersion + 1 };
      next = { ...next, status: 'EFFECTIVE', effectiveAt: now.toISOString(), currentApprovedSupplyPrice: updatedSku.approvedSupplyPrice, version: next.version + 1 };
      this.skus.set(sku.id, updatedSku);
    } else if (command.decision === 'APPROVE') {
      jobs.push({ id: randomUUID(), effectiveAt: current.requestedEffectiveAt, skuId: sku.id, priceType: 'SUPPLY',
        targetPrice: current.requestedSupplyPrice, expectedVersion: current.baseSupplyPriceVersion,
        requestId: current.id, reason: current.reason, actorIdentityId: command.identityId,
        functionalAccountId: command.functionalAccountId, status: 'PENDING' });
    }
    await this.appendAudit({
      action: `SUPPLY_PRICE_CHANGE_${command.decision}`, actorId: command.identityId,
      functionalAccountId: command.functionalAccountId, supplierId: current.supplierId,
      objectId: current.id, beforeSnapshot: { status: current.status, version: current.version },
      afterSnapshot: { status: next.status, version: next.version, opinion: command.opinion },
      requestId: command.requestId, ip: command.ip, actorType: 'COMPANY_USER',
    });
    this.requests.set(next.id, next);
    this.history.push({ requestId: next.id, event: command.decision, version: next.version, snapshot: clone(next) });
    const decisionVersion = current.version + 1;
    this.appendSupplyHistory(next.id, {
      event: command.decision === 'APPROVE' ? 'APPROVE' : 'REJECT',
      fromStatus: 'SUBMITTED',
      toStatus: command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      version: decisionVersion,
      opinion: command.opinion,
      occurredAt: now.toISOString(),
    });
    if (command.decision === 'APPROVE' && due) {
      this.appendSupplyHistory(next.id, {
        event: 'EFFECT', fromStatus: 'APPROVED', toStatus: 'EFFECTIVE',
        version: decisionVersion + 1, opinion: null, occurredAt: now.toISOString(),
      });
    }
    for (const job of jobs) this.outboxes.set(job.id, job);
      return this.remember(scope, command.idempotencyKey, command.requestHash, {
        body: next, replayed: false, jobs: jobs.map(({ id, effectiveAt }) => ({ id, effectiveAt })),
      });
    });
  }

  async effect(jobId: string, now = new Date()): Promise<void> {
    return this.serialized(async () => {
    const job = this.outboxes.get(jobId);
    if (!job || job.status === 'EFFECTIVE') return;
    if (Date.parse(job.effectiveAt) > now.getTime()) throw new SafeApiError(409, 'STATE_TRANSITION_INVALID', 'Price effect is not due');
    const sku = this.skus.get(job.skuId);
    if (!sku) throw new SafeApiError(404, 'PRODUCT_NOT_FOUND', 'Listed SKU was not found');
    let next = sku;
    if (job.priceType === 'SUPPLY') {
      if (sku.supplyPriceVersion !== job.expectedVersion) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Supply price effect version conflict');
      next = { ...sku, approvedSupplyPrice: job.targetPrice, supplyPriceVersion: sku.supplyPriceVersion + 1 };
      const request = this.requests.get(job.requestId!);
      if (request?.status === 'APPROVED') {
        const occurredAt = now.toISOString();
        this.requests.set(request.id, { ...request, status: 'EFFECTIVE', effectiveAt: occurredAt,
          currentApprovedSupplyPrice: job.targetPrice, version: request.version + 1, updatedAt: occurredAt });
        this.appendSupplyHistory(request.id, {
          event: 'EFFECT', fromStatus: 'APPROVED', toStatus: 'EFFECTIVE',
          version: request.version + 1, opinion: null, occurredAt,
        });
      }
    } else if (job.priceType === 'RETAIL') {
      if (sku.retailPriceVersion !== job.expectedVersion) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Retail price effect version conflict');
      next = { ...sku, currentRetailSalePrice: job.targetPrice, retailPriceVersion: sku.retailPriceVersion + 1 };
    } else {
      if (sku.enterprisePriceVersion !== job.expectedVersion) throw new SafeApiError(409, 'VERSION_CONFLICT', 'Enterprise price effect version conflict');
      next = { ...sku, currentEnterpriseSalePrice: job.targetPrice, enterprisePriceVersion: sku.enterprisePriceVersion + 1 };
    }
    this.skus.set(sku.id, next);
    job.status = 'EFFECTIVE';
      this.history.push({ skuId: sku.id, event: `${job.priceType}_PRICE_EFFECT`, before: clone(sku), after: clone(next) });
    });
  }

  listPendingEffects(): Promise<readonly PriceEffectJob[]> {
    return Promise.resolve([...this.outboxes.values()].filter((item) => item.status === 'PENDING').map(({ id, effectiveAt }) => ({ id, effectiveAt })));
  }

  async markEffectFailed(jobId: string): Promise<void> {
    return this.serialized(async () => {
      const job = this.outboxes.get(jobId);
      if (job && job.status !== 'EFFECTIVE') job.status = 'FAILED';
    });
  }

  historyCount(): number {
    return this.history.length;
  }
}
