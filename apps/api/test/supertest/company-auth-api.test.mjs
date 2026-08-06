import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { InMemoryCompanyAuthRepository } from '../../dist/company-auth/in-memory-company-auth.repository.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000001';
const firstAccountId = '30000000-0000-4000-8000-000000000001';
const secondAccountId = '30000000-0000-4000-8000-000000000002';
const validTestCredential = 'company-auth-test-only-valid';
const invalidTestCredential = 'company-auth-test-only-invalid';

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
  id: userId,
  companyId,
  name: '平台管理员',
  mobile: '13800138000',
  email: 'admin@example.test',
  status: 'ACTIVE',
  lastLoginAt: null,
  version: 0,
};

const account = (overrides = {}) => ({
  id: firstAccountId,
  identityId: userId,
  companyId,
  ownerType: 'COMPANY',
  ownerDisplayName: '江苏福礼团供应链科技有限公司',
  accountTypeCode: 'COMPANY_SUPER_ADMIN',
  accountTypeName: '超级管理员',
  workspaceRoute: '/company-admin/workspaces/system',
  displayName: '平台管理员',
  status: 'ACTIVE',
  expiresAt: null,
  lastUsedAt: null,
  ...overrides,
});

const loginBody = (overrides = {}) => ({
  loginAccount: user.mobile,
  password: validTestCredential,
  requestId: '40000000-0000-4000-8000-000000000001',
  ...overrides,
});

const createFixture = async ({ accounts = [account()], users = [user] } = {}) => {
  const repository = new InMemoryCompanyAuthRepository({ accounts, users });
  const app = await createApplication({
    config: config(),
    probes: probes(),
    companyAuthRepository: repository,
    companyCredentialVerifier: {
      verify: async ({ password }) => ({
        valid: password === validTestCredential,
        secondVerificationRequired: false,
      }),
    },
    companySecondVerifier: { verify: async ({ code }) => code === '654321' },
    logger: false,
  });
  await app.init();
  return { app, repository };
};

describe('P0-066 company login and functional workspace selection', () => {
  it('signs a one-functional-account session without returning its raw token', async () => {
    const fixture = await createFixture();
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        selectionRequired: false,
        selectionNonce: '',
        accounts: [
          {
            accountId: firstAccountId,
            accountTypeCode: 'COMPANY_SUPER_ADMIN',
            workspaceRoute: '/company-admin/workspaces/system',
          },
        ],
      });
      expect(response.body).not.toHaveProperty('sessionToken');
      expect(response.headers['set-cookie']?.[0]).toContain(
        '__Host-fulishe-company-admin=',
      );
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-066-01 exposes no public company registration capability', async () => {
    const fixture = await createFixture();
    try {
      for (const method of ['get', 'post']) {
        const response = await request(fixture.app.getHttpServer())[method](
          '/v1/company-auth/register',
        );
        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
      }
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-066-02 requires selection for a multi-account identity', async () => {
    const fixture = await createFixture({
      accounts: [
        account(),
        account({
          id: secondAccountId,
          accountTypeCode: 'COMPANY_FINANCE',
          accountTypeName: '财务',
          workspaceRoute: '/company-admin/workspaces/finance',
        }),
      ],
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());

      expect(login.status).toBe(200);
      expect(login.body.selectionRequired).toBe(true);
      expect(login.body.selectionNonce).toMatch(/^[a-zA-Z0-9_-]{32,}$/u);
      expect(login.body.accounts).toHaveLength(2);
      expect(login.headers['set-cookie']).toBeUndefined();
      expect(await fixture.repository.countActiveSessions(userId)).toBe(0);

      const selected = await request(fixture.app.getHttpServer())
        .post(`/v1/company-auth/workspaces/${secondAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      expect(selected.status).toBe(200);
      expect(selected.body).toEqual({
        functionalAccountId: secondAccountId,
        ownerType: 'COMPANY',
        companyId,
        accountTypeCode: 'COMPANY_FINANCE',
        workspaceRoute: '/company-admin/workspaces/finance',
        expiresAt: expect.any(String),
      });
      expect(selected.body).not.toHaveProperty('sessionToken');
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-066-03 cannot use one selection context for two functional accounts', async () => {
    const fixture = await createFixture({
      accounts: [account(), account({ id: secondAccountId })],
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());
      const first = await request(fixture.app.getHttpServer())
        .post(`/v1/company-auth/workspaces/${firstAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      const conflict = await request(fixture.app.getHttpServer())
        .post(`/v1/company-auth/workspaces/${secondAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });

      expect(first.status).toBe(200);
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ code: 'WORKSPACE_SESSION_CONFLICT' });
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('keeps requestId retries to one pending selection command', async () => {
    const fixture = await createFixture({
      accounts: [account(), account({ id: secondAccountId })],
    });
    try {
      const first = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());
      const replay = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());

      expect(first.status).toBe(200);
      expect(replay.status).toBe(200);
      expect(replay.body.selectionNonce).toBe(first.body.selectionNonce);
      expect(await fixture.repository.countSelectionGrants(userId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('keeps a completed selection command immutable across login requestId retries', async () => {
    const fixture = await createFixture({
      accounts: [account(), account({ id: secondAccountId })],
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());
      const selected = await request(fixture.app.getHttpServer())
        .post(`/v1/company-auth/workspaces/${firstAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      const replayedLogin = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());
      const conflictingSelection = await request(fixture.app.getHttpServer())
        .post(`/v1/company-auth/workspaces/${secondAccountId}/select`)
        .send({ selectionNonce: replayedLogin.body.selectionNonce });

      expect(selected.status).toBe(200);
      expect(replayedLogin.status).toBe(200);
      expect(replayedLogin.body.selectionNonce).toBe(login.body.selectionNonce);
      expect(conflictingSelection.status).toBe(409);
      expect(conflictingSelection.body).toMatchObject({
        code: 'WORKSPACE_SESSION_CONFLICT',
      });
      expect(await fixture.repository.countSelectionGrants(userId)).toBe(1);
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-066-04 rejects a disabled account without issuing a session', async () => {
    const fixture = await createFixture({
      accounts: [account(), account({ id: secondAccountId, status: 'SUSPENDED' })],
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());
      const response = await request(fixture.app.getHttpServer())
        .post(`/v1/company-auth/workspaces/${secondAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await fixture.repository.countActiveSessions(userId)).toBe(0);

      const spoofedOwner = await request(fixture.app.getHttpServer())
        .post(`/v1/company-auth/workspaces/${firstAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce, companyId });
      expect(spoofedOwner.status).toBe(403);
      expect(spoofedOwner.body).toMatchObject({ code: 'DATA_SCOPE_FORBIDDEN' });
    } finally {
      await fixture.app.close();
    }
  });

  it('fails closed when an account is suspended during session issuance', async () => {
    const fixture = await createFixture();
    const issueSession = fixture.repository.issueSession.bind(fixture.repository);
    fixture.repository.issueSession = async (command) => {
      fixture.repository.setAccountStatusForTest(firstAccountId, 'SUSPENDED');
      return issueSession(command);
    };
    try {
      const response = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await fixture.repository.countActiveSessions(userId)).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('uses the same safe error for unknown and invalid credentials and hashes audit accounts', async () => {
    const fixture = await createFixture();
    try {
      const invalid = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody({ password: invalidTestCredential }));
      const unknown = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody({ loginAccount: '13900139000' }));

      expect(invalid.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(invalid.body).toMatchObject({
        code: 'AUTH_INVALID',
        message: '账号或凭证不正确',
      });
      expect(unknown.body).toMatchObject({
        code: 'AUTH_INVALID',
        message: '账号或凭证不正确',
      });
      const audits = fixture.repository.readLoginAudits();
      expect(audits).toHaveLength(2);
      expect(audits.every(({ loginAccountHash }) => /^[a-f0-9]{64}$/u.test(loginAccountHash))).toBe(
        true,
      );
      expect(JSON.stringify(audits)).not.toContain(user.mobile);
    } finally {
      await fixture.app.close();
    }
  });

  it('returns RATE_LIMITED after repeated invalid credentials without exposing account existence', async () => {
    const fixture = await createFixture();
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await request(fixture.app.getHttpServer())
          .post('/v1/company-auth/login')
          .send(loginBody({ password: invalidTestCredential }));
        expect(response.status).toBe(401);
      }
      const blocked = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody({ password: validTestCredential }));
      expect(blocked.status).toBe(429);
      expect(blocked.body).toMatchObject({ code: 'RATE_LIMITED' });
      expect(blocked.headers['set-cookie']).toBeUndefined();
    } finally {
      await fixture.app.close();
    }
  });
});
