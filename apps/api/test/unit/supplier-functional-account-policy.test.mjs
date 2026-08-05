import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FunctionalAccountPolicyError,
  SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES,
  assertAccountAssignment,
  assertAccountWorkspace,
  assertSecondVerification,
  resolveFunctionalAccountTransition,
} from '../../dist/supplier-functional-accounts/supplier-functional-account.policy.js';

test('P0-005 freezes eight distinct supplier account types and workspace routes', () => {
  assert.equal(SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.length, 8);
  assert.equal(
    new Set(SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.map(({ code }) => code)).size,
    8,
  );
  assert.equal(
    new Set(SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.map(({ workspaceRoute }) => workspaceRoute)).size,
    8,
  );
  assert.deepEqual(
    SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.map(({ code }) => code),
    [
      'SUPPLIER_ACCOUNT_ADMIN',
      'SUPPLIER_PRODUCT',
      'SUPPLIER_PRICING',
      'SUPPLIER_INVENTORY',
      'SUPPLIER_FULFILLMENT',
      'SUPPLIER_AFTERSALES',
      'SUPPLIER_FINANCE',
      'SUPPLIER_AUDIT',
    ],
  );
});

test('NEG-M1-005-01 rejects a non-account-admin workspace', () => {
  assert.throws(
    () => assertAccountWorkspace('SUPPLIER_PRICING'),
    (error) =>
      error instanceof FunctionalAccountPolicyError &&
      error.code === 'WORKSPACE_FORBIDDEN',
  );
});

test('NEG-M1-005-02 rejects self privilege escalation', () => {
  assert.throws(
    () =>
      assertAccountAssignment({
        actorAccountTypeCode: 'SUPPLIER_PRICING',
        actorIdentityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        targetAccountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
        targetIdentityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    (error) =>
      error instanceof FunctionalAccountPolicyError &&
      error.code === 'ACCOUNT_TYPE_INVALID',
  );
});

test('NEG-M1-005-03 keeps the last active owner administrator active', () => {
  assert.throws(
    () =>
      resolveFunctionalAccountTransition('ACTIVE', 'SUSPEND', {
        activeOwnerAdminCount: 1,
        targetAccountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
      }),
    (error) =>
      error instanceof FunctionalAccountPolicyError &&
      error.code === 'STATE_TRANSITION_INVALID',
  );
});

test('NEG-M1-005-04 requires second verification before a sensitive change', () => {
  assert.throws(
    () => assertSecondVerification(false),
    (error) =>
      error instanceof FunctionalAccountPolicyError &&
      error.code === 'SECOND_VERIFICATION_REQUIRED' &&
      error.statusCode === 428,
  );
});

