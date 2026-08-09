import { randomUUID } from 'node:crypto';

import type {
  CreateSupplierProductCommand,
  MaterializeApprovedProductCommand,
  MaterializedProductRecord,
  PatchSupplierProductCommand,
  ProductMaterialApprovalRecord,
  SellableProductSummary,
  SubmitSupplierProductCommand,
  SupplierProductCompanyRecord,
  SupplierProductMutationResult,
  SupplierProductRecord,
  SupplierProductRepository,
  SupplierProductSkuRecord,
  SupplierProductSupplierRecord,
} from './supplier-product.repository.js';

interface StoredCommand<T> {
  readonly requestHash: string;
  readonly value: T;
}

interface InMemorySupplierProductOptions {
  readonly companies: readonly SupplierProductCompanyRecord[];
  readonly suppliers: readonly SupplierProductSupplierRecord[];
}

interface ApprovedPriceInput {
  readonly supplierSkuCode: string;
  readonly requestedSupplyPrice: number;
  readonly requestedRetailSalePrice: number;
  readonly requestedEnterpriseSalePrice: number;
}

const clone = <T>(value: T): T => structuredClone(value);

export class InMemorySupplierProductRepository implements SupplierProductRepository {
  private readonly companies: readonly SupplierProductCompanyRecord[];
  private readonly suppliers: readonly SupplierProductSupplierRecord[];
  private readonly supplierProducts = new Map<string, SupplierProductRecord>();
  private readonly approvalTasks = new Map<string, ProductMaterialApprovalRecord>();
  private readonly products = new Map<string, MaterializedProductRecord>();
  private readonly commands = new Map<string, StoredCommand<unknown>>();

  constructor(options: InMemorySupplierProductOptions) {
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
      return { kind: 'STATE_INVALID' };
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
      return { kind: 'STATE_INVALID' };
    }

    const supplierProduct: SupplierProductRecord = {
      ...existing,
      status: 'PENDING_MATERIAL_REVIEW',
      version: existing.version + 1,
      submittedAt: new Date().toISOString(),
    };
    const approvalTask: ProductMaterialApprovalRecord = {
      id: randomUUID(),
      approvalType: 'PRODUCT_MATERIAL',
      objectType: 'SUPPLIER_PRODUCT',
      objectId: existing.id,
      status: 'PENDING',
      assignedAccountTypeCode: 'COMPANY_PRODUCT_OPS',
      version: supplierProduct.version,
    };
    const value = { supplierProduct, approvalTask };
    this.supplierProducts.set(existing.id, supplierProduct);
    this.approvalTasks.set(approvalTask.id, approvalTask);
    this.remember('SUBMIT', command, value);
    return { kind: 'OK', value: clone(value), replayed: false };
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

  private findOwned(id: string, supplierId: string): SupplierProductRecord | null {
    const value = this.supplierProducts.get(id);
    return value?.supplierId === supplierId ? value : null;
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
