import { expect, test } from '@playwright/test';

test.describe('P0-076 supplier cooperation and enterprise welfare service', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.fulisheBusinessInquirySecurity = {
        getCaptchaToken: async () => 'p0-captcha-token',
      };
    });
  });

  test('publishes complete static supplier and welfare service paths without private cache directives', async ({ page }) => {
    const supplier = await page.goto('/supplier-cooperation');
    expect(supplier?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: '成为福礼团合作供应商' })).toBeVisible();
    await expect(page.getByRole('link', { name: '申请供应商合作', exact: true })).toHaveAttribute('href', '/supplier/register');
    await expect(page.getByRole('link', { name: '已有账号登录', exact: true }).first()).toHaveAttribute('href', '/supplier/login');
    await expect(page.getByText('不承诺提交后必然通过', { exact: false })).toBeVisible();

    const welfare = await page.goto('/welfare-card-service');
    expect(welfare?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: '企业福利卡服务' })).toBeVisible();
    for (const section of ['适用场景', '企业申请流程', '员工使用路径', '适用与退款边界', '企业福利咨询']) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible();
    }
    expect(welfare?.headers()['cache-control'] ?? '').not.toMatch(/private|no-store/iu);
    expect(welfare?.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/iu);
    const html = await page.content();
    expect(html).not.toMatch(/WelfareCardAccount|PERSONAL_RECHARGE|supplyPrice|18936579999/iu);
    await page.screenshot({
      path: 'artifacts/verification/M3-P076/welfare-service-desktop.png',
      fullPage: true,
    });
  });

  test('submits the minimum fields and reuses the idempotency key after an unknown result', async ({ page, request }) => {
    await request.post('http://127.0.0.1:4324/test-business-inquiry-behavior', {
      data: { statuses: [503, 201] },
      headers: { cookie: '__Host-fulishe-enterprise-portal=p0-session' },
    });
    await page.goto('/welfare-card-service');
    await page.getByLabel('联系人').fill('李经理');
    await page.getByLabel('企业名称').fill('南京示例企业有限公司');
    await page.getByLabel('手机号码').fill('13800138000');
    await page.getByLabel('需求摘要').fill('计划为员工申请节日福利卡并了解适用范围。');
    await page.getByLabel('我已阅读并同意隐私说明').check();
    await page.getByRole('button', { name: '提交企业福利咨询' }).click();
    await expect(page.locator('.form-alert')).toContainText('结果暂未确认');
    await page.getByRole('button', { name: '重试原请求' }).click();
    await expect(page.getByText('咨询已受理', { exact: true })).toBeVisible();
    await expect(page.getByText('FLX20260821P076TEST', { exact: true })).toBeVisible();
    await expect(page.locator('[data-inquiry-success]')).toContainText('189****9999');

    const observations = await request.get('http://127.0.0.1:4324/test-observations', {
      headers: { cookie: '__Host-fulishe-enterprise-portal=p0-session' },
    });
    const payload = await observations.json();
    expect(payload.businessInquiryRequests).toHaveLength(2);
    expect(payload.businessInquiryRequests[0].idempotencyKey).toBe(
      payload.businessInquiryRequests[1].idempotencyKey,
    );
    expect(payload.businessInquiryRequests[0].captchaToken).toBe('p0-captcha-token');
    expect(payload.businessInquiryRequests[0].body).toEqual({
      contactName: '李经理',
      enterpriseName: '南京示例企业有限公司',
      mobile: '13800138000',
      demandSummary: '计划为员工申请节日福利卡并了解适用范围。',
      consentToUse: true,
    });
  });

  test('shows validation, external verifier and mobile layout boundaries', async ({ page }) => {
    await page.goto('/welfare-card-service');
    await page.getByRole('button', { name: '提交企业福利咨询' }).click();
    await expect(page.getByText('请填写联系人', { exact: true })).toBeVisible();

    await page.evaluate(() => {
      delete window.fulisheBusinessInquirySecurity;
    });
    await page.getByLabel('联系人').fill('李经理');
    await page.getByLabel('企业名称').fill('南京示例企业有限公司');
    await page.getByLabel('手机号码').fill('13800138000');
    await page.getByLabel('需求摘要').fill('计划为员工申请节日福利卡并了解适用范围。');
    await page.getByLabel('我已阅读并同意隐私说明').check();
    await page.getByRole('button', { name: '提交企业福利咨询' }).click();
    await expect(page.locator('.form-alert')).toContainText('人机验证暂不可用');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(390);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: 'artifacts/verification/M3-P076/welfare-service-mobile.png',
      fullPage: true,
    });
  });
});

declare global {
  interface Window {
    fulisheBusinessInquirySecurity?: {
      getCaptchaToken(): Promise<string>;
    };
  }
}

export {};
