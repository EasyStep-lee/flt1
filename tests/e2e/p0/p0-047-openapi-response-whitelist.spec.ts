import { expect, test } from '@playwright/test';

test('P0-047 public portal renders no internal pricing or settlement fields', async ({
  page,
}) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  await expect(page.locator('[data-p0-id="P0-001"]')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /supplyPrice|approvedSupplyPrice|supplyPriceSnapshot|supplierPayable|grossMargin|供应价|供应商应付|毛利/u,
  );
});
