import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SUPPLIER_SCOPED_RESOURCES,
  assertSupplierExportScope,
  assertSupplierResourceScope,
} from '../../dist/supplier-scope/supplier-scope.policy.js';

const supplierA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const supplierB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const missingSupplier = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const capture = (operation) => {
  try {
    operation();
  } catch (error) {
    return error;
  }
  assert.fail('expected operation to fail');
};

test('NEG-M1-004-01 enforces the session supplier across every frozen resource family', () => {
  assert.deepEqual(SUPPLIER_SCOPED_RESOURCES, [
    'SUPPLIER_PROFILE',
    'PRODUCT',
    'ORDER',
    'INVENTORY',
    'STATEMENT',
    'ACCOUNT',
  ]);

  for (const resource of SUPPLIER_SCOPED_RESOURCES) {
    assert.equal(assertSupplierResourceScope(supplierA, supplierA, resource), supplierA);
    const error = capture(() =>
      assertSupplierResourceScope(supplierA, supplierB, resource),
    );
    assert.equal(error.statusCode, 403);
    assert.equal(error.code, 'SUPPLIER_SCOPE_FORBIDDEN');
  }
});

test('NEG-M1-004-03 rejects a mixed-supplier export before any export is created', () => {
  assert.deepEqual(
    assertSupplierExportScope(supplierA, [
      { id: 'row-a-1', supplierId: supplierA },
      { id: 'row-a-2', supplierId: supplierA },
    ]),
    [
      { id: 'row-a-1', supplierId: supplierA },
      { id: 'row-a-2', supplierId: supplierA },
    ],
  );

  const error = capture(() =>
    assertSupplierExportScope(supplierA, [
      { id: 'row-a-1', supplierId: supplierA },
      { id: 'row-b-1', supplierId: supplierB },
    ]),
  );
  assert.equal(error.statusCode, 403);
  assert.equal(error.code, 'DATA_SCOPE_FORBIDDEN');
});

test('NEG-M1-004-04 does not reveal whether a cross-supplier object exists', () => {
  const existing = capture(() =>
    assertSupplierResourceScope(supplierA, supplierB, 'SUPPLIER_PROFILE'),
  );
  const missing = capture(() =>
    assertSupplierResourceScope(supplierA, missingSupplier, 'SUPPLIER_PROFILE'),
  );

  assert.deepEqual(
    {
      statusCode: existing.statusCode,
      code: existing.code,
      message: existing.message,
    },
    {
      statusCode: missing.statusCode,
      code: missing.code,
      message: missing.message,
    },
  );
});
