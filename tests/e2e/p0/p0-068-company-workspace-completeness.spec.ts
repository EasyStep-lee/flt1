import { expect, test, type Page } from '@playwright/test';

const companyOrigin = 'http://127.0.0.1:4321';

const workspaces = [
  ['COMPANY_SUPER_ADMIN', 'PAGE-003', '/company-admin/workspaces/system', '超级管理员', '系统与账号'],
  ['COMPANY_SUPPLIER_OPS', 'PAGE-004', '/company-admin/workspaces/supplier-ops', '供应商运营', '供应商运营'],
  ['COMPANY_PRODUCT_OPS', 'PAGE-005', '/company-admin/workspaces/product-ops', '商品与分类运营', '商品与分类'],
  ['COMPANY_PRICE_REVIEW', 'PAGE-006', '/company-admin/workspaces/price-review', '采购/价格审核', '价格审核'],
  ['COMPANY_ORDER_SERVICE', 'PAGE-007', '/company-admin/workspaces/order-service', '订单客服', '订单客服'],
  ['COMPANY_WELFARE_CARD', 'PAGE-008', '/company-admin/workspaces/welfare-card', '福利卡运营', '福利卡运营'],
  ['COMPANY_FINANCE', 'PAGE-009', '/company-admin/workspaces/finance', '财务结算', '财务结算'],
  ['COMPANY_LOGISTICS', 'PAGE-010', '/company-admin/workspaces/logistics', '物流运营', '物流中心'],
  ['COMPANY_CONTENT', 'PAGE-011', '/company-admin/workspaces/content', '门户内容编辑', '门户内容'],
  ['COMPANY_AUDIT', 'PAGE-012', '/company-admin/workspaces/audit', '审计/只读', '审计风控'],
] as const;

const moduleKeys = {
  COMPANY_SUPER_ADMIN: ['functional-accounts', 'session-control', 'system-parameters'],
  COMPANY_SUPPLIER_OPS: ['onboarding-review', 'supplier-profiles', 'qualification-alerts'],
  COMPANY_PRODUCT_OPS: ['category-templates', 'product-material-review', 'enterprise-shelf'],
  COMPANY_PRICE_REVIEW: ['initial-price-review', 'supply-price-change-review', 'price-history'],
  COMPANY_ORDER_SERVICE: ['personal-orders', 'enterprise-orders', 'after-sales-cases'],
  COMPANY_WELFARE_CARD: ['welfare-plans', 'card-batches', 'account-ledger'],
  COMPANY_FINANCE: ['payment-reconciliation', 'refund-review', 'supplier-statements'],
  COMPANY_LOGISTICS: ['runner-operations', 'personal-deliveries', 'enterprise-deliveries'],
  COMPANY_CONTENT: ['content-tree', 'content-preview', 'publication-history'],
  COMPANY_AUDIT: ['audit-events', 'login-events', 'sensitive-exports'],
} as const satisfies Record<(typeof workspaces)[number][0], readonly [string, string, string]>;

const moduleLabel = (key: string) => `模块 ${key}`;

const moduleItem = (key: string, index: number) => ({
  moduleKey: key,
  label: moduleLabel(key),
  description: `当前职能的 ${key} 页面能力边界`,
  deliveryStage: index === 0 ? 'M1' : 'M2',
  availability: index === 0 ? 'AVAILABLE' : 'DEFERRED',
  dataBoundary: '只使用当前固定职能会话允许的数据',
});

const installCurrentWorkspaceRoute = async (page: Page) => {
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
};

const pageResponse = (url: URL, forceEmpty = false) => {
  const requestedRoute = url.searchParams.get('route');
  const workspace = workspaces.find((candidate) => candidate[2] === requestedRoute);
  if (!workspace) return null;
  const keyword = url.searchParams.get('keyword')?.trim() ?? '';
  const availability = url.searchParams.get('availability') ?? 'ALL';
  const selectedKey = url.searchParams.get('moduleKey');
  const catalog = moduleKeys[workspace[0]].map(moduleItem);
  const items = forceEmpty
    ? []
    : catalog.filter(
        (item) =>
          (availability === 'ALL' || item.availability === availability) &&
          (!keyword || `${item.label} ${item.description}`.includes(keyword)),
      );
  const selected = selectedKey
    ? catalog.find(({ moduleKey }) => moduleKey === selectedKey)
    : undefined;
  return {
    accountTypeCode: workspace[0],
    accountTypeName: workspace[3],
    pageId: workspace[1],
    workspaceRoute: workspace[2],
    filters: { keyword, availability },
    summary: {
      catalogTotal: catalog.length,
      availableTotal: catalog.filter(({ availability: value }) => value === 'AVAILABLE').length,
      deferredTotal: catalog.filter(({ availability: value }) => value === 'DEFERRED').length,
      filteredTotal: items.length,
    },
    items,
    selectedModule: selected
      ? {
          ...selected,
          sections: ['工作台', '内部列表', '详情与交付边界'],
          timeline: [
            { code: 'WORKSPACE_ROUTE_READY', label: '固定职能路由已就绪', stage: 'M1', status: 'DONE' },
            {
              code: selected.availability === 'AVAILABLE' ? 'MODULE_AVAILABLE' : 'BUSINESS_STAGE_DEFERRED',
              label: selected.availability === 'AVAILABLE' ? '当前模块可用' : '业务能力按阶段交付',
              stage: selected.deliveryStage,
              status: selected.availability === 'AVAILABLE' ? 'DONE' : 'DEFERRED',
            },
          ],
        }
      : null,
  };
};

test('NEG-M1-068-02 all company pages keep list, detail and timeline in their own context', async ({
  page,
}) => {
  await installCurrentWorkspaceRoute(page);
  await page.route('**/v1/company-auth/workspace/page**', async (route) => {
    const response = pageResponse(new URL(route.request().url()));
    await route.fulfill({
      contentType: 'application/json',
      status: response ? 200 : 403,
      body: JSON.stringify(
        response ?? { code: 'WORKSPACE_FORBIDDEN', message: '无权访问该职能页面' },
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

  for (const workspace of workspaces) {
    await page.goto(`${companyOrigin}${workspace[2]}`);
    const completeness = page.locator('[data-workspace-completeness]');
    await expect(completeness).toBeVisible();
    await expect(completeness).toHaveAttribute('data-workspace-role', workspace[0]);
    await expect(completeness.getByRole('heading', { name: '职能工作台' })).toBeVisible();
    await expect(completeness.locator('[data-workspace-module]')).toHaveCount(3);
    await expect(completeness).toContainText(moduleLabel(moduleKeys[workspace[0]][0]));

    await completeness.getByRole('button', { name: '查看详情' }).first().click();
    const drawer = page.getByRole('dialog', { name: '模块详情与交付时间线' });
    await expect(drawer).toContainText(moduleLabel(moduleKeys[workspace[0]][0]));
    await expect(drawer).toContainText('固定职能路由已就绪');
    for (const other of workspaces.filter((candidate) => candidate[0] !== workspace[0])) {
      await expect(drawer).not.toContainText(moduleKeys[other[0]][0]);
    }
    await drawer.getByRole('button', { name: 'Close' }).click();
  }
});

test('NEG-M1-068-01 shared page component exposes loading, empty, error, permission and offline states', async ({
  page,
}) => {
  await installCurrentWorkspaceRoute(page);
  let mode: 'success' | 'loading' | 'empty' | 'error' | 'permission' | 'offline' =
    'loading';
  await page.route('**/v1/company-auth/workspace/page**', async (route) => {
    if (mode === 'loading') {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    if (mode === 'offline') {
      await route.abort('failed');
      return;
    }
    if (mode === 'error' || mode === 'permission') {
      await route.fulfill({
        contentType: 'application/json',
        status: mode === 'permission' ? 403 : 500,
        body: JSON.stringify({
          code: mode === 'permission' ? 'WORKSPACE_FORBIDDEN' : 'INTERNAL_ERROR',
          message: mode === 'permission' ? '无权访问页面模块' : '页面模块暂时不可用',
        }),
      });
      return;
    }
    const response = pageResponse(new URL(route.request().url()), mode === 'empty');
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify(response),
    });
  });

  const route = `${companyOrigin}/company-admin/workspaces/system`;
  await page.goto(route);
  await expect(page.locator('[data-workspace-page-state="loading"]')).toBeVisible();
  await expect(page.locator('[data-workspace-page-state="success"]')).toBeVisible();

  mode = 'empty';
  await page.reload();
  await expect(page.locator('[data-workspace-page-state="empty"]')).toBeVisible();

  mode = 'error';
  await page.reload();
  await expect(page.locator('[data-workspace-page-state="error"]')).toBeVisible();

  mode = 'permission';
  await page.reload();
  await expect(page.locator('[data-workspace-page-state="permission-denied"]')).toBeVisible();

  mode = 'offline';
  await page.reload();
  await expect(page.locator('[data-workspace-page-state="offline-or-timeout"]')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /companyId|functionalAccountId|identityId|sessionToken|supplyPrice|supplierPayable|grossMargin/iu,
  );
});
