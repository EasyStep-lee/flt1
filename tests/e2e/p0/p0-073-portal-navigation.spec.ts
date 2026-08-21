import { expect, test } from '@playwright/test';

const publicNavigation = [
  ['首页', '/'],
  ['关于福礼团', '/about'],
  ['供应链能力', '/capabilities'],
  ['社区集采', '/enterprise-procurement'],
  ['福利卡', '/welfare-card-service'],
  ['供应商合作', '/supplier-cooperation'],
  ['新闻公告', '/news'],
  ['联系我们', '/contact'],
] as const;

test('P0-073 public navigation and legal footer stay complete on desktop and mobile', async ({
  page,
}) => {
  await page.goto('/');

  const navigation = page.getByRole('navigation', { name: '公开门户主导航' });
  for (const [label, href] of publicNavigation) {
    await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      href,
    );
  }
  await expect(page.getByTestId('public-enterprise-actions').getByRole('link', { name: '企业注册' })).toHaveAttribute(
    'href',
    '/enterprise/register',
  );
  await expect(page.getByTestId('public-enterprise-actions').getByRole('link', { name: '企业登录' })).toHaveAttribute(
    'href',
    '/enterprise/login',
  );
  await expect(page.getByRole('link', { name: '企业采购车' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '企业工作台' })).toHaveCount(0);

  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('江苏福礼团供应链科技有限公司');
  await expect(footer).toContainText('189****9999');
  await expect(footer.getByRole('link', { name: '平台服务协议' })).toHaveAttribute(
    'href',
    '/legal/service-agreement',
  );
  await expect(footer.getByRole('link', { name: '隐私政策' })).toHaveAttribute(
    'href',
    '/legal/privacy-policy',
  );
  expect((await page.goto('/legal/service-agreement'))?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: '平台服务协议' })).toBeVisible();
  expect((await page.goto('/legal/privacy-policy'))?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: '隐私政策' })).toBeVisible();

  await page.goto('/');
  await page.screenshot({
    path: 'artifacts/verification/M3-P073/portal-navigation-desktop.png',
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const [label] of publicNavigation) {
    await expect(
      page.getByRole('navigation', { name: '公开门户主导航' }).getByRole('link', {
        name: label,
        exact: true,
      }),
    ).toBeVisible();
  }
  expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
    390,
  );
  await page.screenshot({
    path: 'artifacts/verification/M3-P073/portal-navigation-mobile.png',
    fullPage: true,
  });
});

test('P0-073 private enterprise navigation exposes transaction destinations without public caching', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ Cookie: '__Host-fulishe-enterprise-portal=p0-session' });
  const response = await page.goto('/enterprise/procurement/products');
  expect(response?.status()).toBe(200);

  const navigation = page.getByRole('navigation', { name: '企业采购导航' });
  await expect(navigation.getByRole('link', { name: '企业采购货架' })).toHaveAttribute(
    'href',
    '/enterprise/procurement/products',
  );
  await expect(navigation.getByRole('link', { name: '企业采购车' })).toHaveAttribute(
    'href',
    '/enterprise/procurement/cart',
  );
  await expect(navigation.getByRole('link', { name: '企业工作台' })).toHaveAttribute(
    'href',
    '/enterprise/workspace',
  );
  await expect(page.getByTestId('public-enterprise-actions')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/u);
  expect(response?.headers()['cache-control'] ?? '').toMatch(/private/iu);
  expect(response?.headers()['cache-control'] ?? '').toMatch(/no-store/iu);
  expect(response?.headers()['x-robots-tag'] ?? '').toMatch(/noindex/iu);
});
