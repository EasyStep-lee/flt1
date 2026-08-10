import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  FindPublicCatalogProductsInput,
  PublicCatalogPageRecord,
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
