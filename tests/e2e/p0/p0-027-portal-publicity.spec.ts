import { expect, test } from '@playwright/test';

const pages = [
  ['/about', '关于福礼团'],
  ['/', '福礼社企业福利与供应链服务平台'],
  ['/capabilities', '一站式供应链服务能力'],
  ['/enterprise-procurement', '社区集采，不是限时团购活动'],
  ['/cases', '服务场景'],
  ['/cases/enterprise-welfare-service', '企业福利采购服务路径'],
  ['/supplier-cooperation', '成为福礼团合作供应商'],
  ['/news', '新闻与公告'],
  ['/news/community-procurement-boundary', '社区集采服务边界说明'],
  ['/contact', '联系我们'],
] as const;

test.describe('P0-027 portal publicity', () => {
  for (const [route, heading] of pages) {
    test(`${route} is public, crawlable, and responsive`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('[data-p0-id="P0-027"]')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).not.toBeNull();
      expect(new URL(canonical ?? '').pathname).toBe(route);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/u);
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
      expect(response?.headers()['cache-control'] ?? '').not.toMatch(/private|no-store/iu);
      expect(response?.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/iu);

      await page.setViewportSize({ width: 375, height: 812 });
      expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(375);
    });
  }

  test('unpublished slugs fail closed and public HTML exposes no internal price fields', async ({
    page,
  }) => {
    expect((await page.goto('/cases/not-authorized'))?.status()).toBe(404);
    expect((await page.goto('/news/not-published'))?.status()).toBe(404);

    await page.goto('/');
    const html = await page.content();
    expect(html).not.toMatch(
      /supplyPrice|approvedSupplyPrice|supplyAmount|grossMargin|18936579999/iu,
    );
    await expect(page.getByText('189****9999')).toBeVisible();
    await expect(
      page.locator('[data-countdown], [data-group-buying], [data-community-leader]'),
    ).toHaveCount(0);
  });
});
