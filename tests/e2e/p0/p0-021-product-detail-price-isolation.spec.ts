import { expect, test } from '@playwright/test';

const productId = '21111111-1111-4111-8111-111111111111';

test('P0-021 enterprise detail is private and renders only the enterprise selling price', async ({ page }) => {
  // The production __Host- cookie requires HTTPS. The local HTTP harness sends
  // the same verified cookie header without weakening the production contract.
  await page.setExtraHTTPHeaders({
    Cookie: '__Host-fulishe-enterprise-portal=p0-session',
  });
  const response = await page.goto(`/enterprise/procurement/products/${productId}`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control'] ?? '').toMatch(/private.*no-store/iu);
  expect(response?.headers()['x-robots-tag'] ?? '').toMatch(/noindex/iu);
  await expect(page.locator('[data-shell="enterprise-product-detail"]')).toBeVisible();
  await expect(page.getByText('集采价 ¥61.90')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/零售价|供应价|毛利|¥69\.90|¥50\.00/iu);
  expect(await page.content()).not.toMatch(
    /retailSalePrice|supplyPrice|supplierPayable|grossMargin|internalMargin/iu,
  );
});
