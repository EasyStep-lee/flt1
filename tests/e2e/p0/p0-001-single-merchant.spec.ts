import { expect, test } from '@playwright/test';

test('P0-001 portal identifies the company for sale, payment and refund', async ({
  page,
}) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  const boundary = page.locator('[data-p0-id="P0-001"]');
  await expect(boundary).toBeVisible();
  await expect(boundary.getByRole('heading', { name: '唯一对客经营主体' })).toBeVisible();
  await expect(boundary.getByText('江苏福礼团供应链科技有限公司')).toHaveCount(3);
  await expect(boundary.locator('[data-subject="seller"]')).toContainText('销售主体');
  await expect(boundary.locator('[data-subject="payment-payee"]')).toContainText('收款主体');
  await expect(boundary.locator('[data-subject="refund-operator"]')).toContainText('退款主体');
  await expect(boundary).not.toContainText(/供应商收款|供应商店铺/u);
});
