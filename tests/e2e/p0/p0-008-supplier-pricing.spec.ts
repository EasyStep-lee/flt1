import { expect, test, type Page } from '@playwright/test';

const supplierOrigin = 'http://127.0.0.1:4320';
const productRoute = '/supplier/workspaces/products';
const pricingRoute = '/supplier/workspaces/pricing';
const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const skuId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const workspaces = {
  [productRoute]: {
    accountTypeCode: 'SUPPLIER_PRODUCT',
    accountTypeName: '商品运营',
    pageId: 'PAGE-017',
    workspaceRoute: productRoute,
    menuItems: [{ key: 'workspace', label: '商品管理', route: productRoute }],
  },
  [pricingRoute]: {
    accountTypeCode: 'SUPPLIER_PRICING',
    accountTypeName: '价格管理',
    pageId: 'PAGE-018',
    workspaceRoute: pricingRoute,
    menuItems: [{ key: 'workspace', label: '价格管理', route: pricingRoute }],
  },
} as const;

const installWorkspaceRoutes = async (page: Page) => {
  await page.route('**/v1/supplier-auth/workspace/current**', async (route) => {
    const requested = new URL(route.request().url()).searchParams.get(
      'route',
    ) as keyof typeof workspaces;
    const workspace = workspaces[requested];
    await route.fulfill({
      contentType: 'application/json',
      status: workspace ? 200 : 403,
      body: JSON.stringify(
        workspace ?? { code: 'WORKSPACE_FORBIDDEN', message: '无权访问' },
      ),
    });
  });
  await page.route('**/v1/supplier-auth/workspace/page**', async (route) => {
    const requested = new URL(route.request().url()).searchParams.get(
      'route',
    ) as keyof typeof workspaces;
    const workspace = workspaces[requested];
    await route.fulfill({
      contentType: 'application/json',
      status: workspace ? 200 : 403,
      body: JSON.stringify(
        workspace
          ? {
              ...workspace,
              filters: { availability: 'ALL', keyword: '' },
              summary: {
                availableTotal: 1,
                catalogTotal: 1,
                deferredTotal: 0,
                filteredTotal: 1,
              },
              items: [
                {
                  availability: 'AVAILABLE',
                  dataBoundary: '当前供应商固定职能会话',
                  deliveryStage: 'M2',
                  description:
                    requested === pricingRoute
                      ? '首次上架三类价格'
                      : '商品资料不加载价格',
                  label: workspace.menuItems[0].label,
                  moduleKey:
                    requested === pricingRoute ? 'initial-prices' : 'product-drafts',
                },
              ],
              selectedModule: null,
            }
          : { code: 'WORKSPACE_FORBIDDEN', message: '无权访问' },
      ),
    });
  });
};

const pricingPage = () => ({
  total: 1,
  items: [
    {
      supplierProductId: productId,
      name: '独立定价大米礼盒',
      status: 'PENDING_MATERIAL_REVIEW',
      version: 1,
      initialPriceEditable: true,
      latestReview: null,
      skus: [
        {
          id: skuId,
          supplierSkuCode: 'RICE-PRICE-5KG',
          requestedSupplyPrice: null,
          requestedRetailSalePrice: null,
          requestedEnterpriseSalePrice: null,
        },
      ],
    },
  ],
});

test('NEG-M2-008-01/02 keeps PAGE-017 price-free and submits three integer-cent prices only on PAGE-018', async ({
  page,
}) => {
  await installWorkspaceRoutes(page);
  let pricingRequests = 0;
  await page.route('**/v1/supplier/pricing/products', async (route) => {
    pricingRequests += 1;
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify(pricingPage()),
    });
  });

  await page.goto(`${supplierOrigin}${productRoute}`);
  await expect(page.locator('[data-page-id="PAGE-017"]')).toBeVisible();
  await expect(page.getByText('新建商品资料草稿')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /供应价（分）|个人零售价（分）|企业集采价（分）/u,
  );
  expect(pricingRequests).toBe(0);

  let capturedBody: Record<string, unknown> | undefined;
  await page.route('**/v1/supplier/pricing/products/*/initial-prices', async (route) => {
    capturedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        supplierProductId: productId,
        status: 'PENDING',
        version: 1,
        prices: (capturedBody.prices as readonly unknown[]) ?? [],
      }),
    });
  });

  await page.goto(`${supplierOrigin}${pricingRoute}`);
  await expect(page.locator('[data-page-id="PAGE-018"]')).toBeVisible();
  await expect(page.getByText('首次上架三类价格', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: '提交初始价格审核' }).click();
  await expect(page.locator('[data-pricing-state="validation"]')).toBeVisible();

  await page.getByLabel('RICE-PRICE-5KG供应价整数分').fill('5000');
  await page.getByLabel('RICE-PRICE-5KG个人零售价整数分').fill('6990');
  await page.getByLabel('RICE-PRICE-5KG企业集采价整数分').fill('6200');
  await page.getByRole('button', { name: '提交初始价格审核' }).click();
  await expect.poll(() => capturedBody).toBeTruthy();
  expect(capturedBody).toMatchObject({
    prices: [
      {
        supplierSkuCode: 'RICE-PRICE-5KG',
        requestedSupplyPrice: 5000,
        requestedRetailSalePrice: 6990,
        requestedEnterpriseSalePrice: 6200,
      },
    ],
  });
  expect(capturedBody?.requestId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(JSON.stringify(capturedBody)).not.toMatch(
    /companyId|supplierId|functionalAccountId|identityId|buyerId/iu,
  );
});

test('NEG-M2-008-05 retries an unknown result with the exact same idempotency key and body', async ({
  page,
}) => {
  await installWorkspaceRoutes(page);
  await page.route('**/v1/supplier/pricing/products', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify(pricingPage()),
    });
  });
  const attempts: { readonly body: string | null; readonly key: string | undefined }[] = [];
  await page.route('**/v1/supplier/pricing/products/*/initial-prices', async (route) => {
    attempts.push({
      body: route.request().postData(),
      key: route.request().headers()['idempotency-key'],
    });
    if (attempts.length === 1) {
      await route.abort('failed');
      return;
    }
    const body = route.request().postDataJSON();
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        supplierProductId: productId,
        status: 'PENDING',
        version: 1,
        prices: body.prices,
      }),
    });
  });

  await page.goto(`${supplierOrigin}${pricingRoute}`);
  await page.getByLabel('RICE-PRICE-5KG供应价整数分').fill('5000');
  await page.getByLabel('RICE-PRICE-5KG个人零售价整数分').fill('6990');
  await page.getByLabel('RICE-PRICE-5KG企业集采价整数分').fill('6200');
  await page.getByRole('button', { name: '提交初始价格审核' }).click();
  await expect(page.locator('[data-pricing-state="unknown-result"]')).toBeVisible();
  await page.getByRole('button', { name: '按原请求恢复' }).first().click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[0].key).toBeTruthy();
  expect(attempts[1].key).toBe(attempts[0].key);
  expect(attempts[1].body).toBe(attempts[0].body);
});

test('PAGE-018 exposes empty, permission and offline states without ownership leakage', async ({
  page,
}) => {
  await installWorkspaceRoutes(page);
  let mode: 'empty' | 'offline' | 'permission' = 'empty';
  await page.route('**/v1/supplier/pricing/products', async (route) => {
    if (mode === 'offline') {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      status: mode === 'permission' ? 403 : 200,
      body: JSON.stringify(
        mode === 'permission'
          ? { code: 'WORKSPACE_FORBIDDEN', message: '当前职能无权访问价格页面' }
          : { items: [], total: 0 },
      ),
    });
  });

  await page.goto(`${supplierOrigin}${pricingRoute}`);
  await expect(page.locator('[data-pricing-state="empty"]')).toBeVisible();

  mode = 'permission';
  await page.reload();
  await expect(page.locator('[data-pricing-state="permission"]')).toBeVisible();

  mode = 'offline';
  await page.reload();
  await expect(page.locator('[data-pricing-state="offline"]')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /supplierId|functionalAccountId|identityId|sessionToken|grossMargin|bankAccount/iu,
  );
});
