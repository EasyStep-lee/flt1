import { expect, test } from '@playwright/test';

import { createApplication } from '../../../apps/api/dist/bootstrap.js';
import { loadRuntimeConfig } from '../../../apps/api/dist/config/runtime-config.js';
import { InMemorySupplierAuthRepository } from '../../../apps/api/dist/supplier-auth/in-memory-supplier-auth.repository.js';

const apiPort = 4322;
const supplierPortalOrigin = 'http://127.0.0.1:4323';
const supplierId = '10000000-0000-4000-8000-000000000169';
const userId = '20000000-0000-4000-8000-000000000169';
const accountAdminId = '30000000-0000-4000-8000-000000000169';
const financeId = '30000000-0000-4000-8000-000000000170';
const validCredential = 'supplier-auth-test-only-valid';

const account = (
  id: string,
  accountTypeCode: string,
  accountTypeName: string,
  workspaceRoute: string,
) => ({
  accountTypeCode,
  accountTypeName,
  accountTypeStatus: 'ACTIVE' as const,
  displayName: '真实链路测试联系人',
  expiresAt: null,
  id,
  identityId: userId,
  lastUsedAt: null,
  ownerDisplayName: '真实链路测试供应商有限公司',
  ownerType: 'SUPPLIER' as const,
  status: 'ACTIVE' as const,
  supplierId,
  workspaceRoute,
});

let api: Awaited<ReturnType<typeof createApplication>> | undefined;

test.beforeAll(async () => {
  const repository = new InMemorySupplierAuthRepository({
    accounts: [
      account(
        accountAdminId,
        'SUPPLIER_ACCOUNT_ADMIN',
        '主体管理',
        '/supplier/workspaces/account-admin',
      ),
      account(
        financeId,
        'SUPPLIER_FINANCE',
        '财务对账',
        '/supplier/workspaces/finance',
      ),
    ],
    users: [
      {
        email: 'runtime-supplier@example.test',
        id: userId,
        lastLoginAt: null,
        mobile: '13800138169',
        name: '真实链路测试联系人',
        status: 'ACTIVE',
        supplierId,
        supplierStatus: 'ACTIVE',
        version: 0,
      },
    ],
  });
  api = await createApplication({
    config: loadRuntimeConfig({
      NODE_ENV: 'test',
      API_HOST: '127.0.0.1',
      API_PORT: String(apiPort),
      DATABASE_URL:
        'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
      REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
      INFRA_HEALTH_TIMEOUT_MS: '50',
    }),
    probes: (['database', 'redis', 'queue'] as const).map((name) => ({
      name,
      check: async () => ({ code: 'OK', latencyMs: 1, status: 'UP' as const }),
    })),
    supplierAuthRepository: repository,
    supplierCredentialVerifier: {
      verify: async ({ password }) => ({
        secondVerificationRequired: false,
        valid: password === validCredential,
      }),
    },
    supplierSecondVerifier: { verify: async () => false },
    logger: false,
  });
  await api.listen(apiPort, '127.0.0.1');
});

test.afterAll(async () => {
  await api?.close();
});

test('P0-069 browser completes real login and selection through the same-origin API proxy', async ({
  context,
  page,
}) => {
  await page.goto(`${supplierPortalOrigin}/supplier/login`);
  await page.getByLabel('账号或手机号').fill('13800138169');
  await page.getByLabel('密码').fill(validCredential);
  await page.getByRole('button', { name: '安全登录' }).click();

  await expect(page).toHaveURL(`${supplierPortalOrigin}/supplier/account-select`);
  await expect(page.locator('[data-page-id="PAGE-015"]')).toBeVisible();
  expect(
    (await context.cookies()).some(
      ({ name }) => name === '__Host-fulishe-supplier-portal',
    ),
  ).toBe(false);

  await page.getByRole('button', { name: /主体管理/u }).click();
  await expect(page).toHaveURL(
    `${supplierPortalOrigin}/supplier/workspaces/account-admin`,
  );
  await expect(page.locator('[data-page-id="PAGE-016"]')).toBeVisible();

  const sessionCookie = (await context.cookies()).find(
    ({ name }) => name === '__Host-fulishe-supplier-portal',
  );
  expect(sessionCookie).toMatchObject({
    domain: '127.0.0.1',
    httpOnly: true,
    path: '/',
    sameSite: 'Strict',
    secure: true,
  });
  expect(sessionCookie?.value).toMatch(/^[A-Za-z0-9_-]{32,}$/u);
});
