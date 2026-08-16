import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaWelfareCardRepository } from '../../dist/welfare-card-programs/prisma-welfare-card.repository.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const base = {
  id: '20000000-0000-4000-8000-000000000001', consumerUserId,
  programId: '30000000-0000-4000-8000-000000000001', batchId: '40000000-0000-4000-8000-000000000001',
  balanceAmount: 9_000, frozenAmount: 1_000, status: 'ACTIVE', version: 2,
  createdAt: new Date(1), updatedAt: new Date(2),
  program: {
    name: '仓储资格计划', scopeType: 'CATEGORY',
    scopeRules: { schemaVersion: 1, includedIds: ['50000000-0000-4000-8000-000000000001'], excludedIds: [] },
    canPayDeliveryFee: false,
  },
  batch: { batchNo: 'WCB-ELIGIBILITY-REPO' },
  cardCode: { cardNo: 'CARD-ELIGIBILITY-REPO', claimedAt: new Date(3) },
};

test('M3-P053 Prisma eligibility query scopes owner, company and active issuance before returning a whitelist record', async () => {
  let query;
  const prisma = {
    welfareCardAccount: {
      findMany: async (value) => { query = value; return [base, { ...base, id: '20000000-0000-4000-8000-000000000002', cardCode: { ...base.cardCode, claimedAt: null } }]; },
    },
  };
  const repository = new PrismaWelfareCardRepository(prisma);
  const result = await repository.listEligibilityAccounts(companyId, consumerUserId);
  assert.deepEqual(query.where, {
    consumerUserId,
    status: 'ACTIVE',
    program: { companyId, status: 'ACTIVE', complianceStatus: 'APPROVED' },
    batch: { companyId, status: 'ISSUED' },
  });
  assert.deepEqual(query.include, { program: true, batch: true, cardCode: true });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    id: base.id, companyId, consumerUserId, programId: base.programId, programName: '仓储资格计划',
    batchId: base.batchId, batchNo: 'WCB-ELIGIBILITY-REPO', cardNo: 'CARD-ELIGIBILITY-REPO',
    balanceAmount: 9_000, frozenAmount: 1_000, status: 'ACTIVE', version: 2,
    claimedAt: new Date(3).toISOString(), scopeType: 'CATEGORY',
    scopeRules: base.program.scopeRules, canPayDeliveryFee: false,
  });
  assert.equal('welfareCardLedger' in prisma, false);
});
