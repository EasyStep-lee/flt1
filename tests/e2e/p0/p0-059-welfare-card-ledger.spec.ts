import { expect, test, type Page, type Route } from '@playwright/test';

const origin = 'http://127.0.0.1:4321';
const accountId = '30000000-0000-4000-8000-000000000059';
const adjustmentId = '59000000-0000-4000-8000-000000000001';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
const workspace = (role: 'COMPANY_WELFARE_CARD' | 'COMPANY_FINANCE') => ({
  accountTypeCode: role,
  accountTypeName: role === 'COMPANY_WELFARE_CARD' ? '福利卡运营' : '财务结算',
  pageId: role === 'COMPANY_WELFARE_CARD' ? 'PAGE-008' : 'PAGE-009',
  workspaceRoute: role === 'COMPANY_WELFARE_CARD' ? '/company-admin/workspaces/welfare-card' : '/company-admin/workspaces/finance',
  menuItems: [{ key: 'workspace', label: role === 'COMPANY_WELFARE_CARD' ? '福利卡运营' : '财务结算', route: role === 'COMPANY_WELFARE_CARD' ? '/company-admin/workspaces/welfare-card' : '/company-admin/workspaces/finance' }],
});
const installWorkspace = async (page: Page, role: 'COMPANY_WELFARE_CARD' | 'COMPANY_FINANCE') => {
  const current = workspace(role);
  await page.route('**/v1/company-auth/workspace/current**', (route) => json(route, current));
  await page.route('**/v1/company-auth/workspace/page**', (route) => json(route, {
    ...current, filters: { availability: 'ALL', keyword: '' },
    summary: { availableTotal: 1, catalogTotal: 1, deferredTotal: 0, filteredTotal: 1 },
    items: [], selectedModule: null,
  }));
};

test('P0-059 PAGE-008 exposes whitelist account summary and continuous append-only ledger', async ({ page }) => {
  await installWorkspace(page, 'COMPANY_WELFARE_CARD');
  await page.route('**/v1/company/welfare-card/programs', (route) => json(route, { items: [], total: 0 }));
  await page.route(`**/v1/company/welfare-card/accounts/${accountId}/ledger`, (route) => json(route, {
    account: { id: accountId, programName: '2026 员工福利', batchNo: 'WCB-2026-A', maskedCardNo: '****0059', balanceAmount: 10000, frozenAmount: 2000, availableAmount: 8000, status: 'ACTIVE', version: 2 },
    items: [
      { sequence: 1, businessType: 'GRANT', direction: 'CREDIT', amount: 10000, beforeBalance: 0, afterBalance: 10000, beforeFrozen: 0, afterFrozen: 0, occurredAt: new Date(0).toISOString() },
      { sequence: 2, businessType: 'FREEZE', direction: 'DEBIT', amount: 2000, beforeBalance: 10000, afterBalance: 10000, beforeFrozen: 0, afterFrozen: 2000, occurredAt: new Date(1000).toISOString() },
    ],
  }));
  await page.route('**/v1/company/welfare-card/accounts', (route) => json(route, {
    items: [{ id: accountId, programName: '2026 员工福利', batchNo: 'WCB-2026-A', maskedCardNo: '****0059', balanceAmount: 10000, frozenAmount: 2000, availableAmount: 8000, status: 'ACTIVE', version: 2 }], total: 1,
  }));

  await page.goto(`${origin}/company-admin/workspaces/welfare-card`);
  const slice = page.locator('[data-m3-slice="M3-P059"]');
  await expect(slice.getByRole('heading', { name: '福利卡账户与追加式账本' })).toBeVisible();
  await expect(slice).toContainText('****0059');
  await expect(slice).toContainText('¥80.00');
  await slice.getByRole('button', { name: '查看追加式账本' }).click();
  const dialog = page.getByRole('dialog', { name: '福利卡追加式账本' });
  await expect(dialog).toContainText('GRANT');
  await expect(dialog).toContainText('FREEZE');
  await expect(dialog).toContainText('2');
  const text = await page.locator('body').textContent();
  expect(text).not.toMatch(/ownerConsumerUserId|identityId|functionalAccountId|supplyPrice|supplierPayable|个人现金充值入口/iu);
  await page.screenshot({ fullPage: true, path: 'artifacts/verification/M3-P059/welfare-card-account-ledger-page.png' });
});

test('P0-059 PAGE-009 creates pending adjustment and requires an independent decision with second verification', async ({ page }) => {
  await installWorkspace(page, 'COMPANY_FINANCE');
  const bodies: unknown[] = [];
  let adjustment = {
    id: adjustmentId, accountId, businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 500,
    reason: '客服补偿复核', status: 'PENDING', reviewOpinion: null, reversalOfLedgerId: null,
    version: 0, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  };
  await page.route('**/v1/company/welfare-card/adjustments', (route) => json(route, { items: [adjustment], total: 1 }));
  await page.route(`**/v1/company/welfare-card/accounts/${accountId}/adjustments`, (route) => {
    bodies.push(route.request().postDataJSON());
    return json(route, adjustment, 201);
  });
  await page.route(`**/v1/company/welfare-card/adjustments/${adjustmentId}/decision`, (route) => {
    bodies.push(route.request().postDataJSON());
    adjustment = { ...adjustment, status: 'APPROVED', reviewOpinion: '独立复核通过', version: 1, updatedAt: new Date(1000).toISOString() };
    return json(route, adjustment);
  });

  await page.goto(`${origin}/company-admin/workspaces/finance`);
  await expect(page.getByRole('heading', { name: '福利卡财务调整与冲正' })).toBeVisible();
  await page.getByLabel('福利卡账户编号').fill(accountId);
  await page.getByLabel('调整金额（分）').fill('500');
  await page.getByLabel('调整申请原因').fill('客服补偿复核');
  await page.getByRole('button', { name: '提交待复核申请' }).click();
  await page.getByRole('button', { name: '独立复核' }).click();
  const dialog = page.getByRole('dialog', { name: '福利卡调整独立复核' });
  await dialog.getByLabel('复核意见').fill('独立复核通过');
  await dialog.getByLabel('二次验证码').fill('654321');
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('APPROVED')).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual({ businessType: 'ADJUSTMENT', direction: 'CREDIT', amount: 500, reason: '客服补偿复核' });
  expect(bodies[1]).toEqual({ decision: 'APPROVE', opinion: '独立复核通过', secondVerificationCode: '654321', version: 0 });
  expect(JSON.stringify(bodies[0])).not.toMatch(/companyId|ownerConsumerUserId|functionalAccountId|identityId|finalBalance|PERSONAL_RECHARGE/iu);
  await page.screenshot({ fullPage: true, path: 'artifacts/verification/M3-P059/welfare-card-adjustment-page.png' });
});
