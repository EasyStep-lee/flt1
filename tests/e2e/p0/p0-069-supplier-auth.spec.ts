import { expect, test } from '@playwright/test';

const supplierPortalOrigin = 'http://127.0.0.1:4320';

test('P0-069 keeps supplier registration and login as independent noindex pages', async ({
  page,
}) => {
  const login = await page.goto(`${supplierPortalOrigin}/supplier/login`);
  expect(login?.status()).toBe(200);
  await expect(page.locator('[data-page-id="PAGE-014"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '供应商管理后台' })).toBeVisible();
  await expect(page.getByLabel('账号或手机号')).toBeVisible();
  await expect(page.getByRole('link', { name: '申请成为供应商' })).toHaveAttribute(
    'href',
    '/supplier/register',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,nofollow',
  );
  await expect(page.locator('meta[http-equiv="Cache-Control"]')).toHaveAttribute(
    'content',
    'no-store, max-age=0',
  );

  await page.goto(`${supplierPortalOrigin}/supplier/register`);
  await expect(page.locator('[data-page-id="PAGE-013"]')).toBeVisible();
  await expect(page.getByRole('link', { name: /供应商独立登录入口/u })).toHaveAttribute(
    'href',
    '/supplier/login',
  );
});

test('P0-069 multi-account login uses only server-listed supplier workspaces', async ({
  page,
}) => {
  await page.route('**/v1/supplier-auth/login', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountSelectRoute: '/supplier/account-select',
        selectionRequired: true,
        selectionNonce: 'synthetic-supplier-selection-nonce-000001',
        accounts: [
          {
            accountId: '30000000-0000-4000-8000-000000000069',
            ownerType: 'SUPPLIER',
            ownerDisplayName: '测试供应商有限公司',
            accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
            accountTypeName: '主体管理',
            workspaceRoute: '/supplier/workspaces/account-admin',
            status: 'ACTIVE',
          },
          {
            accountId: '30000000-0000-4000-8000-000000000070',
            ownerType: 'SUPPLIER',
            ownerDisplayName: '测试供应商有限公司',
            accountTypeCode: 'SUPPLIER_FINANCE',
            accountTypeName: '财务对账',
            workspaceRoute: '/supplier/workspaces/finance',
            status: 'SUSPENDED',
          },
        ],
      }),
    });
  });
  await page.route('**/v1/supplier-auth/workspaces/*/select', async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({
      selectionNonce: 'synthetic-supplier-selection-nonce-000001',
    });
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        functionalAccountId: '30000000-0000-4000-8000-000000000069',
        ownerType: 'SUPPLIER',
        accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
        workspaceRoute: '/supplier/workspaces/account-admin',
        expiresAt: '2026-08-07T12:00:00.000Z',
      }),
    });
  });

  await page.goto(`${supplierPortalOrigin}/supplier/login`);
  await page.getByLabel('账号或手机号').fill('test-supplier-admin');
  await page.getByLabel('密码').fill('synthetic-password');
  await page.getByRole('button', { name: '安全登录' }).click();

  await expect(page).toHaveURL(`${supplierPortalOrigin}/supplier/account-select`);
  await expect(page.locator('[data-page-id="PAGE-015"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /主体管理/u })).toBeEnabled();
  await expect(page.getByRole('button', { name: /财务对账/u })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText(/输入.*supplierId|输入.*accountId/iu);

  await page.getByRole('button', { name: /主体管理/u }).click();
  await expect(page).toHaveURL(
    `${supplierPortalOrigin}/supplier/workspaces/account-admin`,
  );
  await expect(page.locator('[data-page-id="PAGE-016"]')).toBeVisible();
});

test('NEG-M1-069-03 direct account-select without a grant fails closed', async ({ page }) => {
  await page.goto(`${supplierPortalOrigin}/supplier/account-select`);
  await expect(page.getByRole('heading', { name: '职能账号选择已失效' })).toBeVisible();
  await expect(page.getByRole('link', { name: '返回登录' })).toHaveAttribute(
    'href',
    '/supplier/login',
  );
  await expect(page.getByRole('button')).toHaveCount(0);
});
