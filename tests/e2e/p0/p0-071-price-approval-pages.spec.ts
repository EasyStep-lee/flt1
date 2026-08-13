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

test('P0-071 supplier pricing page visibly separates all three pricing workflows', async ({ page }) => {
  await installSupplierWorkspace(page);
  const sku = { id: skuId, productName: '在售大米礼盒', code: 'RICE-P071-001', approvedSupplyPrice: 5000, currentRetailSalePrice: 6990, currentEnterpriseSalePrice: 6200, supplyPriceVersion: 1, retailPriceVersion: 2, enterprisePriceVersion: 3 };
  await page.route('**/v1/supplier/pricing/skus', (route) => json(route, { items: [sku], total: 1 }));
  await page.route('**/v1/supplier/pricing/supply-price-changes', (route) => json(route, { items: [{ id: taskId, approvalType: 'SUPPLY_PRICE_CHANGE', skuId, skuCode: sku.code, productName: sku.productName, oldSupplyPrice: 4800, requestedSupplyPrice: 5000, currentApprovedSupplyPrice: 5000, requestedEffectiveAt: now, effectiveAt: now, status: 'EFFECTIVE', reason: '成本变化', reviewOpinion: '凭证已核对', version: 3, createdAt: now, updatedAt: now }], total: 1 }));

  await page.goto(`${supplierOrigin}${supplierRoute}`);
  const pageRoot = page.locator('[data-m2-slice="M2-P071"]');
  await expect(pageRoot.getByText('首次上架三类价格', { exact: true })).toBeVisible();
  await expect(pageRoot.getByRole('tab', { name: '供应价变更申请' })).toBeVisible();
  await expect(pageRoot.getByRole('tab', { name: '销售价直接调价' })).toBeVisible();
  await expect(pageRoot).toContainText('审核前旧供应价继续有效');
  await pageRoot.getByRole('tab', { name: '供应价变更申请' }).click();
  await expect(pageRoot).toContainText('凭证已核对');
  await pageRoot.getByRole('tab', { name: '销售价直接调价' }).click();
  await expect(pageRoot.getByRole('button', { name: '销售价免审生效' })).toBeVisible();
});
test('P0-071 company page shows difference, effective time and opinion history without batch approval', async ({ page }) => {
  await installCompanyWorkspace(page);
  const review = { id: taskId, approvalType: 'SUPPLY_PRICE_CHANGE', skuId, skuCode: 'RICE-P071-001', productName: '在售大米礼盒', oldSupplyPrice: 5000, requestedSupplyPrice: 5400, currentApprovedSupplyPrice: 5000, requestedEffectiveAt: now, effectiveAt: null, status: 'SUBMITTED', reason: '原材料成本调整', reviewOpinion: null, version: 1, createdAt: now, updatedAt: now };
  await page.route('**/v1/company/price-reviews/supply-price-changes', (route) => json(route, { items: [review], total: 1 }));
  await page.route('**/v1/company/price-reviews/supply-price-changes/*/history', (route) => json(route, { taskId, items: [{ event: 'SUBMIT', fromStatus: null, toStatus: 'SUBMITTED', version: 1, opinion: null, occurredAt: now }, { event: 'REJECT', fromStatus: 'SUBMITTED', toStatus: 'REJECTED', version: 2, opinion: '请补充成本凭证', occurredAt: now }] }));

  await page.goto(`${companyOrigin}${companyRoute}`);
  const pageRoot = page.locator('[data-m2-slice="M2-P071"]');
  await expect(pageRoot).toContainText('¥50.00');
  await expect(pageRoot).toContainText('¥54.00');
  await expect(pageRoot).toContainText('8.00%');
  await expect(pageRoot).toContainText(now);
  await pageRoot.getByRole('button', { name: '查看历史意见' }).click();
  await expect(page.getByText('请补充成本凭证')).toBeVisible();
  await expect(pageRoot.getByRole('button', { name: /批量通过/u })).toHaveCount(0);
});
