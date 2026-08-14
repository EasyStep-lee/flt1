import assert from 'node:assert/strict';
import test from 'node:test';

import { allocateOriginalPaymentRefund } from '../../dist/refunds/refund-allocation.policy.js';

test('original payment refund allocation closes sequential partial refunds to the exact original split', () => {
    const first = allocateOriginalPaymentRefund({
      originalWelfareAmount: 1801,
      originalCashAmount: 3999,
      previousWelfareRefundAmount: 0,
      previousCashRefundAmount: 0,
      approvedRefundAmount: 2900,
    });
    assert.deepEqual(first, {
      kind: 'ALLOCATED',
      welfareRefundAmount: 900,
      cashRefundAmount: 2000,
      cumulativeRefundAmount: 2900,
    });
    const second = allocateOriginalPaymentRefund({
      originalWelfareAmount: 1801,
      originalCashAmount: 3999,
      previousWelfareRefundAmount: 900,
      previousCashRefundAmount: 2000,
      approvedRefundAmount: 2900,
    });
    assert.deepEqual(second, {
      kind: 'ALLOCATED',
      welfareRefundAmount: 901,
      cashRefundAmount: 1999,
      cumulativeRefundAmount: 5800,
    });
});

test('original payment refund allocation rejects over-refund and malformed prior totals', () => {
    assert.deepEqual(allocateOriginalPaymentRefund({
      originalWelfareAmount: 1800,
      originalCashAmount: 4000,
      previousWelfareRefundAmount: 900,
      previousCashRefundAmount: 2000,
      approvedRefundAmount: 2901,
    }), { kind: 'OVERPAID' });
    assert.deepEqual(allocateOriginalPaymentRefund({
      originalWelfareAmount: 1800,
      originalCashAmount: 4000,
      previousWelfareRefundAmount: 1801,
      previousCashRefundAmount: 0,
      approvedRefundAmount: 1,
    }), { kind: 'INVALID' });
});
