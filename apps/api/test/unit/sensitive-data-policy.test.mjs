import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SensitiveDataPolicyError,
  assertHighSensitivityExport,
  authorizeSensitiveFieldRead,
  omitRestrictedFields,
} from '../../dist/sensitive-data/sensitive-data.policy.js';

const actor = (overrides = {}) => ({
  ownerType: 'COMPANY',
  accountTypeCode: 'COMPANY_PRODUCT_OPS',
  workspaceRoute: '/company-admin/workspaces/product-ops',
  ...overrides,
});

const expectPolicyError = (operation, code) =>
  assert.throws(
    operation,
    (error) => error instanceof SensitiveDataPolicyError && error.code === code,
  );

test('NEG-M1-046-01 defaults sensitive field groups to FIELD_FORBIDDEN', () => {
  for (const fieldGroup of ['SUPPLY_PRICE', 'SUPPLIER_SETTLEMENT']) {
    expectPolicyError(
      () => authorizeSensitiveFieldRead(actor(), { fieldGroup }),
      'FIELD_FORBIDDEN',
    );
  }
  expectPolicyError(
    () =>
      authorizeSensitiveFieldRead(
        actor({
          ownerType: 'CONSUMER',
          accountTypeCode: 'CONSUMER_USER',
          workspaceRoute: '/pages/home/index',
        }),
        { fieldGroup: 'SUPPLY_PRICE' },
      ),
    'FIELD_FORBIDDEN',
  );
});

test('company price and finance roles receive only their frozen field groups', () => {
  assert.equal(
    authorizeSensitiveFieldRead(
      actor({
        accountTypeCode: 'COMPANY_PRICE_REVIEW',
        workspaceRoute: '/company-admin/workspaces/price-review',
      }),
      { fieldGroup: 'SUPPLY_PRICE' },
    ),
    'VISIBLE_WITH_AUDIT',
  );
  assert.equal(
    authorizeSensitiveFieldRead(
      actor({
        accountTypeCode: 'COMPANY_FINANCE',
        workspaceRoute: '/company-admin/workspaces/finance',
      }),
      { fieldGroup: 'SUPPLIER_SETTLEMENT' },
    ),
    'VISIBLE_WITH_AUDIT',
  );
  expectPolicyError(
    () =>
      authorizeSensitiveFieldRead(
        actor({
          accountTypeCode: 'COMPANY_PRICE_REVIEW',
          workspaceRoute: '/company-admin/workspaces/price-review',
        }),
        { fieldGroup: 'SUPPLIER_SETTLEMENT' },
      ),
    'FIELD_FORBIDDEN',
  );
});

test('supplier price and finance roles are limited to the server-bound supplier', () => {
  const supplierActor = actor({
    ownerType: 'SUPPLIER',
    accountTypeCode: 'SUPPLIER_PRICING',
    workspaceRoute: '/supplier/workspaces/pricing',
    supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  assert.equal(
    authorizeSensitiveFieldRead(supplierActor, {
      fieldGroup: 'SUPPLY_PRICE',
      supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }),
    'VISIBLE_WITH_AUDIT',
  );
  expectPolicyError(
    () =>
      authorizeSensitiveFieldRead(supplierActor, {
        fieldGroup: 'SUPPLY_PRICE',
        supplierId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    'FIELD_FORBIDDEN',
  );
});

test('NEG-M1-046-02 rejects a mismatched workspace before field authorization', () => {
  expectPolicyError(
    () =>
      authorizeSensitiveFieldRead(
        actor({
          accountTypeCode: 'COMPANY_FINANCE',
          workspaceRoute: '/company-admin/workspaces/price-review',
        }),
        { fieldGroup: 'SUPPLIER_SETTLEMENT' },
      ),
    'WORKSPACE_FORBIDDEN',
  );
});

test('runner sees necessary address only for its active personal fulfillment', () => {
  const runner = actor({
    ownerType: 'RUNNER',
    accountTypeCode: 'RUNNER',
    workspaceRoute: '/pages/home/index',
    runnerId: 'runner-001',
  });
  assert.equal(
    authorizeSensitiveFieldRead(runner, {
      fieldGroup: 'DELIVERY_ADDRESS',
      delivery: {
        channel: 'CONSUMER',
        assignedRunnerId: 'runner-001',
        stage: 'DELIVERING',
      },
    }),
    'MASKED',
  );
  for (const delivery of [
    { channel: 'ENTERPRISE', assignedRunnerId: 'runner-001', stage: 'DELIVERING' },
    { channel: 'CONSUMER', assignedRunnerId: 'runner-002', stage: 'DELIVERING' },
    { channel: 'CONSUMER', assignedRunnerId: 'runner-001', stage: 'DELIVERED' },
  ]) {
    expectPolicyError(
      () => authorizeSensitiveFieldRead(runner, { fieldGroup: 'DELIVERY_ADDRESS', delivery }),
      'FIELD_FORBIDDEN',
    );
  }
});

test('NEG-M1-046-03 recursively omits public supply-price and payable fields', () => {
  assert.deepEqual(
    omitRestrictedFields({
      id: 'sku-001',
      salePrice: 1299,
      supplyPrice: 899,
      nested: {
        approvedSupplyPrice: 799,
        supplierPayableAmount: 700,
        title: '福利商品',
      },
    }),
    { id: 'sku-001', salePrice: 1299, nested: { title: '福利商品' } },
  );
});

test('NEG-M1-046-04 denies high-sensitivity export without approved evidence', () => {
  const auditActor = actor({
    accountTypeCode: 'COMPANY_AUDIT',
    workspaceRoute: '/company-admin/workspaces/audit',
  });
  expectPolicyError(
    () => assertHighSensitivityExport(auditActor, { approvalStatus: 'PENDING' }),
    'EXPORT_APPROVAL_REQUIRED',
  );
  assert.doesNotThrow(() =>
    assertHighSensitivityExport(auditActor, {
      approvalStatus: 'APPROVED',
      approvalId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    }),
  );
});
