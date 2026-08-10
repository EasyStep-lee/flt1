import { randomUUID } from 'node:crypto';

import type { AuditLogRepository } from '../audit/audit-log.repository.js';
import type { JsonObject } from './supplier-product.policy.js';
import type {
  CreateSupplierProductCommand,
  DecideProductApprovalCommand,
  InitialPriceReviewRecord,
  MaterializeApprovedProductCommand,
  MaterializedProductRecord,
  PatchSupplierProductCommand,
  ProductApprovalDecisionRecord,
  ProductMaterialReviewRecord,
  ProductMaterialApprovalRecord,
  ProductPublicationCandidate,
  SellableProductSummary,
  StageInitialPricesCommand,
  SubmitSupplierProductCommand,
  SupplierProductCompanyRecord,
  SupplierProductMutationResult,
  SupplierProductRecord,
  SupplierProductRepository,
  SupplierProductSkuRecord,
  SupplierProductSupplierRecord,
  SupplierInitialPricingProductRecord,
} from './supplier-product.repository.js';

interface StoredCommand<T> {
  readonly requestHash: string;
  readonly value: T;
}

interface InMemorySupplierProductOptions {
  readonly auditLogRepository?: AuditLogRepository;
  readonly companies: readonly SupplierProductCompanyRecord[];
  readonly suppliers: readonly SupplierProductSupplierRecord[];
}

interface ApprovedPriceInput {
  readonly supplierSkuCode: string;
  readonly requestedSupplyPrice: number;
  readonly requestedRetailSalePrice: number;
  readonly requestedEnterpriseSalePrice: number;
}

interface StoredMaterialApproval {
  readonly id: string;
  readonly approvalType: 'PRODUCT_MATERIAL';
  readonly objectType: 'SUPPLIER_PRODUCT';
  readonly objectId: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly assignedAccountTypeCode: 'COMPANY_PRODUCT_OPS';
  readonly version: number;
  readonly applicantIdentityId: string;
  readonly supplierId: string;
  readonly reviewOpinion: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly detailSnapshot: JsonObject;
  readonly afterSaleSnapshot: JsonObject;
  readonly deliveryRuleId: string;
  readonly materialReviewSnapshot: {
    readonly name: string;
    readonly brand: string | null;
    readonly categoryId: string;
    readonly templateVersion: number;
    readonly attributes: JsonObject;
    readonly qualificationReferenceCount: number;
    readonly isRetailEnabled: boolean;
    readonly isEnterpriseProcurementEnabled: boolean;
    readonly preparationMinutes: number;
    readonly skus: ProductMaterialReviewRecord['skus'];
  };
}

interface StoredPriceApproval extends InitialPriceReviewRecord {
  readonly applicantIdentityId: string;
  readonly assignedAccountTypeCode: 'COMPANY_PRICE_REVIEW';
}

type StoredApproval = StoredMaterialApproval | StoredPriceApproval;

interface PendingDecision {
  readonly requestHash: string;
  readonly result: Promise<SupplierProductMutationResult<ProductApprovalDecisionRecord>>;
}

interface PendingInitialPrices {
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly result: Promise<SupplierProductMutationResult<InitialPriceReviewRecord>>;
}

const clone = <T>(value: T): T => structuredClone(value);

export class InMemorySupplierProductRepository implements SupplierProductRepository {
  private readonly auditLogRepository: AuditLogRepository | undefined;
  private readonly companies: readonly SupplierProductCompanyRecord[];
  private readonly suppliers: readonly SupplierProductSupplierRecord[];
  private readonly supplierProducts = new Map<string, SupplierProductRecord>();
  private readonly approvalTasks = new Map<string, StoredApproval>();
  private readonly products = new Map<string, MaterializedProductRecord>();
  private readonly commands = new Map<string, StoredCommand<unknown>>();
  private readonly pendingDecisions = new Map<string, PendingDecision>();
  private readonly pendingInitialPrices = new Map<string, PendingInitialPrices>();

  constructor(options: InMemorySupplierProductOptions) {
    this.auditLogRepository = options.auditLogRepository;
    this.companies = clone(options.companies);
    this.suppliers = clone(options.suppliers);
  }

  async createDraft(
    command: CreateSupplierProductCommand,
  ): Promise<SupplierProductMutationResult<SupplierProductRecord>> {
    const replay = this.replay<SupplierProductRecord>('CREATE', command);
    if (replay) return replay;
    if (!this.singleMerchantIsActive()) return { kind: 'COMPANY_INVARIANT' };
    if (!this.isActiveSupplier(command.supplierId)) return { kind: 'SUPPLIER_INACTIVE' };
    if (
      [...this.supplierProducts.values()].some(
        ({ supplierId, name }) => supplierId === command.supplierId && name === command.name,
      )
    ) {
      return { kind: 'DUPLICATE' };
    }

    const id = randomUUID();
    const value: SupplierProductRecord = {
      id,
      supplierId: command.supplierId,
      categoryId: command.categoryId,
      templateVersion: command.templateVersion,
      name: command.name,
      brand: command.brand,
      attributes: clone(command.attributes),
      qualificationSnapshot: {
        schemaVersion: '1.0',
        references: clone(command.qualificationReferences),
      },
      isRetailEnabled: command.isRetailEnabled,
      isEnterpriseProcurementEnabled: command.isEnterpriseProcurementEnabled,
      enterpriseMinOrderQty: command.enterpriseMinOrderQty,
      enterprisePackageMultiple: command.enterprisePackageMultiple,
      preparationMinutes: command.preparationMinutes,
      status: 'DRAFT',
      version: 0,
      submittedAt: null,
      skus: command.skus.map(
        (sku): SupplierProductSkuRecord => ({
          id: randomUUID(),
          supplierProductId: id,
          supplierSkuCode: sku.supplierSkuCode,
          attributes: clone(sku.attributes),
          requestedSupplyPrice: null,
          requestedRetailSalePrice: null,
          requestedEnterpriseSalePrice: null,
          initialStock: sku.initialStock,
          status: 'DRAFT',
        }),
      ),
    };
    this.supplierProducts.set(value.id, value);
    this.remember('CREATE', command, value);
    return { kind: 'OK', value: clone(value), replayed: false };
  }

  async patchDraft(
    command: PatchSupplierProductCommand,
  ): Promise<SupplierProductMutationResult<SupplierProductRecord>> {
    const replay = this.replay<SupplierProductRecord>('PATCH', command);
    if (replay) return replay;
    const existing = this.findOwned(command.supplierProductId, command.supplierId);
    if (!existing) return { kind: 'NOT_FOUND' };
    if (existing.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
    if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(existing.status)) {
      return { kind: 'PRICE_INVALID' };
    }
    const duplicateName = [...this.supplierProducts.values()].some(
      ({ id, supplierId, name }) =>
        id !== existing.id &&
        supplierId === command.supplierId &&
        name === (command.patch.name ?? existing.name),
    );
    if (duplicateName) return { kind: 'DUPLICATE' };

    const patched: SupplierProductRecord = {
      ...existing,
      ...command.patch,
      attributes: clone(command.patch.attributes ?? existing.attributes),
      qualificationSnapshot: command.patch.qualificationReferences
        ? {
            schemaVersion: '1.0',
            references: clone(command.patch.qualificationReferences),
          }
        : existing.qualificationSnapshot,
      skus: command.patch.skus
        ? command.patch.skus.map((sku) => {
            const previous = existing.skus.find(
              ({ supplierSkuCode }) => supplierSkuCode === sku.supplierSkuCode,
            );
            return {
              id: previous?.id ?? randomUUID(),
              supplierProductId: existing.id,
              supplierSkuCode: sku.supplierSkuCode,
              attributes: clone(sku.attributes),
              requestedSupplyPrice: previous?.requestedSupplyPrice ?? null,
              requestedRetailSalePrice: previous?.requestedRetailSalePrice ?? null,
              requestedEnterpriseSalePrice:
                previous?.requestedEnterpriseSalePrice ?? null,
              initialStock: sku.initialStock,
              status: previous?.status ?? 'DRAFT',
            } satisfies SupplierProductSkuRecord;
          })
        : existing.skus,
      version: existing.version + 1,
    };
    this.supplierProducts.set(existing.id, patched);
    this.remember('PATCH', command, patched);
    return { kind: 'OK', value: clone(patched), replayed: false };
  }

  async submitMaterial(
    command: SubmitSupplierProductCommand,
  ): Promise<
    SupplierProductMutationResult<{
      readonly supplierProduct: SupplierProductRecord;
      readonly approvalTask: ProductMaterialApprovalRecord;
    }>
  > {
    const replay = this.replay<{
      readonly supplierProduct: SupplierProductRecord;
      readonly approvalTask: ProductMaterialApprovalRecord;
    }>('SUBMIT', command);
    if (replay) return replay;
    const existing = this.findOwned(command.supplierProductId, command.supplierId);
    if (!existing) return { kind: 'NOT_FOUND' };
    if (existing.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
    if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(existing.status)) {
      return { kind: 'PRICE_INVALID' };
    }

    const supplierProduct: SupplierProductRecord = {
      ...existing,
      status: 'PENDING_MATERIAL_REVIEW',
      version: existing.version + 1,
      submittedAt: new Date().toISOString(),
    };
    const createdAt = new Date().toISOString();
    const approvalTask: StoredMaterialApproval = {
      id: randomUUID(),
      approvalType: 'PRODUCT_MATERIAL',
      objectType: 'SUPPLIER_PRODUCT',
      objectId: existing.id,
      status: 'PENDING',
      assignedAccountTypeCode: 'COMPANY_PRODUCT_OPS',
      version: supplierProduct.version,
      applicantIdentityId: command.actorIdentityId,
      supplierId: command.supplierId,
      reviewOpinion: null,
      createdAt,
      updatedAt: createdAt,
      detailSnapshot: {
        schemaVersion: '1.0',
        name: supplierProduct.name,
        brand: supplierProduct.brand,
        attributes: clone(supplierProduct.attributes),
        qualificationSnapshot: clone(supplierProduct.qualificationSnapshot),
      },
      afterSaleSnapshot: { schemaVersion: '1.0', policy: 'company-unified-after-sale' },
      deliveryRuleId: randomUUID(),
      materialReviewSnapshot: {
        name: supplierProduct.name,
        brand: supplierProduct.brand,
        categoryId: supplierProduct.categoryId,
        templateVersion: supplierProduct.templateVersion,
        attributes: clone(supplierProduct.attributes),
        qualificationReferenceCount: supplierProduct.qualificationSnapshot.references.length,
        isRetailEnabled: supplierProduct.isRetailEnabled,
        isEnterpriseProcurementEnabled: supplierProduct.isEnterpriseProcurementEnabled,
        preparationMinutes: supplierProduct.preparationMinutes,
        skus: supplierProduct.skus.map(({ id, supplierSkuCode, attributes }) => ({
          id,
          supplierSkuCode,
          attributes: clone(attributes),
        })),
      },
    };
    const value = {
      supplierProduct,
      approvalTask: {
        id: approvalTask.id,
        approvalType: approvalTask.approvalType,
        objectType: approvalTask.objectType,
        objectId: approvalTask.objectId,
        status: 'PENDING',
        assignedAccountTypeCode: approvalTask.assignedAccountTypeCode,
        version: approvalTask.version,
      } satisfies ProductMaterialApprovalRecord,
    };
    this.supplierProducts.set(existing.id, supplierProduct);
    this.approvalTasks.set(approvalTask.id, approvalTask);
    this.remember('SUBMIT', command, value);
    return { kind: 'OK', value: clone(value), replayed: false };
  }

  async stageInitialPrices(
    command: StageInitialPricesCommand,
  ): Promise<SupplierProductMutationResult<InitialPriceReviewRecord>> {
    const action = `STAGE_INITIAL_PRICES:${command.supplierProductId}`;
    const replay = this.replay<InitialPriceReviewRecord>(action, command);
    if (replay) return replay;
    const pending = this.pendingInitialPrices.get(command.supplierProductId);
    if (pending) {
      if (
        pending.idempotencyKey === command.idempotencyKey &&
        pending.requestHash !== command.requestHash
      ) {
        return { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      const result = await pending.result;
      if (
        pending.idempotencyKey === command.idempotencyKey &&
        result.kind === 'OK'
      ) {
        return { ...clone(result), replayed: true };
      }
      return this.stageInitialPrices(command);
    }
    const result = this.stageInitialPricesOnce(command, action);
    this.pendingInitialPrices.set(command.supplierProductId, {
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      result,
    });
    try {
      return await result;
    } finally {
      this.pendingInitialPrices.delete(command.supplierProductId);
    }
  }

  async listSupplierInitialPricingProducts(
    supplierId: string,
  ): Promise<readonly SupplierInitialPricingProductRecord[]> {
    return [...this.supplierProducts.values()]
      .filter((product) => product.supplierId === supplierId)
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
      .map((product) => {
        const latest = [...this.approvalTasks.values()]
          .filter(
            (task): task is StoredPriceApproval =>
              task.approvalType === 'PRODUCT_INITIAL_PRICE' &&
              task.supplierProductId === product.id,
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
        const latestByCode = new Map(
          latest?.skus.map((price) => [price.supplierSkuCode, price]) ?? [],
        );
        const hasPending = latest?.status === 'PENDING';
        return {
          supplierProductId: product.id,
          name: product.name,
          status: product.status,
          version: product.version,
          initialPriceEditable:
            ['PENDING_MATERIAL_REVIEW', 'MATERIAL_APPROVED'].includes(product.status) &&
            !hasPending,
          latestReview: latest
            ? {
                id: latest.id,
                status: latest.status,
                version: latest.version,
                submittedAt: latest.createdAt,
              }
            : null,
          skus: product.skus.map((sku) => {
            const submitted = latestByCode.get(sku.supplierSkuCode);
            return {
              id: sku.id,
              supplierSkuCode: sku.supplierSkuCode,
              requestedSupplyPrice:
                submitted?.requestedSupplyPrice ?? sku.requestedSupplyPrice,
              requestedRetailSalePrice:
                submitted?.requestedRetailSalePrice ?? sku.requestedRetailSalePrice,
              requestedEnterpriseSalePrice:
                submitted?.requestedEnterpriseSalePrice ??
                sku.requestedEnterpriseSalePrice,
            };
          }),
        };
      });
  }

  private async stageInitialPricesOnce(
    command: StageInitialPricesCommand,
    action: string,
  ): Promise<SupplierProductMutationResult<InitialPriceReviewRecord>> {
    const supplierProduct = this.supplierProducts.get(command.supplierProductId);
    if (!supplierProduct || supplierProduct.supplierId !== command.supplierId) {
      return { kind: 'NOT_FOUND' };
    }
    if (
      !['PENDING_MATERIAL_REVIEW', 'MATERIAL_APPROVED'].includes(
        supplierProduct.status,
      )
    ) {
      return { kind: 'STATE_INVALID' };
    }
    const priceCodes = command.prices.map(({ supplierSkuCode }) => supplierSkuCode);
    if (
      command.prices.length !== supplierProduct.skus.length ||
      new Set(priceCodes).size !== priceCodes.length ||
      supplierProduct.skus.some((sku) => {
        const price = command.prices.find(
          ({ supplierSkuCode }) => supplierSkuCode === sku.supplierSkuCode,
        );
        return (
          !price ||
          ![
            price.requestedSupplyPrice,
            price.requestedRetailSalePrice,
            price.requestedEnterpriseSalePrice,
          ].every((value) => Number.isSafeInteger(value) && value >= 0)
        );
      })
    ) {
      return { kind: 'PRICE_INVALID' };
    }
    const existing = [...this.approvalTasks.values()].find(
      (task) =>
        task.approvalType === 'PRODUCT_INITIAL_PRICE' &&
        task.supplierProductId === supplierProduct.id &&
        task.status === 'PENDING',
    );
    if (existing) return { kind: 'DUPLICATE' };
    const now = new Date().toISOString();
    const priceByCode = new Map(command.prices.map((price) => [price.supplierSkuCode, price]));
    const value: StoredPriceApproval = {
      id: randomUUID(),
      approvalType: 'PRODUCT_INITIAL_PRICE',
      assignedAccountTypeCode: 'COMPANY_PRICE_REVIEW',
      applicantIdentityId: command.applicantIdentityId,
      supplierId: supplierProduct.supplierId,
      supplierProductId: supplierProduct.id,
      name: supplierProduct.name,
      skus: supplierProduct.skus.map((sku) => ({
        id: sku.id,
        ...priceByCode.get(sku.supplierSkuCode)!,
      })),
      status: 'PENDING',
      version: 1,
      reviewOpinion: null,
      createdAt: now,
      updatedAt: now,
    };
    try {
      if (!this.auditLogRepository) throw new Error('AUDIT_REPOSITORY_UNAVAILABLE');
      await this.auditLogRepository.append({
        actorType: 'SUPPLIER_USER',
        actorId: command.applicantIdentityId,
        functionalAccountId: command.applicantFunctionalAccountId,
        supplierId: command.supplierId,
        action: 'PRODUCT_INITIAL_PRICES_SUBMITTED',
        objectType: 'APPROVAL_TASK',
        objectId: value.id,
        beforeSnapshot: null,
        afterSnapshot: { status: 'PENDING', version: 1 },
        requestId: command.requestId,
        ip: command.ip,
      });
    } catch {
      return { kind: 'AUDIT_REQUIRED' };
    }
    this.approvalTasks.set(value.id, value);
    this.remember(action, command, value);
    return { kind: 'OK', value: clone(value), replayed: false };
  }

  async listMaterialReviews(companyId: string): Promise<readonly ProductMaterialReviewRecord[]> {
    return [...this.approvalTasks.values()]
      .filter((task): task is StoredMaterialApproval => task.approvalType === 'PRODUCT_MATERIAL')
      .filter((task) => this.supplierBelongsToCompany(task.supplierId, companyId))
      .map((task) => {
        return {
          id: task.id,
          approvalType: 'PRODUCT_MATERIAL',
          supplierId: task.supplierId,
          supplierProductId: task.objectId,
          ...clone(task.materialReviewSnapshot),
          status: task.status,
          version: task.version,
          reviewOpinion: task.reviewOpinion,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        };
      });
  }

  async listInitialPriceReviews(companyId: string): Promise<readonly InitialPriceReviewRecord[]> {
    return [...this.approvalTasks.values()]
      .filter((task): task is StoredPriceApproval => task.approvalType === 'PRODUCT_INITIAL_PRICE')
      .filter((task) => this.supplierBelongsToCompany(task.supplierId, companyId))
      .map(clone);
  }

  async decideProductApproval(
    command: DecideProductApprovalCommand,
  ): Promise<SupplierProductMutationResult<ProductApprovalDecisionRecord>> {
    const action = `APPROVAL_DECISION:${command.taskId}`;
    const replay = this.replay<ProductApprovalDecisionRecord>(action, command);
    if (replay) return replay;
    const pendingKey = `${action}:${command.idempotencyKey}`;
    const pending = this.pendingDecisions.get(pendingKey);
    if (pending) {
      if (pending.requestHash !== command.requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
      const result = await pending.result;
      return result.kind === 'OK' ? { ...clone(result), replayed: true } : result;
    }
    const result = this.decideProductApprovalOnce(command, action);
    this.pendingDecisions.set(pendingKey, { requestHash: command.requestHash, result });
    try {
      return await result;
    } finally {
      this.pendingDecisions.delete(pendingKey);
    }
  }

  async resolvePublicationCandidate(
    supplierProductId: string,
  ): Promise<ProductPublicationCandidate | null> {
    const material = [...this.approvalTasks.values()].find(
      (task): task is StoredMaterialApproval =>
        task.approvalType === 'PRODUCT_MATERIAL' &&
        task.objectId === supplierProductId &&
        task.status === 'APPROVED',
    );
    const price = [...this.approvalTasks.values()].find(
      (task): task is StoredPriceApproval =>
        task.approvalType === 'PRODUCT_INITIAL_PRICE' &&
        task.supplierProductId === supplierProductId &&
        task.status === 'APPROVED',
    );
    const product = this.supplierProducts.get(supplierProductId);
    if (!material || !price || product?.status !== 'MATERIAL_APPROVED') return null;
    return {
      supplierProductId,
      materialVersion: product.version,
      priceVersion: price.version,
      idempotencyKey: `approval-materialize:${supplierProductId}:${material.version}:${price.version}`,
      requestHash: '',
      detailSnapshot: clone(material.detailSnapshot),
      afterSaleSnapshot: clone(material.afterSaleSnapshot),
      deliveryRuleId: material.deliveryRuleId,
    };
  }

  async materializeApproved(
    command: MaterializeApprovedProductCommand,
  ): Promise<SupplierProductMutationResult<MaterializedProductRecord>> {
    const replay = this.replay<MaterializedProductRecord>('MATERIALIZE', command);
    if (replay) return replay;
    const existingProduct = this.products.get(command.supplierProductId);
    if (existingProduct) {
      this.remember('MATERIALIZE', command, existingProduct);
      return { kind: 'OK', value: clone(existingProduct), replayed: true };
    }
    const supplierProduct = this.supplierProducts.get(command.supplierProductId);
    if (
      !supplierProduct ||
      supplierProduct.status !== 'MATERIAL_APPROVED' ||
      supplierProduct.version !== command.materialVersion ||
      supplierProduct.skus.some(
        (sku) =>
          sku.requestedSupplyPrice === null ||
          sku.requestedRetailSalePrice === null ||
          sku.requestedEnterpriseSalePrice === null,
      )
    ) {
      return { kind: 'PRODUCT_APPROVAL_INCOMPLETE' };
    }

    const value: MaterializedProductRecord = {
      productId: randomUUID(),
      supplierProductId: supplierProduct.id,
      saleStatus: 'ACTIVE',
      skuIds: supplierProduct.skus.map(() => randomUUID()),
    };
    this.products.set(supplierProduct.id, value);
    this.supplierProducts.set(supplierProduct.id, {
      ...supplierProduct,
      status: 'ACTIVE',
      version: supplierProduct.version + 1,
      skus: supplierProduct.skus.map((sku) => ({ ...sku, status: 'ACTIVE' })),
    });
    this.remember('MATERIALIZE', command, value);
    return { kind: 'OK', value: clone(value), replayed: false };
  }

  async findSellableProductBySupplierProductId(
    supplierProductId: string,
  ): Promise<SellableProductSummary | null> {
    const value = this.products.get(supplierProductId);
    return value
      ? {
          productId: value.productId,
          supplierProductId: value.supplierProductId,
          saleStatus: value.saleStatus,
          skuCount: value.skuIds.length,
        }
      : null;
  }

  async markApprovedForTest(input: {
    readonly supplierProductId: string;
    readonly materialVersion: number;
    readonly prices: readonly ApprovedPriceInput[];
  }): Promise<void> {
    const existing = this.supplierProducts.get(input.supplierProductId);
    if (!existing) throw new Error('Supplier product not found');
    const priceByCode = new Map(input.prices.map((price) => [price.supplierSkuCode, price]));
    this.supplierProducts.set(existing.id, {
      ...existing,
      status: 'MATERIAL_APPROVED',
      version: input.materialVersion,
      skus: existing.skus.map((sku) => {
        const price = priceByCode.get(sku.supplierSkuCode);
        if (!price) throw new Error(`Approved price missing for ${sku.supplierSkuCode}`);
        return { ...sku, ...price };
      }),
    });
  }

  async getSupplierProduct(id: string): Promise<SupplierProductRecord | null> {
    const value = this.supplierProducts.get(id);
    return value ? clone(value) : null;
  }

  async countSupplierProducts(): Promise<number> {
    return this.supplierProducts.size;
  }

  async countSupplierProductSkus(): Promise<number> {
    return [...this.supplierProducts.values()].reduce(
      (total, product) => total + product.skus.length,
      0,
    );
  }

  async countProducts(): Promise<number> {
    return this.products.size;
  }

  async countSkus(): Promise<number> {
    return [...this.products.values()].reduce((total, product) => total + product.skuIds.length, 0);
  }

  private async decideProductApprovalOnce(
    command: DecideProductApprovalCommand,
    action: string,
  ): Promise<SupplierProductMutationResult<ProductApprovalDecisionRecord>> {
    const task = this.approvalTasks.get(command.taskId);
    if (!task || task.approvalType !== command.approvalType) {
      return { kind: 'APPROVAL_NOT_FOUND' };
    }
    if (!this.supplierBelongsToCompany(task.supplierId, command.companyId)) {
      return { kind: 'APPROVAL_NOT_FOUND' };
    }
    const requiredAccountType =
      command.approvalType === 'PRODUCT_MATERIAL'
        ? 'COMPANY_PRODUCT_OPS'
        : 'COMPANY_PRICE_REVIEW';
    if (task.assignedAccountTypeCode !== requiredAccountType) {
      return { kind: 'APPROVAL_NOT_FOUND' };
    }
    if (task.version !== command.expectedVersion) {
      return { kind: 'APPROVAL_VERSION_CONFLICT' };
    }
    if (task.status !== 'PENDING') return { kind: 'APPROVAL_STATE_INVALID' };
    if (task.applicantIdentityId === command.actorIdentityId) {
      return { kind: 'SELF_APPROVAL_FORBIDDEN' };
    }
    const supplierProductId =
      task.approvalType === 'PRODUCT_MATERIAL' ? task.objectId : task.supplierProductId;
    const product = this.supplierProducts.get(supplierProductId);
    if (!product) return { kind: 'APPROVAL_NOT_FOUND' };
    if (
      (task.approvalType === 'PRODUCT_MATERIAL' &&
        product.status !== 'PENDING_MATERIAL_REVIEW') ||
      (task.approvalType === 'PRODUCT_INITIAL_PRICE' &&
        !['PENDING_MATERIAL_REVIEW', 'MATERIAL_APPROVED'].includes(product.status))
    ) {
      return { kind: 'APPROVAL_STATE_INVALID' };
    }

    const previousTask = clone(task);
    const previousProduct = clone(product);
    const nextStatus = command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const decidedAt = new Date().toISOString();
    const decidedTask: StoredApproval = {
      ...task,
      status: nextStatus,
      version: task.version + 1,
      reviewOpinion: command.opinion,
      updatedAt: decidedAt,
    };
    const nextProduct: SupplierProductRecord =
      task.approvalType === 'PRODUCT_MATERIAL'
        ? {
            ...product,
            status: command.decision === 'APPROVE' ? 'MATERIAL_APPROVED' : 'CORRECTION_REQUIRED',
            version: product.version + 1,
          }
        : command.decision === 'APPROVE'
          ? {
              ...product,
              skus: product.skus.map((sku) => {
                const price = task.skus.find(
                  ({ supplierSkuCode }) => supplierSkuCode === sku.supplierSkuCode,
                );
                if (!price) throw new Error('INITIAL_PRICE_SNAPSHOT_INCOMPLETE');
                return {
                  ...sku,
                  requestedSupplyPrice: price.requestedSupplyPrice,
                  requestedRetailSalePrice: price.requestedRetailSalePrice,
                  requestedEnterpriseSalePrice: price.requestedEnterpriseSalePrice,
                };
              }),
            }
          : product;
    this.approvalTasks.set(task.id, decidedTask);
    this.supplierProducts.set(product.id, nextProduct);

    try {
      if (!this.auditLogRepository) throw new Error('AUDIT_REPOSITORY_UNAVAILABLE');
      await this.auditLogRepository.append({
        actorType: 'COMPANY_USER',
        actorId: command.actorIdentityId,
        functionalAccountId: command.functionalAccountId,
        supplierId: task.supplierId,
        action:
          task.approvalType === 'PRODUCT_MATERIAL'
            ? 'PRODUCT_MATERIAL_REVIEW_DECIDED'
            : 'PRODUCT_INITIAL_PRICE_REVIEW_DECIDED',
        objectType: 'APPROVAL_TASK',
        objectId: task.id,
        beforeSnapshot: { status: task.status, version: task.version },
        afterSnapshot: { decision: command.decision, status: nextStatus, version: task.version + 1 },
        requestId: command.requestId,
        ip: command.ip,
      });
    } catch {
      this.approvalTasks.set(previousTask.id, previousTask);
      this.supplierProducts.set(previousProduct.id, previousProduct);
      return { kind: 'AUDIT_REQUIRED' };
    }

    const value: ProductApprovalDecisionRecord = {
      id: task.id,
      approvalType: task.approvalType,
      supplierProductId,
      status: nextStatus,
      version: task.version + 1,
      reviewOpinion: command.opinion,
    };
    this.remember(action, command, value);
    return { kind: 'OK', value: clone(value), replayed: false };
  }

  private findOwned(id: string, supplierId: string): SupplierProductRecord | null {
    const value = this.supplierProducts.get(id);
    return value?.supplierId === supplierId ? value : null;
  }

  private supplierBelongsToCompany(supplierId: string, companyId: string): boolean {
    return this.suppliers.some(
      (supplier) => supplier.id === supplierId && supplier.companyId === companyId,
    );
  }

  private isActiveSupplier(supplierId: string): boolean {
    const supplier = this.suppliers.find(({ id }) => id === supplierId);
    return (
      supplier?.status === 'ACTIVE' &&
      this.companies.some(
        ({ id, status }) => id === supplier.companyId && status === 'ACTIVE',
      )
    );
  }

  private singleMerchantIsActive(): boolean {
    return this.companies.length === 1 && this.companies[0]?.status === 'ACTIVE';
  }

  private replay<T>(
    action: string,
    command: { readonly idempotencyKey: string; readonly requestHash: string },
  ): SupplierProductMutationResult<T> | null {
    const stored = this.commands.get(`${action}:${command.idempotencyKey}`);
    if (!stored) return null;
    if (stored.requestHash !== command.requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', value: clone(stored.value as T), replayed: true };
  }

  private remember<T>(
    action: string,
    command: { readonly idempotencyKey: string; readonly requestHash: string },
    value: T,
  ): void {
    this.commands.set(`${action}:${command.idempotencyKey}`, {
      requestHash: command.requestHash,
      value: clone(value),
    });
  }
}
