import { expect, test } from '@playwright/test';

const companyOrigin = 'http://127.0.0.1:4321';

const workspaces = [
  ['COMPANY_SUPER_ADMIN', 'PAGE-003', '/company-admin/workspaces/system', '超级管理员', '系统与账号'],
  ['COMPANY_SUPPLIER_OPS', 'PAGE-004', '/company-admin/workspaces/supplier-ops', '供应商运营', '供应商运营', '供应商入驻审核'],
  ['COMPANY_PRODUCT_OPS', 'PAGE-005', '/company-admin/workspaces/product-ops', '商品与分类运营', '商品与分类', '商品资料审核'],
  ['COMPANY_PRICE_REVIEW', 'PAGE-006', '/company-admin/workspaces/price-review', '采购/价格审核', '价格审核', '初始价格审核'],
  ['COMPANY_ORDER_SERVICE', 'PAGE-007', '/company-admin/workspaces/order-service', '订单客服', '订单客服'],
  ['COMPANY_WELFARE_CARD', 'PAGE-008', '/company-admin/workspaces/welfare-card', '福利卡运营', '福利卡运营'],
  ['COMPANY_FINANCE', 'PAGE-009', '/company-admin/workspaces/finance', '财务结算', '财务结算'],
  ['COMPANY_LOGISTICS', 'PAGE-010', '/company-admin/workspaces/logistics', '物流运营', '物流中心'],
  ['COMPANY_CONTENT', 'PAGE-011', '/company-admin/workspaces/content', '门户内容编辑', '门户内容'],
  ['COMPANY_AUDIT', 'PAGE-012', '/company-admin/workspaces/audit', '审计/只读', '审计风控', '敏感操作审计'],
] as const;

test('NEG-M1-067-02 each company workspace renders only its own menu', async ({ page }) => {
  await page.route('**/v1/company-auth/workspace/current**', async (route) => {
    const requested = new URL(route.request().url()).searchParams.get('route');
    const workspace = workspaces.find((candidate) => candidate[2] === requested);
    await route.fulfill({
      contentType: 'application/json',
      status: workspace ? 200 : 403,
      body: JSON.stringify(
        workspace
          ? {
              accountTypeCode: workspace[0],
              accountTypeName: workspace[3],
              pageId: workspace[1],
              workspaceRoute: workspace[2],
              menuItems: [{ key: 'workspace', label: workspace[4], route: workspace[2] }],
            }
          : { code: 'WORKSPACE_FORBIDDEN', message: '无权访问该职能页面' },
      ),
    });
  });
  await page.route('**/v1/company/suppliers**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }),
    });
  });
  await page.route('**/v1/audit/events**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }),
    });
  });
  await page.route('**/v1/company/product-material-reviews**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ items: [], total: 0 }),
    });
  });
  await page.route('**/v1/company/price-reviews**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ items: [], total: 0 }),
    });
  });

  for (const workspace of workspaces) {
    await page.goto(`${companyOrigin}${workspace[2]}`);
    const shell = page.locator(`[data-page-id="${workspace[1]}"]`);
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-role', workspace[0]);
    await expect(
      page.getByRole('heading', { name: workspace[5] ?? workspace[4], exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-workspace-menu]')).toHaveCount(1);
    for (const other of workspaces.filter((candidate) => candidate[0] !== workspace[0])) {
      await expect(page.locator('[data-workspace-menu]')).not.toContainText(other[4]);
    }
  }
});

test('NEG-M1-067-01 a foreign route response renders permission denied and no business shell', async ({ page }) => {
  await page.route('**/v1/company-auth/workspace/current**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 403,
      body: JSON.stringify({ code: 'WORKSPACE_FORBIDDEN', message: '无权访问该职能页面' }),
    });
  });

  await page.goto(`${companyOrigin}/company-admin/workspaces/finance`);
  await expect(page.getByRole('heading', { name: '无权访问该职能页面' })).toBeVisible();
  await expect(page.locator('[data-page-id="PAGE-009"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/供应价|账单明细|付款凭证/u);
});
