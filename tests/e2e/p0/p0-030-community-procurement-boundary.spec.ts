import { expect, test } from '@playwright/test';

test('P0-030 community procurement is an ordinary always-open enterprise entry', async ({
  page,
}) => {
  const response = await page.goto('/enterprise-procurement');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control'] ?? '').not.toMatch(/private|no-store/iu);
  expect(response?.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/iu);

  await expect(page.locator('main[data-p0-id="P0-030"]')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: '社区集采，不是限时团购活动' }),
  ).toBeVisible();
  await expect(page.getByText('不限定指定社区、活动时段、成团门槛或团长角色')).toBeVisible();
  await expect(page.getByText('不提供企业内部 OA、预算或采购审批流程')).toBeVisible();

  await expect(page.getByRole('link', { name: '注册企业', exact: true }).first()).toHaveAttribute(
    'href',
    '/enterprise/register',
  );
  await expect(page.getByRole('link', { name: '企业登录', exact: true }).first()).toHaveAttribute(
    'href',
    '/enterprise/login',
  );
  await expect(page.getByRole('link', { name: '进入企业采购货架' })).toHaveAttribute(
    'href',
    '/enterprise/procurement/products',
  );

  const html = await page.content();
  expect(html).not.toMatch(
    /立即开团|邀请参团|团长中心|团长佣金|成团进度|活动倒计时|活动截止|发起采购审批|提交预算审批|进入OA/iu,
  );
  expect(html).not.toMatch(
    /communityId|leaderId|leaderCommission|campaignStartAt|campaignEndAt|groupThreshold|groupStatus|approvedSupplyPrice|supplyPrice|internalMargin/iu,
  );
  await expect(page.locator('[data-countdown], [data-group-buying], [data-community-leader]')).toHaveCount(0);

  const registration = await page.request.get('/enterprise/register');
  expect(registration.headers()['cache-control'] ?? '').toMatch(/private.*no-store/iu);
  expect(registration.headers()['x-robots-tag'] ?? '').toMatch(/noindex/iu);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(page.getByRole('heading', { level: 1, name: '社区集采，不是限时团购活动' })).toBeVisible();
  const firstNavigationLink = await page.getByRole('navigation', { name: '公开门户主导航' })
    .getByRole('link', { name: '首页', exact: true })
    .boundingBox();
  expect(firstNavigationLink).not.toBeNull();
  expect(firstNavigationLink?.x ?? -1).toBeGreaterThanOrEqual(0);
});
