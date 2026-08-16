import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const otherConsumerUserId = '10000000-0000-4000-8000-000000000003';
const categoryA = '20000000-0000-4000-8000-000000000001';
const categoryB = '20000000-0000-4000-8000-000000000002';
const productA = '30000000-0000-4000-8000-000000000001';
const productB = '30000000-0000-4000-8000-000000000002';
const skuA = '40000000-0000-4000-8000-000000000001';
const skuB = '40000000-0000-4000-8000-000000000002';

const config = () => loadRuntimeConfig({
  NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: '3000',
  DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0', INFRA_HEALTH_TIMEOUT_MS: '50',
});
const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name, check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));
const clone = (value) => JSON.parse(JSON.stringify(value));

const skus = [
  {
    skuId: skuA, productId: productA, supplierId: '50000000-0000-4000-8000-000000000001', companyId,
    productName: '适用商品', categoryId: categoryA, templateVersion: 1, afterSaleSnapshot: {},
    status: 'ACTIVE', productStatus: 'ACTIVE', isRetailEnabled: true, isEnterpriseProcurementEnabled: false,
    retailSalePrice: 2_000, enterpriseSalePrice: 1_900, approvedSupplyPrice: 1_000,
  },
  {
    skuId: skuB, productId: productB, supplierId: '50000000-0000-4000-8000-000000000002', companyId,
    productName: '不适用商品', categoryId: categoryB, templateVersion: 1, afterSaleSnapshot: {},
    status: 'ACTIVE', productStatus: 'ACTIVE', isRetailEnabled: true, isEnterpriseProcurementEnabled: false,
    retailSalePrice: 3_000, enterpriseSalePrice: 2_900, approvedSupplyPrice: 1_500,
  },
];

const account = (overrides = {}) => ({
  id: '60000000-0000-4000-8000-000000000001', companyId, consumerUserId,
  programId: '70000000-0000-4000-8000-000000000001', programName: '全场福利',
  batchId: '80000000-0000-4000-8000-000000000001', batchNo: 'WCB-ELIGIBLE-001',
  cardNo: 'CARD-ELIGIBLE-0001', balanceAmount: 8_000, frozenAmount: 1_000,
  status: 'ACTIVE', version: 0, claimedAt: new Date(0).toISOString(),
  scopeType: 'ALL_PRODUCTS', scopeRules: { schemaVersion: 1, includedIds: [], excludedIds: [] },
  canPayDeliveryFee: false, ...overrides,
});

const createWelfareRepository = () => {
  const accounts = [
    account(),
    account({
      id: '60000000-0000-4000-8000-000000000002', programName: 'A 类专享',
      cardNo: 'CARD-ELIGIBLE-0002', balanceAmount: 20_000, frozenAmount: 0,
      scopeType: 'CATEGORY', scopeRules: { schemaVersion: 1, includedIds: [categoryA], excludedIds: [] },
    }),
    account({
      id: '60000000-0000-4000-8000-000000000003', consumerUserId: otherConsumerUserId,
      cardNo: 'CARD-OTHER-0003', balanceAmount: 99_999,
    }),
    account({
      id: '60000000-0000-4000-8000-000000000004', cardNo: 'CARD-FROZEN-0004', status: 'FROZEN',
    }),
    account({
      id: '60000000-0000-4000-8000-000000000005', cardNo: 'CARD-ZERO-0005', balanceAmount: 1_000,
      scopeType: 'PRODUCT', scopeRules: { schemaVersion: 1, includedIds: ['30000000-0000-4000-8000-000000000099'], excludedIds: [] },
    }),
    account({
      id: '60000000-0000-4000-8000-000000000006', cardNo: 'CARD-INVALID-0006', balanceAmount: -1,
    }),
  ];
  let reads = 0;
  return {
    listPrograms: async () => [], createProgram: async () => ({ kind: 'DUPLICATE' }),
    createBatch: async () => ({ kind: 'DUPLICATE' }), bindCard: async () => ({ kind: 'CARD_CODE_INVALID', reason: 'STATE' }),
    listEligibilityAccounts: async () => { reads += 1; return clone(accounts); },
    snapshot: () => ({ reads, accounts: clone(accounts) }),
  };
};

const createOrderRepository = (records = skus) => ({
  findOrderableSkus: async (_company, skuIds) => records.filter((entry) => skuIds.includes(entry.skuId)),
  createOrder: async () => { throw new Error('READ_ONLY_SLICE_MUST_NOT_CREATE_ORDER'); },
  releaseOrderInventory: async () => { throw new Error('READ_ONLY_SLICE_MUST_NOT_RELEASE_INVENTORY'); },
});

const applications = [];
const fixture = async ({ records = skus, status = 'ACTIVE' } = {}) => {
  const welfareCardRepository = createWelfareRepository();
  const app = await createApplication({
    config: config(), probes: probes(), welfareCardRepository, orderRepository: createOrderRepository(records),
    orderActorResolver: {
      resolveConsumer: async (cookie) => cookie === '__Host-fulishe-consumer=active'
        ? { kind: 'CONSUMER', companyId, consumerUserId, status }
        : null,
      resolveEnterprise: async () => null,
    },
    logger: false,
  });
  await app.init();
  applications.push(app);
  return { app, welfareCardRepository };
};
afterEach(async () => Promise.all(applications.splice(0).map((app) => app.close())));

const eligible = (app, query = {}) => request(app.getHttpServer())
  .get('/v1/consumer/welfare-card-accounts/eligible')
  .set('Cookie', '__Host-fulishe-consumer=active')
  .query({ skuId: [skuA, skuB], quantity: ['2', '1'], ...query });

describe('M3-P053 consumer welfare-card eligibility API', () => {
  it('returns only session-owned usable accounts with server-priced scope and maximum deduction', async () => {
    const { app, welfareCardRepository } = await fixture();
    const response = await eligible(app).expect(200);
    expect(response.headers['cache-control']).toMatch(/private.*no-store/iu);
    expect(response.headers['x-robots-tag']).toMatch(/noindex/iu);
    expect(response.body).toMatchObject({ goodsAmount: 7_000, deliveryFee: 0, totalAmount: 7_000 });
    expect(response.body.accounts).toEqual([
      expect.objectContaining({
        id: '60000000-0000-4000-8000-000000000001', maskedCardNo: '****0001',
        balanceAmount: 8_000, frozenAmount: 1_000, availableAmount: 7_000,
        eligibleAmount: 7_000, maximumDeductibleAmount: 7_000, scopeType: 'ALL_PRODUCTS',
      }),
      expect.objectContaining({
        id: '60000000-0000-4000-8000-000000000002', maskedCardNo: '****0002',
        eligibleAmount: 4_000, maximumDeductibleAmount: 4_000, scopeType: 'CATEGORY',
      }),
    ]);
    expect(response.body.accounts[1].scopeDescription).toMatch(/部分商品|分类/u);
    expect(JSON.stringify(response.body)).not.toMatch(/"(?:companyId|consumerUserId|programId|batchId|cardNo|supplyPrice|approvedSupplyPrice|supplierPayable)"\s*:|PERSONAL_RECHARGE/iu);
    expect(welfareCardRepository.snapshot().reads).toBe(1);
  });

  it('rejects missing session, suspended account, owner injection and invalid cart without any write', async () => {
    const active = await fixture();
    await request(active.app.getHttpServer()).get('/v1/consumer/welfare-card-accounts/eligible')
      .query({ skuId: skuA, quantity: '1' }).expect(401)
      .expect(({ body }) => expect(body.code).toBe('AUTHENTICATION_REQUIRED'));
    await eligible(active.app, { consumerUserId }).expect(422)
      .expect(({ body }) => expect(body.code).toBe('FIELD_FORBIDDEN'));
    await request(active.app.getHttpServer()).get('/v1/consumer/welfare-card-accounts/eligible')
      .set('Cookie', '__Host-fulishe-consumer=active').query({ skuId: skuA, quantity: '0' }).expect(422)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
    const suspended = await fixture({ status: 'RESTRICTED' });
    await eligible(suspended.app).expect(403)
      .expect(({ body }) => expect(body.code).toBe('ACCOUNT_SUSPENDED'));
    expect(active.welfareCardRepository.snapshot().accounts).toHaveLength(6);
    expect(suspended.welfareCardRepository.snapshot().reads).toBe(0);
  });

  it('fails closed on an unsaleable SKU and makes concurrent duplicate reads deterministic and side-effect free', async () => {
    const missing = await fixture({ records: [skus[0]] });
    await eligible(missing.app).expect(409)
      .expect(({ body }) => expect(body.code).toBe('PRODUCT_NOT_SALEABLE'));
    expect(missing.welfareCardRepository.snapshot().reads).toBe(0);

    const current = await fixture();
    const responses = await Promise.all([eligible(current.app), eligible(current.app), eligible(current.app)]);
    expect(responses.map((entry) => entry.status)).toEqual([200, 200, 200]);
    expect(responses[1].body).toEqual(responses[0].body);
    expect(responses[2].body).toEqual(responses[0].body);
    expect(current.welfareCardRepository.snapshot().reads).toBe(3);
  });
});
