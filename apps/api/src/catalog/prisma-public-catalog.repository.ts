import { Inject, Injectable } from '@nestjs/common';

import { normalizeCategoryTemplateDefinition } from '../category-templates/category-template.policy.js';
import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  FindPublicCatalogProductsInput,
  PublicCatalogPageRecord,
  PublicCatalogProductDetailRecord,
  PublicCatalogRepository,
} from './public-catalog.repository.js';

@Injectable()
export class PrismaPublicCatalogRepository implements PublicCatalogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async isActiveSupplierSource(supplierId: string): Promise<boolean> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        status: 'ACTIVE',
        company: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    return supplier !== null;
  }

  async findSellableProductDetail(
    productId: string,
  ): Promise<PublicCatalogProductDetailRecord | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        template: true,
        skus: {
          include: { supplierProductSku: true },
          orderBy: [{ currentRetailSalePrice: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!product) return null;
    const asObject = (value: unknown): Readonly<Record<string, unknown>> =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? (structuredClone(value) as Readonly<Record<string, unknown>>)
        : {};
    return {
      productId: product.id,
      supplierId: product.supplierId,
      categoryId: product.categoryId,
      templateVersion: product.templateVersion,
      name: product.name,
      saleStatus: product.saleStatus,
      isRetailEnabled: product.isRetailEnabled,
      detailSnapshot: asObject(product.detailSnapshot),
      template: normalizeCategoryTemplateDefinition({
        profile:
          product.template.profile === 'FOOD' ||
          product.template.profile === 'FRESH' ||
          product.template.profile === 'APPAREL' ||
          product.template.profile === 'DIGITAL' ||
          product.template.profile === 'GIFT_BOX'
            ? product.template.profile
            : 'GENERIC',
        fieldSchema: asObject(product.template.fieldSchema),
        skuDimensions: asObject(product.template.skuDimensions),
        qualificationRules: asObject(product.template.qualificationRules),
        detailModules: asObject(product.template.detailModules),
        afterSaleRules: asObject(product.template.afterSaleRules),
      }),
      skus: product.skus.map((sku) => ({
        skuId: sku.id,
        status: sku.status,
        retailSalePrice: sku.currentRetailSalePrice,
        attributes: asObject(sku.supplierProductSku.attributes),
      })),
    };
  }

  async findSellableRetailProducts(
    input: FindPublicCatalogProductsInput,
  ): Promise<PublicCatalogPageRecord> {
    const where = {
      supplierId: input.supplierId,
      saleStatus: 'ACTIVE' as const,
      isRetailEnabled: true,
      company: { status: 'ACTIVE' as const },
      skus: { some: { status: 'ACTIVE' as const } },
      ...(input.excludeProductId
        ? { id: { not: input.excludeProductId } }
        : {}),
    };
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          supplierId: true,
          name: true,
          saleStatus: true,
          isRetailEnabled: true,
          skus: {
            where: { status: 'ACTIVE' },
            orderBy: [{ currentRetailSalePrice: 'asc' }, { id: 'asc' }],
            select: { currentRetailSalePrice: true },
          },
        },
      }),
    ]);

    return {
      total,
      items: products.map((product) => ({
        productId: product.id,
        supplierId: product.supplierId,
        name: product.name,
        saleStatus: product.saleStatus,
        isRetailEnabled: product.isRetailEnabled,
        retailSalePrice: product.skus[0]?.currentRetailSalePrice ?? -1,
        activeSkuCount: product.skus.length,
      })),
    };
  }
}
