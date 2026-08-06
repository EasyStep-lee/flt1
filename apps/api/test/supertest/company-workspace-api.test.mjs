import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { InMemoryCompanyAuthRepository } from '../../dist/company-auth/in-memory-company-auth.repository.js';

const companyId = '00000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000067';
const validCredential = 'company-workspace-test-only-valid';

const workspaces = [
  ['COMPANY_SUPER_ADMIN', '超级管理员', 'PAGE-003', '/company-admin/workspaces/system', '系统与账号'],
  ['COMPANY_SUPPLIER_OPS', '供应商运营', 'PAGE-004', '/company-admin/workspaces/supplier-ops', '供应商运营'],
  ['COMPANY_PRODUCT_OPS', '商品与分类运营', 'PAGE-005', '/company-admin/workspaces/product-ops', '商品与分类'],
  ['COMPANY_PRICE_REVIEW', '采购/价格审核', 'PAGE-006', '/company-admin/workspaces/price-review', '价格审核'],
  ['COMPANY_ORDER_SERVICE', '订单客服', 'PAGE-007', '/company-admin/workspaces/order-service', '订单客服'],
  ['COMPANY_WELFARE_CARD', '福利卡运营', 'PAGE-008', '/company-admin/workspaces/welfare-card', '福利卡运营'],
  ['COMPANY_FINANCE', '财务结算', 'PAGE-009', '/company-admin/workspaces/finance', '财务结算'],
  ['COMPANY_LOGISTICS', '物流运营', 'PAGE-010', '/company-admin/workspaces/logistics', '物流中心'],
  ['COMPANY_CONTENT', '门户内容编辑', 'PAGE-011', '/company-admin/workspaces/content', '门户内容'],
  ['COMPANY_AUDIT', '审计/只读', 'PAGE-012', '/company-admin/workspaces/audit', '审计风控'],
];

const config = () => ({
  appEnv: 'test',
  port: 3000,
  databaseUrl: 'mysql://local:test@127.0.0.1:3306/test',
  redisUrl: 'redis://127.0.0.1:6379/0',
  logLevel: 'silent',
  healthProbeTimeoutMs: 50,
  wechatPayAdapter: 'stub',
  smsAdapter: 'stub',
  objectStorageAdapter: 'stub',
});

const probes = () => ['mysql', 'redis', 'queue'].map((name) => ({
  name,
  check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
}));

const user = {
  id: userId,
  companyId,
  name: '公司职能测试用户',
  mobile: '13800000067',
  email: 'company-workspace@example.test',
  status: 'ACTIVE',
  lastLoginAt: null,
  version: 0,
};

const account = (workspace, index = 0) => ({
  id: `30000000-0000-4000-8000-${String(index + 67).padStart(12, '0')}`,
  identityId: userId,
  companyId,
  ownerType: 'COMPANY',
  ownerDisplayName: '江苏福礼团供应链科技有限公司',
  accountTypeCode: workspace[0],
  accountTypeName: workspace[1],
  workspaceRoute: workspace[3],
  displayName: `${workspace[1]}测试账号`,
  status: 'ACTIVE',
  expiresAt: null,
  lastUsedAt: null,
});

const loginBody = (requestId = '40000000-0000-4000-8000-000000000067') => ({
  loginAccount: user.mobile,
  password: validCredential,
  requestId,
});

const cookieFrom = (response) => response.headers['set-cookie']?.[0]?.split(';')[0];

const createFixture = async ({
  accounts,
  auditLogRepository,
  companyFunctionalAccountRepository,
  supplierOnboardingRepository,
}) => {
  const repository = new InMemoryCompanyAuthRepository({ accounts, users: [user] });
  const app = await createApplication({
    config: config(),
    probes: probes(),
    companyAuthRepository: repository,
    companyCredentialVerifier: {
      verify: async ({ password }) => ({
        valid: password === validCredential,
        secondVerificationRequired: false,
      }),
    },
    companySecondVerifier: { verify: async () => true },
    ...(auditLogRepository ? { auditLogRepository } : {}),
    ...(companyFunctionalAccountRepository
      ? { companyFunctionalAccountRepository }
      : {}),
    ...(supplierOnboardingRepository ? { supplierOnboardingRepository } : {}),
    logger: false,
  });
  await app.init();
  return { app, repository };
};

describe('P0-067 company fixed workspaces', () => {
  it('maps all ten company roles to one fixed page and one non-leaking menu', async () => {
    for (const [index, workspace] of workspaces.entries()) {
      const fixture = await createFixture({ accounts: [account(workspace, index)] });
      try {
        const login = await request(fixture.app.getHttpServer())
          .post('/v1/company-auth/login')
          .send(loginBody(`40000000-0000-4000-8000-${String(index + 67).padStart(12, '0')}`));
        const cookie = cookieFrom(login);
        expect(cookie).toBeTruthy();

        const response = await request(fixture.app.getHttpServer())
          .get('/v1/company-auth/workspace/current')
          .query({ route: workspace[3] })
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toContain('private');
        expect(response.headers['cache-control']).toContain('no-store');
        expect(response.body).toEqual({
          accountTypeCode: workspace[0],
          accountTypeName: workspace[1],
          pageId: workspace[2],
          workspaceRoute: workspace[3],
          menuItems: [{ key: 'workspace', label: workspace[4], route: workspace[3] }],
        });
        for (const other of workspaces.filter((candidate) => candidate[0] !== workspace[0])) {
          expect(JSON.stringify(response.body)).not.toContain(other[3]);
        }
      } finally {
        await fixture.app.close();
      }
    }
  });

  it('NEG-M1-067-01 rejects a deep link before any foreign workspace data loads', async () => {
    const fixture = await createFixture({ accounts: [account(workspaces[1], 1)] });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());
      const response = await request(fixture.app.getHttpServer())
        .get('/v1/company-auth/workspace/current')
        .query({ route: workspaces[8][3] })
        .set('Cookie', cookieFrom(login));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      expect(JSON.stringify(response.body)).not.toContain(workspaces[8][1]);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-067-03 rejects a mismatched company API before object lookup', async () => {
    const auditList = vi.fn(async () => ({ items: [], total: 0 }));
    const fixture = await createFixture({
      accounts: [account(workspaces[1], 1)],
      auditLogRepository: {
        append: async () => undefined,
        list: auditList,
      },
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());
      const response = await request(fixture.app.getHttpServer())
        .get('/v1/audit/events')
        .set('Cookie', cookieFrom(login));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      expect(auditList).not.toHaveBeenCalled();
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-067-04 revokes the old cookie when the natural person switches roles', async () => {
    const fixture = await createFixture({
      accounts: [account(workspaces[0], 0), account(workspaces[6], 6)],
    });
    try {
      const firstLogin = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody('40000000-0000-4000-8000-000000000167'));
      const firstSelection = await request(fixture.app.getHttpServer())
        .post(`/v1/company-auth/workspaces/${account(workspaces[0], 0).id}/select`)
        .send({ selectionNonce: firstLogin.body.selectionNonce });
      const oldCookie = cookieFrom(firstSelection);

      const secondLogin = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody('40000000-0000-4000-8000-000000000267'));
      const secondSelection = await request(fixture.app.getHttpServer())
        .post(`/v1/company-auth/workspaces/${account(workspaces[6], 6).id}/select`)
        .send({ selectionNonce: secondLogin.body.selectionNonce });
      const newCookie = cookieFrom(secondSelection);

      const revoked = await request(fixture.app.getHttpServer())
        .get('/v1/company-auth/workspace/current')
        .query({ route: workspaces[0][3] })
        .set('Cookie', oldCookie);
      const active = await request(fixture.app.getHttpServer())
        .get('/v1/company-auth/workspace/current')
        .query({ route: workspaces[6][3] })
        .set('Cookie', newCookie);

      expect(revoked.status).toBe(401);
      expect(revoked.body).toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
      expect(active.status).toBe(200);
      expect(active.body).toMatchObject({ accountTypeCode: 'COMPANY_FINANCE' });
    } finally {
      await fixture.app.close();
    }
  });

  it('API-013/API-014 bind company account administration to the super-admin session', async () => {
    const initial = {
      id: account(workspaces[0], 0).id,
      identityId: userId,
      companyId,
      accountTypeCode: 'COMPANY_SUPER_ADMIN',
      displayName: '公司超级管理员',
      mobile: user.mobile,
      email: user.email,
      status: 'ACTIVE',
      expiresAt: null,
      lastLoginAt: null,
      version: 0,
    };
    const listCompanyAccounts = vi.fn(async () => ({ items: [initial], total: 1 }));
    const createCompanyAccount = vi.fn(async (command) => ({
      kind: 'OK',
      replayed: false,
      value: {
        ...initial,
        id: '30000000-0000-4000-8000-000000000099',
        identityId: '20000000-0000-4000-8000-000000000099',
        accountTypeCode: command.accountTypeCode,
        displayName: command.displayName,
        mobile: command.mobile,
        email: command.email,
        status: 'PENDING_ACTIVATION',
      },
    }));
    const functionalRepository = {
      createCompanyAccount,
      findCompanyAccountByMobile: async () => null,
      isCompanyActive: async () => true,
      listCompanyAccounts,
    };
    const fixture = await createFixture({
      accounts: [account(workspaces[0], 0)],
      companyFunctionalAccountRepository: functionalRepository,
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());
      const cookie = cookieFrom(login);
      const listed = await request(fixture.app.getHttpServer())
        .get('/v1/company/functional-accounts')
        .set('Cookie', cookie);
      const created = await request(fixture.app.getHttpServer())
        .post('/v1/company/functional-accounts')
        .set('Cookie', cookie)
        .set('Idempotency-Key', 'company-account-invite-0001')
        .send({
          accountTypeCode: 'COMPANY_FINANCE',
          inviteeName: '财务复核员',
          inviteeMobile: '13900000067',
          inviteeEmail: 'finance@example.test',
          secondVerificationCode: '654321',
        });

      expect(listed.status).toBe(200);
      expect(listed.body).toMatchObject({
        total: 1,
        items: [{ accountTypeCode: 'COMPANY_SUPER_ADMIN' }],
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        accountTypeCode: 'COMPANY_FINANCE',
        status: 'PENDING_ACTIVATION',
        workspaceRoute: '/company-admin/workspaces/finance',
      });
      expect(createCompanyAccount).toHaveBeenCalledWith(
        expect.objectContaining({ companyId, actorIdentityId: userId }),
      );

      const spoofed = await request(fixture.app.getHttpServer())
        .post('/v1/company/functional-accounts')
        .set('Cookie', cookie)
        .set('Idempotency-Key', 'company-account-invite-0002')
        .send({
          accountTypeCode: 'COMPANY_FINANCE',
          inviteeName: '越权账号',
          inviteeMobile: '13900000068',
          inviteeEmail: 'spoof@example.test',
          secondVerificationCode: '654321',
          companyId: '00000000-0000-4000-8000-000000000099',
        });
      expect(spoofed.status).toBe(403);
      expect(spoofed.body).toMatchObject({ code: 'DATA_SCOPE_FORBIDDEN' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-067-03 blocks non-super-admin account APIs before repository lookup', async () => {
    const listCompanyAccounts = vi.fn(async () => ({ items: [], total: 0 }));
    const fixture = await createFixture({
      accounts: [account(workspaces[1], 1)],
      companyFunctionalAccountRepository: {
        createCompanyAccount: async () => {
          throw new Error('UNEXPECTED_CREATE');
        },
        findCompanyAccountByMobile: async () => null,
        isCompanyActive: async () => true,
        listCompanyAccounts,
      },
    });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/company-auth/login')
        .send(loginBody());
      const response = await request(fixture.app.getHttpServer())
        .get('/v1/company/functional-accounts')
        .set('Cookie', cookieFrom(login));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });
      expect(listCompanyAccounts).not.toHaveBeenCalled();
    } finally {
      await fixture.app.close();
    }
  });
});
