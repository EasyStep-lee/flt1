import { expect, test } from '@playwright/test';

const supplierOrigin = 'http://127.0.0.1:4320';
const companyOrigin = 'http://127.0.0.1:4321';

test('P0-003 supplier can register and see the frozen onboarding states', async ({ page }) => {
  await page.route('**/v1/suppliers/registrations', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' },
      status: 201,
      body: JSON.stringify({
        registrationId: '11111111-1111-4111-8111-111111111111',
        status: 'DRAFT',
        nextAction: 'COMPLETE_PROFILE',
      }),
    });
  });

  const response = await page.goto(`${supplierOrigin}/supplier/register`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/u);
  await expect(page.getByRole('heading', { name: '供应商入驻申请' })).toBeVisible();
  await page.getByLabel('企业名称').fill('南京示例供应链有限公司');
  await page.getByLabel('统一社会信用代码').fill('91320100MA1ABC2D3X');
  await page.getByLabel('联系人').fill('张经理');
  await page.getByLabel('手机号').fill('13800138000');
  await page.getByLabel('验证码').fill('123456');
  await expect(page.getByLabel('协议版本')).toHaveValue('supplier-agreement-v1.1');
  await page.getByRole('button', { name: '保存入驻申请' }).click();
  await expect(page.getByRole('heading', { name: '草稿' })).toBeVisible();

  const stateLegend = page.locator('[data-testid="supplier-status-legend"]');
  await expect(stateLegend).toContainText('草稿');
  await expect(stateLegend).toContainText('待审核');
  await expect(stateLegend).toContainText('待补正');
  await expect(stateLegend).toContainText('已启用');
  await expect(page.locator('body')).not.toContainText(/供应价|毛利|供应商应付/u);
});

test('P0-003 company supplier ops can filter and review pending applications', async ({ page }) => {
  await page.route('**/v1/company-auth/workspace/current**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountTypeCode: 'COMPANY_SUPPLIER_OPS',
        accountTypeName: '供应商运营',
        pageId: 'PAGE-004',
        workspaceRoute: '/company-admin/workspaces/supplier-ops',
        menuItems: [
          {
            key: 'workspace',
            label: '供应商运营',
            route: '/company-admin/workspaces/supplier-ops',
          },
        ],
      }),
    });
  });
  await page.route('**/v1/company/suppliers**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          items: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              legalName: '南京示例供应链有限公司',
              creditCodeMasked: '9132**********2D3X',
              status: 'PENDING_REVIEW',
              qualificationSummary: { fileCount: 1, complete: true },
              version: 1,
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({
        id: '22222222-2222-4222-8222-222222222222',
        legalName: '南京示例供应链有限公司',
        creditCodeMasked: '9132**********2D3X',
        status: 'ACTIVE',
        qualificationSummary: { fileCount: 1, complete: true },
        version: 2,
      }),
    });
  });

  const response = await page.goto(`${companyOrigin}/company-admin/workspaces/supplier-ops`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: '供应商入驻审核' })).toBeVisible();
  await expect(page.getByText('南京示例供应链有限公司')).toBeVisible();
  await expect(page.getByRole('table').getByText('待审核')).toBeVisible();
  await page.getByRole('button', { name: '通过并启用' }).click();
  await expect(page.getByText('已启用')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/供应价|毛利|供应商应付/u);
});
