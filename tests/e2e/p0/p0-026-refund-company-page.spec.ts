import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4321';
const route = '/company-admin/workspaces/order-service';
const afterSaleId = '86000000-0000-4000-8000-000000000126';

test('P0-026 order-service page submits only approved authority and handles success, unknown, duplicate and offline states', async ({ page }) => {
  await page.route('**/v1/company-auth/workspace/current**', async (request) => {
    await request.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountTypeCode: 'COMPANY_ORDER_SERVICE',
        accountTypeName: '订单客服',
        pageId: 'PAGE-007',
        workspaceRoute: route,
        menuItems: [{ key: 'workspace', label: '订单客服', route }],
      }),
    });
  });
  await page.route('**/v1/company-auth/workspace/page**', async (request) => {
    await request.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        accountTypeCode: 'COMPANY_ORDER_SERVICE',
        accountTypeName: '订单客服',
        pageId: 'PAGE-007',
        workspaceRoute: route,
        filters: { availability: 'ALL', keyword: '' },
        summary: { catalogTotal: 2, availableTotal: 1, deferredTotal: 1, filteredTotal: 2 },
        items: [
          {
            moduleKey: 'refund-initiation', label: '退款执行',
            description: '按已批准授权和原支付分配快照发起退款。',
            deliveryStage: 'M3', availability: 'AVAILABLE',
            dataBoundary: '不返回原账户、微信交易号或供应价。',
          },
          {
            moduleKey: 'after-sales-cases', label: '售后工单',
            description: '完整售后在 M5 实现。', deliveryStage: 'M5', availability: 'DEFERRED',
            dataBoundary: '售后责任流程尚未交付。',
          },
        ],
        selectedModule: null,
      }),
    });
  });

  let mode: 'duplicate' | 'offline' | 'success' | 'unknown' = 'success';
  const requests: Array<{ readonly body: unknown; readonly idempotencyKey: string | null }> = [];
  await page.route('**/v1/aftersales/*/refund', async (request) => {
    requests.push({
      body: request.request().postDataJSON(),
      idempotencyKey: request.request().headers()['idempotency-key'] ?? null,
    });
    if (mode === 'offline') {
      await request.abort('failed');
      return;
    }
    if (mode === 'duplicate') {
      await request.fulfill({
        contentType: 'application/json', status: 409,
        body: JSON.stringify({ code: 'REFUND_DUPLICATE', message: '幂等键与原退款请求冲突' }),
      });
      return;
    }
    await request.fulfill({
      contentType: 'application/json',
      status: mode === 'unknown' ? 202 : 201,
      body: JSON.stringify({
        refundId: '8e000000-0000-4000-8000-000000000126',
        afterSaleId,
        orderId: '87000000-0000-4000-8000-000000000126',
        orderItemId: '88000000-0000-4000-8000-000000000126',
        refundNo: 'RF202608140000000000000126',
        status: mode === 'unknown' ? 'UNKNOWN' : 'SUCCEEDED',
        welfareCardRefundAmount: 900,
        cashRefundAmount: 2000,
        welfareChannelStatus: 'SUCCEEDED',
        wechatChannelStatus: mode === 'unknown' ? 'UNKNOWN' : 'SUCCEEDED',
      }),
    });
  });

  await page.goto(`${origin}${route}`);
  await expect(page.getByRole('heading', { name: '按原支付结构退款' })).toBeVisible();
  await expect(page.getByText('完整售后申请、责任认定和供应商协同仍在 M5')).toBeVisible();
  const id = page.getByLabel('退款授权编号');
  const version = page.getByLabel('退款授权版本');
  const reason = page.getByLabel('退款执行原因');
  await id.fill(afterSaleId);
  await version.fill('3');
  await reason.fill('已批准退货，按原支付结构执行');
  await page.getByRole('button', { name: '按原结构执行退款' }).click();
  await expect(page.locator('[data-refund-initiation-state="success"]')).toBeVisible();
  await expect(page.getByText('福利卡原路退款（分）')).toBeVisible();
  expect(requests[0]?.body).toEqual({
    authorizationVersion: 3,
    reason: '已批准退货，按原支付结构执行',
  });
  expect(JSON.stringify(requests[0]?.body)).not.toMatch(/amount|accountId|paymentTransactionId|supplierId|companyId/iu);
  expect(requests[0]?.idempotencyKey).toBeTruthy();

  mode = 'unknown';
  await id.fill('86000000-0000-4000-8000-000000000127');
  await page.getByRole('button', { name: '按原结构执行退款' }).click();
  await expect(page.locator('[data-refund-initiation-state="unknown-result"]')).toBeVisible();
  await expect(page.getByText('禁止重新生成退款')).toBeVisible();

  mode = 'duplicate';
  await id.fill('86000000-0000-4000-8000-000000000128');
  await page.getByRole('button', { name: '按原结构执行退款' }).click();
  await expect(page.locator('[data-refund-initiation-state="duplicate"]')).toBeVisible();
  await expect(page.getByText('退款请求冲突', { exact: true })).toBeVisible();

  mode = 'offline';
  await id.fill('86000000-0000-4000-8000-000000000129');
  await page.getByRole('button', { name: '按原结构执行退款' }).click();
  await expect(page.locator('[data-refund-initiation-state="offline"]')).toBeVisible();
  await expect(page.getByText('请求结果未知')).toBeVisible();
});
