import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canEnterpriseApplicantEdit,
  canEnterpriseApplicantSubmit,
  isValidCreditCode,
  maskBankAccount,
  maskCreditCode,
  maskMobile,
  resolveEnterpriseNextAction,
  resolveEnterpriseReviewStatus,
} from '../../dist/enterprise-onboarding/enterprise-onboarding.policy.js';

test('enterprise onboarding freezes legal applicant and reviewer transitions', () => {
  assert.equal(canEnterpriseApplicantEdit('DRAFT'), true);
  assert.equal(canEnterpriseApplicantEdit('CORRECTION_REQUIRED'), true);
  assert.equal(canEnterpriseApplicantEdit('PENDING_REVIEW'), false);
  assert.equal(canEnterpriseApplicantSubmit('ACTIVE'), false);
  assert.equal(resolveEnterpriseReviewStatus('PENDING_REVIEW', 'APPROVE'), 'ACTIVE');
  assert.equal(
    resolveEnterpriseReviewStatus('PENDING_REVIEW', 'REQUEST_CORRECTION'),
    'CORRECTION_REQUIRED',
  );
  assert.equal(resolveEnterpriseReviewStatus('DRAFT', 'APPROVE'), null);
  assert.equal(resolveEnterpriseNextAction('ACTIVE'), 'ENTER_WORKSPACE');
  assert.equal(resolveEnterpriseNextAction('SUSPENDED'), 'CONTACT_SUPPORT');
});

test('enterprise identifiers validate and sensitive fields use response masks', () => {
  assert.equal(isValidCreditCode('91320100MA1ABC2D3X'), true);
  assert.equal(isValidCreditCode('91320100MA1ABCI23X'), false);
  assert.equal(maskCreditCode('91320100MA1ABC2D3X'), '9132**********2D3X');
  assert.equal(maskMobile('13800138000'), '138****8000');
  assert.equal(maskBankAccount('6222 0202 0202 0202 020'), '**** **** **** 2020');
});
