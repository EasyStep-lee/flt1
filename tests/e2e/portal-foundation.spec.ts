import { expect, test } from '@playwright/test';

test.describe('portal foundation boundaries', () => {
  test('renders the public ISR shell', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-shell-id="portal-public-shell"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: '企业门户公开区' })).toBeVisible();
    expect(response?.headers()['cache-control'] ?? '').not.toMatch(
      /private|no-store/u,
    );
  });

  for (const route of [
    { path: '/enterprise/login', shellId: 'portal-auth-shell' },
    { path: '/enterprise/workspace', shellId: 'portal-private-shell' },
  ]) {
    test(`${route.path} stays private and noindex`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page.locator(`[data-shell-id="${route.shellId}"]`)).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex/u,
      );
      expect(response?.headers()['cache-control'] ?? '').toMatch(/private/u);
      expect(response?.headers()['cache-control'] ?? '').toMatch(/no-store/u);
      expect(response?.headers()['x-robots-tag'] ?? '').toMatch(/noindex/u);
    });
  }
});
