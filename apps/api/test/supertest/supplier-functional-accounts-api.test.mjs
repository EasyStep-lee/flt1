import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemorySupplierFunctionalAccountRepository } from '../../dist/supplier-functional-accounts/in-memory-supplier-functional-account.repository.js';

const supplierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actorIdentityId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actorAccountId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

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

const ownerAccount = {
  id: actorAccountId,
  identityId: actorIdentityId,
  supplierId,
  accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
  displayName: '主体管理员',
  mobile: '13800138000',
  email: 'owner@example.test',
  status: 'ACTIVE',
  expiresAt: null,
  lastLoginAt: null,
  version: 0,
};

const createFixture = async (overrides = {}) => {
  const repository = new InMemorySupplierFunctionalAccountRepository({
    accounts: [ownerAccount],
    suppliers: [{ id: supplierId, status: 'ACTIVE' }],
  });
  const actorRef = {
    current: {
      accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
      functionalAccountId: actorAccountId,
      identityId: actorIdentityId,
      supplierId,
      workspaceRoute: '/supplier/workspaces/account-admin',
    },
  };
  const auditEvents = [];
  const app = await createApplication({
    config: config(),
    probes: probes(),
    functionalAccountRepository: repository,
    functionalAccountActorResolver: {
      resolve: async () => actorRef.current,
    },
    functionalAccountSecondVerifier: {
      verify: async ({ code }) => code === '654321',
    },
    functionalAccountAuditSink: {
      record: async (event) => auditEvents.push(event),
    },
    logger: false,
    ...overrides,
  });
  await app.init();
  return { app, repository, actorRef, auditEvents };
};

const inviteBody = (overrides = {}) => ({
  accountTypeCode: 'SUPPLIER_PRODUCT',
  inviteeName: '商品运营员',
  inviteeMobile: '13900139000',
  inviteeEmail: 'product@example.test',
  secondVerificationCode: '654321',
  ...overrides,
});

describe('P0-005 supplier functional accounts API', () => {
  it('creates and lists allowlisted account responses in the authenticated supplier scope', async () => {
    const fixture = await createFixture();
    try {
      const created = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'invite-product-0001')
        .send(inviteBody());

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        accountTypeCode: 'SUPPLIER_PRODUCT',
        accountTypeName: '商品运营',
        displayName: '商品运营员',
        status: 'PENDING_ACTIVATION',
        workspaceRoute: '/supplier/workspaces/products',
      });
      expect(created.body).not.toHaveProperty('supplierId');
      expect(created.body).not.toHaveProperty('identityId');
      expect(created.body).not.toHaveProperty('mobile');
      expect(created.body).not.toHaveProperty('email');

      const listed = await request(fixture.app.getHttpServer())
        .get('/v1/supplier/functional-accounts?accountTypeCode=SUPPLIER_PRODUCT&page=1&pageSize=20');
      expect(listed.status).toBe(200);
      expect(listed.headers['cache-control']).toContain('private');
      expect(listed.body).toMatchObject({ page: 1, pageSize: 20, total: 1 });
      expect(listed.body.items).toHaveLength(1);
      expect(listed.body.items[0]).toEqual(created.body);
    } finally {
      await fixture.app.close();
    }
  });

  it('replays an identical invite and rejects an idempotency key conflict', async () => {
    const fixture = await createFixture();
    try {
      const first = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'invite-idempotent-0001')
        .send(inviteBody());
      const replay = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'invite-idempotent-0001')
        .send(inviteBody());
      const conflict = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'invite-idempotent-0001')
        .send(inviteBody({ inviteeMobile: '13700137000' }));

      expect(first.status).toBe(201);
      expect(replay.status).toBe(201);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.body.id).toBe(first.body.id);
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expect(await fixture.repository.countAccounts(supplierId)).toBe(2);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-005-01 rejects cross-workspace account administration without mutation', async () => {
    const fixture = await createFixture();
    fixture.actorRef.current = {
      ...fixture.actorRef.current,
      accountTypeCode: 'SUPPLIER_PRICING',
      workspaceRoute: '/supplier/workspaces/pricing',
    };
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'cross-workspace-0001')
        .send(inviteBody());
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      expect(await fixture.repository.countAccounts(supplierId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-005-02 rejects self privilege escalation and records a security event', async () => {
    const fixture = await createFixture();
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'self-escalation-0001')
        .send(
          inviteBody({
            accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
            inviteeName: '主体管理员',
            inviteeMobile: ownerAccount.mobile,
          }),
        );
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ code: 'ACCOUNT_TYPE_INVALID' });
      expect(await fixture.repository.countAccounts(supplierId)).toBe(1);
      expect(fixture.auditEvents).toContainEqual(
        expect.objectContaining({ event: 'SELF_PRIVILEGE_ESCALATION_REJECTED' }),
      );
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-005-04 requires second verification and rejects owner selectors', async () => {
    const fixture = await createFixture();
    try {
      const missingVerification = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'missing-verification-0001')
        .send(inviteBody({ secondVerificationCode: undefined }));
      expect(missingVerification.status).toBe(428);
      expect(missingVerification.body).toMatchObject({
        code: 'SECOND_VERIFICATION_REQUIRED',
      });

      for (const forbidden of [
        { supplierId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
        { identityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
        { ownerType: 'SUPPLIER' },
        { workspaceRoute: '/supplier/workspaces/pricing' },
      ]) {
        const response = await request(fixture.app.getHttpServer())
          .post('/v1/supplier/functional-accounts')
          .set('Idempotency-Key', `ownership-${Object.keys(forbidden)[0]}-0001`)
          .send(inviteBody(forbidden));
        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({ code: 'DATA_SCOPE_FORBIDDEN' });
      }
      expect(await fixture.repository.countAccounts(supplierId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('rejects the company owner path and inactive supplier state', async () => {
    const fixture = await createFixture();
    try {
      const wrongOwner = await request(fixture.app.getHttpServer())
        .get('/v1/company/functional-accounts');
      expect(wrongOwner.status).toBe(403);
      expect(wrongOwner.body).toMatchObject({ code: 'DATA_SCOPE_FORBIDDEN' });

      fixture.repository.setSupplierStatus(supplierId, 'SUSPENDED');
      const inactive = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'inactive-supplier-0001')
        .send(inviteBody());
      expect(inactive.status).toBe(409);
      expect(inactive.body).toMatchObject({ code: 'STATE_TRANSITION_INVALID' });
    } finally {
      await fixture.app.close();
    }
  });
});

