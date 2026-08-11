import { expect, test, type Page, type Route } from '@playwright/test';

const origin = 'http://127.0.0.1:4321';
const pageRoute = '/company-admin/workspaces/product-ops';
const rootId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const middleId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const leafId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const controlId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

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
    id: rootId, parentId: null, name: '健康服务', level: 1, sortWeight: 10,
    status: 'ENABLED', version: 0,
    children: [{
      id: middleId, parentId: rootId, name: '强监管预留', level: 2, sortWeight: 10,
      status: 'ENABLED', version: 0,
      children: [{
        id: leafId, parentId: middleId, name: '医疗器械预留', level: 3, sortWeight: 10,
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
    items: [{
      availability: 'AVAILABLE', dataBoundary: '当前固定职能', deliveryStage: 'M2',
      description: '分类、模板、资料审核和强监管开关', label: '商品资料审核', moduleKey: 'material-review',
    }],
    selectedModule: null,
  }));
  await page.route('**/v1/company/product-material-reviews', (route) => json(route, { items: [], total: 0 }));
  await page.route('**/v1/company/categories', (route) => json(route, tree));
  await page.route(`**/v1/company/categories/${leafId}/template-versions`, (route) => json(route, {
    categoryId: leafId, activeVersion: 1, total: 1, items: [{
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', categoryId: leafId,
      version: 1, revision: 1, status: 'PUBLISHED', regulatoryMode: 'HIGH_RISK', profile: 'GENERIC',
      fieldSchema: { schemaVersion: '1.0', fields: [] }, skuDimensions: { dimensions: [] },
      qualificationRules: { rules: [] }, detailModules: { modules: [] },
      afterSaleRules: { returnPolicy: 'CATEGORY_RESTRICTED', notice: '公司统一售后', evidenceRequirements: [] },
      createdAt: new Date().toISOString(), publishedAt: new Date().toISOString(), retiredAt: null,
    }],
  }));
};

test('P0-018 provides an independent default-deny control panel with verified enablement and redacted response', async ({ page }) => {
  await installWorkspace(page);
  let controls: unknown[] = [];
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/v1/company/regulated-category-controls', (route) =>
    json(route, { items: controls, total: controls.length }));
  await page.route(`**/v1/company/regulated-category-controls/${leafId}/enable`, async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    const response = {
      id: controlId,
      categoryId: leafId,
      status: 'ENABLED',
      companyQualificationReferenceCount: 1,
      qualificationValidUntil: submitted.qualificationValidUntil,
      version: 1,
      enabledAt: new Date().toISOString(),
      disabledAt: null,
    };
    controls = [response];
    return json(route, response);
  });

  await page.goto(`${origin}${pageRoute}`);
  const panel = page.locator('[data-page-id="PAGE-M2-018"]');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-role', 'COMPANY_PRODUCT_OPS');
  await expect(panel.getByText('尚无显式启用记录；强监管模板仍保持默认关闭')).toBeVisible();

  await panel.getByLabel('公司资质受控对象引用').fill('object://company-qualification/ui-test');
  await panel.getByLabel('公司资质有效期').fill('2027-08-11T12:00');
  await panel.getByLabel('强监管二次验证码').fill('246810');
  await panel.getByRole('button', { name: '二次验证并启用' }).click();

  await expect.poll(() => submitted?.version).toBe(0);
  expect(submitted).toMatchObject({
    companyQualificationReferences: ['object://company-qualification/ui-test'],
    secondVerificationCode: '246810',
  });
  await expect(panel.getByText('已启用')).toBeVisible();
  await expect(panel.getByText('1 份')).toBeVisible();
  await expect(panel).not.toContainText('object://company-qualification/ui-test');
  await expect(panel).not.toContainText(/供应价|结算价|毛利/u);
});

test('P0-018 reports permission and unknown-result states without optimistic enablement', async ({ page }) => {
  await installWorkspace(page);
  await page.route('**/v1/company/regulated-category-controls', (route) => json(route, {
    statusCode: 403, code: 'WORKSPACE_FORBIDDEN', message: 'Forbidden', requestId: 'test', path: route.request().url(), timestamp: new Date().toISOString(),
  }, 403));
  await page.goto(`${origin}${pageRoute}`);
  const panel = page.locator('[data-page-id="PAGE-M2-018"]');
  await expect(panel).toHaveAttribute('data-regulated-category-state', 'permission');
  await expect(panel.getByText('无权访问强监管开关')).toBeVisible();
  await expect(panel.getByText('已启用')).toHaveCount(0);
});
