import { expect, test, type Page } from '@playwright/test';

const companyOrigin = 'http://127.0.0.1:4321';
const materialRoute = '/company-admin/workspaces/product-ops';
const priceRoute = '/company-admin/workspaces/price-review';

const workspaces = {
  [materialRoute]: {
    accountTypeCode: 'COMPANY_PRODUCT_OPS',
    accountTypeName: '商品与分类运营',
    pageId: 'PAGE-005',
    workspaceRoute: materialRoute,
    menuItems: [{ key: 'material-review', label: '商品资料审核', route: materialRoute }],
  },
  [priceRoute]: {
    accountTypeCode: 'COMPANY_PRICE_REVIEW',
    accountTypeName: '采购/价格审核',
    pageId: 'PAGE-006',
    workspaceRoute: priceRoute,
    menuItems: [{ key: 'price-review', label: '初始价格审核', route: priceRoute }],
  },
} as const;

const taskId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const installWorkspaceRoutes = async (page: Page) => {
  await page.route('**/v1/company-auth/workspace/current**', async (route) => {
    const requested = new URL(route.request().url()).searchParams.get('route') as keyof typeof workspaces;
    const workspace = workspaces[requested];
    await route.fulfill({
      contentType: 'application/json',
      status: workspace ? 200 : 403,
      body: JSON.stringify(workspace ?? { code: 'WORKSPACE_FORBIDDEN', message: '无权访问' }),
    });
  });
  await page.route('**/v1/company-auth/workspace/page**', async (route) => {
    const requested = new URL(route.request().url()).searchParams.get('route') as keyof typeof workspaces;
    const workspace = workspaces[requested];
    await route.fulfill({
      contentType: 'application/json',
      status: workspace ? 200 : 403,
      body: JSON.stringify(
        workspace
          ? {
              ...workspace,
              filters: { availability: 'ALL', keyword: '' },
              summary: { availableTotal: 1, catalogTotal: 1, deferredTotal: 0, filteredTotal: 1 },
              items: [
                {
                  availability: 'AVAILABLE',
                  dataBoundary: '当前固定职能',
                  deliveryStage: 'M2',
                  description: '独立审核队列',
                  label: workspace.menuItems[0].label,
                  moduleKey: workspace.menuItems[0].key,
                },
              ],
              selectedModule: null,
            }
          : { code: 'WORKSPACE_FORBIDDEN', message: '无权访问' },
      ),
    });
  });
};

test('NEG-M2-007-01/02 renders independent material and initial-price pages with field isolation', async ({
  page,
}) => {
  await installWorkspaceRoutes(page);
  let materialDecision = 0;
  let priceDecision = 0;
  await page.route('**/v1/company/product-material-reviews', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        total: 1,
        items: [
          {
            id: taskId,
            approvalType: 'PRODUCT_MATERIAL',
            supplierId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            supplierProductId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            name: '双审大米礼盒',
            brand: '福礼优选',
            categoryId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            templateVersion: 1,
            attributes: { origin: '东北' },
            qualificationReferenceCount: 1,
            isRetailEnabled: true,
            isEnterpriseProcurementEnabled: true,
            preparationMinutes: 30,
            skus: [
              {
                id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                supplierSkuCode: 'RICE-5KG',
                attributes: { weight: '5kg' },
              },
            ],
            status: 'PENDING',
            version: 1,
            reviewOpinion: null,
            createdAt: '2026-08-09T10:00:00.000Z',
            updatedAt: '2026-08-09T10:00:00.000Z',
          },
        ],
      }),
    });
  });
  await page.route('**/v1/company/product-material-reviews/*/decision', async (route) => {
    materialDecision += 1;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ decision: 'APPROVE', version: 1 });
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        id: taskId,
        approvalType: 'PRODUCT_MATERIAL',
        supplierProductId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'APPROVED',
        version: 2,
        reviewOpinion: body.opinion,
        publicationStatus: 'WAITING_OTHER_APPROVAL',
        productId: null,
      }),
    });
  });
  await page.route('**/v1/company/price-reviews', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        total: 1,
        items: [
          {
            id: taskId,
            approvalType: 'PRODUCT_INITIAL_PRICE',
            supplierId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            supplierProductId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            name: '双审大米礼盒',
            skus: [
              {
                id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                supplierSkuCode: 'RICE-5KG',
                requestedSupplyPrice: 5000,
                requestedRetailSalePrice: 6990,
                requestedEnterpriseSalePrice: 6200,
              },
            ],
            status: 'PENDING',
            version: 1,
            reviewOpinion: null,
            createdAt: '2026-08-09T10:00:00.000Z',
            updatedAt: '2026-08-09T10:00:00.000Z',
          },
        ],
      }),
    });
  });
  await page.route('**/v1/company/price-reviews/*/decision', async (route) => {
    priceDecision += 1;
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        id: taskId,
        approvalType: 'PRODUCT_INITIAL_PRICE',
        supplierProductId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'APPROVED',
        version: 2,
        reviewOpinion: '价格通过',
        publicationStatus: 'ACTIVE',
        productId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      }),
    });
  });

  await page.goto(`${companyOrigin}${materialRoute}`);
  const materialShell = page.locator('[data-page-id="PAGE-005"]');
  await expect(materialShell.getByRole('heading', { name: '商品资料审核', exact: true })).toBeVisible();
  await expect(materialShell).toContainText('双审大米礼盒');
  await expect(materialShell).toContainText('RICE-5KG');
  await expect(materialShell).not.toContainText(/¥50\.00|¥69\.90|¥62\.00/u);
  await materialShell.getByRole('button', { name: /审\s*核/u }).click();
  await page.getByLabel('资料审核意见').fill('商品资料与资质通过');
  await page.getByRole('button', { name: '提交审核决定' }).click();
  await expect.poll(() => materialDecision).toBe(1);

  await page.goto(`${companyOrigin}${priceRoute}`);
  const priceShell = page.locator('[data-page-id="PAGE-006"]');
  await expect(priceShell.getByRole('heading', { name: '初始价格审核', exact: true })).toBeVisible();
  await expect(priceShell).toContainText('供应 ¥50.00');
  await expect(priceShell).toContainText('零售 ¥69.90');
  await expect(priceShell).toContainText('集采 ¥62.00');
  await expect(priceShell).not.toContainText('东北');
  expect(priceDecision).toBe(0);
});

test('company material page exposes permission and unknown-result recovery states', async ({ page }) => {
  await installWorkspaceRoutes(page);
  let mode: 'permission' | 'offline' = 'permission';
  await page.route('**/v1/company/product-material-reviews', async (route) => {
    if (mode === 'offline') {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      status: 403,
      body: JSON.stringify({ code: 'WORKSPACE_FORBIDDEN', message: '当前职能无权访问资料审核' }),
    });
  });

  await page.goto(`${companyOrigin}${materialRoute}`);
  await expect(page.getByText('无权访问商品资料审核')).toBeVisible();
  mode = 'offline';
  await page.reload();
  await expect(page.getByText('网络离线或超时')).toBeVisible();
});
