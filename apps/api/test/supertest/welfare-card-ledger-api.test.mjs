import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const consumerUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const accountId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const otherAccountId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const makerIdentityId = '11111111-1111-4111-8111-111111111111';
const checkerIdentityId = '22222222-2222-4222-8222-222222222222';

const config = () => loadRuntimeConfig({
  NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
  DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
});
const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));
const clone = (value) => JSON.parse(JSON.stringify(value));

const createRepository = () => {
  const account = {
    id: accountId, companyId, consumerUserId, programId: randomUUID(), programName: '员工关怀',
    batchId: randomUUID(), batchNo: 'BATCH-001', cardNo: 'CARD-0001', balanceAmount: 1_000,
    frozenAmount: 0, status: 'ACTIVE', version: 0, claimedAt: '2026-08-20T00:00:00.000Z',
  };
  const ledgers = [{
    id: randomUUID(), accountId, sequence: 1, businessType: 'CLAIM', direction: 'CREDIT', amount: 1_000,
    beforeBalance: 0, afterBalance: 1_000, beforeFrozen: 0, afterFrozen: 0,
    orderId: null, refundId: null, adjustmentId: null, occurredAt: '2026-08-20T00:00:00.000Z',
  }];
  const adjustments = [];
  const commands = new Map();
  const ledgerValue = () => ({ account: clone(account), items: clone(ledgers) });
  return {
    listPrograms: async () => [], createProgram: async () => ({ kind: 'DUPLICATE' }),
    createBatch: async () => ({ kind: 'DUPLICATE' }), bindCard: async () => ({ kind: 'CARD_CODE_INVALID', reason: 'STATE' }),
    listEligibilityAccounts: async () => [],
    getConsumerLedger: async (scopeCompanyId, scopeConsumerId, targetAccountId) =>
      scopeCompanyId === companyId && scopeConsumerId === consumerUserId && targetAccountId === accountId
        ? { kind: 'OK', value: ledgerValue() } : { kind: 'NOT_FOUND' },
    listCompanyAccounts: async (scopeCompanyId) => scopeCompanyId === companyId ? [clone(account)] : [],
    getCompanyLedger: async (scopeCompanyId, targetAccountId) => scopeCompanyId === companyId && targetAccountId === accountId
      ? { kind: 'OK', value: ledgerValue() } : { kind: 'NOT_FOUND' },
    listAdjustments: async (scopeCompanyId) => scopeCompanyId === companyId ? clone(adjustments) : [],
    createAdjustment: async (command) => {
      const scope = `create:${command.companyId}:${command.idempotencyKey}`;
      const previous = commands.get(scope);
      if (previous) return previous.hash === command.requestHash
        ? { kind: 'OK', replayed: true, value: clone(previous.value) }
        : { kind: 'IDEMPOTENCY_CONFLICT' };
      if (command.companyId !== companyId || command.accountId !== accountId) return { kind: 'NOT_FOUND' };
      let direction = command.direction;
      let amount = command.amount;
      if (command.businessType === 'REVERSAL') {
        const original = ledgers.find((item) => item.id === command.reversalOfLedgerId && item.businessType === 'ADJUSTMENT');
        if (!original || adjustments.some((item) => item.reversalOfLedgerId === original.id)) return { kind: 'REVERSAL_INVALID' };
        direction = original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
        amount = original.amount;
      }
      const value = {
        id: randomUUID(), accountId, businessType: command.businessType, direction, amount,
        reversalOfLedgerId: command.reversalOfLedgerId, reason: command.reason, status: 'PENDING', version: 0,
        applicantIdentityId: command.actorIdentityId, applicantFunctionalAccountId: command.functionalAccountId,
        reviewerIdentityId: null, reviewerFunctionalAccountId: null, reviewOpinion: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      adjustments.push(value); commands.set(scope, { hash: command.requestHash, value: clone(value) });
      return { kind: 'OK', replayed: false, value: clone(value) };
    },
    decideAdjustment: async (command) => {
      const scope = `decide:${command.adjustmentId}:${command.idempotencyKey}`;
      const previous = commands.get(scope);
      if (previous) return previous.hash === command.requestHash
        ? { kind: 'OK', replayed: true, value: clone(previous.value) }
        : { kind: 'IDEMPOTENCY_CONFLICT' };
      const item = adjustments.find((candidate) => candidate.id === command.adjustmentId);
      if (!item || command.companyId !== companyId) return { kind: 'NOT_FOUND' };
      if (item.applicantIdentityId === command.reviewerIdentityId) return { kind: 'SAME_NATURAL_PERSON' };
      if (item.status !== 'PENDING') return { kind: 'STATE_INVALID' };
      if (item.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
      item.status = command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'; item.version += 1;
      item.reviewerIdentityId = command.reviewerIdentityId; item.reviewerFunctionalAccountId = command.functionalAccountId;
      item.reviewOpinion = command.opinion; item.updatedAt = new Date().toISOString();
      if (command.decision === 'APPROVE') {
        const afterBalance = account.balanceAmount + (item.direction === 'CREDIT' ? item.amount : -item.amount);
        if (afterBalance < account.frozenAmount) return { kind: 'INSUFFICIENT_BALANCE' };
        const ledger = {
          id: randomUUID(), accountId, sequence: ledgers.length + 1, businessType: item.businessType,
          direction: item.direction, amount: item.amount, beforeBalance: account.balanceAmount, afterBalance,
          beforeFrozen: account.frozenAmount, afterFrozen: account.frozenAmount, orderId: null, refundId: null,
          adjustmentId: item.id, occurredAt: new Date().toISOString(),
        };
        account.balanceAmount = afterBalance; account.version += 1; ledgers.push(ledger);
      }
      commands.set(scope, { hash: command.requestHash, value: clone(item) });
      return { kind: 'OK', replayed: false, value: clone(item) };
    },
    snapshot: () => clone({ account, adjustments, ledgers }),
  };
};

const applications = [];
const fixture = async () => {
  const repository = createRepository();
  const app = await createApplication({
    config: config(), probes: probes(), welfareCardRepository: repository,
    welfareCardActorResolver: { resolve: async () => ({ role: 'COMPANY_WELFARE_CARD', companyId, identityId: randomUUID(), functionalAccountId: randomUUID() }) },
    orderActorResolver: {
      resolveConsumer: async (cookie) => cookie === 'consumer=active' ? { kind: 'CONSUMER', companyId, consumerUserId, status: 'ACTIVE' } : null,
      resolveEnterprise: async () => null,
    },
    companyFinanceActorResolver: {
      resolve: async (cookie) => cookie === 'finance=maker' || cookie === 'finance=checker'
        ? {
          accountTypeCode: 'COMPANY_FINANCE', companyId,
          functionalAccountId: cookie === 'finance=maker' ? randomUUID() : randomUUID(),
          identityId: cookie === 'finance=maker' ? makerIdentityId : checkerIdentityId,
          workspaceRoute: '/company-admin/workspaces/finance',
        } : null,
    },
    companySecondVerifier: { verify: async ({ code }) => code === '2468' },
    logger: false,
  });
  await app.init(); applications.push(app); return { app, repository };
};
afterEach(async () => Promise.all(applications.splice(0).map((app) => app.close())));

describe('M3-P059 welfare-card ledger API', () => {
  it('returns only the current consumer account ledger whitelist and fails closed on wrong ownership', async () => {
    const { app } = await fixture();
    const response = await request(app.getHttpServer()).get(`/v1/consumer/welfare-card-accounts/${accountId}/ledger`)
      .set('Cookie', 'consumer=active').expect(200);
    expect(response.headers['cache-control']).toMatch(/private.*no-store/iu);
    expect(response.headers['x-robots-tag']).toMatch(/noindex/iu);
    expect(response.body).toMatchObject({
      account: { id: accountId, balanceAmount: 1_000, frozenAmount: 0, availableAmount: 1_000 },
      items: [{ sequence: 1, businessType: 'CLAIM', direction: 'CREDIT', amount: 1_000 }],
    });
    expect(JSON.stringify(response.body)).not.toMatch(/companyId|consumerUserId|functionalAccount|applicant|reviewer|"cardNo":|secret|supplyPrice/iu);
    await request(app.getHttpServer()).get(`/v1/consumer/welfare-card-accounts/${otherAccountId}/ledger`)
      .set('Cookie', 'consumer=active').expect(404).expect(({ body }) => expect(body.code).toBe('WELFARE_LEDGER_SCOPE_FORBIDDEN'));
  });

  it('keeps finance adjustment pending until a different natural person approves with second verification', async () => {
    const { app, repository } = await fixture();
    const created = await request(app.getHttpServer()).post(`/v1/company/welfare-card/accounts/${accountId}/adjustments`)
      .set('Cookie', 'finance=maker').set('Idempotency-Key', 'adjustment-create-0001')
      .send({ businessType: 'ADJUSTMENT', direction: 'DEBIT', amount: 100, reason: '财务凭证核验调整' })
      .expect(201);
    expect(created.body).toMatchObject({ accountId, businessType: 'ADJUSTMENT', direction: 'DEBIT', amount: 100, status: 'PENDING', version: 0 });
    expect(repository.snapshot()).toMatchObject({ account: { balanceAmount: 1_000 }, ledgers: [{ businessType: 'CLAIM' }] });

    await request(app.getHttpServer()).post(`/v1/company/welfare-card/adjustments/${created.body.id}/decision`)
      .set('Cookie', 'finance=maker').set('Idempotency-Key', 'adjustment-decision-same')
      .send({ decision: 'APPROVE', opinion: '同意', secondVerificationCode: '2468', version: 0 })
      .expect(403).expect(({ body }) => expect(body.code).toBe('SAME_NATURAL_PERSON_REVIEW'));
    await request(app.getHttpServer()).post(`/v1/company/welfare-card/adjustments/${created.body.id}/decision`)
      .set('Cookie', 'finance=checker').set('Idempotency-Key', 'adjustment-decision-bad-code')
      .send({ decision: 'APPROVE', opinion: '独立复核通过', secondVerificationCode: '0000', version: 0 })
      .expect(428).expect(({ body }) => expect(body.code).toBe('SECOND_VERIFICATION_REQUIRED'));

    const approved = await request(app.getHttpServer()).post(`/v1/company/welfare-card/adjustments/${created.body.id}/decision`)
      .set('Cookie', 'finance=checker').set('Idempotency-Key', 'adjustment-decision-approve')
      .send({ decision: 'APPROVE', opinion: '独立复核通过', secondVerificationCode: '2468', version: 0 })
      .expect(200);
    expect(approved.body).toMatchObject({ status: 'APPROVED', version: 1 });
    expect(repository.snapshot()).toMatchObject({
      account: { balanceAmount: 900, frozenAmount: 0 },
      ledgers: [{ businessType: 'CLAIM' }, { businessType: 'ADJUSTMENT', direction: 'DEBIT', amount: 100, beforeBalance: 1_000, afterBalance: 900 }],
    });
    const replay = await request(app.getHttpServer()).post(`/v1/company/welfare-card/adjustments/${created.body.id}/decision`)
      .set('Cookie', 'finance=checker').set('Idempotency-Key', 'adjustment-decision-approve')
      .send({ decision: 'APPROVE', opinion: '独立复核通过', secondVerificationCode: '2468', version: 0 })
      .expect(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(repository.snapshot().ledgers).toHaveLength(2);
  });

  it('serializes concurrent decisions and reverses an approved adjustment exactly once', async () => {
    const { app, repository } = await fixture();
    const created = await request(app.getHttpServer()).post(`/v1/company/welfare-card/accounts/${accountId}/adjustments`)
      .set('Cookie', 'finance=maker').set('Idempotency-Key', 'concurrent-create-0001')
      .send({ businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 250, reason: '并发复核测试' })
      .expect(201);
    const decisions = await Promise.all([
      request(app.getHttpServer()).post(`/v1/company/welfare-card/adjustments/${created.body.id}/decision`)
        .set('Cookie', 'finance=checker').set('Idempotency-Key', 'concurrent-decision-0001')
        .send({ decision: 'APPROVE', opinion: '独立复核通过', secondVerificationCode: '2468', version: 0 }),
      request(app.getHttpServer()).post(`/v1/company/welfare-card/adjustments/${created.body.id}/decision`)
        .set('Cookie', 'finance=checker').set('Idempotency-Key', 'concurrent-decision-0002')
        .send({ decision: 'APPROVE', opinion: '独立复核通过', secondVerificationCode: '2468', version: 0 }),
    ]);
    expect(decisions.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(repository.snapshot()).toMatchObject({
      account: { balanceAmount: 1_250 },
      ledgers: [{ businessType: 'CLAIM' }, { businessType: 'ADJUSTMENT', amount: 250 }],
    });

    const adjustmentLedger = repository.snapshot().ledgers[1];
    const reversal = await request(app.getHttpServer()).post(`/v1/company/welfare-card/accounts/${accountId}/adjustments`)
      .set('Cookie', 'finance=maker').set('Idempotency-Key', 'reversal-create-0001')
      .send({ businessType: 'REVERSAL', reversalOfLedgerId: adjustmentLedger.id, reason: '原调整凭证撤销' })
      .expect(201);
    expect(reversal.body).toMatchObject({ businessType: 'REVERSAL', direction: 'DEBIT', amount: 250, status: 'PENDING' });
    await request(app.getHttpServer()).post(`/v1/company/welfare-card/adjustments/${reversal.body.id}/decision`)
      .set('Cookie', 'finance=checker').set('Idempotency-Key', 'reversal-decision-0001')
      .send({ decision: 'APPROVE', opinion: '冲正依据完整', secondVerificationCode: '2468', version: 0 })
      .expect(200);
    expect(repository.snapshot()).toMatchObject({
      account: { balanceAmount: 1_000 },
      ledgers: [
        { sequence: 1, businessType: 'CLAIM' },
        { sequence: 2, businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 250 },
        { sequence: 3, businessType: 'REVERSAL', direction: 'DEBIT', amount: 250 },
      ],
    });
    await request(app.getHttpServer()).post(`/v1/company/welfare-card/accounts/${accountId}/adjustments`)
      .set('Cookie', 'finance=maker').set('Idempotency-Key', 'reversal-create-duplicate')
      .send({ businessType: 'REVERSAL', reversalOfLedgerId: adjustmentLedger.id, reason: '重复冲正' })
      .expect(409).expect(({ body }) => expect(body.code).toBe('WELFARE_REVERSAL_INVALID'));
    expect(repository.snapshot().ledgers).toHaveLength(3);
  });

  it('rejects recharge, ownership/final-balance injection and unauthenticated finance commands with zero writes', async () => {
    const { app, repository } = await fixture(); const before = repository.snapshot();
    const cases = [
      [{ businessType: 'PERSONAL_RECHARGE', direction: 'CREDIT', amount: 100, reason: '现金充值' }, 'PERSONAL_RECHARGE_FORBIDDEN'],
      [{ businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 100, reason: '更正', companyId }, 'FIELD_FORBIDDEN'],
      [{ businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 100, reason: '更正', afterBalance: 1_100 }, 'FIELD_FORBIDDEN'],
    ];
    for (const [body, code] of cases) {
      await request(app.getHttpServer()).post(`/v1/company/welfare-card/accounts/${accountId}/adjustments`)
        .set('Cookie', 'finance=maker').set('Idempotency-Key', `reject-${code}`).send(body)
        .expect(code === 'FIELD_FORBIDDEN' ? 403 : 422).expect(({ body: error }) => expect(error.code).toBe(code));
    }
    await request(app.getHttpServer()).post(`/v1/company/welfare-card/accounts/${accountId}/adjustments`)
      .set('Idempotency-Key', 'reject-unauthenticated')
      .send({ businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 100, reason: '更正' })
      .expect(401).expect(({ body }) => expect(body.code).toBe('AUTHENTICATION_REQUIRED'));
    expect(repository.snapshot()).toEqual(before);
  });
});
