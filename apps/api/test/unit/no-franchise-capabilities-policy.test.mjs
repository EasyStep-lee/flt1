import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NO_FRANCHISEE_POLICY_ID,
  NoFranchiseCapabilityError,
  assertPlatformCapabilityAllowed,
  assertPlatformEntityAllowed,
} from '../../dist/governance/no-franchise-capabilities.policy.js';

test('P0-002 keeps supplier cooperation as an allowed capability', () => {
  assert.equal(NO_FRANCHISEE_POLICY_ID, 'NO_FRANCHISEE_CAPABILITIES');
  assert.doesNotThrow(() => assertPlatformCapabilityAllowed('SUPPLIER_REGISTRATION'));
});

test('NEG-M1-002-01 rejects franchisee registration or admin capabilities', () => {
  assert.throws(
    () => assertPlatformCapabilityAllowed('FRANCHISEE_REGISTRATION'),
    (error) =>
      error instanceof NoFranchiseCapabilityError &&
      error.category === 'FRANCHISEE_ROUTE' &&
      error.code === 'FORBIDDEN_CAPABILITY',
  );
});

test('NEG-M1-002-02 rejects regional revenue sharing', () => {
  assert.throws(
    () => assertPlatformCapabilityAllowed('REGIONAL_REVENUE_SHARE'),
    (error) =>
      error instanceof NoFranchiseCapabilityError &&
      error.category === 'REGIONAL_REVENUE_SHARE' &&
      error.code === 'FORBIDDEN_CAPABILITY',
  );
});

test('NEG-M1-002-03 rejects franchisee persistence entities', () => {
  assert.throws(
    () => assertPlatformEntityAllowed('Franchisee'),
    (error) =>
      error instanceof NoFranchiseCapabilityError &&
      error.category === 'FRANCHISEE_ENTITY' &&
      error.code === 'FORBIDDEN_ENTITY',
  );
});
