import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { expect, test } from '@playwright/test';

interface BuiltCheckoutPage {
  data: Record<string, unknown> & { accounts: Array<Record<string, unknown>>; selectedAccountId: string };
  setData(patch: Record<string, unknown>): void;
  onLoad(): Promise<void>;
  selectAccount(event: { currentTarget: { dataset: { accountId: string } } }): void;
  submitFullWelfarePayment(): Promise<void>;
}

test('P0-055 built checkout sends one account-only full-payment command and reuses its key after an unknown result', async () => {
  let definition: BuiltCheckoutPage | undefined;
  const accountId = '60000000-0000-4000-8000-000000000001';
  const orderId = '70000000-0000-4000-8000-000000000001';
  const requests: Array<{ data?: unknown; header?: Record<string, string>; method: string; url: string }> = [];
  const storage = new Map<string, unknown>([
    ['fulishe.pendingCartItems', [{ skuId: '40000000-0000-4000-8000-000000000001', quantity: 1 }]],
    ['fulishe.pendingBuyerOrder', { orderId, totalAmount: 7_000 }],
  ]);
  let paymentAttempts = 0;
  const context = vm.createContext({
    console, Promise,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value: Record<string, unknown>) => { definition = value as unknown as BuiltCheckoutPage; },
    wx: {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
      removeStorageSync: (key: string) => storage.delete(key),
      request: (options: { data?: unknown; fail: () => void; header?: Record<string, string>; method: string; success: (response: { statusCode: number; data: unknown }) => void; url: string }) => {
        requests.push({
          ...(options.data === undefined ? {} : { data: options.data }),
          ...(options.header === undefined ? {} : { header: options.header }),
          method: options.method,
          url: options.url,
        });
        if (options.url.includes('/welfare-card-full-payment')) {
          paymentAttempts += 1;
          if (paymentAttempts === 1) return options.fail();
          return options.success({ statusCode: 200, data: {
            orderId, orderNo: 'FS202608170000000001', paymentStatus: 'PAID', orderStatus: 'PAID',
            paymentMode: 'WELFARE_CARD', welfareCardAmount: 7_000, cashAmount: 0,
            paidAt: '2026-08-17T03:00:00.000Z', itemCount: 1, supplierFulfillmentCount: 1,
          } });
        }
        return options.success({ statusCode: 200, data: {
          goodsAmount: 7_000, deliveryFee: 0, totalAmount: 7_000,
          accounts: [{
            id: accountId, programName: '全场福利', maskedCardNo: '****0001', balanceAmount: 8_000,
            frozenAmount: 1_000, availableAmount: 7_000, status: 'ACTIVE', version: 0,
            scopeType: 'ALL_PRODUCTS', scopeDescription: '全部商品可用，不含配送费', eligibleAmount: 7_000,
            maximumDeductibleAmount: 7_000,
            itemApplicability: [{ skuId: '40000000-0000-4000-8000-000000000001', eligible: true, eligibleAmount: 7_000, reason: 'ALL_PRODUCTS' }],
            deliveryFeeApplicability: { eligible: false, eligibleAmount: 0 },
          }],
        } });
      },
    },
  });
  vm.runInContext(readFileSync(path.resolve('apps/user-miniapp/dist/pages/checkout/index.js'), 'utf8'), context);
  const page = definition as BuiltCheckoutPage;
  page.setData = (patch: Record<string, unknown>) => Object.assign(page.data, patch);
  await page.onLoad.call(page);
  page.selectAccount.call(page, { currentTarget: { dataset: { accountId } } });
  await page.submitFullWelfarePayment.call(page);
  expect(page.data.state).toBe('unknown');
  const first = requests.at(-1)!;
  await page.submitFullWelfarePayment.call(page);
  const replay = requests.at(-1)!;
  expect(page.data.state).toBe('paid');
  expect(first.header?.['Idempotency-Key']).toBe(replay.header?.['Idempotency-Key']);
  expect(replay).toMatchObject({ method: 'POST', data: { accountId } });
  expect(replay.url).toBe(`https://api.example.test/v1/consumer/orders/${orderId}/welfare-card-full-payment`);
  expect(JSON.stringify(replay)).not.toMatch(/companyId|consumerUserId|buyerId|supplierId|price|amount/iu);
  expect(storage.has('fulishe.pendingBuyerOrder')).toBe(false);
});
