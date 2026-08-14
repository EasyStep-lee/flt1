import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { InMemoryCompanyAuthRepository } from '../../dist/company-auth/in-memory-company-auth.repository.js';

const companyId = '00000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000068';
const validCredential = 'company-page-test-only-valid';

const workspaces = [
  ['COMPANY_SUPER_ADMIN', '超级管理员', 'PAGE-003', '/company-admin/workspaces/system'],
  ['COMPANY_SUPPLIER_OPS', '供应商运营', 'PAGE-004', '/company-admin/workspaces/supplier-ops'],
  ['COMPANY_PRODUCT_OPS', '商品与分类运营', 'PAGE-005', '/company-admin/workspaces/product-ops'],
  ['COMPANY_PRICE_REVIEW', '采购/价格审核', 'PAGE-006', '/company-admin/workspaces/price-review'],
  ['COMPANY_ORDER_SERVICE', '订单客服', 'PAGE-007', '/company-admin/workspaces/order-service'],
  ['COMPANY_WELFARE_CARD', '福利卡运营', 'PAGE-008', '/company-admin/workspaces/welfare-card'],
  ['COMPANY_FINANCE', '财务结算', 'PAGE-009', '/company-admin/workspaces/finance'],
  ['COMPANY_LOGISTICS', '物流运营', 'PAGE-010', '/company-admin/workspaces/logistics'],
  ['COMPANY_CONTENT', '门户内容编辑', 'PAGE-011', '/company-admin/workspaces/content'],
  ['COMPANY_AUDIT', '审计/只读', 'PAGE-012', '/company-admin/workspaces/audit'],
];

const expectedModuleKeys = {
  COMPANY_SUPER_ADMIN: ['functional-accounts', 'session-control', 'system-parameters'],
  COMPANY_SUPPLIER_OPS: ['onboarding-review', 'supplier-profiles', 'qualification-alerts'],
  COMPANY_PRODUCT_OPS: ['category-templates', 'product-material-review', 'enterprise-shelf'],
  COMPANY_PRICE_REVIEW: ['initial-price-review', 'supply-price-change-review', 'price-history'],
  COMPANY_ORDER_SERVICE: ['personal-orders', 'enterprise-orders', 'refund-initiation', 'after-sales-cases'],
  COMPANY_WELFARE_CARD: ['welfare-plans', 'card-batches', 'account-ledger'],
  COMPANY_FINANCE: ['payment-reconciliation', 'refund-review', 'supplier-statements'],
  COMPANY_LOGISTICS: ['runner-operations', 'personal-deliveries', 'enterprise-deliveries'],
  COMPANY_CONTENT: ['content-tree', 'content-preview', 'publication-history'],
  COMPANY_AUDIT: ['audit-events', 'login-events', 'sensitive-exports'],
};

const config = () => ({
  appEnv: 'test',
  port: 3000,
  databaseUrl: 'mysql://local:unit-test-only@127.0.0.1:3306/test',
  redisUrl: 'redis://127.0.0.1:6379/0',
  logLevel: 'silent',
  healthProbeTimeoutMs: 50,
  wechatPayAdapter: 'stub',
  smsAdapter: 'stub',
  objectStorageAdapter: 'stub',
});

const probes = () =>
  ['mysql', 'redis', 'queue'].map((name) => ({
    name,
    check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
  }));

const user = {
  id: userId,
  companyId,
  name: '公司页面测试用户',
  mobile: '13800000068',
  email: 'company-page@example.test',
  status: 'ACTIVE',
  lastLoginAt: null,
  version: 0,
};

const account = (workspace, index = 0) => ({
  id: `30000000-0000-4000-8000-${String(index + 168).padStart(12, '0')}`,
  identityId: userId,
  companyId,
  ownerType: 'COMPANY',
  ownerDisplayName: '江苏福礼团供应链科技有限公司',
  accountTypeCode: workspace[0],
  accountTypeName: workspace[1],
  workspaceRoute: workspace[3],
  displayName: `${workspace[1]}页面测试账号`,
  status: 'ACTIVE',
  expiresAt: null,
  lastUsedAt: null,
});

const loginBody = (requestId = '40000000-0000-4000-8000-000000000068') => ({
  loginAccount: user.mobile,
  password: validCredential,
  requestId,
});

const cookieFrom = (response) => response.headers['set-cookie']?.[0]?.split(';')[0];

const createFixture = async (workspace, index = 0) => {
  const repository = new InMemoryCompanyAuthRepository({
    accounts: [account(workspace, index)],
    users: [user],
  });
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
    logger: false,
  });
  await app.init();
  const login = await request(app.getHttpServer())
    .post('/v1/company-auth/login')
    .send(loginBody(`40000000-0000-4000-8000-${String(index + 168).padStart(12, '0')}`));
  return { app, cookie: cookieFrom(login) };
};

const forbiddenResponsePattern =
  /companyId|functionalAccountId|identityId|sessionToken|supplyPrice|supplierPayable|grossMargin|bankAccount/iu;

describe('P0-068 complete company workspace pages', () => {
  it('returns a distinct server-bound module catalog for all ten workspaces', async () => {
    for (const [index, workspace] of workspaces.entries()) {
      const fixture = await createFixture(workspace, index);
      try {
        const response = await request(fixture.app.getHttpServer())
          .get('/v1/company-auth/workspace/page')
          .query({ route: workspace[3] })
          .set('Cookie', fixture.cookie);

        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toContain('private');
        expect(response.headers['cache-control']).toContain('no-store');
        expect(response.body).toMatchObject({
          accountTypeCode: workspace[0],
          accountTypeName: workspace[1],
          pageId: workspace[2],
          workspaceRoute: workspace[3],
          filters: { availability: 'ALL', keyword: '' },
        });
        expect(response.body.items.map(({ moduleKey }) => moduleKey)).toEqual(
          expectedModuleKeys[workspace[0]],
        );
        expect(response.body.summary).toMatchObject({
          catalogTotal: expectedModuleKeys[workspace[0]].length,
          filteredTotal: expectedModuleKeys[workspace[0]].length,
        });
        expect(JSON.stringify(response.body)).not.toMatch(forbiddenResponsePattern);

        const foreignKeys = Object.entries(expectedModuleKeys)
          .filter(([role]) => role !== workspace[0])
          .flatMap(([, keys]) => keys);
        for (const foreignKey of foreignKeys) {
          expect(JSON.stringify(response.body)).not.toContain(`"${foreignKey}"`);
        }
      } finally {
        await fixture.app.close();
      }
    }
  });

  it('filters the current catalog and returns only its selected detail timeline', async () => {
    const workspace = workspaces[0];
    const fixture = await createFixture(workspace);
    try {
      const filtered = await request(fixture.app.getHttpServer())
        .get('/v1/company-auth/workspace/page')
        .query({
          route: workspace[3],
          availability: 'AVAILABLE',
          keyword: '账号',
        })
        .set('Cookie', fixture.cookie);
      expect(filtered.status).toBe(200);
      expect(filtered.body.items).toHaveLength(1);
      expect(filtered.body.items[0]).toMatchObject({ moduleKey: 'functional-accounts' });
      expect(filtered.body.summary.filteredTotal).toBe(1);

      const detail = await request(fixture.app.getHttpServer())
        .get('/v1/company-auth/workspace/page')
        .query({ route: workspace[3], moduleKey: 'functional-accounts' })
        .set('Cookie', fixture.cookie);
      expect(detail.status).toBe(200);
      expect(detail.body.selectedModule).toMatchObject({
        moduleKey: 'functional-accounts',
        availability: 'AVAILABLE',
      });
      expect(detail.body.selectedModule.sections.length).toBeGreaterThan(0);
      expect(detail.body.selectedModule.timeline.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(detail.body)).not.toMatch(forbiddenResponsePattern);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-068-02 rejects route and client context crossover before returning a catalog', async () => {
    const workspace = workspaces[1];
    const fixture = await createFixture(workspace, 1);
    try {
      const foreignRoute = await request(fixture.app.getHttpServer())
        .get('/v1/company-auth/workspace/page')
        .query({ route: workspaces[6][3] })
        .set('Cookie', fixture.cookie);
      expect(foreignRoute.status).toBe(403);
      expect(foreignRoute.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });

      const spoofed = await request(fixture.app.getHttpServer())
        .get('/v1/company-auth/workspace/page')
        .query({ route: workspace[3], accountTypeCode: 'COMPANY_FINANCE' })
        .set('Cookie', fixture.cookie);
      expect(spoofed.status).toBe(403);
      expect(spoofed.body).toMatchObject({ code: 'DATA_SCOPE_FORBIDDEN' });
      expect(JSON.stringify([foreignRoute.body, spoofed.body])).not.toMatch(
        forbiddenResponsePattern,
      );
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-068-03 fails closed for an unknown module without leaking secrets', async () => {
    const workspace = workspaces[8];
    const fixture = await createFixture(workspace, 8);
    try {
      const response = await request(fixture.app.getHttpServer())
        .get('/v1/company-auth/workspace/page')
        .query({ route: workspace[3], moduleKey: 'supplier-statements' })
        .set('Cookie', fixture.cookie);
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_MODULE_NOT_FOUND' });
      expect(JSON.stringify(response.body)).not.toMatch(forbiddenResponsePattern);
    } finally {
      await fixture.app.close();
    }
  });
});
