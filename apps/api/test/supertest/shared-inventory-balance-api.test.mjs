import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const supplierA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const supplierB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const skuId = '23333333-3333-4333-8333-333333333333';
const activeActor = {
  role: 'SUPPLIER_INVENTORY',
  supplierId: supplierA,
  identityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  functionalAccountId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
};

const config = () => loadRuntimeConfig({
  NODE_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  DATABASE_URL: 'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
  REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
  INFRA_HEALTH_TIMEOUT_MS: '50',
});
const probes = () => ['database', 'redis', 'queue'].map((name) => ({
  name,
  check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));

const clone = (value) => JSON.parse(JSON.stringify(value));
const createRepository = () => {
  const balance = {
    id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    skuId,
    supplierId: supplierA,
    productName: '共用大米礼盒',
    skuCode: 'RICE-5KG',
    status: 'AVAILABLE',
    availableQty: 10,
    reservedQty: 0,
    soldQty: 0,
    safetyStockQty: 3,
    version: 0,
    updatedAt: new Date(0).toISOString(),
  };
  const logs = [];
  const commands = new Map();
  return {
    list: async (supplierId) => supplierId === supplierA ? [clone(balance)] : [],
    history: async (supplierId, requestedSkuId) =>
      supplierId === supplierA && requestedSkuId === skuId ? clone(logs) : null,
    adjust: async (command) => {
      if (command.supplierId !== supplierA || command.skuId !== skuId) return { kind: 'NOT_FOUND' };
      const previous = commands.get(command.idempotencyKey);
      if (previous) {
        return previous.requestHash === command.requestHash
          ? { kind: 'OK', value: clone(previous.value), replayed: true }
          : { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      if (command.expectedVersion !== balance.version) return { kind: 'VERSION_CONFLICT' };
      const next = command.mode === 'SET_AVAILABLE'
        ? command.quantity
        : balance.availableQty + command.quantity;
      if (next < 0) return { kind: 'NEGATIVE' };
      const before = balance.availableQty;
      balance.availableQty = next;
      balance.version += 1;
      balance.updatedAt = new Date(balance.version * 1000).toISOString();
      logs.push({
        id: randomUUID(),
        skuId,
        type: command.type,
        quantityDelta: next - before,
        beforeAvailableQty: before,
        afterAvailableQty: next,
        resultingVersion: balance.version,
        reason: command.reason,
        occurredAt: balance.updatedAt,
      });
      const value = { balance: clone(balance), log: clone(logs.at(-1)) };
      commands.set(command.idempotencyKey, { requestHash: command.requestHash, value });
      return { kind: 'OK', value, replayed: false };
    },
    snapshot: () => ({ balance: clone(balance), logs: clone(logs) }),
  };
};

const applications = [];
const createFixture = async () => {
  const actor = { ...activeActor };
  const repository = createRepository();
  const app = await createApplication({
    config: config(),
    probes: probes(),
    inventoryRepository: repository,
    supplierInventoryActorResolver: { resolve: async () => ({ ...actor }) },
    logger: false,
  });
  await app.init();
  applications.push(app);
  return { actor, app, repository };
};

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe('M2-P063 shared InventoryBalance supplier API', () => {
  it('lists the current supplier shared SKU balance without price or ownership internals', async () => {
    const { app } = await createFixture();
    const response = await request(app.getHttpServer())
      .get('/v1/supplier/inventory?page=1&pageSize=20&warningOnly=false')
      .expect(200);

    expect(response.headers['cache-control']).toMatch(/private.*no-store/iu);
    expect(response.body).toMatchObject({
      total: 1,
      items: [{
        skuId,
        productName: '共用大米礼盒',
        availableQty: 10,
        reservedQty: 0,
        soldQty: 0,
        safetyStockQty: 3,
        warning: false,
        version: 0,
      }],
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /supplierId|companyId|approvedSupplyPrice|supplyPrice|supplierPayable|margin/iu,
    );
  });

  it('adjusts once, replays the same command, and rejects negative/version/ownership changes atomically', async () => {
    const { actor, app, repository } = await createFixture();
    const url = `/v1/supplier/inventory/${skuId}/adjustments`;
    const body = {
      type: 'DECREASE',
      mode: 'DELTA_AVAILABLE',
      quantity: -4,
      expectedVersion: 0,
      reason: '仓库实物出库修正',
    };
    const first = await request(app.getHttpServer())
      .post(url)
      .set('Idempotency-Key', 'm2p063-adjust-1')
      .send(body)
      .expect(200);
    const replay = await request(app.getHttpServer())
      .post(url)
      .set('Idempotency-Key', 'm2p063-adjust-1')
      .send(body)
      .expect(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body).toEqual(first.body);
    expect(first.body.balance).toMatchObject({ skuId, availableQty: 6, version: 1 });
    expect(first.body.log).toMatchObject({ beforeAvailableQty: 10, afterAvailableQty: 6 });
    expect(repository.snapshot().logs).toHaveLength(1);
    const history = await request(app.getHttpServer())
      .get(`/v1/supplier/inventory/${skuId}/history`)
      .expect(200);
    expect(history.headers['cache-control']).toMatch(/private.*no-store/iu);
    expect(history.body).toMatchObject({
      total: 1,
      items: [{ skuId, beforeAvailableQty: 10, afterAvailableQty: 6, resultingVersion: 1 }],
    });
    expect(JSON.stringify(history.body)).not.toMatch(/supplierId|companyId|actorIdentityId|functionalAccountId/iu);

    await request(app.getHttpServer())
      .post(url)
      .set('Idempotency-Key', 'm2p063-adjust-1')
      .send({ ...body, quantity: -3 })
      .expect(409)
      .expect(({ body: error }) => expect(error.code).toBe('IDEMPOTENCY_CONFLICT'));
    await request(app.getHttpServer())
      .post(url)
      .set('Idempotency-Key', 'm2p063-negative')
      .send({ ...body, quantity: -20, expectedVersion: 1 })
      .expect(422)
      .expect(({ body: error }) => expect(error.code).toBe('INVENTORY_NEGATIVE'));
    await request(app.getHttpServer())
      .post(url)
      .set('Idempotency-Key', 'm2p063-stale')
      .send({ ...body, quantity: -1, expectedVersion: 0 })
      .expect(409)
      .expect(({ body: error }) => expect(error.code).toBe('INVENTORY_VERSION_CONFLICT'));
    expect(repository.snapshot()).toMatchObject({ balance: { availableQty: 6 }, logs: [{}] });

    actor.supplierId = supplierB;
    await request(app.getHttpServer()).get('/v1/supplier/inventory').expect(200)
      .expect(({ body: page }) => expect(page.items).toHaveLength(0));
    await request(app.getHttpServer())
      .post(url)
      .set('Idempotency-Key', 'm2p063-cross-supplier')
      .send({ ...body, supplierId: supplierA })
      .expect(422);
  });
});
