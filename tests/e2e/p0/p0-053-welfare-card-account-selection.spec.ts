import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { expect, test } from '@playwright/test';

interface BuiltCheckoutPage {
  data: Record<string, unknown> & { accounts: Array<Record<string, unknown>> };
  setData(patch: Record<string, unknown>): void;
  onLoad(): Promise<void>;
  selectAccount(event: { currentTarget: { dataset: { accountId: string } } }): void;
  useNoWelfareCard(): void;
}

test('P0-053 built checkout selects one server-qualified welfare account or none without manual amount or owner input', async () => {
  let definition: BuiltCheckoutPage | undefined;
  const requests: Array<{ method: string; url: string }> = [];
  const accountId = '60000000-0000-4000-8000-000000000001';
  const storage = new Map<string, unknown>([['fulishe.pendingCartItems', [
    { skuId: '40000000-0000-4000-8000-000000000001', supplierId: '50000000-0000-4000-8000-000000000001', supplierLabel: '供应来源甲', productName: '商品甲', quantity: 2, retailSalePrice: 2_000 },
    { skuId: '40000000-0000-4000-8000-000000000002', supplierId: '50000000-0000-4000-8000-000000000002', supplierLabel: '供应来源乙', productName: '商品乙', quantity: 1, retailSalePrice: 3_000 },
  ]]]);
  const context = vm.createContext({
    console, Promise,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value: Record<string, unknown>) => { definition = value as unknown as BuiltCheckoutPage; },
    wx: {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
      removeStorageSync: (key: string) => storage.delete(key),
      request: (options: { method: string; success: (response: { statusCode: number; data: unknown }) => void; url: string }) => {
        requests.push({ method: options.method, url: options.url });
        options.success({ statusCode: 200, data: {
          goodsAmount: 7_000, deliveryFee: 0, totalAmount: 7_000,
          accounts: [{
            id: accountId, programName: '全场福利', maskedCardNo: '****0001',
            balanceAmount: 8_000, frozenAmount: 1_000, availableAmount: 7_000,
            status: 'ACTIVE', version: 0, scopeType: 'ALL_PRODUCTS',
            scopeDescription: '全部商品可用，不含配送费', eligibleAmount: 7_000,
            maximumDeductibleAmount: 7_000,
          }],
        } });
      },
    },
  });
  vm.runInContext(readFileSync(path.resolve('apps/user-miniapp/dist/pages/checkout/index.js'), 'utf8'), context);
  expect(definition).toBeTruthy();
  const page = definition as BuiltCheckoutPage;
  page.setData = (patch: Record<string, unknown>) => Object.assign(page.data, patch);
  await page.onLoad.call(page);

  expect(page.data).toMatchObject({ state: 'success', goodsAmountLabel: '¥70.00', totalAmountLabel: '¥70.00' });
  expect(page.data.accounts[0]).toMatchObject({
    maskedCardNo: '****0001', availableLabel: '¥70.00', eligibleLabel: '¥70.00', maximumDeductibleLabel: '¥70.00',
  });
  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe('GET');
  expect(requests[0]?.url).toContain('/v1/consumer/welfare-card-accounts/eligible?');
  expect(requests[0]?.url).not.toMatch(/companyId|consumerUserId|buyerId|supplierId|price|amount/iu);

  page.selectAccount.call(page, { currentTarget: { dataset: { accountId } } });
  expect(page.data.selectedAccountId).toBe(accountId);
  expect(storage.get('fulishe.selectedWelfareCardAccountId')).toBe(accountId);
  page.useNoWelfareCard.call(page);
  expect(page.data.selectedAccountId).toBe('');
  expect(storage.has('fulishe.selectedWelfareCardAccountId')).toBe(false);

  const template = readFileSync(path.resolve('apps/user-miniapp/dist/pages/checkout/index.wxml'), 'utf8');
  expect(template).toContain('不使用福利卡');
  expect(template).not.toMatch(/<input[^>]*(?:amount|抵扣)/iu);
  expect(template).not.toMatch(/支付成功|已扣款|个人现金充值|提现|转让/iu);
});
