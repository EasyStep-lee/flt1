import { expect, test } from '@playwright/test';

const productId = '21111111-1111-4111-8111-111111111111';
const skuId = '23333333-3333-4333-8333-333333333333';

test('P0-061 enterprise shelf uses the same Product and SKU resource identifiers', async ({ page }) => {
  await page.setExtraHTTPHeaders({
    Cookie: '__Host-fulishe-enterprise-portal=p0-session',
  });
  const response = await page.goto('/enterprise/procurement/products');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control'] ?? '').toMatch(/private.*no-store/iu);
  expect(response?.headers()['x-robots-tag'] ?? '').toMatch(/noindex/iu);
  await expect(page.getByRole('heading', { name: '企业采购货架' })).toBeVisible();
  await expect(page.getByText('社区集采 · 普通企业采购入口')).toBeVisible();
  const item = page.locator(`[data-product-id="${productId}"]`);
  await expect(item).toHaveAttribute('data-sku-ids', skuId);
  await expect(item.getByText('集采价 ¥61.90 起')).toBeVisible();
  await expect(item.getByRole('link')).toHaveAttribute(
    'href',
    `/enterprise/procurement/products/${productId}`,
  );
  await expect(page.locator('body')).not.toContainText(/零售价|供应价|店铺|成团|团长/iu);
  expect(await page.content()).not.toMatch(
    /retailSalePrice|supplyPrice|inventoryBalance|grossMargin/iu,
  );
});
