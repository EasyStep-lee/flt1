import { expect, test, type Page, type Route } from '@playwright/test';

const supplierOrigin = 'http://127.0.0.1:4320';
const supplierRoute = '/supplier/workspaces/inventory';
const skuId = '23333333-3333-4333-8333-333333333333';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });

const installWorkspace = async (page: Page) => {
  const workspace = {
    accountTypeCode: 'SUPPLIER_INVENTORY',
    accountTypeName: '库存/仓库',
    pageId: 'PAGE-019',
    workspaceRoute: supplierRoute,
    menuItems: [{ key: 'workspace', label: '库存管理', route: supplierRoute }],
  };
  await page.route('**/v1/supplier-auth/workspace/current**', (route) => json(route, workspace));
  await page.route('**/v1/supplier-auth/workspace/page**', (route) => json(route, {
    ...workspace,
    filters: { availability: 'ALL', keyword: '' },
    summary: { availableTotal: 1, catalogTotal: 3, deferredTotal: 2, filteredTotal: 3 },
    items: [],
    selectedModule: null,
  }));
};

test('P0-063 supplier inventory page adjusts the single shared SKU balance without ownership or price fields', async ({ page }) => {
  await installWorkspace(page);
  let current = {
    skuId,
    productName: '共用大米礼盒',
    skuCode: 'RICE-5KG',
    status: 'AVAILABLE',
    availableQty: 10,
    reservedQty: 0,
    soldQty: 0,
    damagedQty: 0,
    safetyStockQty: 3,
    warning: false,
    version: 0,
    updatedAt: new Date(0).toISOString(),
  };
  await page.route('**/v1/supplier/inventory', (route) => json(route, { items: [current], total: 1, page: 1, pageSize: 20 }));
  let adjustmentBody: Record<string, unknown> | undefined;
  let idempotencyKey: string | undefined;
  await page.route('**/v1/supplier/inventory/*/adjustments', async (route) => {
    adjustmentBody = route.request().postDataJSON() as Record<string, unknown>;
    idempotencyKey = route.request().headers()['idempotency-key'];
    current = { ...current, availableQty: 6, version: 1, updatedAt: new Date().toISOString() };
    return json(route, {
      balance: current,
      log: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', skuId, type: 'DECREASE',
        availableDelta: -4, reservedDelta: 0, soldDelta: 0, damagedDelta: 0,
        beforeAvailableQty: 10, afterAvailableQty: 6, beforeReservedQty: 0,
        afterReservedQty: 0, beforeSoldQty: 0, afterSoldQty: 0,
        resultingVersion: 1, reason: adjustmentBody.reason, occurredAt: current.updatedAt,
      },
    });
  });

  await page.goto(`${supplierOrigin}${supplierRoute}`);
  const panel = page.locator('[data-m2-slice="M2-P063"]');
  await expect(panel.getByRole('heading', { name: '跨渠道共用库存' })).toBeVisible();
  await expect(panel).toContainText('共用大米礼盒');
  await expect(panel).toContainText('10');
  expect(await panel.textContent()).not.toMatch(/供应价（分）|零售价（分）|集采价（分）|supplierId|companyId/iu);

  await panel.getByRole('button', { name: '调整库存' }).click();
  await page.getByLabel('调整类型').click();
  await page.getByTitle('出库减少').click();
  await page.getByLabel('调整数量（减少填写负数）').fill('-4');
  await page.getByLabel('调整原因').fill('仓库实物出库修正');
  await page.getByRole('button', { name: '确认调整' }).click();
  await expect.poll(() => adjustmentBody).toBeTruthy();
  expect(adjustmentBody).toMatchObject({
    type: 'DECREASE', mode: 'DELTA_AVAILABLE', quantity: -4, expectedVersion: 0,
    reason: '仓库实物出库修正',
  });
  expect(idempotencyKey).toBeTruthy();
  expect(JSON.stringify(adjustmentBody)).not.toMatch(/supplierId|companyId|identityId|supplyPrice/iu);
  await expect(panel).toContainText('6');
});
