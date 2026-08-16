import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const supplierA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const supplierB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const subOrderId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const orderItemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const actor = {
  role: 'SUPPLIER_FULFILLMENT', supplierId: supplierA,
  identityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  functionalAccountId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
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
  const record = {
    id: subOrderId, orderId: '11111111-1111-4111-8111-111111111111',
    enterpriseProcurementOrderId: null, supplierId: supplierA,
    subOrderNo: 'FS202608160001-01', channelType: 'CONSUMER',
    activationStatus: 'ACTIVE', preparationStatus: 'PENDING',
    handoverStatus: 'NOT_READY', version: 0,
    pickupPoint: { address: '江苏省连云港市海州区示例取货点' },
    items: [{ orderItemId, productName: '福利大米', skuLabel: '5kg', quantity: 2 }],
    nodes: [], createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    goodsAmount: 2000, supplyAmount: 1200, settlementStatus: 'NOT_RECONCILED',
  };
  const commands = new Map();
  const outboxes = [];
  return {
    list: async (supplierId) => supplierId === supplierA ? [clone(record)] : [],
    appendNode: async (command) => {
      if (command.supplierId !== supplierA || command.subOrderId !== subOrderId) return { kind: 'NOT_FOUND' };
      const prior = commands.get(command.idempotencyKey);
      if (prior) return prior.hash === command.requestHash
        ? { kind: 'OK', value: clone(prior.value), replayed: true }
        : { kind: 'IDEMPOTENCY_CONFLICT' };
      if (record.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
      const transitions = {
        'PENDING:ACCEPT': ['ACCEPTED', 'NOT_READY'],
        'ACCEPTED:START_PREPARING': ['PREPARING', 'NOT_READY'],
        'PREPARING:MARK_READY': ['READY_FOR_HANDOVER', 'READY'],
        'READY_FOR_HANDOVER:HANDOVER': ['HANDED_OVER', 'HANDED_OVER'],
      };
      const next = transitions[`${record.preparationStatus}:${command.node}`];
      if (command.node !== 'REPORT_SHORTAGE' && !next) return { kind: 'STATE_INVALID' };
      if (command.node === 'HANDOVER' && command.handoverParty !== 'RUNNER') return { kind: 'HANDOVER_PARTY_INVALID' };
      if (command.node === 'REPORT_SHORTAGE' && !command.shortages?.every((item) => item.orderItemId === orderItemId && item.quantity > 0 && item.quantity <= 2)) return { kind: 'SHORTAGE_INVALID' };
      if (next) [record.preparationStatus, record.handoverStatus] = next;
      record.version += 1;
      record.updatedAt = new Date(record.version * 1000).toISOString();
      record.nodes.push({ id: randomUUID(), node: command.node, reason: command.reason ?? null, resultingVersion: record.version, occurredAt: record.updatedAt });
      if (command.node === 'MARK_READY') outboxes.push({ subOrderId, channelType: 'CONSUMER' });
      const value = clone(record);
      commands.set(command.idempotencyKey, { hash: command.requestHash, value });
      return { kind: 'OK', value, replayed: false };
    },
    snapshot: () => ({ record: clone(record), outboxes: clone(outboxes) }),
  };
};

const applications = [];
const fixture = async () => {
  const repository = createRepository();
  const currentActor = { ...actor };
  const app = await createApplication({
    config: config(), probes: probes(), fulfillmentRepository: repository,
    supplierFulfillmentActorResolver: { resolve: async () => ({ ...currentActor }) }, logger: false,
  });
  await app.init();
  applications.push(app);
  return { app, currentActor, repository };
};

afterEach(async () => Promise.all(applications.splice(0).map((app) => app.close())));

describe('M3-P031 supplier fulfillment preparation API', () => {
  it('lists only the current supplier suborders with a strict fulfillment DTO', async () => {
    const { app, currentActor } = await fixture();
    const response = await request(app.getHttpServer())
      .get('/v1/supplier/fulfillment-sub-orders?page=1&pageSize=20')
      .expect(200);
    expect(response.headers['cache-control']).toMatch(/private.*no-store/iu);
    expect(response.body).toMatchObject({ total: 1, items: [{ id: subOrderId, subOrderNo: 'FS202608160001-01', channelType: 'CONSUMER', preparationStatus: 'PENDING', version: 0 }] });
    expect(JSON.stringify(response.body)).not.toMatch(/supplierId|goodsAmount|supplyAmount|settlementStatus|payment|welfare|consumerUserId|enterpriseCustomerId/iu);

    currentActor.supplierId = supplierB;
    await request(app.getHttpServer()).get('/v1/supplier/fulfillment-sub-orders').expect(200)
      .expect(({ body }) => expect(body.items).toHaveLength(0));
  });

  it('advances append-only nodes, reports shortage and replays without creating delivery entities', async () => {
    const { app, repository } = await fixture();
    const url = `/v1/supplier/fulfillment-sub-orders/${subOrderId}/nodes`;
    const send = (key, body) => request(app.getHttpServer()).post(url).set('Idempotency-Key', key).send(body);
    const accepted = await send('accept-1', { node: 'ACCEPT', expectedVersion: 0 }).expect(200);
    const replay = await send('accept-1', { node: 'ACCEPT', expectedVersion: 0 }).expect(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body).toEqual(accepted.body);
    await send('accept-1', { node: 'ACCEPT', expectedVersion: 1 }).expect(409)
      .expect(({ body }) => expect(body.code).toBe('IDEMPOTENCY_CONFLICT'));
    await send('short-1', { node: 'REPORT_SHORTAGE', expectedVersion: 1, reason: '实物短缺', shortages: [{ orderItemId, quantity: 1 }] }).expect(200);
    await send('prepare-1', { node: 'START_PREPARING', expectedVersion: 2 }).expect(200);
    await send('ready-1', { node: 'MARK_READY', expectedVersion: 3 }).expect(200);
    await send('handover-bad', { node: 'HANDOVER', expectedVersion: 4, handoverParty: 'COMPANY_LOGISTICS', handoverReference: 'handover-001' }).expect(422)
      .expect(({ body }) => expect(body.code).toBe('FULFILLMENT_HANDOVER_PARTY_INVALID'));
    await send('handover-1', { node: 'HANDOVER', expectedVersion: 4, handoverParty: 'RUNNER', handoverReference: 'runner-check-001' }).expect(200);

    const snapshot = repository.snapshot();
    expect(snapshot.record).toMatchObject({ preparationStatus: 'HANDED_OVER', handoverStatus: 'HANDED_OVER', version: 5 });
    expect(snapshot.record.nodes).toHaveLength(5);
    expect(snapshot.outboxes).toEqual([{ subOrderId, channelType: 'CONSUMER' }]);
    expect(JSON.stringify(snapshot)).not.toMatch(/DeliveryTask|EnterpriseDeliveryOrder/iu);
  });

  it('rejects owner injection, stale version, wrong owner and illegal transitions without mutation', async () => {
    const { app, currentActor, repository } = await fixture();
    const url = `/v1/supplier/fulfillment-sub-orders/${subOrderId}/nodes`;
    await request(app.getHttpServer()).post(url).set('Idempotency-Key', 'owner-field')
      .send({ node: 'ACCEPT', expectedVersion: 0, supplierId: supplierA }).expect(422)
      .expect(({ body }) => expect(body.code).toBe('FIELD_FORBIDDEN'));
    await request(app.getHttpServer()).post(url).set('Idempotency-Key', 'illegal')
      .send({ node: 'MARK_READY', expectedVersion: 0 }).expect(409)
      .expect(({ body }) => expect(body.code).toBe('STATE_TRANSITION_INVALID'));
    await request(app.getHttpServer()).post(url).set('Idempotency-Key', 'stale')
      .send({ node: 'ACCEPT', expectedVersion: 9 }).expect(409)
      .expect(({ body }) => expect(body.code).toBe('VERSION_CONFLICT'));
    currentActor.supplierId = supplierB;
    await request(app.getHttpServer()).post(url).set('Idempotency-Key', 'wrong-owner')
      .send({ node: 'ACCEPT', expectedVersion: 0 }).expect(403)
      .expect(({ body }) => expect(body.code).toBe('SUPPLIER_SCOPE_FORBIDDEN'));
    expect(repository.snapshot().record).toMatchObject({ preparationStatus: 'PENDING', version: 0, nodes: [] });
  });
});
