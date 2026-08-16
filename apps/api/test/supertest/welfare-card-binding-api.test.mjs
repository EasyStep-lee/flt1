import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const consumerUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherConsumerUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const config = () => loadRuntimeConfig({
  NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
  DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
});
const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));
const clone = (value) => JSON.parse(JSON.stringify(value));

const seedCard = (cardNo, secret, overrides = {}) => ({
  id: randomUUID(), companyId, programId: '10000000-0000-4000-8000-000000000001',
  programName: '2026 员工福利', batchId: '20000000-0000-4000-8000-000000000001',
  batchNo: 'WCB-2026-ACTIVE', agreementVersion: 1, batchStatus: 'ACTIVE',
  cardNo, secret, amount: 10000, status: 'UNCLAIMED', claimedByConsumerUserId: null,
  claimedAt: null, ...overrides,
});

const createRepository = () => {
  const cards = [
    seedCard('CARD-PASSWORD', 'pw-0001'),
    seedCard('CARD-REDEMPTION', 'redeem-0002'),
    seedCard('CARD-SCAN', 'scan-0003'),
    seedCard('CARD-DISABLED', 'disabled-0004', { status: 'DISABLED' }),
    seedCard('CARD-FROZEN', 'frozen-0005', { batchStatus: 'FROZEN' }),
    seedCard('CARD-OTHER', 'other-0006', {
      status: 'CLAIMED', claimedByConsumerUserId: otherConsumerUserId,
      claimedAt: new Date(1000).toISOString(),
    }),
    seedCard('CARD-CONCURRENT', 'concurrent-0007'),
  ];
  const accounts = [];
  const ledgers = [];
  const commands = new Map();
  let tail = Promise.resolve();
  const bindCard = async (command) => {
    const previous = tail;
    let unlock;
    tail = new Promise((resolve) => { unlock = resolve; });
    await previous;
    try {
      const scopeKey = `${command.consumerUserId}:${command.idempotencyKey}`;
      const prior = commands.get(scopeKey);
      if (prior) return prior.hash === command.requestHash
        ? { kind: 'OK', replayed: true, value: clone(prior.value) }
        : { kind: 'IDEMPOTENCY_CONFLICT' };
      const card = cards.find((item) => item.companyId === command.companyId && item.cardNo === command.cardNo);
      if (!card || card.secret !== command.secret) return { kind: 'CARD_CODE_INVALID', reason: 'CREDENTIAL' };
      if (card.status === 'DISABLED' || card.status === 'EXPIRED' || card.batchStatus !== 'ACTIVE') {
        return { kind: 'CARD_CODE_INVALID', reason: 'STATE' };
      }
      if (card.status === 'CLAIMED') return card.claimedByConsumerUserId === command.consumerUserId
        ? { kind: 'CARD_ALREADY_CLAIMED' }
        : { kind: 'CARD_RECIPIENT_MISMATCH' };
      const now = new Date(2000 + accounts.length).toISOString();
      const account = {
        id: randomUUID(), companyId: command.companyId, consumerUserId: command.consumerUserId,
        programId: card.programId, programName: card.programName, batchId: card.batchId,
        batchNo: card.batchNo, cardNo: card.cardNo, balanceAmount: card.amount,
        frozenAmount: 0, status: 'ACTIVE', version: 0, claimedAt: now,
      };
      card.status = 'CLAIMED';
      card.claimedByConsumerUserId = command.consumerUserId;
      card.claimedAt = now;
      accounts.push(account);
      ledgers.push({ accountId: account.id, businessType: 'CLAIM', direction: 'CREDIT', amount: card.amount });
      commands.set(scopeKey, { hash: command.requestHash, value: clone(account) });
      return { kind: 'OK', replayed: false, value: clone(account) };
    } finally {
      unlock();
    }
  };
  return {
    listPrograms: async () => [],
    createProgram: async () => ({ kind: 'DUPLICATE' }),
    createBatch: async () => ({ kind: 'DUPLICATE' }),
    bindCard,
    snapshot: () => ({ accounts: clone(accounts), cards: clone(cards), ledgers: clone(ledgers) }),
  };
};

const applications = [];
const fixture = async () => {
  const repository = createRepository();
  let session = { kind: 'CONSUMER', companyId, consumerUserId, status: 'ACTIVE' };
  const app = await createApplication({
    config: config(), probes: probes(), welfareCardRepository: repository,
    orderActorResolver: {
      resolveConsumer: async (cookie) => cookie === '__Host-fulishe-consumer=active' ? clone(session) : null,
      resolveEnterprise: async () => null,
    },
    logger: false,
  });
  await app.init();
  applications.push(app);
  return { app, repository, setSession: (value) => { session = value; } };
};
afterEach(async () => Promise.all(applications.splice(0).map((app) => app.close())));

const bind = (app, key, body, cookie = '__Host-fulishe-consumer=active') => request(app.getHttpServer())
  .post('/v1/consumer/welfare-card-accounts/bind')
  .set('Cookie', cookie)
  .set('Idempotency-Key', key)
  .send({ agreementAccepted: true, agreementVersion: 1, ...body });
const bindingBody = (method, cardNo, credential, extra = {}) => ({ method, cardNo, secret: credential, ...extra });

describe('M3-P052 consumer welfare-card binding API', () => {
  it('binds card password, redemption code and scan result to the session owner with one CLAIM ledger each', async () => {
    const { app, repository } = await fixture();
    const cases = [
      ['CARD_PASSWORD', 'CARD-PASSWORD', 'pw-0001'],
      ['REDEMPTION_CODE', 'CARD-REDEMPTION', 'redeem-0002'],
      ['SCAN_CODE', 'CARD-SCAN', 'scan-0003'],
    ];
    for (const [method, cardNo, secret] of cases) {
      const response = await bind(app, `bind-${method}`, bindingBody(method, cardNo, secret)).expect(201);
      expect(response.headers['cache-control']).toMatch(/private.*no-store/iu);
      expect(response.headers['x-robots-tag']).toMatch(/noindex/iu);
      expect(response.body).toMatchObject({
        programName: '2026 员工福利', batchNo: 'WCB-2026-ACTIVE',
        maskedCardNo: `****${cardNo.slice(-4)}`, balanceAmount: 10000,
        frozenAmount: 0, availableAmount: 10000, status: 'ACTIVE', version: 0,
      });
      expect(JSON.stringify(response.body)).not.toMatch(/secret|consumerUserId|companyId|programId|batchId|supplier|PERSONAL_RECHARGE/iu);
    }
    expect(repository.snapshot().accounts).toHaveLength(3);
    expect(repository.snapshot().ledgers).toEqual(expect.arrayContaining([
      expect.objectContaining({ businessType: 'CLAIM', direction: 'CREDIT', amount: 10000 }),
    ]));
    expect(repository.snapshot().ledgers).toHaveLength(3);
  });

  it('rejects invalid, disabled, frozen, wrong-owner, unauthenticated and owner-injected requests without a write', async () => {
    const { app, repository } = await fixture();
    const before = repository.snapshot();
    await bind(app, 'wrong-secret', bindingBody('CARD_PASSWORD', 'CARD-PASSWORD', 'wrong-credential'))
      .expect(422).expect(({ body }) => expect(body.code).toBe('CARD_CODE_INVALID'));
    await bind(app, 'disabled-card', bindingBody('CARD_PASSWORD', 'CARD-DISABLED', 'disabled-0004'))
      .expect(409).expect(({ body }) => expect(body.code).toBe('CARD_CODE_INVALID'));
    await bind(app, 'frozen-card', bindingBody('CARD_PASSWORD', 'CARD-FROZEN', 'frozen-0005'))
      .expect(409).expect(({ body }) => expect(body.code).toBe('CARD_CODE_INVALID'));
    await bind(app, 'wrong-owner', bindingBody('REDEMPTION_CODE', 'CARD-OTHER', 'other-0006'))
      .expect(403).expect(({ body }) => expect(body.code).toBe('CARD_RECIPIENT_MISMATCH'));
    await bind(app, 'owner-injection', bindingBody('CARD_PASSWORD', 'CARD-PASSWORD', 'pw-0001', { companyId }))
      .expect(422).expect(({ body }) => expect(body.code).toBe('FIELD_FORBIDDEN'));
    await bind(app, 'missing-session', bindingBody('CARD_PASSWORD', 'CARD-PASSWORD', 'pw-0001'), 'invalid')
      .expect(401).expect(({ body }) => expect(body.code).toBe('AUTHENTICATION_REQUIRED'));
    expect(repository.snapshot()).toEqual(before);
  });

  it('replays the exact command, conflicts on changed payload and allows only one concurrent claimant', async () => {
    const { app, repository } = await fixture();
    const body = bindingBody('CARD_PASSWORD', 'CARD-PASSWORD', 'pw-0001');
    const first = await bind(app, 'exact-replay', body).expect(201);
    const replayed = await bind(app, 'exact-replay', body).expect(200);
    expect(replayed.headers['idempotency-replayed']).toBe('true');
    expect(replayed.body).toEqual(first.body);
    await bind(app, 'exact-replay', bindingBody('CARD_PASSWORD', 'CARD-PASSWORD', 'changed')).expect(409)
      .expect(({ body: error }) => expect(error.code).toBe('IDEMPOTENCY_CONFLICT'));

    const concurrent = await Promise.all([
      bind(app, 'concurrent-a', bindingBody('CARD_PASSWORD', 'CARD-CONCURRENT', 'concurrent-0007')),
      bind(app, 'concurrent-b', bindingBody('CARD_PASSWORD', 'CARD-CONCURRENT', 'concurrent-0007')),
    ]);
    expect(concurrent.map((entry) => entry.status).sort()).toEqual([201, 409]);
    expect(concurrent.find((entry) => entry.status === 409)?.body.code).toBe('CARD_ALREADY_CLAIMED');
    expect(repository.snapshot().accounts).toHaveLength(2);
    expect(repository.snapshot().ledgers).toHaveLength(2);
  });
});
