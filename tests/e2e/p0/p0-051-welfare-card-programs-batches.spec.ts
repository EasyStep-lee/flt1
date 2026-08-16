import { expect, test, type Page, type Route } from '@playwright/test';

const origin = 'http://127.0.0.1:4321';
const workspaceRoute = '/company-admin/workspaces/welfare-card';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });

const installWorkspace = async (page: Page) => {
  const workspace = {
    accountTypeCode: 'COMPANY_WELFARE_CARD', accountTypeName: '福利卡运营',
    pageId: 'PAGE-008', workspaceRoute,
    menuItems: [{ key: 'workspace', label: '福利卡运营', route: workspaceRoute }],
  };
  await page.route('**/v1/company-auth/workspace/current**', (route) => json(route, workspace));
  await page.route('**/v1/company-auth/workspace/page**', (route) => json(route, {
    ...workspace, filters: { availability: 'ALL', keyword: '' },
    summary: { availableTotal: 2, catalogTotal: 3, deferredTotal: 1, filteredTotal: 3 },
    items: [], selectedModule: null,
  }));
};

test('P0-051 PAGE-008 shows company welfare programs and DRAFT batches without recharge or supplier fields', async ({ page }) => {
  await installWorkspace(page);
  await page.route('**/v1/company/welfare-card/programs', (route) => json(route, {
    items: [{
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: '2026 中秋企业福利计划',
      fundingType: 'ENTERPRISE_GRANT', issuerType: 'COMPANY', scopeType: 'ALL_PRODUCTS',
      scopeRules: { schemaVersion: 1, includedIds: [], excludedIds: [] },
      canPayDeliveryFee: false, refundPolicy: '按原福利卡账户退回',
      complianceStatus: 'DRAFT', status: 'DRAFT', version: 0,
      createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
      history: [{ event: 'PROGRAM_CREATED', resultingVersion: 0, occurredAt: new Date(0).toISOString() }],
      batches: [{
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', batchNo: 'WCB-2026-MID-A',
        totalAmount: 30000, unitAmount: 10000, issueCount: 3,
        claimMode: 'ENTERPRISE_ASSIGNED', agreementVersion: 1, status: 'DRAFT', version: 0,
        createdAt: new Date(1000).toISOString(),
        history: [{ event: 'BATCH_CREATED', resultingVersion: 0, occurredAt: new Date(1000).toISOString() }],
      }],
    }], total: 1,
  }));

  await page.goto(`${origin}${workspaceRoute}`);
  const panel = page.locator('[data-m3-slice="M3-P051"]');
  await expect(panel.getByRole('heading', { name: '福利卡计划与批次' })).toBeVisible();
  await expect(panel).toContainText('2026 中秋企业福利计划');
  await expect(panel).toContainText('WCB-2026-MID-A');
  await expect(panel.getByRole('button', { name: '新建福利卡计划' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '新建发行批次' })).toBeVisible();
  await panel.getByRole('button', { name: '新建福利卡计划' }).click();
  await expect(page.getByRole('dialog', { name: '新建福利卡计划' })).toContainText('仅允许企业福利发放、公司活动赠送、实体卡或兑换码');
  const text = await page.locator('body').textContent();
  expect(text).not.toMatch(/PERSONAL_RECHARGE|个人现金充值|供应价|supplierPrice|supplierPayable|companyId|identityId|functionalAccountId/iu);
  await page.screenshot({ fullPage: true, path: 'artifacts/verification/M3-P051/welfare-card-programs-batches-page.png' });
});
