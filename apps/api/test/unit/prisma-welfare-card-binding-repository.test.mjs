/* global structuredClone */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';

import { PrismaWelfareCardRepository } from '../../dist/welfare-card-programs/prisma-welfare-card.repository.js';
import { hashWelfareCardSecret, verifyWelfareCardSecret } from '../../dist/welfare-card-programs/welfare-card-secret.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const secret = 'issued-secret-0001';

const command = (overrides = {}) => ({
  companyId,
  consumerUserId,
  method: 'CARD_PASSWORD',
  cardNo: 'CARD-REPOSITORY-0001',
  secret,
  agreementVersion: 1,
  idempotencyKey: 'bind-repository-0001',
  requestHash: 'a'.repeat(64),
  requestId: 'request-m3-p052-repository',
  ...overrides,
});

const fixture = () => {
  const state = {
    accounts: [],
    commands: [],
    ledgers: [],
    card: {
      id: '20000000-0000-4000-8000-000000000001',
      batchId: '30000000-0000-4000-8000-000000000001',
      cardNo: 'CARD-REPOSITORY-0001',
      secretHash: hashWelfareCardSecret(secret, Buffer.alloc(16, 7)),
      amount: 8800,
      status: 'UNCLAIMED',
      claimedByConsumerUserId: null,
      claimedAt: null,
      version: 0,
      batch: {
        id: '30000000-0000-4000-8000-000000000001',
        companyId,
        programId: '40000000-0000-4000-8000-000000000001',
        batchNo: 'WCB-REPOSITORY-0001',
        agreementVersion: 1,
        status: 'ISSUED',
        program: {
          id: '40000000-0000-4000-8000-000000000001',
          name: '仓储并发福利计划',
          status: 'ACTIVE',
          complianceStatus: 'APPROVED',
        },
      },
    },
  };
  const findCommand = ({ where }) => {
    const key = where.companyId_consumerUserId_idempotencyKey;
    return state.commands.find((entry) => entry.companyId === key.companyId
      && entry.consumerUserId === key.consumerUserId && entry.idempotencyKey === key.idempotencyKey) ?? null;
  };
  const tx = {
    welfareCardBindingCommand: {
      findUnique: async (query) => findCommand(query),
      create: async ({ data }) => { state.commands.push(structuredClone(data)); return data; },
    },
    welfareCardCode: {
      findUnique: async ({ where, include }) => {
        const matched = (where.cardNo === state.card.cardNo || where.id === state.card.id) ? state.card : null;
        if (!matched) return null;
        return include ? matched : { ...matched, batch: undefined };
      },
      updateMany: async ({ where, data }) => {
        if (where.id !== state.card.id || where.status !== state.card.status || where.version !== state.card.version) return { count: 0 };
        state.card.status = data.status;
        state.card.claimedByConsumerUserId = data.claimedByConsumerUserId;
        state.card.claimedAt = data.claimedAt;
        state.card.version += data.version.increment;
        return { count: 1 };
      },
    },
    welfareCardAccount: {
      create: async ({ data }) => {
        const row = { ...structuredClone(data), createdAt: new Date(), updatedAt: new Date() };
        state.accounts.push(row);
        return row;
      },
    },
    welfareCardLedger: {
      create: async ({ data }) => { state.ledgers.push(structuredClone(data)); return data; },
    },
  };
  let tail = Promise.resolve();
  const prisma = {
    welfareCardBindingCommand: tx.welfareCardBindingCommand,
    welfareCardCode: tx.welfareCardCode,
    $transaction: async (callback) => {
      const previous = tail;
      let unlock;
      tail = new Promise((resolve) => { unlock = resolve; });
      await previous;
      try { return await callback(tx); } finally { unlock(); }
    },
  };
  return { repository: new PrismaWelfareCardRepository(prisma), state };
};

test('M3-P052 scrypt digest is salted, verifiable and never contains the plaintext credential', () => {
  const first = hashWelfareCardSecret(secret, Buffer.alloc(16, 1));
  const second = hashWelfareCardSecret(secret, Buffer.alloc(16, 2));
  assert.notEqual(first, second);
  assert.equal(first.includes(secret), false);
  assert.equal(verifyWelfareCardSecret(secret, first), true);
  assert.equal(verifyWelfareCardSecret('wrong-secret', first), false);
  assert.equal(verifyWelfareCardSecret(secret, 'malformed'), false);
});

test('M3-P052 Prisma repository atomically claims once, writes one account and one immutable CLAIM entry, then replays safely', async () => {
  const { repository, state } = fixture();
  const first = await repository.bindCard(command());
  assert.equal(first.kind, 'OK');
  assert.equal(first.replayed, false);
  assert.equal(state.card.status, 'CLAIMED');
  assert.equal(state.card.claimedByConsumerUserId, consumerUserId);
  assert.equal(state.accounts.length, 1);
  assert.equal(state.ledgers.length, 1);
  assert.deepEqual(
    { businessType: state.ledgers[0].businessType, direction: state.ledgers[0].direction, amount: state.ledgers[0].amount },
    { businessType: 'CLAIM', direction: 'CREDIT', amount: 8800 },
  );
  assert.equal(JSON.stringify(state).includes(secret), false);
  assert.equal(state.commands[0].requestId, 'request-m3-p052-repository');

  const replay = await repository.bindCard(command());
  assert.equal(replay.kind, 'OK');
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, first.value);
  assert.equal(state.accounts.length, 1);
  assert.equal(state.ledgers.length, 1);
  assert.equal((await repository.bindCard(command({ requestHash: 'b'.repeat(64) }))).kind, 'IDEMPOTENCY_CONFLICT');
});

test('M3-P052 concurrent distinct commands produce exactly one claimant and no duplicate credit', async () => {
  const { repository, state } = fixture();
  const results = await Promise.all([
    repository.bindCard(command({ idempotencyKey: 'concurrent-a', requestHash: 'c'.repeat(64) })),
    repository.bindCard(command({ idempotencyKey: 'concurrent-b', requestHash: 'd'.repeat(64) })),
  ]);
  assert.deepEqual(results.map((entry) => entry.kind).sort(), ['CARD_ALREADY_CLAIMED', 'OK']);
  assert.equal(state.accounts.length, 1);
  assert.equal(state.ledgers.length, 1);
});

test('M3-P052 wrong secret has no state, account, command or ledger side effect', async () => {
  const { repository, state } = fixture();
  const result = await repository.bindCard(command({ secret: 'wrong-secret-0001' }));
  assert.deepEqual(result, { kind: 'CARD_CODE_INVALID', reason: 'CREDENTIAL' });
  assert.equal(state.card.status, 'UNCLAIMED');
  assert.equal(state.accounts.length, 0);
  assert.equal(state.ledgers.length, 0);
  assert.equal(state.commands.length, 0);
});
