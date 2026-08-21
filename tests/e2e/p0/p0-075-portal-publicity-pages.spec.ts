import { expect, test } from '@playwright/test';

const publicPages = [
  {
    route: '/about',
    heading: '关于福礼团',
    sections: ['平台定位', '服务理念', '公开信息原则'],
    next: ['查看供应链能力', '/capabilities'],
  },
  {
    route: '/capabilities',
    heading: '一站式供应链服务能力',
    sections: ['能力全景', '链路隔离'],
    next: ['查看服务场景', '/cases'],
  },
  {
    route: '/cases',
    heading: '服务场景',
    sections: ['当前可公开内容', '已授权客户案例'],
    next: ['联系企业服务', '/contact'],
  },
  {
    route: '/news',
    heading: '新闻与公告',
    sections: ['已发布内容', '规则透明，历史可追溯'],
    next: ['了解平台能力', '/capabilities'],
  },
  {
    route: '/contact',
    heading: '联系我们',
    sections: ['已确认客服渠道', '诉求分流', '隐私说明'],
    next: ['注册企业', '/enterprise/register'],
  },
] as const;

test.describe('P0-075 enterprise publicity pages', () => {
  test('about, capabilities, cases, news and contact provide complete content and a next action', async ({
    page,
  }) => {
    for (const item of publicPages) {
      const response = await page.goto(item.route);
      expect(response?.status(), item.route).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible();
      for (const section of item.sections) await expect(page.getByText(section, { exact: true }).first()).toBeVisible();
      await expect(page.getByText('下一步', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: item.next[0], exact: true })).toHaveAttribute(
        'href',
        item.next[1],
      );
      expect(response?.headers()['cache-control'] ?? '').not.toMatch(/private|no-store/iu);
      expect(response?.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/iu);
    }
    await page.screenshot({
      path: 'artifacts/verification/M3-P075/portal-publicity-desktop.png',
      fullPage: true,
    });
  });

  test('qualifications and customer cases fail closed while rule announcements retain version and effective date', async ({
    page,
  }) => {
    await page.goto('/about');
    await expect(page.getByText('公司营业执照已由授权人员核验并保存在公司受控存储。', { exact: false })).toBeVisible();
    await expect(page.getByText('当前页面不虚构时间线、证书或荣誉。', { exact: false })).toBeVisible();

    await page.goto('/cases');
    await expect(page.getByText('当前没有可在代码仓库和公开站点发布的客户授权材料', { exact: false })).toBeVisible();
    await expect(page.getByText('不代表特定客户案例或客户背书', { exact: false })).toBeVisible();
    await expect(page.locator('[data-authorized-case]')).toHaveCount(0);

    await page.goto('/news/community-procurement-boundary');
    await expect(page.getByText('V1.1', { exact: true })).toBeVisible();
    await expect(page.locator('time[datetime="2026-08-02"]')).toHaveText('2026-08-02');
    await expect(page.getByText('公众访客、企业客户与意向供应商', { exact: true })).toBeVisible();
    expect((await page.goto('/cases/not-authorized'))?.status()).toBe(404);
    expect((await page.goto('/news/not-published'))?.status()).toBe(404);
  });

  test('publicity detail and contact pages offer explicit next steps without sensitive or invented data', async ({
    page,
  }) => {
    await page.goto('/cases/enterprise-welfare-service');
    await expect(page.getByText('下一步', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '联系企业服务', exact: true })).toHaveAttribute('href', '/contact');

    await page.goto('/news/community-procurement-boundary');
    await expect(page.getByText('下一步', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '进入社区集采', exact: true })).toHaveAttribute(
      'href',
      '/enterprise-procurement',
    );

    await page.goto('/contact');
    await expect(page.getByRole('link', { name: '查看供应商合作', exact: true })).toHaveAttribute(
      'href',
      '/supplier-cooperation',
    );
    const html = await page.content();
    expect(html).not.toMatch(
      /supplyPrice|approvedSupplyPrice|supplyAmount|grossMargin|18936579999|统一社会信用代码|银行账号/iu,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/news');
    expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: 'artifacts/verification/M3-P075/portal-publicity-mobile.png',
      fullPage: true,
    });
  });
});
