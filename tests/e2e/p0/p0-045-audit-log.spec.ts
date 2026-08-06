import { expect, test } from '@playwright/test';

const companyOrigin = 'http://127.0.0.1:4321';

test('P0-045 company audit workspace lists masked immutable sensitive events', async ({ page }) => {
  await page.route('**/v1/company-auth/workspace/current**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountTypeCode: 'COMPANY_AUDIT',
        accountTypeName: '审计/只读',
        pageId: 'PAGE-012',
        workspaceRoute: '/company-admin/workspaces/audit',
        menuItems: [
          {
            key: 'workspace',
            label: '审计风控',
            route: '/company-admin/workspaces/audit',
          },
        ],
      }),
    });
  });
  await page.route('**/v1/audit/events**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        items: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            actorType: 'SUPPLIER_USER',
            actorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            action: 'functional_account.invited',
            objectType: 'functional_account',
            objectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            beforeSnapshot: { status: null },
            afterSnapshot: {
              accountTypeCode: 'SUPPLIER_PRODUCT',
              displayName: '商品运营员',
              status: 'PENDING_ACTIVATION',
            },
            requestId: '11111111-1111-4111-8111-111111111111',
            occurredAt: '2026-08-05T12:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    });
  });

  const response = await page.goto(`${companyOrigin}/company-admin/workspaces/audit`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/u);
  await expect(page.locator('[data-page-id="PAGE-012"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '敏感操作审计' })).toBeVisible();
  await expect(page.getByText('functional_account.invited')).toBeVisible();
  await expect(page.getByText('商品运营员')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /13900139000|product@example\.test|供应价|供应商应付|银行账号/u,
  );
});
