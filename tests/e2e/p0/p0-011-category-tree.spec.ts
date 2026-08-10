import { expect, test, type Page, type Route } from '@playwright/test';

const origin = 'http://127.0.0.1:4321';
const pageRoute = '/company-admin/workspaces/product-ops';

const workspace = {
  accountTypeCode: 'COMPANY_PRODUCT_OPS',
  accountTypeName: '商品与分类运营',
  pageId: 'PAGE-005',
  workspaceRoute: pageRoute,
  menuItems: [{ key: 'material-review', label: '商品资料审核', route: pageRoute }],
};

const rootId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const middleId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const leafId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const tree = () => ({
  total: 3,
  items: [
    {
      id: rootId,
      parentId: null,
      name: '食品饮料',
      level: 1,
      sortWeight: 10,
      status: 'ENABLED',
      version: 0,
      children: [
        {
          id: middleId,
          parentId: rootId,
          name: '粮油米面',
          level: 2,
          sortWeight: 10,
          status: 'ENABLED',
          version: 0,
          children: [
            {
              id: leafId,
              parentId: middleId,
              name: '大米',
              level: 3,
              sortWeight: 10,
              status: 'ENABLED',
              version: 0,
              children: [],
            },
          ],
        },
      ],
    },
  ],
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });

const installWorkspace = async (page: Page) => {
  await page.route('**/v1/company-auth/workspace/current**', (route) => json(route, workspace));
  await page.route('**/v1/company-auth/workspace/page**', (route) =>
    json(route, {
      ...workspace,
      filters: { availability: 'ALL', keyword: '' },
      summary: { availableTotal: 1, catalogTotal: 1, deferredTotal: 0, filteredTotal: 1 },
      items: [
        {
          availability: 'AVAILABLE',
          dataBoundary: '当前固定职能',
          deliveryStage: 'M2',
          description: '分类与商品资料',
          label: '商品资料审核',
          moduleKey: 'material-review',
        },
      ],
      selectedModule: null,
    }),
  );
  await page.route('**/v1/company/product-material-reviews', (route) =>
    json(route, { items: [], total: 0 }),
  );
};

test('P0-011 manages the protected category tree from the product-ops page', async ({ page }) => {
  await installWorkspace(page);
  let created = 0;
  let patched = 0;
  let deleted = 0;
  await page.route('**/v1/company/categories', async (route) => {
    if (route.request().method() === 'GET') return json(route, tree());
    created += 1;
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    expect(route.request().postDataJSON()).toEqual({
      parentId: rootId,
      name: '休闲食品',
      level: 2,
      sortWeight: 10,
    });
    return json(route, {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      parentId: rootId,
      name: '休闲食品',
      level: 2,
      sortWeight: 10,
      status: 'ENABLED',
      version: 0,
    }, 201);
  });
  await page.route('**/v1/company/categories/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      patched += 1;
      expect(route.request().postDataJSON()).toMatchObject({ version: 0, status: 'DISABLED' });
      return json(route, {
        id: leafId,
        parentId: middleId,
        name: '大米',
        level: 3,
        sortWeight: 10,
        status: 'DISABLED',
        version: 1,
      });
    }
    deleted += 1;
    return json(route, { code: 'CATEGORY_REFERENCED', message: '已引用分类不能删除' }, 409);
  });

  await page.goto(`${origin}${pageRoute}`);
  const panel = page.locator('[data-category-tree-state]');
  await expect(panel).toHaveAttribute('data-category-tree-state', 'success');
  await expect(panel.getByRole('heading', { name: '平台分类树' })).toBeVisible();
  await expect(panel).toContainText('食品饮料');
  await expect(panel).toContainText('粮油米面');
  await expect(panel).toContainText('大米');
  await expect(panel).not.toContainText(/供应价|结算价|毛利/u);

  await panel.getByRole('button', { name: '新增子级' }).first().click();
  await page.getByLabel('分类名称').fill('休闲食品');
  await page.getByRole('button', { name: '创建分类' }).click();
  await expect.poll(() => created).toBe(1);

  const leafRow = panel.getByRole('row', { name: /大米/u });
  await leafRow.getByRole('button', { name: /停\s*用/u }).click();
  await expect.poll(() => patched).toBe(1);

  await leafRow.getByRole('button', { name: /删\s*除/u }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect.poll(() => deleted).toBe(1);
  await expect(panel.getByText('已引用分类不能删除')).toBeVisible();
});

test('P0-011 exposes empty, permission and offline recovery states without fake categories', async ({ page }) => {
  await installWorkspace(page);
  let mode: 'empty' | 'permission' | 'offline' = 'empty';
  await page.route('**/v1/company/categories', async (route) => {
    if (mode === 'offline') return route.abort('failed');
    if (mode === 'permission') {
      return json(route, { code: 'WORKSPACE_FORBIDDEN', message: '当前职能无权访问分类管理' }, 403);
    }
    return json(route, { items: [], total: 0 });
  });

  await page.goto(`${origin}${pageRoute}`);
  await expect(page.locator('[data-category-tree-state]')).toHaveAttribute('data-category-tree-state', 'empty');
  await expect(page.getByText('尚未建立平台分类')).toBeVisible();

  mode = 'permission';
  await page.reload();
  await expect(page.getByText('无权访问分类管理', { exact: true })).toBeVisible();

  mode = 'offline';
  await page.reload();
  await expect(page.getByText('分类树网络离线或超时')).toBeVisible();
});
