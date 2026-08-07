import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApplication } from '../../dist/bootstrap.js';
import { InMemorySupplierAuthRepository } from '../../dist/supplier-auth/in-memory-supplier-auth.repository.js';

const supplierId = '10000000-0000-4000-8000-000000000070';
const userId = '20000000-0000-4000-8000-000000000070';
const validCredential = 'supplier-workspace-test-only-valid';

const workspaces = [
  ['SUPPLIER_ACCOUNT_ADMIN', '主体管理', 'PAGE-016', '/supplier/workspaces/account-admin', '主体管理'],
  ['SUPPLIER_PRODUCT', '商品运营', 'PAGE-017', '/supplier/workspaces/products', '商品管理'],
  ['SUPPLIER_PRICING', '价格管理', 'PAGE-018', '/supplier/workspaces/pricing', '价格管理'],
  ['SUPPLIER_INVENTORY', '库存/仓库', 'PAGE-019', '/supplier/workspaces/inventory', '库存管理'],
  ['SUPPLIER_FULFILLMENT', '订单履约', 'PAGE-020', '/supplier/workspaces/fulfillment', '履约管理'],
  ['SUPPLIER_AFTERSALES', '售后', 'PAGE-021', '/supplier/workspaces/aftersales', '售后协同'],
  ['SUPPLIER_FINANCE', '财务对账', 'PAGE-022', '/supplier/workspaces/finance', '财务对账'],
  ['SUPPLIER_AUDIT', '只读审计', 'PAGE-023', '/supplier/workspaces/audit', '审计记录'],
];

const expectedModuleKeys = {
  SUPPLIER_ACCOUNT_ADMIN: ['profile', 'functional-accounts', 'login-events'],
  SUPPLIER_PRODUCT: ['product-drafts', 'material-submissions', 'collection-flags'],
  SUPPLIER_PRICING: ['initial-prices', 'supply-price-changes', 'sale-price-history'],
  SUPPLIER_INVENTORY: ['inventory-overview', 'inventory-adjustments', 'batch-expiry'],
  SUPPLIER_FULFILLMENT: ['fulfillment-suborders', 'handover', 'exceptions'],
  SUPPLIER_AFTERSALES: ['aftersales-cases', 'evidence', 'responsibility-appeals'],
  SUPPLIER_FINANCE: ['supplier-statements', 'statement-disputes', 'settlement-evidence'],
  SUPPLIER_AUDIT: ['audit-events', 'login-events', 'download-events'],
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
  supplierAuthSessionSigningKey: `unit-test-only-${'x'.repeat(32)}`,
});

const probes = () =>
  ['mysql', 'redis', 'queue'].map((name) => ({
    name,
    check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
  }));

const user = {
  email: 'supplier-workspace@example.test',
  id: userId,
  lastLoginAt: null,
  mobile: '13800000070',
  name: '供应商页面测试用户',
  status: 'ACTIVE',
  supplierId,
  supplierStatus: 'ACTIVE',
  version: 0,
};

const account = (workspace, index = 0) => ({
  accountTypeCode: workspace[0],
  accountTypeName: workspace[1],
  accountTypeStatus: 'ACTIVE',
  displayName: `${workspace[1]}页面测试账号`,
  expiresAt: null,
  id: `30000000-0000-4000-8000-${String(index + 270).padStart(12, '0')}`,
  identityId: userId,
  lastUsedAt: null,
  ownerDisplayName: '测试供应商有限公司',
  ownerType: 'SUPPLIER',
  status: 'ACTIVE',
  supplierId,
  workspaceRoute: workspace[3],
});

const loginBody = (index = 0) => ({
  loginAccount: user.mobile,
  password: validCredential,
  requestId: `40000000-0000-4000-8000-${String(index + 270).padStart(12, '0')}`,
});

const cookieFrom = (response) => response.headers['set-cookie']?.[0]?.split(';')[0];

const createFixture = async ({ accounts }) => {
  const repository = new InMemorySupplierAuthRepository({ accounts, users: [user] });
  const app = await createApplication({
    config: config(),
    probes: probes(),
    supplierAuthRepository: repository,
    supplierCredentialVerifier: {
      verify: async ({ password }) => ({
        valid: password === validCredential,
        secondVerificationRequired: false,
      }),
    },
    supplierSecondVerifier: { verify: async () => true },
    logger: false,
  });
  await app.init();
  return { app, repository };
};

const forbiddenResponsePattern =
  /supplierId|functionalAccountId|identityId|sessionToken|supplyPrice|supplierPayable|grossMargin|bankAccount/iu;

describe('P0-070 supplier fixed functional workspaces', () => {
  it('maps all eight roles to exactly one fixed page and one internal menu', async () => {
    for (const [index, workspace] of workspaces.entries()) {
      const fixture = await createFixture({ accounts: [account(workspace, index)] });
      try {
        const login = await request(fixture.app.getHttpServer())
          .post('/v1/supplier-auth/login')
          .send(loginBody(index));
        const response = await request(fixture.app.getHttpServer())
          .get('/v1/supplier-auth/workspace/current')
          .query({ route: workspace[3] })
          .set('Cookie', cookieFrom(login));

        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
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
        expect(JSON.stringify(response.body)).not.toMatch(forbiddenResponsePattern);
      } finally {
        await fixture.app.close();
      }
    }
  });

  it('returns only the current role module catalog and selected detail', async () => {
    for (const [index, workspace] of workspaces.entries()) {
      const fixture = await createFixture({ accounts: [account(workspace, index)] });
      try {
        const login = await request(fixture.app.getHttpServer())
          .post('/v1/supplier-auth/login')
          .send(loginBody(index));
        const cookie = cookieFrom(login);
        const response = await request(fixture.app.getHttpServer())
          .get('/v1/supplier-auth/workspace/page')
          .query({ route: workspace[3] })
          .set('Cookie', cookie);

        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
        expect(response.body.items.map(({ moduleKey }) => moduleKey)).toEqual(
          expectedModuleKeys[workspace[0]],
        );
        expect(response.body).toMatchObject({
          accountTypeCode: workspace[0],
          pageId: workspace[2],
          workspaceRoute: workspace[3],
          summary: { catalogTotal: 3, filteredTotal: 3 },
        });

        const detail = await request(fixture.app.getHttpServer())
          .get('/v1/supplier-auth/workspace/page')
          .query({ route: workspace[3], moduleKey: expectedModuleKeys[workspace[0]][0] })
          .set('Cookie', cookie);
        expect(detail.status).toBe(200);
        expect(detail.body.selectedModule).toMatchObject({
          moduleKey: expectedModuleKeys[workspace[0]][0],
        });
        expect(detail.body.selectedModule.sections.length).toBeGreaterThan(0);
        expect(detail.body.selectedModule.timeline.length).toBeGreaterThanOrEqual(2);
        expect(JSON.stringify([response.body, detail.body])).not.toMatch(
          forbiddenResponsePattern,
        );

        const currentKeys = new Set(expectedModuleKeys[workspace[0]]);
        const foreignKeys = Object.entries(expectedModuleKeys)
          .filter(([role]) => role !== workspace[0])
          .flatMap(([, keys]) => keys)
          .filter((key) => !currentKeys.has(key));
        for (const foreignKey of foreignKeys) {
          expect(JSON.stringify(response.body)).not.toContain(`"${foreignKey}"`);
        }
      } finally {
        await fixture.app.close();
      }
    }
  });

  it('NEG-M1-070-01/02 rejects cross-workspace and client supplier context', async () => {
    const workspace = workspaces[1];
    const fixture = await createFixture({ accounts: [account(workspace, 1)] });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody(1));
      const cookie = cookieFrom(login);
      const foreignRoute = await request(fixture.app.getHttpServer())
        .get('/v1/supplier-auth/workspace/page')
        .query({ route: workspaces[6][3] })
        .set('Cookie', cookie);
      expect(foreignRoute.status).toBe(403);
      expect(foreignRoute.body).toMatchObject({ code: 'WORKSPACE_FORBIDDEN' });

      const spoofed = await request(fixture.app.getHttpServer())
        .get('/v1/supplier-auth/workspace/page')
        .query({ route: workspace[3], supplierId: '10000000-0000-4000-8000-000000000999' })
        .set('Cookie', cookie);
      expect(spoofed.status).toBe(403);
      expect(spoofed.body).toMatchObject({ code: 'DATA_SCOPE_FORBIDDEN' });
      expect(JSON.stringify([foreignRoute.body, spoofed.body])).not.toMatch(
        forbiddenResponsePattern,
      );
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-070-03 rejects a foreign module instead of combining role pages', async () => {
    const workspace = workspaces[0];
    const fixture = await createFixture({ accounts: [account(workspace)] });
    try {
      const login = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody());
      const response = await request(fixture.app.getHttpServer())
        .get('/v1/supplier-auth/workspace/page')
        .query({ route: workspace[3], moduleKey: 'supplier-statements' })
        .set('Cookie', cookieFrom(login));
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'WORKSPACE_MODULE_NOT_FOUND' });
      expect(JSON.stringify(response.body)).not.toMatch(forbiddenResponsePattern);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M1-070-04 revokes the old cookie when the person switches supplier roles', async () => {
    const accounts = [account(workspaces[0], 0), account(workspaces[6], 6)];
    const fixture = await createFixture({ accounts });
    try {
      const firstLogin = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody(20));
      const firstSelection = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${accounts[0].id}/select`)
        .send({ selectionNonce: firstLogin.body.selectionNonce });
      const oldCookie = cookieFrom(firstSelection);

      const secondLogin = await request(fixture.app.getHttpServer())
        .post('/v1/supplier-auth/login')
        .send(loginBody(21));
      const secondSelection = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier-auth/workspaces/${accounts[1].id}/select`)
        .send({ selectionNonce: secondLogin.body.selectionNonce });
      const newCookie = cookieFrom(secondSelection);

      const revoked = await request(fixture.app.getHttpServer())
        .get('/v1/supplier-auth/workspace/current')
        .query({ route: workspaces[0][3] })
        .set('Cookie', oldCookie);
      const active = await request(fixture.app.getHttpServer())
        .get('/v1/supplier-auth/workspace/current')
        .query({ route: workspaces[6][3] })
        .set('Cookie', newCookie);

      expect(revoked.status).toBe(401);
      expect(revoked.body).toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
      expect(active.status).toBe(200);
      expect(active.body).toMatchObject({ accountTypeCode: 'SUPPLIER_FINANCE' });
    } finally {
      await fixture.app.close();
    }
  });
});
