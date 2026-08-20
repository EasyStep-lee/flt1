import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4321';
const route = '/company-admin/workspaces/order-service';

test('P0-058 order-service page displays deterministic sequential split refunds without accepting channel targets', async ({ page }) => {
  await page.route('**/v1/company-auth/workspace/current**', (request) => request.fulfill({
    contentType: 'application/json', status: 200, body: JSON.stringify({
      accountTypeCode: 'COMPANY_ORDER_SERVICE', accountTypeName: '订单客服', pageId: 'PAGE-007', workspaceRoute: route,
      menuItems: [{ key: 'workspace', label: '订单客服', route }],
    }),
  }));
  await page.route('**/v1/company-auth/workspace/page**', (request) => request.fulfill({
    contentType: 'application/json', status: 200, body: JSON.stringify({
      accountTypeCode: 'COMPANY_ORDER_SERVICE', accountTypeName: '订单客服', pageId: 'PAGE-007', workspaceRoute: route,
      filters: { availability: 'ALL', keyword: '' },
      summary: { catalogTotal: 1, availableTotal: 1, deferredTotal: 0, filteredTotal: 1 },
      items: [{ moduleKey: 'refund-initiation', label: '退款执行', description: '按原支付分配快照发起退款。', deliveryStage: 'M3', availability: 'AVAILABLE', dataBoundary: '退款目标和金额由服务端派生。' }],
      selectedModule: null,
    }),
  }));

  const bodies: unknown[] = [];
  let call = 0;
  await page.route('**/v1/aftersales/*/refund', (request) => {
    bodies.push(request.request().postDataJSON());
    call += 1;
    return request.fulfill({
      contentType: 'application/json', status: 201, body: JSON.stringify({
        refundId: `8e000000-0000-4000-8000-00000000005${call}`,
        afterSaleId: `86000000-0000-4000-8000-00000000005${call}`,
        orderId: '87000000-0000-4000-8000-000000000058',
        orderItemId: '88000000-0000-4000-8000-000000000058',
        refundNo: `RF20260820000000000000005${call}`,
        status: 'SUCCEEDED',
        welfareCardRefundAmount: call === 1 ? 900 : 901,
        cashRefundAmount: call === 1 ? 2000 : 1999,
        welfareChannelStatus: 'SUCCEEDED', wechatChannelStatus: 'SUCCEEDED',
      }),
    });
  });

  await page.goto(`${origin}${route}`);
  const id = page.getByLabel('退款授权编号');
  await id.fill('86000000-0000-4000-8000-000000000051');
  await page.getByLabel('退款授权版本').fill('1');
  await page.getByLabel('退款执行原因').fill('第一笔部分退款');
  await page.getByRole('button', { name: '按原结构执行退款' }).click();
  await expect(page.getByText('900', { exact: true })).toBeVisible();
  await expect(page.getByText('2000', { exact: true })).toBeVisible();

  await id.fill('86000000-0000-4000-8000-000000000052');
  await page.getByLabel('退款执行原因').fill('第二笔尾差退款');
  await page.getByRole('button', { name: '按原结构执行退款' }).click();
  await expect(page.getByText('901', { exact: true })).toBeVisible();
  await expect(page.getByText('1999', { exact: true })).toBeVisible();

  expect(bodies).toHaveLength(2);
  for (const body of bodies) {
    expect(JSON.stringify(body)).not.toMatch(/amount|accountId|paymentTransactionId|wechatTransactionId|supplierId|companyId/iu);
  }
});
