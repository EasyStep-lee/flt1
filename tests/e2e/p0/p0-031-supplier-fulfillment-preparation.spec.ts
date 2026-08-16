import { expect, test, type Page, type Route } from '@playwright/test';

const origin = 'http://127.0.0.1:4320';
const workspaceRoute = '/supplier/workspaces/fulfillment';
const subOrderId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });

const installWorkspace = async (page: Page) => {
  const workspace = {
    accountTypeCode: 'SUPPLIER_FULFILLMENT', accountTypeName: '订单履约',
    pageId: 'PAGE-020', workspaceRoute,
    menuItems: [{ key: 'workspace', label: '履约管理', route: workspaceRoute }],
  };
  await page.route('**/v1/supplier-auth/workspace/current**', (route) => json(route, workspace));
  await page.route('**/v1/supplier-auth/workspace/page**', (route) => json(route, {
    ...workspace, filters: { availability: 'ALL', keyword: '' },
    summary: { availableTotal: 3, catalogTotal: 3, deferredTotal: 0, filteredTotal: 3 },
    items: [], selectedModule: null,
  }));
};

test('P0-031 PAGE-020 confirms and prepares only the current supplier suborder without financial fields', async ({ page }) => {
  await installWorkspace(page);
  let item = {
    id: subOrderId, subOrderNo: 'FS202608160001-01', orderNo: 'FS202608160001',
    channelType: 'CONSUMER', preparationStatus: 'PENDING', handoverStatus: 'NOT_READY',
    pickupPoint: { address: '江苏省连云港市海州区示例取货点' },
    items: [{ orderItemId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', productName: '福利大米', skuLabel: '5kg', quantity: 2 }],
    nodes: [] as Array<{ id: string; node: string; reason: string | null; resultingVersion: number; occurredAt: string }>, version: 0, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  };
  await page.route('**/v1/supplier/fulfillment-sub-orders?**', (route) => json(route, { items: [item], total: 1, page: 1, pageSize: 100 }));
  let captured: Record<string, unknown> | undefined;
  await page.route('**/v1/supplier/fulfillment-sub-orders/*/nodes', async (route) => {
    captured = route.request().postDataJSON() as Record<string, unknown>;
    item = { ...item, preparationStatus: 'ACCEPTED', version: 1, nodes: [{ id: 'node-1', node: 'ACCEPT', reason: null, resultingVersion: 1, occurredAt: new Date(1000).toISOString() }] };
    return json(route, item);
  });

  await page.goto(`${origin}${workspaceRoute}`);
  const panel = page.locator('[data-m3-slice="M3-P031"]');
  await expect(panel.getByRole('heading', { name: '供应商备货' })).toBeVisible();
  await expect(panel).toContainText('FS202608160001-01');
  await expect(panel).toContainText('福利大米');
  expect(await panel.textContent()).not.toMatch(/供应价|结算金额|福利卡|微信支付|supplierId|supplyAmount|goodsAmount/iu);
  await panel.getByRole('button', { name: '确认子单' }).click();
  await expect.poll(() => captured).toEqual({ node: 'ACCEPT', expectedVersion: 0 });
  expect(JSON.stringify(captured)).not.toMatch(/supplierId|companyId|identityId/iu);
  await expect(panel).toContainText('已确认');
  await page.screenshot({ fullPage: true, path: 'artifacts/verification/M3-P031/supplier-fulfillment-page.png' });
});
