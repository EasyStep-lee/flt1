import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import { COMPANY_LEGAL_NAME, PLATFORM_NAME } from '../merchant/single-merchant.service.js';
import type { JsonObject } from './supplier-product.policy.js';
import type {
  CreateSupplierProductCommand,
  MaterializeApprovedProductCommand,
  MaterializedProductRecord,
  PatchSupplierProductCommand,
  ProductMaterialApprovalRecord,
  SellableProductSummary,
  SubmitSupplierProductCommand,
  SupplierProductMutationResult,
  SupplierProductRecord,
  SupplierProductRepository,
} from './supplier-product.repository.js';

type TransactionClient = Prisma.TransactionClient;

const asInputJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const asJsonObject = (value: Prisma.JsonValue, field: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field.toUpperCase()}_INVALID`);
  }
  return structuredClone(value) as JsonObject;
};

const qualification = (
  value: Prisma.JsonValue,
): SupplierProductRecord['qualificationSnapshot'] => {
  const object = asJsonObject(value, 'supplier_product_qualification');
  if (object.schemaVersion !== '1.0' || !Array.isArray(object.references)) {
    throw new Error('SUPPLIER_PRODUCT_QUALIFICATION_INVALID');
  }
  const references = object.references.map((reference) => {
    if (typeof reference !== 'string') {
      throw new Error('SUPPLIER_PRODUCT_QUALIFICATION_INVALID');
    }
    return reference;
  });
  return { schemaVersion: '1.0', references };
};

const toRecord = (value: {
  readonly id: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly name: string;
  readonly brand: string | null;
  readonly attributes: Prisma.JsonValue;
  readonly qualificationSnapshot: Prisma.JsonValue;
  readonly isRetailEnabled: boolean;
  readonly isEnterpriseProcurementEnabled: boolean;
  readonly enterpriseMinOrderQty: number;
  readonly enterprisePackageMultiple: number;
  readonly preparationMinutes: number;
  readonly status: SupplierProductRecord['status'];
  readonly version: number;
  readonly submittedAt: Date | null;
  readonly skus: readonly {
    readonly id: string;
    readonly supplierProductId: string;
    readonly supplierSkuCode: string;
    readonly attributes: Prisma.JsonValue;
    readonly requestedSupplyPrice: number | null;
    readonly requestedRetailSalePrice: number | null;
    readonly requestedEnterpriseSalePrice: number | null;
    readonly initialStock: number;
    readonly status: SupplierProductRecord['skus'][number]['status'];
  }[];
}): SupplierProductRecord => ({
  id: value.id,
  supplierId: value.supplierId,
  categoryId: value.categoryId,
  templateVersion: value.templateVersion,
  name: value.name,
  brand: value.brand,
  attributes: asJsonObject(value.attributes, 'supplier_product_attributes'),
  qualificationSnapshot: qualification(value.qualificationSnapshot),
  isRetailEnabled: value.isRetailEnabled,
  isEnterpriseProcurementEnabled: value.isEnterpriseProcurementEnabled,
  enterpriseMinOrderQty: value.enterpriseMinOrderQty,
  enterprisePackageMultiple: value.enterprisePackageMultiple,
  preparationMinutes: value.preparationMinutes,
  status: value.status,
  version: value.version,
  submittedAt: value.submittedAt?.toISOString() ?? null,
  skus: value.skus.map((sku) => ({
    id: sku.id,
    supplierProductId: sku.supplierProductId,
    supplierSkuCode: sku.supplierSkuCode,
    attributes: asJsonObject(sku.attributes, 'supplier_product_sku_attributes'),
    requestedSupplyPrice: sku.requestedSupplyPrice,
    requestedRetailSalePrice: sku.requestedRetailSalePrice,
    requestedEnterpriseSalePrice: sku.requestedEnterpriseSalePrice,
    initialStock: sku.initialStock,
    status: sku.status,
  })),
});

const parseStored = <T>(value: Prisma.JsonValue): T => structuredClone(value) as T;

@Injectable()
export class PrismaSupplierProductRepository implements SupplierProductRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createDraft(
    command: CreateSupplierProductCommand,
  ): Promise<SupplierProductMutationResult<SupplierProductRecord>> {
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay<SupplierProductRecord>(
        database,
        `CREATE:${command.supplierId}`,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      const companies = await database.company.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { id: 'asc' },
        take: 2,
      });
      if (
        companies.length !== 1 ||
        companies[0]?.legalName !== COMPANY_LEGAL_NAME ||
        companies[0]?.platformName !== PLATFORM_NAME
      ) {
        return { kind: 'COMPANY_INVARIANT' } as const;
      }
      const supplier = await database.supplier.findFirst({
        where: { id: command.supplierId, companyId: companies[0].id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!supplier) return { kind: 'SUPPLIER_INACTIVE' } as const;
      const duplicate = await database.supplierProduct.findUnique({
        where: {
          supplierId_name: { supplierId: command.supplierId, name: command.name },
        },
        select: { id: true },
      });
      if (duplicate) return { kind: 'DUPLICATE' } as const;

      const created = await database.supplierProduct.create({
        data: {
          supplierId: command.supplierId,
          categoryId: command.categoryId,
          templateVersion: command.templateVersion,
          name: command.name,
          brand: command.brand,
          attributes: asInputJson(command.attributes),
          qualificationSnapshot: asInputJson({
            schemaVersion: '1.0',
            references: command.qualificationReferences,
          }),
          isRetailEnabled: command.isRetailEnabled,
          isEnterpriseProcurementEnabled: command.isEnterpriseProcurementEnabled,
          enterpriseMinOrderQty: command.enterpriseMinOrderQty,
          enterprisePackageMultiple: command.enterprisePackageMultiple,
          preparationMinutes: command.preparationMinutes,
          skus: {
            create: command.skus.map((sku) => ({
              supplierSkuCode: sku.supplierSkuCode,
              attributes: asInputJson(sku.attributes),
              initialStock: sku.initialStock,
            })),
          },
        },
        include: { skus: true },
      });
      const record = toRecord(created);
      await database.supplierProductStatusHistory.create({
        data: {
          supplierProductId: record.id,
          fromStatus: null,
          toStatus: 'DRAFT',
          event: 'CREATE',
          actorIdentityId: command.actorIdentityId,
          functionalAccountId: command.functionalAccountId,
          version: 0,
        },
      });
      await this.remember(
        database,
        `CREATE:${command.supplierId}`,
        command.idempotencyKey,
        command.requestHash,
        record,
      );
      return { kind: 'OK', value: record, replayed: false } as const;
    });
  }

  async patchDraft(
    command: PatchSupplierProductCommand,
  ): Promise<SupplierProductMutationResult<SupplierProductRecord>> {
    const scope = `PATCH:${command.supplierId}:${command.supplierProductId}`;
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay<SupplierProductRecord>(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      const current = await database.supplierProduct.findFirst({
        where: { id: command.supplierProductId, supplierId: command.supplierId },
        include: { skus: true },
      });
      if (!current) return { kind: 'NOT_FOUND' } as const;
      if (current.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' } as const;
      if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(current.status)) {
        return { kind: 'STATE_INVALID' } as const;
      }
      if (command.patch.name && command.patch.name !== current.name) {
        const duplicate = await database.supplierProduct.findUnique({
          where: {
            supplierId_name: {
              supplierId: command.supplierId,
              name: command.patch.name,
            },
          },
          select: { id: true },
        });
        if (duplicate) return { kind: 'DUPLICATE' } as const;
      }
      const updated = await database.supplierProduct.updateMany({
        where: {
          id: current.id,
          supplierId: command.supplierId,
          status: current.status,
          version: command.expectedVersion,
        },
        data: {
          ...(command.patch.categoryId !== undefined ? { categoryId: command.patch.categoryId } : {}),
          ...(command.patch.templateVersion !== undefined
            ? { templateVersion: command.patch.templateVersion }
            : {}),
          ...(command.patch.name !== undefined ? { name: command.patch.name } : {}),
          ...(command.patch.brand !== undefined ? { brand: command.patch.brand } : {}),
          ...(command.patch.attributes !== undefined
            ? { attributes: asInputJson(command.patch.attributes) }
            : {}),
          ...(command.patch.qualificationReferences !== undefined
            ? {
                qualificationSnapshot: asInputJson({
                  schemaVersion: '1.0',
                  references: command.patch.qualificationReferences,
                }),
              }
            : {}),
          ...(command.patch.isRetailEnabled !== undefined
            ? { isRetailEnabled: command.patch.isRetailEnabled }
            : {}),
          ...(command.patch.isEnterpriseProcurementEnabled !== undefined
            ? {
                isEnterpriseProcurementEnabled:
                  command.patch.isEnterpriseProcurementEnabled,
              }
            : {}),
          ...(command.patch.enterpriseMinOrderQty !== undefined
            ? { enterpriseMinOrderQty: command.patch.enterpriseMinOrderQty }
            : {}),
          ...(command.patch.enterprisePackageMultiple !== undefined
            ? { enterprisePackageMultiple: command.patch.enterprisePackageMultiple }
            : {}),
          ...(command.patch.preparationMinutes !== undefined
            ? { preparationMinutes: command.patch.preparationMinutes }
            : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) return { kind: 'VERSION_CONFLICT' } as const;
      if (command.patch.skus) {
        await database.supplierProductSku.deleteMany({
          where: { supplierProductId: current.id },
        });
        await database.supplierProductSku.createMany({
          data: command.patch.skus.map((sku) => ({
            supplierProductId: current.id,
            supplierSkuCode: sku.supplierSkuCode,
            attributes: asInputJson(sku.attributes),
            initialStock: sku.initialStock,
          })),
        });
      }
      const next = await database.supplierProduct.findUniqueOrThrow({
        where: { id: current.id },
        include: { skus: true },
      });
      const record = toRecord(next);
      await database.supplierProductStatusHistory.create({
        data: {
          supplierProductId: current.id,
          fromStatus: current.status,
          toStatus: current.status,
          event: 'UPDATE',
          actorIdentityId: command.actorIdentityId,
          functionalAccountId: command.functionalAccountId,
          version: record.version,
        },
      });
      await this.remember(database, scope, command.idempotencyKey, command.requestHash, record);
      return { kind: 'OK', value: record, replayed: false } as const;
    });
  }

  async submitMaterial(
    command: SubmitSupplierProductCommand,
  ): Promise<
    SupplierProductMutationResult<{
      readonly supplierProduct: SupplierProductRecord;
      readonly approvalTask: ProductMaterialApprovalRecord;
    }>
  > {
    const scope = `SUBMIT:${command.supplierId}:${command.supplierProductId}`;
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay<{
        readonly supplierProduct: SupplierProductRecord;
        readonly approvalTask: ProductMaterialApprovalRecord;
      }>(database, scope, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      const current = await database.supplierProduct.findFirst({
        where: { id: command.supplierProductId, supplierId: command.supplierId },
        include: { skus: true },
      });
      if (!current) return { kind: 'NOT_FOUND' } as const;
      if (current.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' } as const;
      if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(current.status)) {
        return { kind: 'STATE_INVALID' } as const;
      }
      const version = current.version + 1;
      const submittedAt = new Date();
      const update = await database.supplierProduct.updateMany({
        where: { id: current.id, status: current.status, version: current.version },
        data: {
          status: 'PENDING_MATERIAL_REVIEW',
          submittedAt,
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) return { kind: 'VERSION_CONFLICT' } as const;
      const task = await database.approvalTask.create({
        data: {
          approvalType: 'PRODUCT_MATERIAL',
          objectType: 'SUPPLIER_PRODUCT',
          objectId: current.id,
          applicantType: 'SUPPLIER_USER',
          applicantId: command.actorIdentityId,
          applicantFunctionalAccountId: command.functionalAccountId,
          supplierId: command.supplierId,
          assignedAccountTypeCode: 'COMPANY_PRODUCT_OPS',
          requestSnapshot: asInputJson({ requestId: command.requestId }),
          version,
        },
      });
      await database.approvalTaskHistory.create({
        data: {
          approvalTaskId: task.id,
          fromStatus: null,
          toStatus: 'PENDING',
          event: 'CREATE',
          actorType: 'SUPPLIER_USER',
          actorId: command.actorIdentityId,
          functionalAccountId: command.functionalAccountId,
          version,
        },
      });
      await database.supplierProductStatusHistory.create({
        data: {
          supplierProductId: current.id,
          fromStatus: current.status,
          toStatus: 'PENDING_MATERIAL_REVIEW',
          event: 'SUBMIT_MATERIAL',
          actorIdentityId: command.actorIdentityId,
          functionalAccountId: command.functionalAccountId,
          version,
        },
      });
      const next = await database.supplierProduct.findUniqueOrThrow({
        where: { id: current.id },
        include: { skus: true },
      });
      const result = {
        supplierProduct: toRecord(next),
        approvalTask: {
          id: task.id,
          approvalType: 'PRODUCT_MATERIAL',
          objectType: 'SUPPLIER_PRODUCT',
          objectId: current.id,
          status: 'PENDING',
          assignedAccountTypeCode: 'COMPANY_PRODUCT_OPS',
          version,
        } satisfies ProductMaterialApprovalRecord,
      };
      await this.remember(database, scope, command.idempotencyKey, command.requestHash, result);
      return { kind: 'OK', value: result, replayed: false } as const;
    });
  }

  async materializeApproved(
    command: MaterializeApprovedProductCommand,
  ): Promise<SupplierProductMutationResult<MaterializedProductRecord>> {
    const scope = `MATERIALIZE:${command.supplierProductId}`;
    try {
      return await this.prisma.$transaction(async (database) => {
        const replay = await this.replay<MaterializedProductRecord>(
          database,
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
        const existing = await database.product.findUnique({
          where: { supplierProductId: command.supplierProductId },
          include: { skus: true },
        });
        if (existing) {
          const value = this.toMaterialized(existing);
          await this.remember(
            database,
            scope,
            command.idempotencyKey,
            command.requestHash,
            value,
          );
          return { kind: 'OK', value, replayed: true } as const;
        }
        const supplierProduct = await database.supplierProduct.findUnique({
          where: { id: command.supplierProductId },
          include: { supplier: true, skus: true },
        });
        if (
          !supplierProduct ||
          supplierProduct.status !== 'MATERIAL_APPROVED' ||
          supplierProduct.version !== command.materialVersion ||
          supplierProduct.supplier.status !== 'ACTIVE' ||
          supplierProduct.skus.some(
            (sku) =>
              sku.requestedSupplyPrice === null ||
              sku.requestedRetailSalePrice === null ||
              sku.requestedEnterpriseSalePrice === null,
          )
        ) {
          return { kind: 'PRODUCT_APPROVAL_INCOMPLETE' } as const;
        }
        const product = await database.product.create({
          data: {
            companyId: supplierProduct.supplier.companyId,
            supplierId: supplierProduct.supplierId,
            supplierProductId: supplierProduct.id,
            categoryId: supplierProduct.categoryId,
            templateVersion: supplierProduct.templateVersion,
            name: supplierProduct.name,
            saleStatus: 'ACTIVE',
            isRetailEnabled: supplierProduct.isRetailEnabled,
            isEnterpriseProcurementEnabled:
              supplierProduct.isEnterpriseProcurementEnabled,
            detailSnapshot: asInputJson(command.detailSnapshot),
            afterSaleSnapshot: asInputJson(command.afterSaleSnapshot),
            deliveryRuleId: command.deliveryRuleId,
            skus: {
              create: supplierProduct.skus.map((sku) => ({
                supplierProductSkuId: sku.id,
                code: `SKU-${randomUUID().replaceAll('-', '')}`,
                approvedSupplyPrice: sku.requestedSupplyPrice!,
                currentRetailSalePrice: sku.requestedRetailSalePrice!,
                currentEnterpriseSalePrice: sku.requestedEnterpriseSalePrice!,
                supplyPriceVersion: command.priceVersion,
                retailPriceVersion: command.priceVersion,
                enterprisePriceVersion: command.priceVersion,
                status: 'ACTIVE',
              })),
            },
          },
          include: { skus: true },
        });
        const update = await database.supplierProduct.updateMany({
          where: {
            id: supplierProduct.id,
            status: 'MATERIAL_APPROVED',
            version: command.materialVersion,
          },
          data: { status: 'ACTIVE', version: { increment: 1 } },
        });
        if (update.count !== 1) throw new Error('SUPPLIER_PRODUCT_MATERIALIZE_RACE');
        await database.supplierProductSku.updateMany({
          where: { supplierProductId: supplierProduct.id },
          data: { status: 'ACTIVE' },
        });
        await database.supplierProductStatusHistory.create({
          data: {
            supplierProductId: supplierProduct.id,
            fromStatus: 'MATERIAL_APPROVED',
            toStatus: 'ACTIVE',
            event: 'ACTIVATE',
            actorIdentityId: null,
            functionalAccountId: null,
            version: command.materialVersion + 1,
          },
        });
        const value = this.toMaterialized(product);
        await this.remember(
          database,
          scope,
          command.idempotencyKey,
          command.requestHash,
          value,
        );
        return { kind: 'OK', value, replayed: false } as const;
      });
    } catch (error) {
      const existing = await this.prisma.product.findUnique({
        where: { supplierProductId: command.supplierProductId },
        include: { skus: true },
      });
      if (existing) {
        return { kind: 'OK', value: this.toMaterialized(existing), replayed: true };
      }
      throw error;
    }
  }

  async findSellableProductBySupplierProductId(
    supplierProductId: string,
  ): Promise<SellableProductSummary | null> {
    const product = await this.prisma.product.findFirst({
      where: { supplierProductId, saleStatus: 'ACTIVE' },
      select: { id: true, supplierProductId: true, saleStatus: true, _count: { select: { skus: true } } },
    });
    return product
      ? {
          productId: product.id,
          supplierProductId: product.supplierProductId,
          saleStatus: 'ACTIVE',
          skuCount: product._count.skus,
        }
      : null;
  }

  private async replay<T>(
    database: TransactionClient,
    scope: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<SupplierProductMutationResult<T> | null> {
    const command = await database.supplierProductCommand.findUnique({
      where: { scope_idempotencyKey: { scope, idempotencyKey } },
      select: { requestHash: true, responseSnapshot: true },
    });
    if (!command) return null;
    if (command.requestHash !== requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', value: parseStored<T>(command.responseSnapshot), replayed: true };
  }

  private async remember(
    database: TransactionClient,
    scope: string,
    idempotencyKey: string,
    requestHash: string,
    value: unknown,
  ): Promise<void> {
    await database.supplierProductCommand.create({
      data: {
        scope,
        idempotencyKey,
        requestHash,
        responseSnapshot: asInputJson(value),
      },
    });
  }

  private toMaterialized(value: {
    readonly id: string;
    readonly supplierProductId: string;
    readonly saleStatus: 'ACTIVE' | 'OFF_SHELF' | 'ARCHIVED';
    readonly skus: readonly { readonly id: string }[];
  }): MaterializedProductRecord {
    if (value.saleStatus !== 'ACTIVE') throw new Error('PRODUCT_NOT_ACTIVE');
    return {
      productId: value.id,
      supplierProductId: value.supplierProductId,
      saleStatus: 'ACTIVE',
      skuIds: value.skus.map(({ id }) => id),
    };
  }
}
