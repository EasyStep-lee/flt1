import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const enterpriseCustomerId = '10000000-0000-4000-8000-000000000029';
const enterpriseUserId = '10000000-0000-4000-8000-000000000129';
const enterpriseAddressId = '10000000-0000-4000-8000-000000000229';
const invoiceProfileId = '10000000-0000-4000-8000-000000000329';
const otherEnterpriseAddressId = '10000000-0000-4000-8000-000000000999';
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
  productName: `企业商品${index + 1}`,
  categoryId: `50000000-0000-4000-8000-00000000000${index + 1}`,
  templateVersion: 1,
  afterSaleSnapshot: { provider: 'COMPANY_UNIFIED' },
  status: 'ACTIVE',
  productStatus: 'ACTIVE',
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  retailSalePrice: 1500 + index * 100,
  enterpriseSalePrice: 1200 + index * 100,
  approvedSupplyPrice: 800 + index * 100,
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

class EnterpriseProcurementRepository {
  constructor() {
    this.commands = [];
    this.replays = new Map();
  }

  async findOrderableSkus(_companyId, skuIds) {
    return skus.filter((item) => skuIds.includes(item.skuId));
  }

  async createOrder(command) {
    if (command.enterpriseProcurement?.enterpriseAddressId === otherEnterpriseAddressId) {
      return { kind: 'ENTERPRISE_SCOPE_FORBIDDEN' };
    }
    const replayKey = `${command.idempotencyScope}:${command.idempotencyKey}`;
    const prior = this.replays.get(replayKey);
    if (prior) {
      return prior.requestHash === command.requestHash
        ? { kind: 'REPLAY', order: prior.order }
        : { kind: 'IDEMPOTENCY_CONFLICT' };
    }
    this.commands.push(clone(command));
    const order = {
      ...command,
      orderId: randomUUID(),
      orderNo: 'FS2026081500000029',
      items: command.items.map((item) => ({ ...item, orderItemId: randomUUID() })),
      supplierFulfillments: command.supplierFulfillments.map((item) => ({
        ...item,
        fulfillmentOrderId: randomUUID(),
      })),
      enterpriseProcurement: {
        enterpriseOrderId: randomUUID(),
        paymentMethod: command.enterpriseProcurement.paymentMethod,
        remittanceReviewStatus: 'NOT_SUBMITTED',
        status: 'PENDING_PAYMENT',
        address: {
          consignee: '企业收货人',
          mobile: '13800138000',
          region: '江苏省南京市建邺区',
          fullAddress: '江东中路 100 号',
          deliveryNote: '工作日收货',
        },
        invoiceProfile: {
          title: '南京示例企业有限公司',
          taxNumber: '91320100MA1ABC2D3X',
          registeredAddress: '南京市建邺区江东中路 100 号',
          registeredPhone: '025-88886666',
          bankName: '示例银行南京分行',
          bankAccountMasked: '**** **** **** 2020',
        },
      },
    };
    this.replays.set(replayKey, { requestHash: command.requestHash, order });
    return { kind: 'CREATED', order };
  }
}

const actorResolver = {
  resolveConsumer: async () => null,
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
      : cookie === '__Host-fulishe-enterprise-portal=suspended-session'
        ? {
            kind: 'ENTERPRISE',
            companyId,
            enterpriseCustomerId,
            enterpriseUserId,
            status: 'SUSPENDED',
            permissions: ['PURCHASE'],
          }
        : cookie === '__Host-fulishe-enterprise-portal=readonly-session'
          ? {
              kind: 'ENTERPRISE',
              companyId,
              enterpriseCustomerId,
              enterpriseUserId,
              status: 'ACTIVE',
              permissions: [],
            }
      : null,
};

const createFixture = async () => {
  const repository = new EnterpriseProcurementRepository();
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

const body = (overrides = {}) => ({
  items: skus.map(({ skuId }, index) => ({ skuId, quantity: index + 1 })),
  enterpriseAddressId,
  invoiceProfileId,
  paymentMethod: 'BANK_TRANSFER',
  ...overrides,
});

describe('M3-P029 / P0-029 unified enterprise procurement', () => {
  it('keeps the published items-only request compatible by selecting active enterprise defaults', async () => {
    const { app, repository } = await createFixture();
    try {
      const response = await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', 'enterprise-procurement-defaults-0029')
        .send({ items: body().items })
        .expect(201);
      expect(response.body.enterpriseProcurement).toMatchObject({
        paymentMethod: 'WECHAT_PAY',
        nextAction: 'START_WECHAT_PAYMENT',
      });
      expect(repository.commands[0].enterpriseProcurement).toEqual({
        enterpriseAddressId: null,
        invoiceProfileId: null,
        paymentMethod: 'WECHAT_PAY',
        purchaserUserId: enterpriseUserId,
      });
    } finally {
      await app.close();
    }
  });

  it('creates one private company order with immutable enterprise checkout snapshots', async () => {
    const { app, repository } = await createFixture();
    try {
      const response = await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', 'enterprise-procurement-create-0029')
        .send(body())
        .expect(201);

      expect(response.headers['cache-control']).toMatch(/private.*no-store/iu);
      expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(response.body).toMatchObject({
        orderType: 'ENTERPRISE',
        sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED',
        goodsAmount: 8000,
        totalAmount: 8000,
        enterpriseProcurement: {
          paymentMethod: 'BANK_TRANSFER',
          remittanceReviewStatus: 'NOT_SUBMITTED',
          status: 'PENDING_PAYMENT',
          nextAction: 'SUBMIT_REMITTANCE_PROOF',
          address: {
            consignee: '企业收货人',
            mobileMasked: '138****8000',
            fullAddress: '江东中路 100 号',
          },
          invoiceProfile: {
            title: '南京示例企业有限公司',
            taxNumberMasked: '9132********2D3X',
            bankAccountMasked: '**** **** **** 2020',
          },
        },
      });
      expect(response.body.supplierFulfillments).toHaveLength(3);
      expect(repository.commands).toHaveLength(1);
      expect(repository.commands[0].enterpriseProcurement).toEqual({
        enterpriseAddressId,
        invoiceProfileId,
        paymentMethod: 'BANK_TRANSFER',
        purchaserUserId: enterpriseUserId,
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /approvedSupplyPrice|supplyPrice|supplierPayable|grossMargin|enterpriseCustomerId|purchaserUserId|13800138000|91320100MA1ABC2D3X|DeliveryTask/iu,
      );
    } finally {
      await app.close();
    }
  });

  it('NEG-M3-P029-01 rejects missing, invalid and client-owned checkout fields without a write', async () => {
    const { app, repository } = await createFixture();
    try {
      await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', 'enterprise-procurement-invalid-0029')
        .send(body({ invoiceProfileId: undefined }))
        .expect(422)
        .expect(({ body: error }) => expect(error.code).toBe('VALIDATION_FAILED'));

      await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', 'enterprise-procurement-owner-field-0029')
        .send(body({ enterpriseCustomerId, purchaserUserId: enterpriseUserId }))
        .expect(422)
        .expect(({ body: error }) => expect(error.code).toBe('FIELD_FORBIDDEN'));

      await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', 'enterprise-procurement-channel-0029')
        .send(body({ paymentMethod: 'ALIPAY' }))
        .expect(422)
        .expect(({ body: error }) => expect(error.code).toBe('VALIDATION_FAILED'));
      expect(repository.commands).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('NEG-M3-P029-02 rejects wrong-owner profiles, suspended enterprises and members without purchase permission', async () => {
    const { app, repository } = await createFixture();
    try {
      await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', 'enterprise-procurement-wrong-owner-0029')
        .send(body({ enterpriseAddressId: otherEnterpriseAddressId }))
        .expect(403)
        .expect(({ body: error }) => expect(error.code).toBe('ENTERPRISE_SCOPE_FORBIDDEN'));

      for (const cookie of ['suspended-session', 'readonly-session']) {
        await request(app.getHttpServer())
          .post('/v1/enterprise/orders')
          .set('Cookie', `__Host-fulishe-enterprise-portal=${cookie}`)
          .set('Idempotency-Key', `enterprise-procurement-${cookie}-0029`)
          .send(body())
          .expect(403)
          .expect(({ body: error }) => expect(error.code).toBe('ACCESS_DENIED'));
      }
      expect(repository.commands).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('NEG-M3-P029-03 replays an identical checkout and rejects a changed payment method', async () => {
    const { app, repository } = await createFixture();
    try {
      const key = 'enterprise-procurement-replay-0029';
      const first = await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', key)
        .send(body())
        .expect(201);
      const replay = await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', key)
        .send(body())
        .expect(200);
      expect(replay.body).toEqual(first.body);

      await request(app.getHttpServer())
        .post('/v1/enterprise/orders')
        .set('Cookie', '__Host-fulishe-enterprise-portal=enterprise-session')
        .set('Idempotency-Key', key)
        .send(body({ paymentMethod: 'WECHAT_PAY' }))
        .expect(409)
        .expect(({ body: error }) => expect(error.code).toBe('IDEMPOTENCY_CONFLICT'));
      expect(repository.commands).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
