import { expect, test } from '@playwright/test';

test('P0-028/P0-077 enterprise registration is private, responsive, and submits one company review', async ({
  page,
}) => {
  const registrationId = '28000000-0000-4000-8000-000000000028';
  let createCount = 0;
  let submitCount = 0;
  await page.route('**/v1/enterprise/registrations', async (route) => {
    createCount += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body).not.toHaveProperty('companyId');
    expect(body).not.toHaveProperty('enterpriseCustomerId');
    expect(body).not.toHaveProperty('status');
    expect(body).toMatchObject({
      legalName: '南京示例企业有限公司',
      agreementVersion: 'enterprise-procurement-v1.1',
    });
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({
        registrationId,
        status: 'DRAFT',
        version: 0,
        registrationAccessToken: 'p0-028-signed-registration-token',
        registrationAccessExpiresAt: '2030-12-31T00:00:00.000Z',
        nextAction: 'COMPLETE_PROFILE',
      }),
    });
  });
  await page.route('**/v1/enterprise/registrations/me/submit-review', async (route) => {
    submitCount += 1;
    expect(route.request().headers().authorization).toBe(
      'Registration p0-028-signed-registration-token',
    );
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({
        id: registrationId,
        legalName: '南京示例企业有限公司',
        creditCodeMasked: '9132********2D3X',
        status: 'PENDING_REVIEW',
        version: 1,
        administratorName: '李经理',
        administratorMobileMasked: '138****8000',
        businessLicenseProvided: true,
        addresses: [],
        correctionFields: [],
        nextAction: 'REVIEW_IN_PROGRESS',
      }),
    });
  });

  const response = await page.goto('/enterprise/register');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control'] ?? '').toMatch(/private.*no-store/iu);
  expect(response?.headers()['x-robots-tag'] ?? '').toMatch(/noindex/iu);
  await expect(page.locator('[data-shell="enterprise-registration"]')).toHaveAttribute(
    'data-p0',
    'P0-028',
  );
  await expect(page.locator('[data-shell="enterprise-registration"]')).toHaveAttribute(
    'data-p0-partial',
    'P0-077',
  );
  await expect(page.getByRole('heading', { level: 1, name: '一次提交，开启统一企业采购' })).toBeVisible();

  await page.getByLabel('企业全称').fill('南京示例企业有限公司');
  await page.getByLabel('统一社会信用代码').fill('91320100MA1ABC2D3X');
  await page.getByLabel('企业类型').click();
  await page.getByText('有限责任公司', { exact: true }).click();
  await page.getByRole('textbox', { name: '注册地址', exact: true }).fill('南京市建邺区江东中路 100 号');
  await page.getByLabel('营业执照受控存储引用').fill('object://enterprise-certification/license-028');
  await page.getByLabel('管理员姓名').fill('李经理');
  await page.getByLabel('职务').fill('采购负责人');
  await page.getByLabel('管理员手机').fill('13800138000');
  await page.getByLabel('短信验证码').fill('123456');
  await page.getByLabel('管理员邮箱').fill('buyer@example.test');
  await page.getByLabel('发票抬头').fill('南京示例企业有限公司');
  await page.getByLabel('纳税人识别号').fill('91320100MA1ABC2D3X');
  await page.getByLabel('收货人').fill('李经理');
  await page.getByLabel('收货手机').fill('13800138000');
  await page.getByLabel('省市区').fill('江苏省南京市建邺区');
  await page.getByLabel('详细地址').fill('江东中路 100 号');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '保存并提交公司审核' }).click();

  await expect(page.getByText(/企业认证已提交/u)).toBeVisible();
  expect(createCount).toBe(1);
  expect(submitCount).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem('fulishe.enterprise.registration.credential'))).toContain(
    registrationId,
  );

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(375);
  expect(await page.content()).not.toMatch(/6222020202020202020|13800138000.*registrationAccessToken/iu);
});
