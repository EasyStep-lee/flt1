import assert from 'node:assert/strict';
import test from 'node:test';

import { COMPANY_WORKSPACE_PAGE_MODULES } from '../../dist/company-auth/company-workspace-page.policy.js';

test('M3-P026 exposes refund initiation only in the independent company order-service page', () => {
  const orderService = COMPANY_WORKSPACE_PAGE_MODULES.COMPANY_ORDER_SERVICE;
  assert.deepEqual(
    orderService.find(({ moduleKey }) => moduleKey === 'refund-initiation'),
    {
      moduleKey: 'refund-initiation',
      label: '退款执行',
      description: '按已批准授权和原支付分配快照发起退款。',
      deliveryStage: 'M3',
      availability: 'AVAILABLE',
      dataBoundary: '只展示退款状态和渠道金额摘要，不返回原福利卡账户、微信交易号、供应价或结算信息。',
      sections: ['已批准退款', '原结构金额摘要', '退款状态时间线'],
    },
  );
  assert.equal(
    orderService.find(({ moduleKey }) => moduleKey === 'after-sales-cases')?.availability,
    'DEFERRED',
  );
  for (const [role, modules] of Object.entries(COMPANY_WORKSPACE_PAGE_MODULES)) {
    if (role === 'COMPANY_ORDER_SERVICE') continue;
    assert.equal(modules.some(({ moduleKey }) => moduleKey === 'refund-initiation'), false);
  }
});
