import { expect, test, type Page, type Route } from '@playwright/test';

const supplierOrigin = 'http://127.0.0.1:4320';
const companyOrigin = 'http://127.0.0.1:4321';
const supplierRoute = '/supplier/workspaces/pricing';
const companyRoute = '/company-admin/workspaces/price-review';
const skuId = '99999999-9999-4999-8999-999999999999';
const taskId = '88888888-8888-4888-8888-888888888888';
const now = new Date().toISOString();

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });

const installSupplierWorkspace = async (page: Page) => {
  const workspace = { accountTypeCode: 'SUPPLIER_PRICING', accountTypeName: '价格管理', pageId: 'PAGE-018', workspaceRoute: supplierRoute, menuItems: [{ key: 'workspace', label: '价格管理', route: supplierRoute }] };
  await page.route('**/v1/supplier-auth/workspace/current**', (route) => json(route, workspace));
  await page.route('**/v1/supplier-auth/workspace/page**', (route) => json(route, { ...workspace, filters: { availability: 'ALL', keyword: '' }, summary: { availableTotal: 1, catalogTotal: 1, deferredTotal: 0, filteredTotal: 1 }, items: [], selectedModule: null }));
  await page.route('**/v1/supplier/pricing/products', (route) => json(route, { items: [], total: 0 }));
};

const installCompanyWorkspace = async (page: Page) => {
  const workspace = { accountTypeCode: 'COMPANY_PRICE_REVIEW', accountTypeName: '采购/价格审核', pageId: 'PAGE-006', workspaceRoute: companyRoute, menuItems: [{ key: 'review', label: '价格审核', route: companyRoute }] };
  await page.route('**/v1/company-auth/workspace/current**', (route) => json(route, workspace));
  await page.route('**/v1/company-auth/workspace/page**', (route) => json(route, { ...workspace, filters: { availability: 'ALL', keyword: '' }, summary: { availableTotal: 1, catalogTotal: 1, deferredTotal: 0, filteredTotal: 1 }, items: [], selectedModule: null }));
  await page.route('**/v1/company/price-reviews', (route) => json(route, { items: [], total: 0 }));
};

test('P0-019 supplier page sends supply changes to review and sale prices without an approval request', async ({ page }) => {
  await installSupplierWorkspace(page);
  const sku = { id: skuId, productName: '在售大米礼盒', code: 'RICE-LISTED-001', approvedSupplyPrice: 5000, currentRetailSalePrice: 6990, currentEnterpriseSalePrice: 6200, supplyPriceVersion: 0, retailPriceVersion: 0, enterprisePriceVersion: 0 };
  await page.route('**/v1/supplier/pricing/skus', (route) => json(route, { items: [sku], total: 1 }));
  let supplyBody: Record<string, unknown> | undefined;
  let saleBody: Record<string, unknown> | undefined;
  await page.route('**/v1/supplier/pricing/skus/*/supply-price-change', async (route) => {
    supplyBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { id: taskId, approvalType: 'SUPPLY_PRICE_CHANGE', skuId, skuCode: sku.code, productName: sku.productName, oldSupplyPrice: 5000, requestedSupplyPrice: supplyBody.requestedSupplyPrice, currentApprovedSupplyPrice: 5000, requestedEffectiveAt: supplyBody.effectiveAt, effectiveAt: null, status: 'SUBMITTED', reason: supplyBody.reason, reviewOpinion: null, version: 1, createdAt: now, updatedAt: now }, 201);
  });
  await page.route('**/v1/supplier/pricing/skus/*/sale-prices', async (route) => {
    saleBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { skuId, currentRetailSalePrice: saleBody.retailSalePrice, currentEnterpriseSalePrice: saleBody.enterpriseSalePrice, retailPriceVersion: 1, enterprisePriceVersion: 1, effectiveAt: saleBody.effectiveAt, reviewCreated: false, scheduled: false });
  });

  await page.goto(`${supplierOrigin}${supplierRoute}`);
  const panel = page.locator('[data-m2-slice="M2-P019"]');
  await expect(panel.getByRole('heading', { name: '上架后分级调价' })).toBeVisible();
  await panel.getByLabel('RICE-LISTED-001调价原因').fill('成本与销售策略调整');
  await panel.getByLabel('RICE-LISTED-001二次验证').fill('246810');
  await panel.getByRole('button', { name: '提交供应价审核' }).click();
  await expect.poll(() => supplyBody).toBeTruthy();
  expect(supplyBody).toMatchObject({ requestedSupplyPrice: 5000, version: 0 });
  expect(JSON.stringify(supplyBody)).not.toMatch(/supplierId|companyId|identityId/iu);

  await panel.getByLabel('RICE-LISTED-001调价原因').fill('销售策略调整');
  await panel.getByLabel('RICE-LISTED-001二次验证').fill('246810');
  await panel.getByRole('button', { name: '销售价免审生效' }).click();
  await expect.poll(() => saleBody).toBeTruthy();
  expect(saleBody).toMatchObject({ retailSalePrice: 6990, enterpriseSalePrice: 6200, retailPriceVersion: 0, enterprisePriceVersion: 0 });
});

test('P0-019 company price-review page displays old/new supply price and requires decision verification', async ({ page }) => {
  await installCompanyWorkspace(page);
  const review = { id: taskId, approvalType: 'SUPPLY_PRICE_CHANGE', skuId, skuCode: 'RICE-LISTED-001', productName: '在售大米礼盒', oldSupplyPrice: 5000, requestedSupplyPrice: 5400, currentApprovedSupplyPrice: 5000, requestedEffectiveAt: now, effectiveAt: null, status: 'SUBMITTED', reason: '原材料成本调整', reviewOpinion: null, version: 1, createdAt: now, updatedAt: now };
  await page.route('**/v1/company/price-reviews/supply-price-changes', (route) => json(route, { items: [review], total: 1 }));
  let decisionBody: Record<string, unknown> | undefined;
  await page.route('**/v1/company/price-reviews/supply-price-changes/*/decision', async (route) => {
    decisionBody = route.request().postDataJSON() as Record<string, unknown>;
    return json(route, { ...review, status: 'EFFECTIVE', currentApprovedSupplyPrice: 5400, effectiveAt: now, version: 3, reviewOpinion: decisionBody.opinion });
  });
  await page.goto(`${companyOrigin}${companyRoute}`);
  const panel = page.locator('[data-m2-slice="M2-P019"]');
  await expect(panel).toContainText('¥50.00');
  await expect(panel).toContainText('¥54.00');
  await panel.getByRole('button', { name: '审核变更' }).click();
  await page.getByLabel('供应价审核意见').fill('成本凭证已核对');
  await page.getByLabel('价格审核二次验证').fill('135790');
  await page.getByRole('button', { name: '提交审核决定' }).click();
  await expect.poll(() => decisionBody).toBeTruthy();
  expect(decisionBody).toMatchObject({ decision: 'APPROVE', version: 1, secondVerificationCode: '135790' });
});
