import { expect, test } from '@playwright/test';

const companyOrigin = 'http://127.0.0.1:4321';

test('P0-046 non-price audit workspace does not request or render restricted fields', async ({
  page,
}) => {
  let requestedUrl = '';
  await page.route('**/v1/audit/events**', async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        items: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            actorType: 'SUPPLIER_USER',
            actorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            action: 'supplier_product.updated',
            objectType: 'supplier_product',
            objectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            beforeSnapshot: { title: '原商品标题' },
            afterSnapshot: { title: '新商品标题' },
            requestId: '11111111-1111-4111-8111-111111111111',
            occurredAt: '2026-08-05T23:30:00.000Z',
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
  await expect(page.locator('[data-page-id="PAGE-012"]')).toBeVisible();
  await expect(page.getByText('新商品标题')).toBeVisible();
  expect(requestedUrl).not.toMatch(/fieldGroup|export|download/u);
  await expect(page.locator('body')).not.toContainText(
    /supplyPrice|approvedSupplyPrice|supplierPayable|grossMargin|供应价|供应商应付|毛利/u,
  );
});
