import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaWelfareCardRepository } from '../../dist/welfare-card-programs/prisma-welfare-card.repository.js';

const clone = (value) => globalThis.structuredClone(value);

test('M3-P059 account CAS conflict rolls back the prior adjustment approval mutation', async () => {
  const state = {
    account: {
      id: '30000000-0000-4000-8000-000000000059', companyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      balanceAmount: 1_000, frozenAmount: 0, ledgerSequence: 1, version: 0,
    },
    adjustment: {
      id: '59000000-0000-4000-8000-000000000001', companyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      accountId: '30000000-0000-4000-8000-000000000059', businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 100,
      reversalOfLedgerId: null, reason: '并发调整', status: 'PENDING', version: 0,
      applicantIdentityId: '11111111-1111-4111-8111-111111111111', applicantFunctionalAccountId: '41000000-0000-4000-8000-000000000001',
      reviewerIdentityId: null, reviewerFunctionalAccountId: null, reviewOpinion: null,
      createdAt: new Date(0), updatedAt: new Date(0),
    },
    ledgers: [],
  };
  const prisma = {
    welfareCardAdjustmentCommand: { findUnique: async () => null },
    $transaction: async (callback) => {
      const working = clone(state);
      const tx = {
        welfareCardAdjustment: {
          findFirst: async () => clone(working.adjustment),
          updateMany: async () => {
            working.adjustment.status = 'APPROVED'; working.adjustment.version += 1;
            return { count: 1 };
          },
        },
        welfareCardAccount: {
          findFirst: async () => clone(working.account),
          updateMany: async () => ({ count: 0 }),
        },
        welfareCardLedger: { create: async ({ data }) => { working.ledgers.push(data); return data; } },
      };
      const result = await callback(tx);
      Object.assign(state, working);
      return result;
    },
  };
  const repository = new PrismaWelfareCardRepository(prisma);
  const result = await repository.decideAdjustment({
    adjustmentId: state.adjustment.id, companyId: state.adjustment.companyId,
    decision: 'APPROVE', expectedVersion: 0, functionalAccountId: '42000000-0000-4000-8000-000000000001',
    idempotencyKey: 'decision-conflict-0001', ip: '127.0.0.1', opinion: '独立复核',
    requestHash: 'a'.repeat(64), requestId: '43000000-0000-4000-8000-000000000001',
    reviewerIdentityId: '22222222-2222-4222-8222-222222222222',
  });
  assert.deepEqual(result, { kind: 'VERSION_CONFLICT' });
  assert.equal(state.adjustment.status, 'PENDING');
  assert.equal(state.adjustment.version, 0);
  assert.equal(state.account.balanceAmount, 1_000);
  assert.equal(state.ledgers.length, 0);
});
