import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemorySupplierAuthRepository } from '../../dist/supplier-auth/in-memory-supplier-auth.repository.js';
import { SupplierAuthService } from '../../dist/supplier-auth/supplier-auth.service.js';

const supplierId = '10000000-0000-4000-8000-000000000069';
const userId = '20000000-0000-4000-8000-000000000069';
const firstAccountId = '30000000-0000-4000-8000-000000000069';
const secondAccountId = '30000000-0000-4000-8000-000000000070';
const validCredential = 'supplier-auth-test-only-valid';
const invalidCredential = 'supplier-auth-test-only-invalid';
const signingKeyField = ['SUPPLIER_AUTH_SESSION_SIGNING', 'KEY'].join('_');

const config = (overrides = {}) =>
  loadRuntimeConfig({
    NODE_ENV: 'test',
    API_HOST: '127.0.0.1',
    API_PORT: '3000',
    DATABASE_URL:
      'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
    INFRA_HEALTH_TIMEOUT_MS: '50',
    [signingKeyField]: `unit-test-only-${'x'.repeat(32)}`,
    ...overrides,
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

const sessionTokenFrom = (response) => {
  const cookie = response.headers['set-cookie']?.[0];
  if (!cookie) return null;
  return cookie.split(';', 1)[0]?.split('=', 2)[1] ?? null;
};

const createFixture = async ({
  accounts = [account()],
  credentialVerifier: providedCredentialVerifier,
  repository: providedRepository,
  runtimeConfig = config(),
  secondVerifier: providedSecondVerifier,
  users = [user],
  secondVerificationRequired = false,
} = {}) => {
  const repository =
    providedRepository ?? new InMemorySupplierAuthRepository({ accounts, users });
  const app = await createApplication({
    config: runtimeConfig,
    probes: probes(),
    supplierAuthRepository: repository,
    supplierCredentialVerifier: providedCredentialVerifier ?? {
      verify: async ({ password }) => ({
        valid: password === validCredential,
        secondVerificationRequired,
      }),
    },
    supplierSecondVerifier: providedSecondVerifier ?? {
      verify: async ({ code }) => code === '654321',
    },
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
          password: invalidCredential,
          requestId: '40000000-0000-4000-8000-000000000069',
          supplierId: '10000000-0000-4000-8000-000000000069',
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'DATA_SCOPE_FORBIDDEN' });
      expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
    } finally {
      await fixture.app.close();
    }
  });

  it('rejects malformed optional login verification codes before session issuance', async () => {
    const credentialVerify = vi.fn(async () => ({
      valid: true,
      secondVerificationRequired: false,
    }));
    const fixture = await createFixture({
      credentialVerifier: { verify: credentialVerify },
    });
    try {
      const invalidCodes = [{ value: '654321' }, '1'.repeat(17)];
      for (const [index, verificationCode] of invalidCodes.entries()) {
        const response = await request(fixture.app.getHttpServer())
          .post('/v1/supplier-auth/login')
          .send(
            loginBody({
              requestId: `40000000-0000-4000-8000-${String(70 + index).padStart(12, '0')}`,
              verificationCode,
            }),
          );

        expect(response.status).toBe(422);
        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
      }
      expect(await fixture.repository.countSelectionGrants(userId)).toBe(0);
      expect(await fixture.repository.countActiveSessions(userId)).toBe(0);
      expect(credentialVerify).not.toHaveBeenCalled();
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
          password: invalidCredential,
          requestId: '40000000-0000-4000-8000-000000000069',
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        code: 'AUTH_INVALID',
        message: '账号或凭证不正确',
      });
      expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
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
      expect(fixture.repository.readLoginAudits()).toEqual([
        expect.objectContaining({
          deviceInfo: { userAgent: expect.any(String) },
          functionalAccountId: null,
          ip: expect.any(String),
          result: 'AUTH_INVALID',
          riskReason: 'WORKSPACE_SELECTION_INVALID',
          userId: null,
          userType: 'UNKNOWN',
        }),
      ]);
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
      expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
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

  it('keeps concurrent same-request direct-login cookies valid regardless of response order', async () => {
    const fixture = await createFixture();
    try {
      const responses = await Promise.all(
        Array.from({ length: 3 }, () =>
          request(fixture.app.getHttpServer())
            .post('/v1/supplier-auth/login')
            .send(loginBody()),
        ),
      );
      const tokens = responses.map(sessionTokenFrom);

      expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
      expect(tokens).toEqual([
        expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
        expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
        expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
      ]);
      expect(new Set(tokens).size).toBe(1);
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
      expect(await fixture.repository.countSelectionGrants(userId)).toBe(1);

      for (const token of tokens.toReversed()) {
        const resolved = await fixture.repository.resolveSession(
          createHash('sha256').update(token).digest('hex'),
          new Date().toISOString(),
        );
        expect(resolved).toMatchObject({
          kind: 'ACTIVE',
          session: { functionalAccountId: firstAccountId },
        });
      }
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

  it('binds selection nonces to a server secret while preserving requestId replay', async () => {
    const accounts = [account(), account({ id: secondAccountId })];
    const firstFixture = await createFixture({
      accounts,
      runtimeConfig: config({
        [signingKeyField]: `unit-test-only-${'a'.repeat(32)}`,
      }),
    });
    const secondFixture = await createFixture({
      accounts,
      runtimeConfig: config({
        [signingKeyField]: `unit-test-only-${'b'.repeat(32)}`,
      }),
    });
    try {
      const first = await request(firstFixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      const firstReplay = await request(firstFixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      const second = await request(secondFixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());

      expect(first.status).toBe(200);
      expect(firstReplay.body.selectionNonce).toBe(first.body.selectionNonce);
      expect(second.status).toBe(200);
      expect(first.body.selectionNonce).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect(second.body.selectionNonce).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect(second.body.selectionNonce).not.toBe(first.body.selectionNonce);
    } finally {
      await firstFixture.app.close();
      await secondFixture.app.close();
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

      const recovered = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${firstAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      expect(recovered.status).toBe(200);
      expect(recovered.body).toEqual(selected.body);
      expect(recovered.headers['idempotency-replayed']).toBe('true');
      expect(recovered.headers['set-cookie']?.[0]).toContain(
        '__Host-fulishe-supplier-portal=',
      );
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);

      fixture.repository.setAccountStatusForTest(secondAccountId, 'ACTIVE');
      const conflict = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${secondAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });
      expect(conflict.status).toBe(409);
      expect(conflict.body).toMatchObject({ code: 'WORKSPACE_SESSION_CONFLICT' });
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
      expect(
        fixture.repository
          .readLoginAudits()
          .filter(({ riskReason }) =>
            ['WORKSPACE_ACCOUNT_UNAVAILABLE', 'WORKSPACE_SESSION_CONFLICT'].includes(
              riskReason,
            ),
          ),
      ).toEqual([
        expect.objectContaining({
          functionalAccountId: secondAccountId,
          result: 'ACCOUNT_SUSPENDED',
          riskReason: 'WORKSPACE_ACCOUNT_UNAVAILABLE',
          userId,
          userType: 'SUPPLIER_USER',
        }),
        expect.objectContaining({
          functionalAccountId: secondAccountId,
          result: 'AUTH_INVALID',
          riskReason: 'WORKSPACE_SESSION_CONFLICT',
          userId,
          userType: 'SUPPLIER_USER',
        }),
      ]);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-069-04 keeps every concurrent same-account replay cookie valid regardless of response order', async () => {
    const fixture = await createFixture({
      accounts: [account(), account({ id: secondAccountId })],
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());

      const responses = await Promise.all(
        Array.from({ length: 3 }, () =>
          request(fixture.app.getHttpServer())
            .post(`/v1/supplier-auth/workspaces/${firstAccountId}/select`)
            .send({ selectionNonce: login.body.selectionNonce }),
        ),
      );
      const tokens = responses.map(sessionTokenFrom);

      expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
      expect(tokens).toEqual([
        expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
        expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
        expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
      ]);
      expect(new Set(tokens).size).toBe(1);
      expect(tokens[0]).not.toBe(login.body.selectionNonce);
      expect(
        responses.filter(
          ({ headers }) => headers['idempotency-replayed'] === 'true',
        ),
      ).toHaveLength(2);
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
      expect(fixture.repository.readStoredSessionHashes()).toHaveLength(1);

      for (const token of tokens.toReversed()) {
        const resolved = await fixture.repository.resolveSession(
          createHash('sha256').update(token).digest('hex'),
          new Date().toISOString(),
        );
        expect(resolved).toMatchObject({
          kind: 'ACTIVE',
          session: { functionalAccountId: firstAccountId },
        });
      }
    } finally {
      await fixture.app.close();
    }
  });

  it('fails closed for an existing supplier cookie after the session signing key rotates', async () => {
    const fixture = await createFixture();
    let rotatedFixture;
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      const token = sessionTokenFrom(login);

      rotatedFixture = await createFixture({
        repository: fixture.repository,
        runtimeConfig: config({
          [signingKeyField]: `unit-test-only-${'y'.repeat(32)}`,
        }),
      });

      await expect(
        rotatedFixture.app
          .get(SupplierAuthService)
          .resolveActiveSession(`__Host-fulishe-supplier-portal=${token}`),
      ).rejects.toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
    } finally {
      await rotatedFixture?.app.close();
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

  it('lists an expired active account as unavailable and refuses its workspace', async () => {
    const fixture = await createFixture({
      accounts: [
        account(),
        account({
          accountTypeCode: 'SUPPLIER_FINANCE',
          accountTypeName: '财务对账',
          expiresAt: '2020-01-01T00:00:00.000Z',
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

  it('recovers a second-verified workspace without consuming another one-time code', async () => {
    const secondVerify = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const fixture = await createFixture({
      secondVerificationRequired: true,
      secondVerifier: { verify: secondVerify },
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody({ requestId: '40000000-0000-4000-8000-000000000073' }));
      const selected = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${firstAccountId}/select`)
        .send({
          selectionNonce: login.body.selectionNonce,
          secondVerificationCode: '654321',
        });
      const recovered = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${firstAccountId}/select`)
        .send({ selectionNonce: login.body.selectionNonce });

      expect(selected.status).toBe(200);
      expect(recovered.status).toBe(200);
      expect(recovered.body).toEqual(selected.body);
      expect(recovered.headers['idempotency-replayed']).toBe('true');
      expect(sessionTokenFrom(recovered)).toBe(sessionTokenFrom(selected));
      expect(secondVerify).toHaveBeenCalledOnce();
      expect(await fixture.repository.countActiveSessions(userId)).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });

  it('rejects malformed optional second-verification codes without consuming the grant', async () => {
    const secondVerify = vi.fn(async ({ code }) => code === '654321');
    const fixture = await createFixture({
      secondVerificationRequired: true,
      secondVerifier: { verify: secondVerify },
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(
          loginBody({ requestId: '40000000-0000-4000-8000-000000000072' }),
        );
      expect(login.status).toBe(200);

      for (const secondVerificationCode of [{ value: '654321' }, '1'.repeat(17)]) {
        const response = await request(fixture.app.getHttpServer())
          .post(`/v1/supplier-auth/workspaces/${firstAccountId}/select`)
          .send({
            selectionNonce: login.body.selectionNonce,
            secondVerificationCode,
          });

        expect(response.status).toBe(422);
        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
      }
      expect(await fixture.repository.countActiveSessions(userId)).toBe(0);
      expect(secondVerify).not.toHaveBeenCalled();

      const selected = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${firstAccountId}/select`)
        .send({
          selectionNonce: login.body.selectionNonce,
          secondVerificationCode: '654321',
      });
      expect(selected.status).toBe(200);
      expect(secondVerify).toHaveBeenCalledOnce();
    } finally {
      await fixture.app.close();
    }
  });
});
