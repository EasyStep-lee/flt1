import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const enterpriseCustomerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actor = {
  role: 'COMPANY_WELFARE_CARD', companyId,
  identityId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  functionalAccountId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
};

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
  const programs = [];
  const batches = [];
  const commands = new Map();
  const replay = (command, create) => {
    const previous = commands.get(command.idempotencyKey);
    if (previous) return previous.hash === command.requestHash
      ? { kind: 'OK', replayed: true, value: clone(previous.value) }
      : { kind: 'IDEMPOTENCY_CONFLICT' };
    const value = create();
    commands.set(command.idempotencyKey, { hash: command.requestHash, value: clone(value) });
    return { kind: 'OK', replayed: false, value: clone(value) };
  };
  return {
    listPrograms: async (currentCompanyId) => programs
      .filter((program) => program.companyId === currentCompanyId)
      .map((program) => ({ ...clone(program), batches: batches.filter((batch) => batch.programId === program.id).map(clone) })),
    createProgram: async (command) => replay(command, () => {
      if (programs.some((program) => program.companyId === command.companyId && program.name === command.name)) return { duplicate: true };
      const now = new Date(0).toISOString();
      const value = {
        id: randomUUID(), companyId: command.companyId, name: command.name,
        fundingType: command.fundingType, issuerType: 'COMPANY',
        scopeType: command.scopeType, scopeRules: command.scopeRules,
        canPayDeliveryFee: command.canPayDeliveryFee, refundPolicy: command.refundPolicy,
        complianceStatus: 'DRAFT', status: 'DRAFT', version: 0,
        createdAt: now, updatedAt: now, history: [{ event: 'PROGRAM_CREATED', resultingVersion: 0, occurredAt: now }],
      };
      programs.push(value);
      return value;
    }),
    createBatch: async (command) => {
      const program = programs.find((item) => item.id === command.programId && item.companyId === command.companyId);
      if (!program) return { kind: 'NOT_FOUND' };
      return replay(command, () => {
        if (batches.some((batch) => batch.companyId === command.companyId && batch.batchNo === command.batchNo)) return { duplicate: true };
        const now = new Date(1000).toISOString();
        const value = {
          id: randomUUID(), companyId: command.companyId, programId: command.programId,
          enterpriseCustomerId: command.enterpriseCustomerId, batchNo: command.batchNo,
          totalAmount: command.totalAmount, unitAmount: command.unitAmount,
          issueCount: command.issueCount, claimMode: command.claimMode,
          agreementVersion: command.agreementVersion, status: 'DRAFT', version: 0,
          createdAt: now, history: [{ event: 'BATCH_CREATED', resultingVersion: 0, occurredAt: now }],
        };
        batches.push(value);
        return value;
      });
    },
    snapshot: () => ({ programs: clone(programs), batches: clone(batches) }),
  };
};

const applications = [];
const fixture = async () => {
  const repository = createRepository();
  const currentActor = { ...actor };
  const app = await createApplication({
    config: config(), probes: probes(), welfareCardRepository: repository,
    welfareCardActorResolver: { resolve: async () => ({ ...currentActor }) }, logger: false,
  });
  await app.init();
  applications.push(app);
  return { app, currentActor, repository };
};
afterEach(async () => Promise.all(applications.splice(0).map((app) => app.close())));

const planBody = {
  name: '2026 中秋企业福利计划', fundingType: 'ENTERPRISE_GRANT',
  scopeType: 'ALL_PRODUCTS', scopeRules: { schemaVersion: 1, includedIds: [], excludedIds: [] },
  canPayDeliveryFee: false, refundPolicy: '按原福利卡账户退回，异常进入人工复核',
};

describe('M3-P051 welfare-card program and batch API', () => {
  it('creates and lists one company-owned DRAFT program with exact-head idempotency and a strict DTO', async () => {
    const { app, repository } = await fixture();
    const create = () => request(app.getHttpServer()).post('/v1/company/welfare-card/programs')
      .set('Idempotency-Key', 'program-enterprise-2026').send(planBody);
    const first = await create().expect(201);
    expect(first.body).toMatchObject({
      name: planBody.name, fundingType: 'ENTERPRISE_GRANT', issuerType: 'COMPANY',
      complianceStatus: 'DRAFT', status: 'DRAFT', version: 0,
    });
    const replayed = await create().expect(201);
    expect(replayed.headers['idempotency-replayed']).toBe('true');
    expect(replayed.body).toEqual(first.body);
    await request(app.getHttpServer()).post('/v1/company/welfare-card/programs')
      .set('Idempotency-Key', 'program-enterprise-2026').send({ ...planBody, name: '冲突名称' })
      .expect(409).expect(({ body }) => expect(body.code).toBe('IDEMPOTENCY_CONFLICT'));

    const listed = await request(app.getHttpServer()).get('/v1/company/welfare-card/programs').expect(200);
    expect(listed.headers['cache-control']).toMatch(/private.*no-store/iu);
    expect(listed.headers['x-robots-tag']).toMatch(/noindex/iu);
    expect(listed.body).toMatchObject({ total: 1, items: [{ id: first.body.id, batches: [] }] });
    expect(JSON.stringify(listed.body)).not.toMatch(/companyId|functionalAccountId|identityId|supplierPrice|supplierPayable|secret|PERSONAL_RECHARGE/iu);
    expect(repository.snapshot().programs).toHaveLength(1);
  });

  it('rejects owner injection, other roles and every non-allowlisted funding source without a write', async () => {
    const { app, currentActor, repository } = await fixture();
    const post = (key, body) => request(app.getHttpServer()).post('/v1/company/welfare-card/programs')
      .set('Idempotency-Key', key).send(body);
    await post('owner-injection', { ...planBody, companyId }).expect(422)
      .expect(({ body }) => expect(body.code).toBe('FIELD_FORBIDDEN'));
    await post('personal-recharge', { ...planBody, fundingType: 'PERSONAL_RECHARGE' }).expect(422)
      .expect(({ body }) => expect(body.code).toBe('PERSONAL_RECHARGE_FORBIDDEN'));
    await post('fourth-source', { ...planBody, fundingType: 'PARTNER_TOPUP' }).expect(422)
      .expect(({ body }) => expect(body.code).toBe('WELFARE_FUNDING_SOURCE_INVALID'));
    await request(app.getHttpServer()).get(`/v1/company/welfare-card/programs?companyId=${companyId}`).expect(422)
      .expect(({ body }) => expect(body.code).toBe('FIELD_FORBIDDEN'));
    currentActor.role = 'COMPANY_FINANCE';
    await request(app.getHttpServer()).get('/v1/company/welfare-card/programs').expect(403)
      .expect(({ body }) => expect(body.code).toBe('WORKSPACE_FORBIDDEN'));
    expect(repository.snapshot()).toEqual({ programs: [], batches: [] });
  });

  it('creates an amount-conserving DRAFT batch and rejects mismatch or incompatible claim mode without side effects', async () => {
    const { app, repository } = await fixture();
    const program = await request(app.getHttpServer()).post('/v1/company/welfare-card/programs')
      .set('Idempotency-Key', 'program-before-batch').send(planBody).expect(201);
    const url = `/v1/company/welfare-card/programs/${program.body.id}/batches`;
    const body = {
      enterpriseCustomerId, batchNo: 'WCB-2026-MID-A', totalAmount: 30000,
      unitAmount: 10000, issueCount: 3, claimMode: 'ENTERPRISE_ASSIGNED', agreementVersion: 1,
    };
    const send = (key, value) => request(app.getHttpServer()).post(url).set('Idempotency-Key', key).send(value);
    const first = await send('batch-2026-mid-a', body).expect(201);
    expect(first.body).toMatchObject({
      batchNo: body.batchNo, totalAmount: 30000, unitAmount: 10000,
      issueCount: 3, claimMode: 'ENTERPRISE_ASSIGNED', agreementVersion: 1,
      status: 'DRAFT', version: 0,
    });
    const replayed = await send('batch-2026-mid-a', body).expect(201);
    expect(replayed.headers['idempotency-replayed']).toBe('true');
    expect(replayed.body).toEqual(first.body);
    await send('amount-mismatch', { ...body, batchNo: 'WCB-BAD-AMOUNT', totalAmount: 30001 })
      .expect(422).expect(({ body: error }) => expect(error.code).toBe('WELFARE_BATCH_AMOUNT_MISMATCH'));
    await send('wrong-claim-mode', { ...body, batchNo: 'WCB-BAD-CLAIM', claimMode: 'PHYSICAL_CARD_OR_CODE' })
      .expect(422).expect(({ body: error }) => expect(error.code).toBe('WELFARE_CLAIM_MODE_INVALID'));
    expect(repository.snapshot().batches).toHaveLength(1);
    expect(JSON.stringify(first.body)).not.toMatch(/companyId|enterpriseCustomerId|identityId|functionalAccountId|supplier/iu);
  });

  it('accepts the versioned composite scope and rejects malformed lists before any repository write', async () => {
    const { app, repository } = await fixture();
    const compositeRules = {
      schemaVersion: 2,
      categoryIncludedIds: ['10000000-0000-4000-8000-000000000001'],
      productIncludedIds: [],
      skuIncludedIds: [],
      categoryExcludedIds: [],
      productExcludedIds: ['20000000-0000-4000-8000-000000000001'],
      skuExcludedIds: [],
    };
    const composite = { ...planBody, name: '组合适用范围计划', scopeType: 'COMPOSITE', scopeRules: compositeRules };
    const created = await request(app.getHttpServer()).post('/v1/company/welfare-card/programs')
      .set('Idempotency-Key', 'composite-scope-valid').send(composite).expect(201);
    expect(created.body).toMatchObject({ scopeType: 'COMPOSITE', scopeRules: compositeRules });
    expect(created.body.scopeRules).toMatchObject({ includedIds: [], excludedIds: [] });

    const duplicate = { ...compositeRules, productExcludedIds: [compositeRules.productExcludedIds[0], compositeRules.productExcludedIds[0]] };
    await request(app.getHttpServer()).post('/v1/company/welfare-card/programs')
      .set('Idempotency-Key', 'composite-scope-duplicate').send({ ...composite, name: '重复规则计划', scopeRules: duplicate })
      .expect(422).expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
    await request(app.getHttpServer()).post('/v1/company/welfare-card/programs')
      .set('Idempotency-Key', 'composite-scope-unknown').send({
        ...composite,
        name: '未知字段计划',
        scopeRules: { ...compositeRules, clientOwnedRule: true },
      }).expect(422).expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
    expect(repository.snapshot().programs).toHaveLength(1);
  });
});
