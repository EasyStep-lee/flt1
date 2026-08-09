import { expect, test } from '@playwright/test';

const supplierOrigin = 'http://127.0.0.1:4320';
const categoryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

test('P0-006 supplier product page creates only an upstream draft with session-bound ownership', async ({
  page,
}) => {
  await page.route('**/v1/supplier-auth/workspace/current**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountTypeCode: 'SUPPLIER_PRODUCT',
        accountTypeName: '商品运营',
        pageId: 'PAGE-017',
        workspaceRoute: '/supplier/workspaces/products',
        menuItems: [
          {
            key: 'workspace',
            label: '商品管理',
            route: '/supplier/workspaces/products',
          },
        ],
      }),
    });
  });
  await page.route('**/v1/supplier-auth/workspace/page**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountTypeCode: 'SUPPLIER_PRODUCT',
        accountTypeName: '商品运营',
        pageId: 'PAGE-017',
        workspaceRoute: '/supplier/workspaces/products',
        filters: { keyword: '', availability: 'ALL' },
        summary: {
          catalogTotal: 1,
          availableTotal: 1,
          deferredTotal: 0,
          filteredTotal: 1,
        },
        items: [
          {
            moduleKey: 'product-drafts',
            label: '商品资料草稿',
            description: '本供应商商品资料',
            deliveryStage: 'M2',
            availability: 'AVAILABLE',
            dataBoundary: '当前供应商固定职能会话',
          },
        ],
        selectedModule: null,
      }),
    });
  });

  let capturedBody: Record<string, unknown> | undefined;
  await page.route('**/v1/supplier/products', async (route) => {
    capturedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        categoryId,
        templateVersion: 1,
        name: '有机大米礼盒',
        brand: '福礼优选',
        attributes: { schemaVersion: '1.0' },
        qualificationReferenceCount: 1,
        isRetailEnabled: true,
        isEnterpriseProcurementEnabled: false,
        enterpriseMinOrderQty: 1,
        enterprisePackageMultiple: 1,
        preparationMinutes: 0,
        status: 'DRAFT',
        version: 0,
        skus: [
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            supplierSkuCode: 'RICE-GIFT-5KG',
            attributes: { weight: '5kg' },
            initialStock: 100,
            status: 'DRAFT',
          },
        ],
      }),
    });
  });

  await page.goto(`${supplierOrigin}/supplier/workspaces/products`);
  await expect(page.locator('[data-supplier-product-state="empty"]')).toBeVisible();
  await page.getByLabel('分类编号').fill(categoryId);
  await page.getByLabel('商品名称').fill('有机大米礼盒');
  await page.getByLabel('品牌（选填）').fill('福礼优选');
  await page.getByLabel('资质引用（选填）').fill(
    'object://supplier-product/license-001',
  );
  await page.getByLabel('供应商 SKU 编码').fill('RICE-GIFT-5KG');
  await page.getByLabel('SKU 属性 JSON').fill('{"weight":"5kg"}');
  await page.getByLabel('初始库存').fill('100');
  await page.getByRole('button', { name: '保存商品资料草稿' }).click();

  await expect(page.locator('[data-supplier-product-state="success"]')).toBeVisible();
  await expect(page.getByText('有机大米礼盒')).toBeVisible();
  await expect(page.getByText('仅保存了上游资料')).toBeVisible();
  expect(capturedBody).toMatchObject({
    categoryId,
    name: '有机大米礼盒',
    skus: [{ supplierSkuCode: 'RICE-GIFT-5KG', initialStock: 100 }],
  });
  expect(JSON.stringify(capturedBody)).not.toMatch(
    /companyId|supplierId|functionalAccountId|requestedSupplyPrice|supplyPrice|approvedSupplyPrice/iu,
  );
  await expect(page.locator('body')).not.toContainText(
    /requestedSupplyPrice|supplyPrice|approvedSupplyPrice/iu,
  );
});
