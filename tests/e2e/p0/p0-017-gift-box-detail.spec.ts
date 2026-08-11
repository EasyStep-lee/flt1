import { expect, test, type Page, type Route } from '@playwright/test';

const origin = 'http://127.0.0.1:4321';
const pageRoute = '/company-admin/workspaces/product-ops';
const rootId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const middleId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const leafId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const templateId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const workspace = {
  accountTypeCode: 'COMPANY_PRODUCT_OPS', accountTypeName: '商品与分类运营',
  pageId: 'PAGE-005', workspaceRoute: pageRoute,
  menuItems: [{ key: 'material-review', label: '商品资料审核', route: pageRoute }],
};
const tree = { total: 3, items: [{
  id: rootId, parentId: null, name: '福利礼盒', level: 1, sortWeight: 10, status: 'ENABLED', version: 0,
  children: [{
    id: middleId, parentId: rootId, name: '企业福利', level: 2, sortWeight: 10, status: 'ENABLED', version: 0,
    children: [{
      id: leafId, parentId: middleId, name: '员工关怀礼盒', level: 3, sortWeight: 10,
      status: 'ENABLED', version: 0, children: [],
    }],
  }],
}] };
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });

const installWorkspace = async (page: Page) => {
  await page.route('**/v1/company-auth/workspace/current**', (route) => json(route, workspace));
  await page.route('**/v1/company-auth/workspace/page**', (route) => json(route, {
    ...workspace, filters: { availability: 'ALL', keyword: '' },
    summary: { availableTotal: 1, catalogTotal: 1, deferredTotal: 0, filteredTotal: 1 },
    items: [{ availability: 'AVAILABLE', dataBoundary: '当前固定职能', deliveryStage: 'M2', description: '分类与商品资料', label: '商品资料审核', moduleKey: 'material-review' }],
    selectedModule: null,
  }));
  await page.route('**/v1/company/product-material-reviews', (route) => json(route, { items: [], total: 0 }));
  await page.route('**/v1/company/categories', (route) => json(route, tree));
};

test('P0-017 creates a GIFT_BOX draft with structured bundle items and company after-sales', async ({ page }) => {
  await installWorkspace(page);
  let templates: unknown[] = [];
  let submittedBody: Record<string, unknown> | undefined;
  await page.route(`**/v1/company/categories/${leafId}/template-versions`, async (route) => {
    if (route.request().method() === 'GET') {
      return json(route, { categoryId: leafId, activeVersion: null, items: templates, total: templates.length });
    }
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    const draft = {
      id: templateId, categoryId: leafId, version: 1, revision: 0, status: 'DRAFT',
      ...submittedBody, createdAt: new Date().toISOString(), publishedAt: null, retiredAt: null,
    };
    templates = [draft];
    return json(route, draft, 201);
  });

  await page.goto(`${origin}${pageRoute}`);
  const panel = page.locator('[data-category-template-state]');
  await panel.getByRole('button', { name: '新建礼盒模板草稿' }).click();
  await expect.poll(() => submittedBody?.profile).toBe('GIFT_BOX');
  const body = submittedBody as {
    readonly fieldSchema: { readonly fields: readonly { readonly key: string; readonly type: string }[] };
    readonly skuDimensions: { readonly dimensions: readonly { readonly key: string }[] };
    readonly detailModules: { readonly modules: readonly { readonly key: string; readonly kind: string }[] };
    readonly afterSaleRules: { readonly notice: string; readonly returnPolicy: string };
  };
  expect(body.fieldSchema.fields).toContainEqual(expect.objectContaining({
    key: 'bundle-items', type: 'BUNDLE_ITEMS',
  }));
  expect(body.fieldSchema.fields.map(({ key }) => key)).toEqual(expect.arrayContaining([
    'packaging', 'customization', 'delivery-cycle', 'welfare-scenario',
  ]));
  expect(body.skuDimensions.dimensions.map(({ key }) => key)).toEqual([
    'package', 'tier', 'custom-version',
  ]);
  expect(body.detailModules.modules).toContainEqual(expect.objectContaining({
    key: 'gift-box-after-sales', kind: 'AFTER_SALE',
  }));
  expect(body.afterSaleRules).toMatchObject({
    returnPolicy: 'COMPANY_STANDARD',
    notice: expect.stringContaining('江苏福礼团供应链科技有限公司'),
  });
  await expect(panel.getByText('礼盒', { exact: true })).toBeVisible();
  await expect(panel).not.toContainText(/供应价|结算价|毛利/u);
});
