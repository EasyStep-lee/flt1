import { expect, test } from '@playwright/test';

test('P0-009 presents supply sources without supplier-store commerce', async ({
  page,
}) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  const boundary = page.locator('[data-p0-id="P0-009"]');
  await expect(boundary).toBeVisible();
  await expect(
    boundary.getByRole('heading', { name: '供应来源不是店铺' }),
  ).toBeVisible();
  await expect(boundary.locator('[data-capability="company-catalog"]')).toBeVisible();
  await expect(boundary.locator('[data-capability="company-checkout"]')).toBeVisible();
  await expect(boundary.locator('[data-capability="company-service"]')).toBeVisible();
  await expect(boundary).not.toContainText(
    /进入店铺|店铺首页|店铺优惠券|供应商收款|供应商结算/u,
  );
  await expect(page.locator('a[href*="store"], a[href*="shop"]')).toHaveCount(0);
});
