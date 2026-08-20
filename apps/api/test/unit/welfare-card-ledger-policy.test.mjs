import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertWelfareLedgerChain,
  fundingLedgerBusinessType,
  normalizeWelfareAdjustmentRequest,
} from '../../dist/welfare-card-ledger/welfare-card-ledger.policy.js';

const at = (sequence) => `2026-08-20T00:00:0${sequence}.000Z`;
const entry = (sequence, businessType, direction, amount, beforeBalance, afterBalance, beforeFrozen, afterFrozen) => ({
  sequence,
  businessType,
  direction,
  amount,
  beforeBalance,
  afterBalance,
  beforeFrozen,
  afterFrozen,
  occurredAt: at(sequence),
});

describe('M3-P059 welfare-card ledger policy', () => {
  it('maps the only three approved funding sources to append-only opening entries', () => {
    assert.equal(fundingLedgerBusinessType('ENTERPRISE_GRANT'), 'GRANT');
    assert.equal(fundingLedgerBusinessType('COMPANY_GIFT'), 'GIFT');
    assert.equal(fundingLedgerBusinessType('PHYSICAL_CARD_OR_CODE'), 'CLAIM');
    assert.throws(() => fundingLedgerBusinessType('PERSONAL_RECHARGE'), { code: 'PERSONAL_RECHARGE_FORBIDDEN' });
    for (const forbidden of ['CASH_RECHARGE', 'PARTNER_TOPUP', '', undefined]) {
      assert.throws(() => fundingLedgerBusinessType(forbidden), { code: 'WELFARE_FUNDING_SOURCE_INVALID' });
    }
  });

  it('accepts a continuous non-negative chain covering grant, freeze, release, capture, refund, adjustment and reversal', () => {
    const items = [
      entry(1, 'GRANT', 'CREDIT', 10_000, 0, 10_000, 0, 0),
      entry(2, 'FREEZE', 'DEBIT', 3_000, 10_000, 10_000, 0, 3_000),
      entry(3, 'RELEASE', 'CREDIT', 1_000, 10_000, 10_000, 3_000, 2_000),
      entry(4, 'CAPTURE', 'DEBIT', 2_000, 10_000, 8_000, 2_000, 0),
      entry(5, 'REFUND', 'CREDIT', 500, 8_000, 8_500, 0, 0),
      entry(6, 'ADJUSTMENT', 'DEBIT', 300, 8_500, 8_200, 0, 0),
      entry(7, 'REVERSAL', 'CREDIT', 300, 8_200, 8_500, 0, 0),
    ];
    assert.doesNotThrow(() => assertWelfareLedgerChain({ balanceAmount: 8_500, frozenAmount: 0 }, items));
  });

  it('fails closed on a sequence gap, broken before snapshot, illegal arithmetic, negative amount or account mismatch', () => {
    const opening = entry(1, 'CLAIM', 'CREDIT', 1_000, 0, 1_000, 0, 0);
    const validFreeze = entry(2, 'FREEZE', 'DEBIT', 200, 1_000, 1_000, 0, 200);
    const invalidChains = [
      [opening, { ...validFreeze, sequence: 3 }],
      [opening, { ...validFreeze, beforeBalance: 999 }],
      [opening, { ...validFreeze, afterFrozen: 199 }],
      [opening, { ...validFreeze, amount: -1 }],
    ];
    for (const items of invalidChains) {
      assert.throws(() => assertWelfareLedgerChain({ balanceAmount: 1_000, frozenAmount: 200 }, items), { code: 'WELFARE_LEDGER_INCONSISTENT' });
    }
    assert.throws(() => assertWelfareLedgerChain({ balanceAmount: 999, frozenAmount: 200 }, [opening, validFreeze]), { code: 'WELFARE_LEDGER_INCONSISTENT' });
  });

  it('normalizes finance adjustments while rejecting ownership, final balance and recharge fields', () => {
    assert.deepEqual(normalizeWelfareAdjustmentRequest({
      businessType: 'ADJUSTMENT', direction: 'DEBIT', amount: 500, reason: '线下凭证复核后更正',
    }), {
      businessType: 'ADJUSTMENT', direction: 'DEBIT', amount: 500, reversalOfLedgerId: null, reason: '线下凭证复核后更正',
    });
    assert.deepEqual(normalizeWelfareAdjustmentRequest({
      businessType: 'REVERSAL', reversalOfLedgerId: '11111111-1111-4111-8111-111111111111', reason: '冲正错误调整',
    }), {
      businessType: 'REVERSAL', direction: null, amount: null,
      reversalOfLedgerId: '11111111-1111-4111-8111-111111111111', reason: '冲正错误调整',
    });
    for (const payload of [
      { businessType: 'PERSONAL_RECHARGE', direction: 'CREDIT', amount: 100, reason: '现金充值' },
      { businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 100, reason: '更正', companyId: 'injected' },
      { businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 100, reason: '更正', afterBalance: 200 },
      { businessType: 'REVERSAL', direction: 'CREDIT', amount: 100, reversalOfLedgerId: '11111111-1111-4111-8111-111111111111', reason: '更正' },
    ]) {
      assert.throws(() => normalizeWelfareAdjustmentRequest(payload), (error) => typeof error?.code === 'string');
    }
  });
});
