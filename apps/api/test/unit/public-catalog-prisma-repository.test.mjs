import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaPublicCatalogRepository } from '../../dist/catalog/prisma-public-catalog.repository.js';

const supplierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const excludedProductId = '11111111-1111-4111-8111-111111111111';

test('P0-010 Prisma query fixes supplier, company, sale status, retail channel and active SKU scope', async () => {
  const captured = {};
  const prisma = {
    supplier: {
      findFirst: async (input) => {
        captured.supplier = input;
        return { id: supplierId };
      },
    },
    product: {
      count: async (input) => {
        captured.count = input;
        return 1;
      },
      findMany: async (input) => {
        captured.findMany = input;
        return [
          {
            id: '22222222-2222-4222-8222-222222222222',
            supplierId,
            name: '有机大米礼盒',
            saleStatus: 'ACTIVE',
            isRetailEnabled: true,
            skus: [{ currentRetailSalePrice: 6990 }],
          },
        ];
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  const repository = new PrismaPublicCatalogRepository(prisma);

  assert.equal(await repository.isActiveSupplierSource(supplierId), true);
  const result = await repository.findSellableRetailProducts({
    supplierId,
    excludeProductId: excludedProductId,
    page: 2,
    pageSize: 20,
  });

  assert.deepEqual(captured.supplier.where, {
    id: supplierId,
    status: 'ACTIVE',
    company: { status: 'ACTIVE' },
  });
  assert.deepEqual({ ...captured.findMany.where, OR: undefined }, {
    supplierId,
    saleStatus: 'ACTIVE',
    isRetailEnabled: true,
    company: { status: 'ACTIVE' },
    skus: { some: { status: 'ACTIVE' } },
    id: { not: excludedProductId },
    OR: undefined,
  });
  assert.deepEqual(captured.findMany.where.OR[0], {
    template: { regulatoryMode: 'STANDARD' },
  });
  assert.equal(captured.findMany.where.OR[1].template.regulatoryMode, 'HIGH_RISK');
  assert.ok(captured.findMany.where.OR[1].qualificationValidUntil.gt instanceof Date);
  assert.equal(
    captured.findMany.where.OR[1].category.regulatedControl.is.status,
    'ENABLED',
  );
  assert.ok(
    captured.findMany.where.OR[1].category.regulatedControl.is.companyQualificationValidUntil.gt instanceof Date,
  );
  assert.equal(captured.findMany.skip, 20);
  assert.equal(captured.findMany.take, 20);
  assert.deepEqual(result, {
    total: 1,
    items: [
      {
        productId: '22222222-2222-4222-8222-222222222222',
        supplierId,
        name: '有机大米礼盒',
        saleStatus: 'ACTIVE',
        isRetailEnabled: true,
        retailSalePrice: 6990,
        activeSkuCount: 1,
      },
    ],
  });
  assert.doesNotMatch(
    JSON.stringify(captured.findMany.select),
    /approvedSupplyPrice|supplyPrice|supplierProductId|creditCode|phone|settlement/iu,
  );
});
test('P0-010 inactive or cross-company supplier source is not accepted', async () => {
  const repository = new PrismaPublicCatalogRepository({
    supplier: { findFirst: async () => null },
  });
  assert.equal(await repository.isActiveSupplierSource(supplierId), false);
});

test('P0-021 product detail query reads both customer selling prices but never the supply price', async () => {
  let captured;
  const prisma = {
    product: {
      findFirst: async (input) => {
        captured = input;
        return null;
      },
    },
  };
  const repository = new PrismaPublicCatalogRepository(prisma);
  assert.equal(await repository.findSellableProductDetail(excludedProductId), null);
  assert.equal(captured.select.skus.select.currentRetailSalePrice, true);
  assert.equal(captured.select.skus.select.currentEnterpriseSalePrice, true);
  assert.deepEqual(captured.select.skus.select.supplierProductSku, {
    select: { attributes: true },
  });
  assert.doesNotMatch(
    JSON.stringify(captured.select),
    /approvedSupplyPrice|supplyPriceVersion|supplierPayable|grossMargin/iu,
  );
});
