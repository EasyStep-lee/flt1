import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemorySupplierFunctionalAccountRepository } from '../../dist/supplier-functional-accounts/in-memory-supplier-functional-account.repository.js';

const supplierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actorIdentityId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actorAccountId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const requestId = '11111111-1111-4111-8111-111111111111';

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

const inviteBody = (overrides = {}) => ({
  accountTypeCode: 'SUPPLIER_PRODUCT',
  inviteeName: '商品运营员',
  inviteeMobile: '13900139000',
  inviteeEmail: 'product@example.test',
  secondVerificationCode: '654321',
  ...overrides,
});

const createFixture = async ({ failAppend = false } = {}) => {
  const auditRepository = new InMemoryAuditLogRepository({ failAppend });
  const functionalRepository = new InMemorySupplierFunctionalAccountRepository(
    {
      accounts: [ownerAccount],
      suppliers: [{ id: supplierId, status: 'ACTIVE' }],
    },
    auditRepository,
  );
  const auditActorRef = {
    current: {
      accountTypeCode: 'COMPANY_AUDIT',
      companyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      functionalAccountId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      identityId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      workspaceRoute: '/company-admin/workspaces/audit',
    },
  };
  const app = await createApplication({
    config: config(),
    probes: probes(),
    auditLogRepository: auditRepository,
    auditActorResolver: { resolve: async () => auditActorRef.current },
    functionalAccountRepository: functionalRepository,
    functionalAccountActorResolver: {
      resolve: async () => ({
        accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
        functionalAccountId: actorAccountId,
        identityId: actorIdentityId,
        supplierId,
        workspaceRoute: '/supplier/workspaces/account-admin',
      }),
    },
    functionalAccountSecondVerifier: {
      verify: async ({ code }) => code === '654321',
    },
    logger: false,
  });
  await app.init();
  return { app, auditActorRef, auditRepository, functionalRepository };
};

describe('P0-045 sensitive operation audit API', () => {
  it('appends one immutable audit event with the invite and exposes only masked fields', async () => {
    const fixture = await createFixture();
    try {
      const created = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'audit-invite-0001')
        .set('x-request-id', requestId)
        .send(inviteBody());
      expect(created.status).toBe(201);

      const response = await request(fixture.app.getHttpServer())
        .get('/v1/audit/events?page=1&pageSize=20');
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('private');
      expect(response.body).toMatchObject({ page: 1, pageSize: 20, total: 1 });
      expect(response.body.items[0]).toMatchObject({
        actorType: 'SUPPLIER_USER',
        actorId: actorIdentityId,
        action: 'functional_account.invited',
        objectType: 'functional_account',
        objectId: created.body.id,
        requestId,
        afterSnapshot: {
          accountTypeCode: 'SUPPLIER_PRODUCT',
          displayName: '商品运营员',
          status: 'PENDING_ACTIVATION',
        },
      });
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toMatch(/13900139000|product@example\.test|supplyPrice|bankAccount|"ip"/u);
      expect(await fixture.auditRepository.count()).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-045-01 rolls back the account when the audit append fails', async () => {
    const fixture = await createFixture({ failAppend: true });
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/functional-accounts')
        .set('Idempotency-Key', 'audit-failure-0001')
        .set('x-request-id', requestId)
        .send(inviteBody());
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'AUDIT_REQUIRED' });
      expect(await fixture.functionalRepository.countAccounts(supplierId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-045-03 rejects actor spoof fields and denies non-audit workspaces', async () => {
    const fixture = await createFixture();
    try {
      for (const spoof of [{ actorId: actorIdentityId }, { applicantId: actorIdentityId }]) {
        const response = await request(fixture.app.getHttpServer())
          .post('/v1/supplier/functional-accounts')
          .set('Idempotency-Key', `spoof-${Object.keys(spoof)[0]}-0001`)
          .set('x-request-id', requestId)
          .send(inviteBody(spoof));
        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({ code: 'ACTOR_SPOOFED' });
      }
      fixture.auditActorRef.current = {
        ...fixture.auditActorRef.current,
        accountTypeCode: 'COMPANY_FINANCE',
        workspaceRoute: '/company-admin/workspaces/finance',
      };
      const denied = await request(fixture.app.getHttpServer()).get('/v1/audit/events');
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
    } finally {
      await fixture.app.close();
    }
  });
});
