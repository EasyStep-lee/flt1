import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import { COMPANY_LEGAL_NAME, PLATFORM_NAME } from '../merchant/single-merchant.service.js';
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
  SupplierProductMutationResult,
  SupplierProductRecord,
  SupplierProductRepository,
  SupplierInitialPricingProductRecord,
} from './supplier-product.repository.js';

type TransactionClient = Prisma.TransactionClient;

type ApprovalDecisionRollbackKind =
  | 'APPROVAL_STATE_INVALID'
  | 'APPROVAL_VERSION_CONFLICT'
  | 'AUDIT_REQUIRED';

class ApprovalDecisionRollback extends Error {
  readonly kind: ApprovalDecisionRollbackKind;

  constructor(kind: ApprovalDecisionRollbackKind) {
    super(kind);
    this.kind = kind;
  }
}

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

  replayMutation<T>(
    scope: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<SupplierProductMutationResult<T> | null> {
    return this.replay<T>(this.prisma, scope, idempotencyKey, requestHash);
  }

  async categoryIsReferenced(categoryId: string): Promise<boolean> {
    const [supplierProduct, product] = await Promise.all([
      this.prisma.supplierProduct.findFirst({
        where: { categoryId },
        select: { id: true },
      }),
      this.prisma.product.findFirst({ where: { categoryId }, select: { id: true } }),
    ]);
    return Boolean(supplierProduct || product);
  }

  async findCategoryAssignment(
    supplierProductId: string,
    supplierId?: string,
  ): Promise<{
    readonly categoryId: string;
    readonly supplierId: string;
    readonly templateVersion: number;
  } | null> {
    return this.prisma.supplierProduct.findFirst({
      where: {
        id: supplierProductId,
        ...(supplierId === undefined ? {} : { supplierId }),
      },
      select: { categoryId: true, supplierId: true, templateVersion: true },
    });
  }

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
          requestSnapshot: asInputJson({
            requestId: command.requestId,
            detailSnapshot: {
              schemaVersion: '1.0',
              name: current.name,
              brand: current.brand,
              attributes: current.attributes,
              qualificationSnapshot: current.qualificationSnapshot,
            },
            afterSaleSnapshot: {
              schemaVersion: '1.0',
              policy: 'company-unified-after-sale',
            },
            deliveryRuleId: randomUUID(),
            materialReviewSnapshot: {
              name: current.name,
              brand: current.brand,
              categoryId: current.categoryId,
              templateVersion: current.templateVersion,
              attributes: current.attributes,
              qualificationReferenceCount: qualification(current.qualificationSnapshot).references.length,
              isRetailEnabled: current.isRetailEnabled,
              isEnterpriseProcurementEnabled: current.isEnterpriseProcurementEnabled,
              preparationMinutes: current.preparationMinutes,
              skus: current.skus.map((sku) => ({
                id: sku.id,
                supplierSkuCode: sku.supplierSkuCode,
                attributes: sku.attributes,
              })),
            },
          }),
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

  async stageInitialPrices(
    command: StageInitialPricesCommand,
  ): Promise<SupplierProductMutationResult<InitialPriceReviewRecord>> {
    const scope = `STAGE_INITIAL_PRICES:${command.supplierProductId}`;
    try {
      return await this.prisma.$transaction(async (database) => {
        const firstReplay = await this.replay<InitialPriceReviewRecord>(
          database,
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (firstReplay) return firstReplay;

        await database.$queryRaw<Array<{ readonly id: string }>>`
          SELECT id FROM supplier_product
          WHERE id = ${command.supplierProductId}
          FOR UPDATE
        `;

        const replay = await this.replay<InitialPriceReviewRecord>(
          database,
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
        const product = await database.supplierProduct.findUnique({
          where: { id: command.supplierProductId },
          include: { skus: true },
        });
        if (!product || product.supplierId !== command.supplierId) {
          return { kind: 'NOT_FOUND' } as const;
        }
        if (
          !['PENDING_MATERIAL_REVIEW', 'MATERIAL_APPROVED'].includes(product.status)
        ) {
          return { kind: 'STATE_INVALID' } as const;
        }
        const priceByCode = new Map(
          command.prices.map((price) => [price.supplierSkuCode, price]),
        );
        if (
          command.prices.length !== product.skus.length ||
          priceByCode.size !== command.prices.length ||
          product.skus.some((sku) => {
            const price = priceByCode.get(sku.supplierSkuCode);
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
          return { kind: 'PRICE_INVALID' } as const;
        }
        const duplicate = await database.approvalTask.findFirst({
          where: {
            approvalType: 'PRODUCT_INITIAL_PRICE',
            objectType: 'SUPPLIER_PRODUCT',
            objectId: product.id,
            status: 'PENDING',
          },
          select: { id: true },
        });
        if (duplicate) return { kind: 'DUPLICATE' } as const;
        const prices = product.skus.map((sku) => ({
          id: sku.id,
          ...priceByCode.get(sku.supplierSkuCode)!,
        }));
        const task = await database.approvalTask.create({
          data: {
            approvalType: 'PRODUCT_INITIAL_PRICE',
            objectType: 'SUPPLIER_PRODUCT',
            objectId: product.id,
            applicantType: 'SUPPLIER_USER',
            applicantId: command.applicantIdentityId,
            applicantFunctionalAccountId: command.applicantFunctionalAccountId,
            supplierId: product.supplierId,
            assignedAccountTypeCode: 'COMPANY_PRICE_REVIEW',
            requestSnapshot: asInputJson({ name: product.name, prices }),
            version: 1,
          },
        });
        await database.approvalTaskHistory.create({
          data: {
            approvalTaskId: task.id,
            fromStatus: null,
            toStatus: 'PENDING',
            event: 'CREATE',
            actorType: 'SUPPLIER_USER',
            actorId: command.applicantIdentityId,
            functionalAccountId: command.applicantFunctionalAccountId,
            version: 1,
          },
        });
        try {
          await database.auditLog.create({
            data: {
              actorType: 'SUPPLIER_USER',
              actorId: command.applicantIdentityId,
              supplierId: command.supplierId,
              functionalAccountId: command.applicantFunctionalAccountId,
              action: 'PRODUCT_INITIAL_PRICES_SUBMITTED',
              objectType: 'APPROVAL_TASK',
              objectId: task.id,
              beforeSnapshot: asInputJson({ status: null, version: 0 }),
              afterSnapshot: asInputJson({ status: 'PENDING', version: 1 }),
              requestId: command.requestId,
              ip: command.ip,
            },
          });
        } catch {
          throw new ApprovalDecisionRollback('AUDIT_REQUIRED');
        }
        const value: InitialPriceReviewRecord = {
          id: task.id,
          approvalType: 'PRODUCT_INITIAL_PRICE',
          supplierId: product.supplierId,
          supplierProductId: product.id,
          name: product.name,
          skus: prices,
          status: 'PENDING',
          version: 1,
          reviewOpinion: null,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        };
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
      if (error instanceof ApprovalDecisionRollback) {
        return { kind: error.kind };
      }
      const replay = await this.replay<InitialPriceReviewRecord>(
        this.prisma,
        scope,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      throw error;
    }
  }

  async listSupplierInitialPricingProducts(
    supplierId: string,
  ): Promise<readonly SupplierInitialPricingProductRecord[]> {
    const products = await this.prisma.supplierProduct.findMany({
      where: { supplierId },
      include: { skus: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    const tasks = await this.prisma.approvalTask.findMany({
      where: {
        approvalType: 'PRODUCT_INITIAL_PRICE',
        objectType: 'SUPPLIER_PRODUCT',
        objectId: { in: products.map(({ id }) => id) },
        supplierId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return products.map((product) => {
      const latest = tasks.find(({ objectId }) => objectId === product.id);
      const snapshot = latest
        ? this.parseInitialPriceSnapshot(latest.requestSnapshot)
        : null;
      const priceByCode = new Map(
        snapshot?.prices.map((price) => [price.supplierSkuCode, price]) ?? [],
      );
      return {
        supplierProductId: product.id,
        name: product.name,
        status: product.status,
        version: product.version,
        initialPriceEditable:
          ['PENDING_MATERIAL_REVIEW', 'MATERIAL_APPROVED'].includes(product.status) &&
          latest?.status !== 'PENDING',
        latestReview:
          latest && ['PENDING', 'APPROVED', 'REJECTED'].includes(latest.status)
            ? {
                id: latest.id,
                status: latest.status as 'PENDING' | 'APPROVED' | 'REJECTED',
                version: latest.version,
                submittedAt: latest.createdAt.toISOString(),
              }
            : null,
        skus: product.skus.map((sku) => {
          const submitted = priceByCode.get(sku.supplierSkuCode);
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

  async listMaterialReviews(
    companyId: string,
  ): Promise<readonly ProductMaterialReviewRecord[]> {
    const supplierIds = (
      await this.prisma.supplier.findMany({
        where: { companyId },
        select: { id: true },
      })
    ).map(({ id }) => id);
    const tasks = await this.prisma.approvalTask.findMany({
      where: {
        approvalType: 'PRODUCT_MATERIAL',
        objectType: 'SUPPLIER_PRODUCT',
        assignedAccountTypeCode: 'COMPANY_PRODUCT_OPS',
        supplierId: { in: supplierIds },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return tasks.flatMap((task) => {
      const snapshot = this.parseMaterialReviewSnapshot(task.requestSnapshot);
      if (!snapshot || !task.supplierId || !['PENDING', 'APPROVED', 'REJECTED'].includes(task.status)) return [];
      return [{
        id: task.id,
        approvalType: 'PRODUCT_MATERIAL' as const,
        supplierId: task.supplierId,
        supplierProductId: task.objectId,
        ...snapshot,
        status: task.status as ProductMaterialReviewRecord['status'],
        version: task.version,
        reviewOpinion: task.reviewOpinion,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      }];
    });
  }

  async listInitialPriceReviews(
    companyId: string,
  ): Promise<readonly InitialPriceReviewRecord[]> {
    const supplierIds = (
      await this.prisma.supplier.findMany({
        where: { companyId },
        select: { id: true },
      })
    ).map(({ id }) => id);
    const tasks = await this.prisma.approvalTask.findMany({
      where: {
        approvalType: 'PRODUCT_INITIAL_PRICE',
        objectType: 'SUPPLIER_PRODUCT',
        assignedAccountTypeCode: 'COMPANY_PRICE_REVIEW',
        supplierId: { in: supplierIds },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    const products = await this.prisma.supplierProduct.findMany({
      where: { id: { in: tasks.map(({ objectId }) => objectId) }, supplier: { companyId } },
      select: { id: true, name: true, supplierId: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    return tasks.flatMap((task) => {
      const snapshot = this.parseInitialPriceSnapshot(task.requestSnapshot);
      const product = productById.get(task.objectId);
      if (!product || !snapshot || !['PENDING', 'APPROVED', 'REJECTED'].includes(task.status)) return [];
      return [{
        id: task.id,
        approvalType: 'PRODUCT_INITIAL_PRICE' as const,
        supplierId: product.supplierId,
        supplierProductId: product.id,
        name: snapshot.name,
        skus: snapshot.prices,
        status: task.status as InitialPriceReviewRecord['status'],
        version: task.version,
        reviewOpinion: task.reviewOpinion,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      }];
    });
  }

  async decideProductApproval(
    command: DecideProductApprovalCommand,
  ): Promise<SupplierProductMutationResult<ProductApprovalDecisionRecord>> {
    const scope = `PRODUCT_APPROVAL_DECISION:${command.taskId}`;
    let result: SupplierProductMutationResult<ProductApprovalDecisionRecord>;
    try {
      result = await this.prisma.$transaction(async (database) => {
        const replay = await this.replayApproval<ProductApprovalDecisionRecord>(
          database,
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
        const task = await database.approvalTask.findUnique({ where: { id: command.taskId } });
        if (!task || task.approvalType !== command.approvalType) {
          return { kind: 'APPROVAL_NOT_FOUND' } as const;
        }
        const requiredAccountType =
          command.approvalType === 'PRODUCT_MATERIAL'
            ? 'COMPANY_PRODUCT_OPS'
            : 'COMPANY_PRICE_REVIEW';
        if (task.assignedAccountTypeCode !== requiredAccountType || !task.supplierId) {
          return { kind: 'APPROVAL_NOT_FOUND' } as const;
        }
        const owner = await database.supplier.findFirst({
          where: { id: task.supplierId, companyId: command.companyId },
          select: { id: true },
        });
        if (!owner) return { kind: 'APPROVAL_NOT_FOUND' } as const;
        if (task.version !== command.expectedVersion) {
          return { kind: 'APPROVAL_VERSION_CONFLICT' } as const;
        }
        if (task.status !== 'PENDING') return { kind: 'APPROVAL_STATE_INVALID' } as const;
        if (task.applicantId === command.actorIdentityId) {
          return { kind: 'SELF_APPROVAL_FORBIDDEN' } as const;
        }
        const product = await database.supplierProduct.findUnique({
          where: { id: task.objectId },
          include: { skus: true },
        });
        if (!product) return { kind: 'APPROVAL_NOT_FOUND' } as const;
        if (
          (command.approvalType === 'PRODUCT_MATERIAL' &&
            product.status !== 'PENDING_MATERIAL_REVIEW') ||
          (command.approvalType === 'PRODUCT_INITIAL_PRICE' &&
            !['PENDING_MATERIAL_REVIEW', 'MATERIAL_APPROVED'].includes(product.status))
        ) {
          return { kind: 'APPROVAL_STATE_INVALID' } as const;
        }
        const initialPriceSnapshot =
          command.approvalType === 'PRODUCT_INITIAL_PRICE' && command.decision === 'APPROVE'
            ? this.parseInitialPriceSnapshot(task.requestSnapshot)
            : null;
        if (
          command.approvalType === 'PRODUCT_INITIAL_PRICE' &&
          command.decision === 'APPROVE' &&
          (!initialPriceSnapshot ||
            initialPriceSnapshot.prices.length !== product.skus.length ||
            initialPriceSnapshot.prices.some(
              (price) =>
                !product.skus.some(
                  (sku) =>
                    sku.id === price.id && sku.supplierSkuCode === price.supplierSkuCode,
                ),
            ))
        ) {
          return { kind: 'APPROVAL_STATE_INVALID' } as const;
        }
        const nextStatus = command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        const updateTask = await database.approvalTask.updateMany({
          where: { id: task.id, status: 'PENDING', version: command.expectedVersion },
          data: {
            status: nextStatus,
            reviewedByType: 'COMPANY_USER',
            reviewedBy: command.actorIdentityId,
            reviewerFunctionalAccountId: command.functionalAccountId,
            reviewOpinion: command.opinion,
            version: { increment: 1 },
          },
        });
        if (updateTask.count !== 1) {
          throw new ApprovalDecisionRollback('APPROVAL_VERSION_CONFLICT');
        }

        if (command.approvalType === 'PRODUCT_MATERIAL') {
          const nextProductStatus =
            command.decision === 'APPROVE' ? 'MATERIAL_APPROVED' : 'CORRECTION_REQUIRED';
          const updateProduct = await database.supplierProduct.updateMany({
            where: {
              id: product.id,
              status: 'PENDING_MATERIAL_REVIEW',
              version: product.version,
            },
            data: { status: nextProductStatus, version: { increment: 1 } },
          });
          if (updateProduct.count !== 1) {
            throw new ApprovalDecisionRollback('APPROVAL_VERSION_CONFLICT');
          }
          await database.supplierProductStatusHistory.create({
            data: {
              supplierProductId: product.id,
              fromStatus: 'PENDING_MATERIAL_REVIEW',
              toStatus: nextProductStatus,
              event: command.decision === 'APPROVE' ? 'APPROVE_MATERIAL' : 'UPDATE',
              actorIdentityId: command.actorIdentityId,
              functionalAccountId: command.functionalAccountId,
              version: product.version + 1,
            },
          });
        } else if (initialPriceSnapshot) {
          for (const price of initialPriceSnapshot.prices) {
            const updated = await database.supplierProductSku.updateMany({
              where: {
                id: price.id,
                supplierProductId: product.id,
                supplierSkuCode: price.supplierSkuCode,
              },
              data: {
                requestedSupplyPrice: price.requestedSupplyPrice,
                requestedRetailSalePrice: price.requestedRetailSalePrice,
                requestedEnterpriseSalePrice: price.requestedEnterpriseSalePrice,
              },
            });
            if (updated.count !== 1) {
              throw new ApprovalDecisionRollback('APPROVAL_STATE_INVALID');
            }
          }
        }
        await database.approvalTaskHistory.create({
          data: {
            approvalTaskId: task.id,
            fromStatus: 'PENDING',
            toStatus: nextStatus,
            event: command.decision,
            actorType: 'COMPANY_USER',
            actorId: command.actorIdentityId,
            functionalAccountId: command.functionalAccountId,
            opinion: command.opinion,
            version: task.version + 1,
          },
        });
        try {
          await database.auditLog.create({
            data: {
              actorType: 'COMPANY_USER',
              actorId: command.actorIdentityId,
              supplierId: task.supplierId,
              functionalAccountId: command.functionalAccountId,
              action:
                command.approvalType === 'PRODUCT_MATERIAL'
                  ? 'PRODUCT_MATERIAL_REVIEW_DECIDED'
                  : 'PRODUCT_INITIAL_PRICE_REVIEW_DECIDED',
              objectType: 'APPROVAL_TASK',
              objectId: task.id,
              beforeSnapshot: asInputJson({ status: task.status, version: task.version }),
              afterSnapshot: asInputJson({
                decision: command.decision,
                status: nextStatus,
                version: task.version + 1,
              }),
              requestId: command.requestId,
              ip: command.ip,
            },
          });
        } catch {
          throw new ApprovalDecisionRollback('AUDIT_REQUIRED');
        }
        const value: ProductApprovalDecisionRecord = {
          id: task.id,
          approvalType: command.approvalType,
          supplierProductId: product.id,
          status: nextStatus,
          version: task.version + 1,
          reviewOpinion: command.opinion,
        };
        await this.rememberApproval(
          database,
          scope,
          command.idempotencyKey,
          command.requestHash,
          value,
        );
        return { kind: 'OK', value, replayed: false } as const;
      });
    } catch (error) {
      if (error instanceof ApprovalDecisionRollback) {
        result = { kind: error.kind };
      } else {
        const replay = await this.replayApproval<ProductApprovalDecisionRecord>(
          this.prisma,
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
        throw error;
      }
    }
    if (result.kind === 'APPROVAL_VERSION_CONFLICT') {
      const replay = await this.replayApproval<ProductApprovalDecisionRecord>(
        this.prisma,
        scope,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
    }
    return result;
  }

  async resolvePublicationCandidate(
    supplierProductId: string,
  ): Promise<ProductPublicationCandidate | null> {
    const [product, tasks] = await Promise.all([
      this.prisma.supplierProduct.findUnique({
        where: { id: supplierProductId },
        include: { skus: true },
      }),
      this.prisma.approvalTask.findMany({
        where: {
          objectType: 'SUPPLIER_PRODUCT',
          objectId: supplierProductId,
          approvalType: { in: ['PRODUCT_MATERIAL', 'PRODUCT_INITIAL_PRICE'] },
          status: 'APPROVED',
        },
      }),
    ]);
    const material = tasks.find(({ approvalType }) => approvalType === 'PRODUCT_MATERIAL');
    const price = tasks.find(({ approvalType }) => approvalType === 'PRODUCT_INITIAL_PRICE');
    if (
      !product ||
      product.status !== 'MATERIAL_APPROVED' ||
      !material ||
      !price ||
      product.skus.some(
        (sku) =>
          sku.requestedSupplyPrice === null ||
          sku.requestedRetailSalePrice === null ||
          sku.requestedEnterpriseSalePrice === null,
      )
    ) {
      return null;
    }
    const snapshot = this.parseMaterialPublicationSnapshot(material.requestSnapshot);
    if (!snapshot) return null;
    return {
      supplierProductId,
      materialVersion: product.version,
      priceVersion: price.version,
      idempotencyKey: `approval-materialize:${supplierProductId}:${material.version}:${price.version}`,
      requestHash: '',
      detailSnapshot: snapshot.detailSnapshot,
      afterSaleSnapshot: snapshot.afterSaleSnapshot,
      deliveryRuleId: snapshot.deliveryRuleId,
    };
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

  private parseInitialPriceSnapshot(value: Prisma.JsonValue | null): {
    readonly name: string;
    readonly prices: InitialPriceReviewRecord['skus'];
  } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = value as Record<string, Prisma.JsonValue>;
    const prices = source.prices;
    if (typeof source.name !== 'string' || !Array.isArray(prices)) return null;
    const parsed = prices.map((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
      const row = candidate as Record<string, Prisma.JsonValue>;
      if (
        typeof row.id !== 'string' ||
        typeof row.supplierSkuCode !== 'string' ||
        !Number.isSafeInteger(row.requestedSupplyPrice) ||
        !Number.isSafeInteger(row.requestedRetailSalePrice) ||
        !Number.isSafeInteger(row.requestedEnterpriseSalePrice) ||
        Number(row.requestedSupplyPrice) < 0 ||
        Number(row.requestedRetailSalePrice) < 0 ||
        Number(row.requestedEnterpriseSalePrice) < 0
      ) {
        return null;
      }
      return {
        id: row.id,
        supplierSkuCode: row.supplierSkuCode,
        requestedSupplyPrice: Number(row.requestedSupplyPrice),
        requestedRetailSalePrice: Number(row.requestedRetailSalePrice),
        requestedEnterpriseSalePrice: Number(row.requestedEnterpriseSalePrice),
      };
    });
    if (parsed.some((row) => row === null)) return null;
    return { name: source.name, prices: parsed as InitialPriceReviewRecord['skus'] };
  }

  private parseMaterialReviewSnapshot(
    value: Prisma.JsonValue | null,
  ): Omit<
    ProductMaterialReviewRecord,
    | 'approvalType'
    | 'createdAt'
    | 'id'
    | 'reviewOpinion'
    | 'status'
    | 'supplierId'
    | 'supplierProductId'
    | 'updatedAt'
    | 'version'
  > | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const root = value as Record<string, Prisma.JsonValue>;
    const candidate = root.materialReviewSnapshot;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
    const row = candidate as Record<string, Prisma.JsonValue>;
    if (
      typeof row.name !== 'string' ||
      !(row.brand === null || typeof row.brand === 'string') ||
      typeof row.categoryId !== 'string' ||
      !Number.isSafeInteger(row.templateVersion) ||
      !row.attributes ||
      typeof row.attributes !== 'object' ||
      Array.isArray(row.attributes) ||
      !Number.isSafeInteger(row.qualificationReferenceCount) ||
      typeof row.isRetailEnabled !== 'boolean' ||
      typeof row.isEnterpriseProcurementEnabled !== 'boolean' ||
      !Number.isSafeInteger(row.preparationMinutes) ||
      !Array.isArray(row.skus)
    ) {
      return null;
    }
    const skus = row.skus.map((candidateSku) => {
      if (!candidateSku || typeof candidateSku !== 'object' || Array.isArray(candidateSku)) return null;
      const sku = candidateSku as Record<string, Prisma.JsonValue>;
      if (
        typeof sku.id !== 'string' ||
        typeof sku.supplierSkuCode !== 'string' ||
        !sku.attributes ||
        typeof sku.attributes !== 'object' ||
        Array.isArray(sku.attributes)
      ) {
        return null;
      }
      return {
        id: sku.id,
        supplierSkuCode: sku.supplierSkuCode,
        attributes: structuredClone(sku.attributes) as JsonObject,
      };
    });
    if (skus.some((sku) => sku === null)) return null;
    return {
      name: row.name,
      brand: row.brand as string | null,
      categoryId: row.categoryId,
      templateVersion: Number(row.templateVersion),
      attributes: structuredClone(row.attributes) as JsonObject,
      qualificationReferenceCount: Number(row.qualificationReferenceCount),
      isRetailEnabled: row.isRetailEnabled,
      isEnterpriseProcurementEnabled: row.isEnterpriseProcurementEnabled,
      preparationMinutes: Number(row.preparationMinutes),
      skus: skus as ProductMaterialReviewRecord['skus'],
    };
  }

  private parseMaterialPublicationSnapshot(value: Prisma.JsonValue | null): {
    readonly detailSnapshot: JsonObject;
    readonly afterSaleSnapshot: JsonObject;
    readonly deliveryRuleId: string;
  } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, Prisma.JsonValue>;
    if (
      typeof row.deliveryRuleId !== 'string' ||
      !row.detailSnapshot ||
      typeof row.detailSnapshot !== 'object' ||
      Array.isArray(row.detailSnapshot) ||
      !row.afterSaleSnapshot ||
      typeof row.afterSaleSnapshot !== 'object' ||
      Array.isArray(row.afterSaleSnapshot)
    ) {
      return null;
    }
    return {
      detailSnapshot: structuredClone(row.detailSnapshot) as JsonObject,
      afterSaleSnapshot: structuredClone(row.afterSaleSnapshot) as JsonObject,
      deliveryRuleId: row.deliveryRuleId,
    };
  }

  private async replayApproval<T>(
    database: TransactionClient | PrismaService,
    scope: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<SupplierProductMutationResult<T> | null> {
    const command = await database.approvalTaskCommand.findUnique({
      where: { scope_idempotencyKey: { scope, idempotencyKey } },
      select: { requestHash: true, responseSnapshot: true },
    });
    if (!command) return null;
    if (command.requestHash !== requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', value: parseStored<T>(command.responseSnapshot), replayed: true };
  }

  private async rememberApproval(
    database: TransactionClient,
    scope: string,
    idempotencyKey: string,
    requestHash: string,
    value: unknown,
  ): Promise<void> {
    await database.approvalTaskCommand.create({
      data: {
        scope,
        idempotencyKey,
        requestHash,
        responseSnapshot: asInputJson(value),
      },
    });
  }

  private async replay<T>(
    database: TransactionClient | PrismaService,
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
