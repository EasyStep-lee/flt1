import { expect, test } from '@playwright/test';

const expectedSections = [
  'hero',
  'core-services',
  'supply-chain-capabilities',
  'community-procurement',
  'category-preview',
  'authorized-cases',
  'supplier-cooperation',
  'news',
  'enterprise-service-cta',
] as const;

test('P0-074 public home follows the nine-section service journey without invented proof', async ({
  page,
}) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control'] ?? '').not.toMatch(/private|no-store/iu);
  expect(response?.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/iu);

  const observedSections = await page.locator('[data-home-section]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-home-section')),
  );
  expect(observedSections).toEqual(expectedSections);

  const hero = page.locator('[data-home-section="hero"]');
  await expect(hero.getByRole('heading', { level: 1, name: '福礼社企业福利与供应链服务平台' })).toBeVisible();
  await expect(hero.getByRole('link', { name: '进入社区集采' })).toHaveAttribute('href', '/enterprise-procurement');
  await expect(hero.getByRole('link', { name: '了解供应链能力' })).toHaveAttribute('href', '/capabilities');

  const services = page.locator('[data-home-section="core-services"]');
  await expect(services.locator('[data-home-service]')).toHaveCount(3);
  await expect(services.getByRole('link', { name: '企业注册' })).toHaveAttribute('href', '/enterprise/register');
  await expect(services.getByRole('link', { name: '福利咨询' })).toHaveAttribute('href', '/contact#enterprise-welfare');
  await expect(services.getByRole('link', { name: '申请供应商合作' })).toHaveAttribute('href', '/supplier/register');

  const capabilityNames = ['分类商品', '供应商准入', '质量审核', '库存协同', '统一结账', '配送与售后'];
  const capabilities = page.locator('[data-home-section="supply-chain-capabilities"]');
  await expect(capabilities.locator('[data-home-capability]')).toHaveCount(6);
  for (const name of capabilityNames) await expect(capabilities.getByRole('heading', { name })).toBeVisible();

  const community = page.locator('[data-home-section="community-procurement"]');
  await expect(community.getByText('面向正常企业持续开放')).toBeVisible();
  await expect(community.locator('ol > li')).toHaveCount(5);
  await expect(community.getByRole('link', { name: '注册企业' })).toHaveAttribute('href', '/enterprise/register');
  await expect(community.getByRole('link', { name: '企业登录' })).toHaveAttribute('href', '/enterprise/login');

  const categories = page.locator('[data-home-section="category-preview"] [data-home-category]');
  await expect(categories).toHaveText(['食品', '家居日用', '个护', '纸品', '家庭清洁', '文体办公']);
  await expect(page.locator('[data-home-product]')).toHaveCount(0);

  const cases = page.locator('[data-home-section="authorized-cases"]');
  await expect(cases.locator('[data-home-empty="authorized-cases"]')).toBeVisible();
  await expect(cases.locator('[data-authorized-case]')).toHaveCount(0);
  await expect(cases.getByText('暂无已取得公开授权的客户案例')).toBeVisible();
  await expect(cases.getByRole('link', { name: '查看匿名服务路径' })).toHaveAttribute('href', '/cases');

  const supplier = page.locator('[data-home-section="supplier-cooperation"]');
  await expect(supplier.locator('ol > li')).toHaveCount(5);
  await expect(supplier.getByRole('link', { name: '查看合作资料' })).toHaveAttribute('href', '/supplier-cooperation');
  await expect(supplier.getByRole('link', { name: '供应商注册' })).toHaveAttribute('href', '/supplier/register');
  await expect(supplier.getByRole('link', { name: '供应商登录' })).toHaveAttribute('href', '/supplier/login');

  const news = page.locator('[data-home-section="news"]');
  await expect(news.getByText('社区集采服务边界说明')).toBeVisible();
  await expect(news.locator('time[datetime="2026-08-02"]')).toBeVisible();
  await expect(news.getByRole('link', { name: '查看全部新闻' })).toHaveAttribute('href', '/news');

  const cta = page.locator('[data-home-section="enterprise-service-cta"]');
  await expect(cta.getByRole('link', { name: '注册企业' })).toHaveAttribute('href', '/enterprise/register');
  await expect(cta.getByRole('link', { name: '联系商务' })).toHaveAttribute('href', '/contact');

  const html = await page.content();
  expect(html).not.toMatch(/supplierPrice|approvedSupplyPrice|supplyAmount|grossMargin|18936579999|[¥￥]/iu);
  await expect(page.locator('[data-sales-count], [data-countdown], [data-group-buying], [data-community-leader]')).toHaveCount(0);
});

test('P0-074 home remains usable at 390px and records current visual evidence', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/verification/M3-P074/portal-home-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(390);
  for (const section of expectedSections) await expect(page.locator(`[data-home-section="${section}"]`)).toBeVisible();
  await page.screenshot({ path: 'artifacts/verification/M3-P074/portal-home-mobile.png', fullPage: true });
});
