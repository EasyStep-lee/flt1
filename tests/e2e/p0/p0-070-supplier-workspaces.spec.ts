import { expect, test, type Page } from '@playwright/test';

const supplierOrigin = 'http://127.0.0.1:4320';

const workspaces = [
  ['SUPPLIER_ACCOUNT_ADMIN', 'PAGE-016', '/supplier/workspaces/account-admin', '主体管理', '主体管理'],
  ['SUPPLIER_PRODUCT', 'PAGE-017', '/supplier/workspaces/products', '商品运营', '商品管理'],
  ['SUPPLIER_PRICING', 'PAGE-018', '/supplier/workspaces/pricing', '价格管理', '价格管理'],
  ['SUPPLIER_INVENTORY', 'PAGE-019', '/supplier/workspaces/inventory', '库存/仓库', '库存管理'],
  ['SUPPLIER_FULFILLMENT', 'PAGE-020', '/supplier/workspaces/fulfillment', '订单履约', '履约管理'],
  ['SUPPLIER_AFTERSALES', 'PAGE-021', '/supplier/workspaces/aftersales', '售后', '售后协同'],
  ['SUPPLIER_FINANCE', 'PAGE-022', '/supplier/workspaces/finance', '财务对账', '财务对账'],
  ['SUPPLIER_AUDIT', 'PAGE-023', '/supplier/workspaces/audit', '只读审计', '审计记录'],
] as const;

const moduleKeys = {
  SUPPLIER_ACCOUNT_ADMIN: ['profile', 'functional-accounts', 'login-events'],
  SUPPLIER_PRODUCT: ['product-drafts', 'material-submissions', 'collection-flags'],
  SUPPLIER_PRICING: ['initial-prices', 'supply-price-changes', 'sale-price-history'],
  SUPPLIER_INVENTORY: ['inventory-overview', 'inventory-adjustments', 'batch-expiry'],
  SUPPLIER_FULFILLMENT: ['fulfillment-suborders', 'handover', 'exceptions'],
  SUPPLIER_AFTERSALES: ['aftersales-cases', 'evidence', 'responsibility-appeals'],
  SUPPLIER_FINANCE: ['supplier-statements', 'statement-disputes', 'settlement-evidence'],
  SUPPLIER_AUDIT: ['audit-events', 'login-events', 'download-events'],
} as const;

const installCurrentWorkspaceRoute = async (page: Page) => {
  await page.route('**/v1/supplier-auth/workspace/current**', async (route) => {
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

const moduleItem = (key: string, index: number) => ({
  moduleKey: key,
  label: `模块 ${key}`,
  description: `当前供应商职能的 ${key} 页面能力边界`,
  deliveryStage: index === 0 ? 'M1' : 'M2',
  availability: index === 0 ? 'AVAILABLE' : 'DEFERRED',
  dataBoundary: '只使用当前供应商固定职能会话允许的数据',
});

const pageResponse = (url: URL, forceEmpty = false) => {
  const workspace = workspaces.find(
    (candidate) => candidate[2] === url.searchParams.get('route'),
  );
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

test('NEG-M1-070-03 eight supplier roles render one page and one internal menu each', async ({
  page,
}) => {
  await installCurrentWorkspaceRoute(page);
  await page.route('**/v1/supplier-auth/workspace/page**', async (route) => {
    const response = pageResponse(new URL(route.request().url()));
    await route.fulfill({
      contentType: 'application/json',
      status: response ? 200 : 403,
      body: JSON.stringify(
        response ?? { code: 'WORKSPACE_FORBIDDEN', message: '无权访问该职能页面' },
      ),
    });
  });

  for (const workspace of workspaces) {
    await page.goto(`${supplierOrigin}${workspace[2]}`);
    const pageShell = page.locator(`[data-page-id="${workspace[1]}"]`);
    await expect(pageShell).toBeVisible();
    await expect(pageShell).toHaveAttribute('data-role', workspace[0]);
    await expect(pageShell.locator('[data-workspace-menu]')).toHaveCount(1);
    await expect(pageShell.locator('[data-workspace-menu]')).toHaveText(workspace[4]);
    await expect(pageShell.locator('[data-supplier-workspace-page]')).toHaveAttribute(
      'data-workspace-role',
      workspace[0],
    );
    await expect(pageShell.locator('[data-supplier-workspace-module]')).toHaveCount(3);
    for (const other of workspaces.filter((candidate) => candidate[0] !== workspace[0])) {
      await expect(pageShell.locator('[data-workspace-menu]')).not.toContainText(other[4]);
      await expect(pageShell).not.toContainText(`模块 ${moduleKeys[other[0]][0]}`);
    }
  }
});

test('NEG-M1-070-05 ignores an older filter response that arrives after the latest query', async ({
  page,
}) => {
  await installCurrentWorkspaceRoute(page);
  let releaseSlowResponse: (() => void) | undefined;
  let markSlowStarted: (() => void) | undefined;
  const slowStarted = new Promise<void>((resolve) => {
    markSlowStarted = resolve;
  });
  const slowResponseGate = new Promise<void>((resolve) => {
    releaseSlowResponse = resolve;
  });

  await page.route('**/v1/supplier-auth/workspace/page**', async (route) => {
    const url = new URL(route.request().url());
    const keyword = url.searchParams.get('keyword') ?? '';
    if (keyword === '慢') {
      markSlowStarted?.();
      await slowResponseGate;
    }
    const response = pageResponse(url);
    if (!response) {
      await route.fulfill({
        contentType: 'application/json',
        status: 403,
        body: JSON.stringify({ code: 'WORKSPACE_FORBIDDEN', message: '无权访问该职能页面' }),
      });
      return;
    }
    const raceItem = keyword
      ? { ...moduleItem('product-drafts', 0), label: `${keyword}响应结果` }
      : undefined;
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        ...response,
        items: raceItem ? [raceItem] : response.items,
        summary: {
          ...response.summary,
          filteredTotal: raceItem ? 1 : response.summary.filteredTotal,
        },
      }),
    });
  });

  await page.goto(`${supplierOrigin}/supplier/workspaces/products`);
  await expect(page.locator('[data-supplier-workspace-state="success"]')).toBeVisible();
  const search = page.getByLabel('搜索当前供应商职能模块');
  await search.fill('慢');
  await search.press('Enter');
  await slowStarted;
  await search.fill('快');
  await search.press('Enter');
  await expect(page.getByText('快响应结果')).toBeVisible();

  releaseSlowResponse?.();
  await expect(page.getByText('慢响应结果')).toHaveCount(0);
  await expect(page.getByText('快响应结果')).toBeVisible();
  await expect(search).toHaveValue('快');
});

test('NEG-M1-070-01 shared component exposes loading, empty, error, permission and offline states', async ({
  page,
}) => {
  await installCurrentWorkspaceRoute(page);
  let mode: 'loading' | 'success' | 'empty' | 'error' | 'permission' | 'offline' =
    'loading';
  await page.route('**/v1/supplier-auth/workspace/page**', async (route) => {
    if (mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 600));
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
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify(
        pageResponse(new URL(route.request().url()), mode === 'empty'),
      ),
    });
  });

  const route = `${supplierOrigin}/supplier/workspaces/products`;
  await page.goto(route);
  await expect(page.locator('[data-supplier-workspace-state="loading"]')).toBeVisible();
  await expect(page.locator('[data-supplier-workspace-state="success"]')).toBeVisible();

  mode = 'empty';
  await page.reload();
  await expect(page.locator('[data-supplier-workspace-state="empty"]')).toBeVisible();

  mode = 'error';
  await page.reload();
  await expect(page.locator('[data-supplier-workspace-state="error"]')).toBeVisible();

  mode = 'permission';
  await page.reload();
  await expect(page.locator('[data-supplier-workspace-state="permission-denied"]')).toBeVisible();

  mode = 'offline';
  await page.reload();
  await expect(page.locator('[data-supplier-workspace-state="offline-or-timeout"]')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /supplierId|functionalAccountId|identityId|sessionToken|supplyPrice|supplierPayable|grossMargin|bankAccount/iu,
  );
});
