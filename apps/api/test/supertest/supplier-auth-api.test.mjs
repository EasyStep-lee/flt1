import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemorySupplierAuthRepository } from '../../dist/supplier-auth/in-memory-supplier-auth.repository.js';

const supplierId = '10000000-0000-4000-8000-000000000069';
const userId = '20000000-0000-4000-8000-000000000069';
const firstAccountId = '30000000-0000-4000-8000-000000000069';
const secondAccountId = '30000000-0000-4000-8000-000000000070';
const validCredential = 'supplier-auth-test-only-valid';

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

const user = {
  email: 'supplier@example.test',
  id: userId,
  lastLoginAt: null,
  mobile: '13800138000',
  name: '供应商联系人',
  status: 'ACTIVE',
  supplierId,
  supplierStatus: 'ACTIVE',
  version: 0,
};

const account = (overrides = {}) => ({
  accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
  accountTypeName: '主体管理',
  accountTypeStatus: 'ACTIVE',
  displayName: '供应商联系人',
  expiresAt: null,
  id: firstAccountId,
  identityId: userId,
  lastUsedAt: null,
  ownerDisplayName: '测试供应商有限公司',
  ownerType: 'SUPPLIER',
  status: 'ACTIVE',
  supplierId,
  workspaceRoute: '/supplier/workspaces/account-admin',
  ...overrides,
});

const loginBody = (overrides = {}) => ({
  loginAccount: user.mobile,
  password: validCredential,
  requestId: '40000000-0000-4000-8000-000000000069',
  ...overrides,
});

const createFixture = async ({
  accounts = [account()],
  users = [user],
  secondVerificationRequired = false,
} = {}) => {
  const repository = new InMemorySupplierAuthRepository({ accounts, users });
  const app = await createApplication({
    config: config(),
    probes: probes(),
    supplierAuthRepository: repository,
    supplierCredentialVerifier: {
      verify: async ({ password }) => ({
        valid: password === validCredential,
        secondVerificationRequired,
      }),
    },
    supplierSecondVerifier: { verify: async ({ code }) => code === '654321' },
    logger: false,
  });
  await app.init();
  return { app, repository };
};

describe('P0-069 supplier login and functional workspace selection', () => {
  it('NEG-M1-069-01 rejects client-supplied supplier ownership', async () => {
    const fixture = await createFixture();
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send({
          loginAccount: '13800138000',
          password: 'invalid',
          requestId: '40000000-0000-4000-8000-000000000069',
          supplierId: '10000000-0000-4000-8000-000000000069',
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'DATA_SCOPE_FORBIDDEN' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-069-02 uses a non-enumerating credential error', async () => {
    const fixture = await createFixture();
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send({
          loginAccount: '13800138000',
          password: 'invalid',
          requestId: '40000000-0000-4000-8000-000000000069',
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'AUTH_INVALID',
        message: '账号或凭证不正确',
      });
    } finally {
      await fixture.app.close();
    }
  });

  it('fails closed when one login identifier ambiguously matches multiple supplier users', async () => {
    const fixture = await createFixture({
      users: [
        user,
        {
          ...user,
          email: 'other@example.test',
          id: '20000000-0000-4000-8000-000000000070',
          supplierId: '10000000-0000-4000-8000-000000000070',
        },
      ],
    });
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'AUTH_INVALID' });
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await fixture.repository.countActiveSessions(userId)).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-069-03 refuses workspace selection without a valid grant', async () => {
    const fixture = await createFixture();
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/workspaces/30000000-0000-4000-8000-000000000069/select')
        .send({ selectionNonce: 'a'.repeat(43) });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      expect(response.headers['set-cookie']).toBeUndefined();
    } finally {
      await fixture.app.close();
    }
  });

  it('signs a sole eligible functional-account session without exposing owner ids', async () => {
    const fixture = await createFixture();
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        accountSelectRoute: '/supplier/account-select',
        selectionRequired: false,
        selectionNonce: '',
        accounts: [
          {
            accountId: firstAccountId,
            ownerType: 'SUPPLIER',
            accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
            workspaceRoute: '/supplier/workspaces/account-admin',
          },
        ],
      });
      expect(JSON.stringify(response.body)).not.toContain(supplierId);
      expect(response.body).not.toHaveProperty('userId');
      expect(response.body).not.toHaveProperty('sessionToken');
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['set-cookie']?.[0]).toContain(
        '__Host-fulishe-supplier-portal=',
      );
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
      expect(fixture.repository.readStoredSessionHashes()).toEqual([
        expect.stringMatching(/^[a-f0-9]{64}$/u),
      ]);
    } finally {
      await fixture.app.close();
    }
  });

  it('requires an explicit choice for multiple accounts and binds one server-owned workspace', async () => {
    const fixture = await createFixture({
      accounts: [
        account(),
        account({
          accountTypeCode: 'SUPPLIER_FINANCE',
          accountTypeName: '财务对账',
          id: secondAccountId,
          workspaceRoute: '/supplier/workspaces/finance',
        }),
      ],
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      expect(login.status).toBe(200);
      expect(login.body.selectionRequired).toBe(true);
      expect(login.body.selectionNonce).toMatch(/^[A-Za-z0-9_-]{32,}$/u);
      expect(login.body.accounts).toHaveLength(2);
      expect(login.headers['set-cookie']).toBeUndefined();

      const selected = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${secondAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      expect(selected.status).toBe(200);
      expect(selected.body).toEqual({
        accountTypeCode: 'SUPPLIER_FINANCE',
        expiresAt: expect.any(String),
        functionalAccountId: secondAccountId,
        ownerType: 'SUPPLIER',
        workspaceRoute: '/supplier/workspaces/finance',
      });
      expect(JSON.stringify(selected.body)).not.toContain(supplierId);
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('keeps requestId retries to one immutable selection grant', async () => {
    const fixture = await createFixture({
      accounts: [account(), account({ id: secondAccountId })],
    });
    try {
      const first = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      const replay = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());

      expect(replay.body.selectionNonce).toBe(first.body.selectionNonce);
      expect(await fixture.repository.countSelectionGrants(userId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-069-04 rejects disabled accounts and cross-account selection replay', async () => {
    const fixture = await createFixture({
      accounts: [account(), account({ id: secondAccountId })],
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      fixture.repository.setAccountStatusForTest(secondAccountId, 'SUSPENDED');
      const disabled = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${secondAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      expect(disabled.status).toBe(403);
      expect(disabled.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });

      const selected = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${firstAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      expect(selected.status).toBe(200);
      fixture.repository.setAccountStatusForTest(secondAccountId, 'ACTIVE');
      const conflict = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${secondAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ code: 'WORKSPACE_SESSION_CONFLICT' });
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('lists a disabled account type as unavailable and refuses its workspace', async () => {
    const fixture = await createFixture({
      accounts: [
        account(),
        account({
          accountTypeCode: 'SUPPLIER_FINANCE',
          accountTypeName: '财务对账',
          accountTypeStatus: 'DISABLED',
          id: secondAccountId,
          workspaceRoute: '/supplier/workspaces/finance',
        }),
      ],
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      expect(login.body.accounts).toContainEqual(
        expect.objectContaining({ accountId: secondAccountId, status: 'SUSPENDED' }),
      );

      const selected = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${secondAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      expect(selected.status).toBe(403);
      expect(selected.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      expect(await fixture.repository.countActiveSessions(userId)).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('invalidates an issued session when the supplier is suspended', async () => {
    const fixture = await createFixture();
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      const cookie = login.headers['set-cookie']?.[0].split(';')[0];
      fixture.repository.setSupplierStatusForTest(userId, 'SUSPENDED');

      const resolution = await fixture.repository.resolveSession(
        fixture.repository.readStoredSessionHashes()[0],
        new Date().toISOString(),
      );
      expect(cookie).toContain('__Host-fulishe-supplier-portal=');
      expect(resolution).toEqual({ kind: 'INVALID' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-069-02 rejects valid credentials for a non-active supplier', async () => {
    const fixture = await createFixture({
      users: [{ ...user, supplierStatus: 'SUSPENDED' }],
    });
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'SUPPLIER_NOT_ACTIVE' });
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await fixture.repository.countActiveSessions(userId)).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('requires second verification before issuing a selected workspace', async () => {
    const fixture = await createFixture({ secondVerificationRequired: true });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      const blocked = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${firstAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      expect(blocked.status).toBe(428);
      expect(blocked.body).toMatchObject({ code: 'SECOND_VERIFICATION_REQUIRED' });

      const selected = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${firstAccountId}/select`)
        .send({
          selectionNonce: login.body.selectionNonce,
          secondVerificationCode: '654321',
        });
      expect(selected.status).toBe(200);
    } finally {
      await fixture.app.close();
    }
  });
});
