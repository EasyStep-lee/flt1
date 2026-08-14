import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const consumerUserId = '10000000-0000-4000-8000-000000000002';
const enterpriseCustomerId = '10000000-0000-4000-8000-000000000003';
const enterpriseUserId = '10000000-0000-4000-8000-000000000004';
const suppliers = [
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
];
const skus = suppliers.map((supplierId, index) => ({
  skuId: `30000000-0000-4000-8000-00000000000${index + 1}`,
  productId: `40000000-0000-4000-8000-00000000000${index + 1}`,
  supplierId,
  companyId,
  productName: `商品${index + 1}`,
  categoryId: `50000000-0000-4000-8000-00000000000${index + 1}`,
  templateVersion: index + 1,
  afterSaleSnapshot: { rule: '公司统一售后' },
  status: 'ACTIVE',
  productStatus: 'ACTIVE',
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  retailSalePrice: [1200, 2300, 3400][index],
  enterpriseSalePrice: [1100, 2100, 3100][index],
  approvedSupplyPrice: [700, 1400, 2100][index],
}));

const config = () =>
  loadRuntimeConfig({
    NODE_ENV: 'test',
    API_HOST: '127.0.0.1',
    API_PORT: '3000',
    DATABASE_URL:
      'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
    INFRA_HEALTH_TIMEOUT_MS: '50',
  });

const probes = () =>
  ['database', 'redis', 'queue'].map((name) => ({
    name,
    check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
  }));

const clone = (value) => JSON.parse(JSON.stringify(value));

class RecordingOrderRepository {
  constructor(records = skus) {
    this.records = records;
    this.commands = [];
    this.replays = new Map();
  }

  async findOrderableSkus(_companyId, skuIds) {
    return this.records.filter((record) => skuIds.includes(record.skuId));
  }

  async createOrder(command) {
    const replayKey = `${command.idempotencyScope}:${command.idempotencyKey}`;
    const previous = this.replays.get(replayKey);
    if (previous) {
      return previous.requestHash === command.requestHash
        ? { kind: 'REPLAY', order: previous.order }
        : { kind: 'IDEMPOTENCY_CONFLICT' };
    }
    this.commands.push(clone(command));
    const order = {
      ...command,
      orderId: randomUUID(),
      orderNo: `FS${String(this.commands.length).padStart(18, '0')}`,
      items: command.items.map((item) => ({ ...item, orderItemId: randomUUID() })),
      supplierFulfillments: command.supplierFulfillments.map((item) => ({
        ...item,
        fulfillmentOrderId: randomUUID(),
      })),
    };
    this.replays.set(replayKey, { requestHash: command.requestHash, order });
    return { kind: 'CREATED', order };
  }
}

const actorResolver = {
  resolveConsumer: async (cookie) =>
    cookie === '__Host-fulishe-consumer=consumer-session'
      ? { kind: 'CONSUMER', companyId, consumerUserId, status: 'ACTIVE' }
      : null,
  resolveEnterprise: async (cookie) =>
    cookie === '__Host-fulishe-enterprise-portal=enterprise-session'
      ? {
          kind: 'ENTERPRISE',
          companyId,
          enterpriseCustomerId,
          enterpriseUserId,
          status: 'ACTIVE',
          permissions: ['PURCHASE'],
        }
      : null,
};

const createFixture = async (repository = new RecordingOrderRepository()) => {
  const app = await createApplication({
    config: config(),
    probes: probes(),
    orderRepository: repository,
    orderActorResolver: actorResolver,
    logger: false,
  });
  await app.init();
  return { app, repository };
};

const requestItems = skus.map(({ skuId }, index) => ({ skuId, quantity: index + 1 }));

describe('P0-022 personal and enterprise cross-supplier company orders', () => {
  it('creates one consumer main order and exactly one fulfillment per supplier using retail prices', async () => {
    const { app, repository } = await createFixture();
    try {
      const response = await request(app.getHttpServer())
        .post('/v1/consumer/orders')
        .set('Cookie', '__Host-fulishe-consumer=consumer-session')
        .set('Idempotency-Key', 'consumer-three-suppliers-0001')
        .send({ items: requestItems })
        .expect(201);

      expect(response.headers['cache-control']).toMatch(/private.*no-store/iu);
      expect(response.body).toMatchObject({
        orderType: 'CONSUMER',
        sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED',
        goodsAmount: 16_000,
        totalAmount: 16_000,
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING_PAYMENT',
      });
      expect(response.body.items).toHaveLength(3);
      expect(response.body.supplierFulfillments).toHaveLength(3);
      expect(response.body.supplierFulfillments.map((item) => item.supplierId).sort()).toEqual(
        [...suppliers].sort(),
      );
      expect(repository.commands).toHaveLength(1);
      expect(repository.commands[0]).toMatchObject({
        companyId,
        consumerUserId,
        enterpriseCustomerId: null,
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /supplyPrice|approvedSupplyPrice|companyId|consumerUserId|enterpriseCustomerId|buyerId|margin|payable/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('creates one enterprise main order using enterprise prices and no personal welfare fields', async () => {
    const { app, repository } = await createFixture();
    try {
      const response = await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', 'enterprise-three-suppliers-0001')
        .send({ items: requestItems })
        .expect(201);

      expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(response.body).toMatchObject({
        orderType: 'ENTERPRISE',
        checkoutMode: 'COMPANY_UNIFIED',
        goodsAmount: 14_600,
        totalAmount: 14_600,
      });
      expect(response.body.supplierFulfillments).toHaveLength(3);
      expect(repository.commands[0]).toMatchObject({
        companyId,
        consumerUserId: null,
        enterpriseCustomerId,
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /welfare|supplyPrice|approvedSupplyPrice|enterpriseCustomerId|enterpriseUserId|margin|payable/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('replays an identical command and rejects a changed body without a second write', async () => {
    const { app, repository } = await createFixture();
    try {
      const first = await request(app.getHttpServer())
        .post('/v1/consumer/orders')
        .set('Cookie', '__Host-fulishe-consumer=consumer-session')
        .set('Idempotency-Key', 'consumer-idempotent-order-0001')
        .send({ items: requestItems })
        .expect(201);
      const replay = await request(app.getHttpServer())
        .post('/v1/consumer/orders')
        .set('Cookie', '__Host-fulishe-consumer=consumer-session')
        .set('Idempotency-Key', 'consumer-idempotent-order-0001')
        .send({ items: requestItems })
        .expect(200);
      expect(replay.body).toEqual(first.body);

      await request(app.getHttpServer())
        .post('/v1/consumer/orders')
        .set('Cookie', '__Host-fulishe-consumer=consumer-session')
        .set('Idempotency-Key', 'consumer-idempotent-order-0001')
        .set('x-request-id', 'neg-m3-p022-idempotency')
        .send({ items: [{ ...requestItems[0], quantity: 9 }, ...requestItems.slice(1)] })
        .expect(409)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            code: 'IDEMPOTENCY_CONFLICT',
            requestId: 'neg-m3-p022-idempotency',
          }),
        );
      expect(repository.commands).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it('rejects unauthenticated, client-owned scope and non-orderable SKU sets without partial writes', async () => {
    const repository = new RecordingOrderRepository(skus.slice(0, 2));
    const { app } = await createFixture(repository);
    try {
      await request(app.getHttpServer())
        .post('/v1/consumer/orders')
        .set('Idempotency-Key', 'consumer-no-session-0001')
        .send({ items: requestItems })
        .expect(401);

      await request(app.getHttpServer())
        .post('/v1/consumer/orders')
        .set('Cookie', '__Host-fulishe-consumer=consumer-session')
        .set('Idempotency-Key', 'consumer-spoofed-scope-0001')
        .set('x-request-id', 'neg-m3-p022-scope')
        .send({ items: requestItems, companyId, consumerUserId, supplierId: suppliers[0] })
        .expect(422)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'FIELD_FORBIDDEN', requestId: 'neg-m3-p022-scope' }),
        );

      await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', 'enterprise-missing-sku-0001')
        .set('x-request-id', 'neg-m3-p022-product')
        .send({ items: requestItems })
        .expect(409)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            code: 'PRODUCT_NOT_SALEABLE',
            requestId: 'neg-m3-p022-product',
          }),
        );
      expect(repository.commands).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
