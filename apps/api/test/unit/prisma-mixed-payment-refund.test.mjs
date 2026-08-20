import assert from 'node:assert/strict';
import test from 'node:test';

const refundId = '81000000-0000-4000-8000-000000000001';
const orderId = '70000000-0000-4000-8000-000000000001';
const accountId = '60000000-0000-4000-8000-000000000001';

const fixture = ({ failAtEvent = false, accountStatus = 'SUSPENDED' } = {}) => {
  const state = {
    refund: {
      id: refundId,
      orderId,
      refundNo: 'RF202608200000000001',
      welfareCardRefundAmount: 901,
      cashRefundAmount: 1999,
      status: 'PROCESSING',
      welfareChannelStatus: 'PROCESSING',
      wechatChannelStatus: 'PENDING',
      version: 1,
      order: { welfareCardAccountId: accountId },
    },
    account: {
      id: accountId,
      balanceAmount: 3000,
      frozenAmount: 120,
      status: accountStatus,
      version: 7,
    },
    ledgers: [],
    events: [],
  };
  const clone = (value) => globalThis.structuredClone(value);
  const tx = {
    refundTransaction: {
      findUnique: async ({ where }) => where.id === state.refund.id ? clone(state.refund) : null,
      updateMany: async ({ where, data }) => {
        if (
          where.id !== state.refund.id ||
          where.version !== state.refund.version ||
          where.welfareChannelStatus !== state.refund.welfareChannelStatus
        ) return { count: 0 };
        state.refund.welfareChannelStatus = data.welfareChannelStatus;
        state.refund.status = data.status;
        state.refund.version += data.version.increment;
        return { count: 1 };
      },
    },
    welfareCardAccount: {
      findUnique: async ({ where }) => where.id === state.account.id ? clone(state.account) : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== state.account.id || where.version !== state.account.version) return { count: 0 };
        state.account.balanceAmount += data.balanceAmount.increment;
        state.account.version += data.version.increment;
        return { count: 1 };
      },
    },
    welfareCardLedger: {
      findFirst: async ({ where }) => clone(state.ledgers.find((ledger) =>
        ledger.accountId === where.accountId &&
        ledger.refundId === where.refundId &&
        ledger.businessType === where.businessType,
      ) ?? null),
      create: async ({ data }) => {
        if (state.ledgers.some((ledger) => ledger.accountId === data.accountId && ledger.idempotencyKey === data.idempotencyKey)) {
          const duplicate = new Error('duplicate ledger');
          duplicate.code = 'P2002';
          throw duplicate;
        }
        state.ledgers.push(clone(data));
        return clone(data);
      },
    },
    refundTransactionEvent: {
      create: async ({ data }) => {
        if (failAtEvent) throw new Error('SIMULATED_REFUND_EVENT_FAILURE');
        state.events.push(clone(data));
        return clone(data);
      },
    },
  };
  const prisma = {
    $transaction: async (callback) => {
      const before = clone(state);
      try { return await callback(tx); }
      catch (error) {
        state.refund = before.refund;
        state.account = before.account;
        state.ledgers = before.ledgers;
        state.events = before.events;
        throw error;
      }
    },
  };
  return { prisma, state };
};

const command = (overrides = {}) => ({
  refundId,
  refundNo: 'RF202608200000000001',
  refundAmount: 901,
  originalWelfareCardAccountId: accountId,
  requestId: 'request-m3-p058-0001',
  ...overrides,
});

test('M3-P058 credits the original inactive welfare account and appends one REFUND/CREDIT ledger atomically', async () => {
  const { PrismaWelfareRefundAdapter } = await import('../../dist/refunds/prisma-welfare-refund.adapter.js');
  const { prisma, state } = fixture();
  const adapter = new PrismaWelfareRefundAdapter(prisma);

  assert.deepEqual(await adapter.refund(command()), { kind: 'SUCCEEDED' });
  assert.equal(state.account.status, 'SUSPENDED');
  assert.equal(state.account.balanceAmount, 3901);
  assert.equal(state.account.frozenAmount, 120);
  assert.equal(state.ledgers.length, 1);
  assert.deepEqual({
    accountId: state.ledgers[0].accountId,
    refundId: state.ledgers[0].refundId,
    businessType: state.ledgers[0].businessType,
    direction: state.ledgers[0].direction,
    amount: state.ledgers[0].amount,
    beforeBalance: state.ledgers[0].beforeBalance,
    afterBalance: state.ledgers[0].afterBalance,
  }, {
    accountId,
    refundId,
    businessType: 'REFUND',
    direction: 'CREDIT',
    amount: 901,
    beforeBalance: 3000,
    afterBalance: 3901,
  });
  assert.equal(state.refund.welfareChannelStatus, 'SUCCEEDED');
  assert.equal(state.refund.status, 'PARTIAL_CHANNEL_DONE');
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].event, 'WELFARE_REFUND_APPLIED');
});

test('M3-P058 replays a completed refund without a second balance or ledger mutation', async () => {
  const { PrismaWelfareRefundAdapter } = await import('../../dist/refunds/prisma-welfare-refund.adapter.js');
  const { prisma, state } = fixture({ accountStatus: 'ACTIVE' });
  const adapter = new PrismaWelfareRefundAdapter(prisma);
  await adapter.refund(command());
  assert.deepEqual(await adapter.refund(command()), { kind: 'SUCCEEDED' });
  assert.equal(state.account.balanceAmount, 3901);
  assert.equal(state.ledgers.length, 1);
  assert.equal(state.events.length, 1);
});

test('M3-P058 rejects a client-visible target mismatch and never redirects the refund', async () => {
  const { PrismaWelfareRefundAdapter } = await import('../../dist/refunds/prisma-welfare-refund.adapter.js');
  const { RefundAdapterError } = await import('../../dist/refunds/refund.adapter.js');
  const { prisma, state } = fixture();
  const adapter = new PrismaWelfareRefundAdapter(prisma);
  await assert.rejects(
    adapter.refund(command({ originalWelfareCardAccountId: '60000000-0000-4000-8000-000000000099' })),
    (error) => error instanceof RefundAdapterError && error.code === 'REFUND_CHANNEL_REJECTED',
  );
  assert.equal(state.account.balanceAmount, 3000);
  assert.equal(state.ledgers.length, 0);
});

test('M3-P058 rolls back the account, ledger and refund status when the audit event fails late', async () => {
  const { PrismaWelfareRefundAdapter } = await import('../../dist/refunds/prisma-welfare-refund.adapter.js');
  const { prisma, state } = fixture({ failAtEvent: true });
  const adapter = new PrismaWelfareRefundAdapter(prisma);
  await assert.rejects(adapter.refund(command()), /SIMULATED_REFUND_EVENT_FAILURE/u);
  assert.equal(state.account.balanceAmount, 3000);
  assert.equal(state.account.version, 7);
  assert.equal(state.ledgers.length, 0);
  assert.equal(state.refund.welfareChannelStatus, 'PROCESSING');
  assert.equal(state.events.length, 0);
});
