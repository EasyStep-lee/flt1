import { expect, test } from '@playwright/test';

const products = [
  ['21111111-1111-4111-8111-111111111111', '23333333-3333-4333-8333-333333333333'],
  ['31111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'],
  ['41111111-1111-4111-8111-111111111111', '43333333-3333-4333-8333-333333333333'],
] as const;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ Cookie: '__Host-fulishe-enterprise-portal=p0-session' });
});

test('P0-062 enterprise cart submits one company order and shows three supplier fulfillments', async ({ page }) => {
  for (const [productId, skuId] of products) {
    await page.goto(`/enterprise/procurement/products/${productId}`);
    await page.getByRole('button', { name: '加入企业采购车' }).click();
    await expect(page.locator(`[data-cart-sku-id="${skuId}"]`)).toContainText('已加入');
  }

  const cartResponse = await page.goto('/enterprise/procurement/cart');
  expect(cartResponse?.status()).toBe(200);
  expect(cartResponse?.headers()['cache-control'] ?? '').toMatch(/private.*no-store/iu);
  expect(cartResponse?.headers()['x-robots-tag'] ?? '').toMatch(/noindex/iu);
  await expect(page.getByRole('heading', { name: '企业采购车' })).toBeVisible();
  await expect(page.locator('[data-supplier-group]')).toHaveCount(3);
  await expect(page.getByText('合计 ¥140.70')).toBeVisible();
  await page.getByRole('link', { name: '去统一结算' }).click();

  await expect(page.getByRole('heading', { name: '企业采购结算' })).toBeVisible();
  await expect(page.getByText('向江苏福礼团供应链科技有限公司提交 1 张主订单')).toBeVisible();
  await expect(page.locator('[data-checkout-supplier-group]')).toHaveCount(3);
  await page.screenshot({ fullPage: true, path: 'artifacts/verification/M3-P062/enterprise-checkout-page.png' });
  await page.getByRole('button', { name: '提交企业订单' }).click();

  await expect(page.getByRole('heading', { name: '订单提交成功' })).toBeVisible();
  await expect(page.getByText('主订单号：E202608200001')).toBeVisible();
  await expect(page.locator('[data-fulfillment-group]')).toHaveCount(3);
  await expect(page.getByText('主订单合计 ¥140.70')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/供应价|利润|supplyPrice|grossMargin/iu);
  await page.screenshot({ fullPage: true, path: 'artifacts/verification/M3-P062/enterprise-order-result-page.png' });

  const observations = await page.request.get('http://127.0.0.1:4324/test-observations', {
    headers: { Cookie: '__Host-fulishe-enterprise-portal=p0-session' },
  });
  const evidence = await observations.json();
  expect(evidence.orderRequests).toHaveLength(1);
  expect(Object.keys(evidence.orderRequests[0].body)).toEqual(['items']);
  expect(evidence.orderRequests[0].body.items).toEqual(products.map(([, skuId]) => ({ skuId, quantity: 1 })));
  expect(evidence.orderRequests[0].idempotencyKey).toMatch(/^ent-[a-z0-9-]{16,}$/u);
});

test('P0-062 enterprise cart remains usable on a narrow viewport without leaking supplier cost', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/enterprise/procurement/products/${products[0][0]}`);
  await page.getByRole('button', { name: '加入企业采购车' }).click();
  await page.goto('/enterprise/procurement/cart');
  expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
  expect(await page.content()).not.toMatch(/supplyPrice|grossMargin|payableAmount/iu);
});
