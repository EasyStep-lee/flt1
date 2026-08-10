import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  evaluateNoSupplierStorefront,
  scanNoSupplierStorefrontRepository,
} from '../../scripts/check-no-supplier-storefront.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const categoryAndCode = ({ category, code }) => ({ category, code });

test('NEG-M2-009-01 detects a customer-facing supplier storefront route', () => {
  const result = evaluateNoSupplierStorefront({
    routes: [
      { source: 'synthetic-next-page', value: '/suppliers/supplier-1/storefront' },
    ],
  });

  assert.deepEqual(result.violations.map(categoryAndCode), [
    { category: 'SUPPLIER_STOREFRONT', code: 'FORBIDDEN_CAPABILITY' },
  ]);
});

test('NEG-M2-009-02 detects supplier payment fields in a public response schema', () => {
  const result = evaluateNoSupplierStorefront({
    openApiDocument: {
      components: {
        schemas: {
          PublicCatalogProductResponse: {
            properties: { supplierPaymentAccountId: { type: 'string' } },
            type: 'object',
          },
        },
      },
      paths: {},
    },
  });

  assert.deepEqual(result.violations.map(categoryAndCode), [
    { category: 'SUPPLIER_DIRECT_PAYMENT', code: 'FORBIDDEN_CAPABILITY' },
  ]);
});

test('NEG-M2-009-03 detects supplier-store cart ownership in a public schema', () => {
  const result = evaluateNoSupplierStorefront({
    openApiDocument: {
      components: {
        schemas: {
          ConsumerCartResponse: {
            properties: { supplierStoreCartId: { type: 'string' } },
            type: 'object',
          },
        },
      },
      paths: {},
    },
  });

  assert.deepEqual(result.violations.map(categoryAndCode), [
    { category: 'SUPPLIER_STORE_CART', code: 'FORBIDDEN_CAPABILITY' },
  ]);
});

test('P0-009 repository scan covers routes, OpenAPI, Prisma and migrations', async () => {
  const result = await scanNoSupplierStorefrontRepository(repositoryRoot);

  assert.equal(result.policyId, 'NO_SUPPLIER_STOREFRONT_CAPABILITIES');
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.violations, []);
  assert.ok(result.checked.applicationRouteFiles >= 1);
  assert.ok(result.checked.discoveredRoutes >= 1);
  assert.ok(result.checked.openApiPaths >= 1);
  assert.ok(result.checked.schemaFiles >= 1);
  assert.ok(result.checked.migrationFiles >= 1);
  assert.equal(path.isAbsolute(repositoryRoot), true);
});
