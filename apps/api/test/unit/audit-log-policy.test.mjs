import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REQUIRED_SENSITIVE_AUDIT_ACTIONS,
  assertAuditRequestId,
  sanitizeAuditSnapshot,
} from '../../dist/audit/audit-log.policy.js';

test('M1-P045 freezes the required sensitive audit action vocabulary', () => {
  assert.deepEqual(REQUIRED_SENSITIVE_AUDIT_ACTIONS, [
    'refund.approved',
    'product.force_unpublished',
    'supplier.bank_account.changed',
    'supplier.payment.marked',
  ]);
});

test('NEG-M1-045-03 and 04 require a server-bound UUID request id', () => {
  assert.equal(
    assertAuditRequestId('11111111-1111-4111-8111-111111111111'),
    '11111111-1111-4111-8111-111111111111',
  );
  for (const value of [undefined, '', 'client-actor', 'not-a-uuid']) {
    assert.throws(() => assertAuditRequestId(value), {
      code: 'REQUEST_ID_REQUIRED',
    });
  }
});

test('audit snapshots mask contact and bank data and redact secrets and supply price', () => {
  assert.deepEqual(
    sanitizeAuditSnapshot({
      mobile: '13900139000',
      email: 'buyer@example.test',
      bankAccount: '6222021234567890',
      token: 'secret-token',
      supplyPrice: 12345,
      nested: { displayName: '商品运营员', password: 'secret' },
    }),
    {
      mobile: '***9000',
      email: 'b***@example.test',
      bankAccount: '***7890',
      token: '[REDACTED]',
      supplyPrice: '[REDACTED]',
      nested: { displayName: '商品运营员', password: '[REDACTED]' },
    },
  );
});
