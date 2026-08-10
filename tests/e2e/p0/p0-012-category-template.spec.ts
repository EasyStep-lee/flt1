import { expect, test, type Page, type Route } from '@playwright/test';

const origin = 'http://127.0.0.1:4321';
const pageRoute = '/company-admin/workspaces/product-ops';
const rootId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const middleId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const leafId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const templateId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const workspace = {
  accountTypeCode: 'COMPANY_PRODUCT_OPS',
  accountTypeName: '商品与分类运营',
  pageId: 'PAGE-005',
  workspaceRoute: pageRoute,
  menuItems: [{ key: 'material-review', label: '商品资料审核', route: pageRoute }],
};

const tree = {
  total: 3,
  items: [{
    id: rootId, parentId: null, name: '食品饮料', level: 1, sortWeight: 10,
    status: 'ENABLED', version: 0,
    children: [{
      id: middleId, parentId: rootId, name: '粮油米面', level: 2, sortWeight: 10,
      status: 'ENABLED', version: 0,
      children: [{
        id: leafId, parentId: middleId, name: '大米', level: 3, sortWeight: 10,
        status: 'ENABLED', version: 0, children: [],
      }],
    }],
  }],
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });

const installWorkspace = async (page: Page) => {
  await page.route('**/v1/company-auth/workspace/current**', (route) => json(route, workspace));
  await page.route('**/v1/company-auth/workspace/page**', (route) => json(route, {
    ...workspace,
    filters: { availability: 'ALL', keyword: '' },
    summary: { availableTotal: 1, catalogTotal: 1, deferredTotal: 0, filteredTotal: 1 },
    items: [{ availability: 'AVAILABLE', dataBoundary: '当前固定职能', deliveryStage: 'M2', description: '分类与商品资料', label: '商品资料审核', moduleKey: 'material-review' }],
    selectedModule: null,
  }));
  await page.route('**/v1/company/product-material-reviews', (route) => json(route, { items: [], total: 0 }));
  await page.route('**/v1/company/categories', (route) => json(route, tree));
};

test('P0-012 creates, edits and publishes a category-template version from product ops', async ({ page }) => {
  await installWorkspace(page);
  let templates: unknown[] = [];
  let created = 0;
  let patched = 0;
  let published = 0;

  await page.route(`**/v1/company/categories/${leafId}/template-versions`, async (route) => {
    if (route.request().method() === 'GET') {
      return json(route, { categoryId: leafId, activeVersion: published ? 1 : null, items: templates, total: templates.length });
    }
    created += 1;
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    const draft = {
      id: templateId, categoryId: leafId, version: 1, revision: 0, status: 'DRAFT',
      ...route.request().postDataJSON(), createdAt: new Date().toISOString(), publishedAt: null, retiredAt: null,
    };
    templates = [draft];
    return json(route, draft, 201);
  });
  await page.route(`**/v1/company/category-template-versions/${templateId}`, async (route) => {
    patched += 1;
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    const body = route.request().postDataJSON();
    expect(body.revision).toBe(0);
    const draft = { ...(templates[0] as object), ...body, revision: 1 };
    templates = [draft];
    return json(route, draft);
  });
  await page.route(`**/v1/company/category-template-versions/${templateId}/publish`, async (route) => {
    published += 1;
    expect(route.request().postDataJSON()).toEqual({ revision: 1 });
    const current = { ...(templates[0] as object), status: 'PUBLISHED', revision: 2, publishedAt: new Date().toISOString() };
    templates = [current];
    return json(route, current);
  });

  await page.goto(`${origin}${pageRoute}`);
  const panel = page.locator('[data-category-template-state]');
  await expect(panel.getByRole('heading', { name: '分类模板版本' })).toBeVisible();
  await expect(panel).toHaveAttribute('data-category-template-state', 'empty');
  await panel.getByRole('button', { name: '新建下一版本草稿' }).click();
  await expect.poll(() => created).toBe(1);
  await expect(panel).toContainText('草稿');
  await panel.getByRole('button', { name: '编辑定义' }).click();
  const editor = panel.getByLabel('模板定义 JSON');
  await expect(editor).toContainText('description');
  await panel.getByRole('button', { name: '保存草稿' }).click();
  await expect.poll(() => patched).toBe(1);
  await panel.getByRole('button', { name: '发布版本' }).click();
  await page.getByRole('button', { name: '确认发布' }).click();
  await expect.poll(() => published).toBe(1);
  await expect(panel).toContainText('当前发布');
  await expect(panel).not.toContainText(/供应价|结算价|毛利/u);
});

test('P0-012 shows permission and unknown-result recovery without fabricating a published version', async ({ page }) => {
  await installWorkspace(page);
  let denied = true;
  await page.route(`**/v1/company/categories/${leafId}/template-versions`, (route) => {
    if (denied) return json(route, { code: 'WORKSPACE_FORBIDDEN', message: '当前职能无权访问模板' }, 403);
    return route.abort('failed');
  });
  await page.goto(`${origin}${pageRoute}`);
  await expect(page.getByText('无权访问分类模板', { exact: true })).toBeVisible();
  denied = false;
  await page.reload();
  await expect(page.getByText('分类模板网络离线或超时')).toBeVisible();
  await expect(page.locator('[data-category-template-state]').getByText('当前发布', { exact: true })).toHaveCount(0);
});
