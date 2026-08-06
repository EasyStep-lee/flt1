import { expect, test } from '@playwright/test';

const companyAdminOrigin = 'http://127.0.0.1:4321';

test('NEG-M1-066-01 company login is independent, noindex and has no public registration', async ({
  page,
}) => {
  const response = await page.goto(`${companyAdminOrigin}/company-admin/login`);
  expect(response?.status()).toBe(200);

  await expect(page.locator('[data-page-id="PAGE-001"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '公司管理后台' })).toBeVisible();
  await expect(page.getByLabel('账号或手机号')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,nofollow',
  );
  await expect(page.locator('meta[http-equiv="Cache-Control"]')).toHaveAttribute(
    'content',
    'no-store, max-age=0',
  );
  await expect(page.locator('body')).not.toContainText(/注册公司|公司注册|公众注册入口/u);
  await expect(page.getByRole('link', { name: /注册/u })).toHaveCount(0);
});

test('NEG-M1-066-02 multi-account login requires a server-listed choice before navigation', async ({
  page,
}) => {
  await page.route('**/v1/company-auth/login', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        selectionRequired: true,
        selectionNonce: 'synthetic-selection-nonce-000000000001',
        accounts: [
          {
            accountId: '30000000-0000-4000-8000-000000000001',
            ownerType: 'COMPANY',
            ownerDisplayName: '江苏福礼团供应链科技有限公司',
            accountTypeCode: 'COMPANY_SUPER_ADMIN',
            accountTypeName: '超级管理员',
            workspaceRoute: '/company-admin/workspaces/system',
            status: 'ACTIVE',
          },
          {
            accountId: '30000000-0000-4000-8000-000000000002',
            ownerType: 'COMPANY',
            ownerDisplayName: '江苏福礼团供应链科技有限公司',
            accountTypeCode: 'COMPANY_FINANCE',
            accountTypeName: '财务',
            workspaceRoute: '/company-admin/workspaces/finance',
            status: 'SUSPENDED',
          },
        ],
      }),
    });
  });

  await page.goto(`${companyAdminOrigin}/company-admin/login`);
  await page.getByLabel('账号或手机号').fill('test-company-admin');
  await page.getByLabel('密码').fill('synthetic-password');
  await page.getByRole('button', { name: '安全登录' }).click();

  await expect(page).toHaveURL(`${companyAdminOrigin}/company-admin/account-select`);
  await expect(page.locator('[data-page-id="PAGE-002"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '选择职能账号' })).toBeVisible();
  await expect(page.getByRole('button', { name: /超级管理员/u })).toBeEnabled();
  await expect(page.getByRole('button', { name: /财务/u })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText(/输入.*accountId|输入.*ownerId/iu);
});

test('NEG-M1-066-04 direct account-select without an identity grant fails closed', async ({
  page,
}) => {
  await page.goto(`${companyAdminOrigin}/company-admin/account-select`);
  await expect(page.getByRole('heading', { name: '职能账号选择已失效' })).toBeVisible();
  await expect(page.getByRole('link', { name: '返回登录' })).toHaveAttribute(
    'href',
    '/company-admin/login',
  );
  await expect(page.getByRole('button')).toHaveCount(0);
});
