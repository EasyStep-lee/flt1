import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectSupplierSubmissionIssues,
  maskCreditCode,
  normalizeCreditCode,
  resolveSupplierTransition,
  SupplierOnboardingPolicyError,
} from '../../dist/supplier-onboarding/supplier-onboarding.policy.js';

test('P0-003 normalizes and masks a supplier credit code deterministically', () => {
  assert.equal(
    normalizeCreditCode(' 91320100ma1abc2d3x '),
    '91320100MA1ABC2D3X',
  );
  assert.equal(maskCreditCode('91320100MA1ABC2D3X'), '9132**********2D3X');
});

test('P0-003 implements only the frozen supplier state transitions', () => {
  assert.equal(resolveSupplierTransition('DRAFT', 'SUBMIT'), 'PENDING_REVIEW');
  assert.equal(
    resolveSupplierTransition('PENDING_REVIEW', 'REQUEST_CORRECTION'),
    'CORRECTION_REQUIRED',
  );
  assert.equal(
    resolveSupplierTransition('CORRECTION_REQUIRED', 'RESUBMIT'),
    'PENDING_REVIEW',
  );
  assert.equal(resolveSupplierTransition('PENDING_REVIEW', 'APPROVE'), 'ACTIVE');

  assert.throws(
    () => resolveSupplierTransition('DRAFT', 'APPROVE'),
    (error) =>
      error instanceof SupplierOnboardingPolicyError &&
      error.code === 'STATE_TRANSITION_INVALID',
  );
});

test('NEG-M1-003-04 reports qualification and pickup issues without mutating a draft', () => {
  const issues = collectSupplierSubmissionIssues({
    pickupAddress: '',
    pickupLat: null,
    pickupLng: null,
    qualificationSnapshot: { schemaVersion: '1.0', files: [] },
  });

  assert.deepEqual(
    issues.map((issue) => issue.field),
    ['qualificationFiles', 'pickupAddress', 'pickupLat', 'pickupLng'],
  );
});
