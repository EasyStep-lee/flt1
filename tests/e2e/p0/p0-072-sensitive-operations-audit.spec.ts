import { expect, test } from '@playwright/test';

const companyOrigin = 'http://127.0.0.1:4321';
const supplierOrigin = 'http://127.0.0.1:4320';

const approval = (status: 'PENDING' | 'IN_REVIEW', version: number) => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  approvalType: 'SENSITIVE_EXPORT',
  resource: 'AUDIT_EVENTS',
  status,
  version,
  reviewOpinion: null,
  createdAt: '2026-08-08T01:00:00.000Z',
  updatedAt: '2026-08-08T01:00:00.000Z',
});

const auditPage = {
  items: [
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      actorType: 'SUPPLIER_USER',
      actorId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      action: 'sensitive_export.requested',
      objectType: 'sensitive_export_approval',
      objectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      beforeSnapshot: {},
      afterSnapshot: { resource: 'AUDIT_EVENTS', status: 'PENDING', version: 0 },
      requestId: '11111111-1111-4111-8111-111111111111',
      occurredAt: '2026-08-08T01:00:00.000Z',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
};

test('P0-072 company audit page creates and independently claims a versioned approval', async ({ page }) => {
  let current = approval('PENDING', 0);
  let createdBody: unknown;
  let claimBody: unknown;

  await page.route('**/v1/company-auth/workspace/current**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountTypeCode: 'COMPANY_AUDIT',
        accountTypeName: '审计/只读',
        pageId: 'PAGE-012',
        workspaceRoute: '/company-admin/workspaces/audit',
        menuItems: [{ key: 'workspace', label: '审计风控', route: '/company-admin/workspaces/audit' }],
      }),
    }),
  );
  await page.route('**/v1/company-auth/workspace/page**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountTypeCode: 'COMPANY_AUDIT',
        accountTypeName: '审计/只读',
        pageId: 'PAGE-012',
        workspaceRoute: '/company-admin/workspaces/audit',
        filters: { keyword: '', availability: 'ALL' },
        summary: { catalogTotal: 1, availableTotal: 1, deferredTotal: 0, filteredTotal: 1 },
        items: [{
          moduleKey: 'audit-events',
          label: '敏感操作审计',
          description: '不可变审计事件',
          deliveryStage: 'M1',
          availability: 'AVAILABLE',
          dataBoundary: '公司审计职能白名单',
        }],
        selectedModule: null,
      }),
    }),
  );
  await page.route('**/v1/audit/events**', (route) =>
    route.fulfill({ contentType: 'application/json', status: 200, body: JSON.stringify(auditPage) }),
  );
  await page.route('**/v1/audit/sensitive-export-approvals**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/claim')) {
      claimBody = request.postDataJSON();
      current = approval('IN_REVIEW', 1);
      await route.fulfill({ contentType: 'application/json', status: 200, body: JSON.stringify(current) });
      return;
    }
    if (request.method() === 'POST') {
      createdBody = request.postDataJSON();
      await route.fulfill({ contentType: 'application/json', status: 201, body: JSON.stringify(current) });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ items: [current], total: 1 }),
    });
  });

  await page.goto(`${companyOrigin}/company-admin/workspaces/audit`);
  await expect(page.locator('[data-page-id="PAGE-012"]')).toBeVisible();
  await page.getByRole('button', { name: '独立认领' }).click();
  await expect.poll(() => claimBody).toEqual({ version: 0 });
  await expect(page.getByRole('button', { name: '复核决定' })).toBeVisible();
  await page.getByLabel('敏感导出申请理由').fill('季度审计复核');
  await page.getByRole('button', { name: '发起审批' }).click();
  await expect.poll(() => createdBody).toEqual({ reason: '季度审计复核', resource: 'AUDIT_EVENTS' });
  await expect(page.locator('body')).not.toContainText(/supplierId|functionalAccountId|bankAccount|supplyPrice/u);
});

test('P0-072 supplier audit page reads own scope and can only request review', async ({ page }) => {
  let requestBody: unknown;
  await page.route('**/v1/supplier-auth/workspace/current**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountTypeCode: 'SUPPLIER_AUDIT',
        accountTypeName: '只读审计',
        pageId: 'PAGE-023',
        workspaceRoute: '/supplier/workspaces/audit',
        menuItems: [{ key: 'workspace', label: '审计记录', route: '/supplier/workspaces/audit' }],
      }),
    }),
  );
  await page.route('**/v1/audit/events**', (route) =>
    route.fulfill({ contentType: 'application/json', status: 200, body: JSON.stringify(auditPage) }),
  );
  await page.route('**/v1/audit/sensitive-export-approvals**', async (route) => {
    if (route.request().method() === 'POST') {
      requestBody = route.request().postDataJSON();
      await route.fulfill({ contentType: 'application/json', status: 201, body: JSON.stringify(approval('PENDING', 0)) });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({ items: [approval('PENDING', 0)], total: 1 }),
    });
  });

  await page.goto(`${supplierOrigin}/supplier/workspaces/audit`);
  await expect(page.locator('[data-page-id="PAGE-023"]')).toBeVisible();
  await expect(page.getByText('sensitive_export.requested')).toBeVisible();
  await expect(page.getByRole('button', { name: '独立认领' })).toHaveCount(0);
  await page.getByLabel('供应商敏感导出申请理由').fill('本方操作记录审计');
  await page.getByRole('button', { name: '提交复核' }).click();
  await expect.poll(() => requestBody).toEqual({ reason: '本方操作记录审计', resource: 'AUDIT_EVENTS' });
  await expect(page.locator('body')).not.toContainText(/其他供应商|bankAccount|supplyPrice/u);
});
