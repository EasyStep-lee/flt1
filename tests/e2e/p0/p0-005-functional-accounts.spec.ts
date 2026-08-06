import { expect, test } from '@playwright/test';

const supplierOrigin = 'http://127.0.0.1:4320';

test('P0-005 account admin lists and invites a fixed supplier functional account', async ({ page }) => {
  const accounts = [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      displayName: '主体管理员',
      accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
      accountTypeName: '主体管理',
      workspaceRoute: '/supplier/workspaces/account-admin',
      status: 'ACTIVE',
    },
  ];
  await page.route('**/v1/supplier/functional-accounts**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({ items: accounts, page: 1, pageSize: 20, total: accounts.length }),
      });
      return;
    }
    const invited = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      displayName: '商品运营员',
      accountTypeCode: 'SUPPLIER_PRODUCT',
      accountTypeName: '商品运营',
      workspaceRoute: '/supplier/workspaces/products',
      status: 'PENDING_ACTIVATION',
    };
    accounts.push(invited);
    await route.fulfill({ contentType: 'application/json', status: 201, body: JSON.stringify(invited) });
  });

  const response = await page.goto(`${supplierOrigin}/supplier/workspaces/account-admin/accounts`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/u);
  await expect(page.getByRole('heading', { name: '职能账号管理' })).toBeVisible();
  await expect(page.getByText('主体管理员')).toBeVisible();
  await page.getByRole('button', { name: '邀请职能账号' }).click();
  await page.getByLabel('职能类型').click();
  await page.getByTitle('商品运营').click();
  await page.getByLabel('姓名').fill('商品运营员');
  await page.getByLabel('手机号').fill('13900139000');
  await page.getByLabel('邮箱（选填）').fill('product@example.test');
  await page.getByLabel('二次验证码').fill('654321');
  await page.getByRole('button', { name: '确认邀请' }).click();
  await expect(page.getByText('商品运营员')).toBeVisible();
  await expect(page.getByText('/supplier/workspaces/products')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/供应价|毛利|供应商应付/u);
});

