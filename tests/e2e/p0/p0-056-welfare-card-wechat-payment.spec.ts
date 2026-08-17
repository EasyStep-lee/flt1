import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { expect, test } from '@playwright/test';

interface MiniappRequestOptions {
  method?: string;
  url: string;
  data?: unknown;
  header?: Record<string, string>;
  success: (response: { statusCode: number; data: unknown }) => void;
}

interface MiniappPaymentOptions {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
  success: (response: { errMsg: string }) => void;
}

interface CheckoutPage {
  data: Record<string, unknown> & { state?: string };
  setData: (patch: Record<string, unknown>) => void;
  onLoad: () => Promise<void>;
  selectAccount: (event: { currentTarget: { dataset: { accountId: string } } }) => void;
  submitSelectedPayment: () => Promise<void>;
}

test('P0-056 built checkout sends one account-only command and invokes wx.requestPayment once with the server payload', async () => {
  let page: CheckoutPage | null = null;
  const orderId = '70000000-0000-4000-8000-000000000001';
  const accountId = '60000000-0000-4000-8000-000000000001';
  const requests: Array<{
    method: string | undefined;
    url: string;
    data: unknown;
    header: Record<string, string> | undefined;
  }> = [];
  const requestPayments: MiniappPaymentOptions[] = [];
  const storage = new Map<string, unknown>([
    ['fulishe.pendingCartItems', [{ skuId: '40000000-0000-4000-8000-000000000001', quantity: 1 }]],
    ['fulishe.pendingBuyerOrder', { orderId, totalAmount: 7_000 }],
  ]);
  const clientPayment = { timeStamp: '1786666666', nonceStr: 'nonce', package: 'prepay_id=mixed-prepay-1', signType: 'RSA', paySign: 'signature' };
  const context = vm.createContext({
    console, Promise,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value: unknown) => { page = value as CheckoutPage; },
    wx: {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
      removeStorageSync: (key: string) => storage.delete(key),
      request: (options: MiniappRequestOptions) => {
        requests.push({ method: options.method, url: options.url, data: options.data, header: options.header });
        if (options.url.includes('/welfare-card-wechat-payment')) return options.success({ statusCode: 201, data: {
          paymentTransactionId: '71000000-0000-4000-8000-000000000001', orderId, channel: 'WECHAT_PAY', status: 'PREPAY_CREATED',
          collectorName: '江苏福礼团供应链科技有限公司', checkoutMode: 'COMPANY_UNIFIED', paymentMode: 'WELFARE_CARD_WECHAT',
          welfareCardAmount: 4_000, cashAmount: 3_000, totalAmount: 7_000, amount: 3_000,
          outTradeNo: 'WP2026081700000000000000000001', prepayId: 'mixed-prepay-1', clientPayment,
        } });
        return options.success({ statusCode: 200, data: {
          goodsAmount: 7_000, deliveryFee: 0, totalAmount: 7_000,
          accounts: [{ id: accountId, programName: '全场福利', maskedCardNo: '****0001', balanceAmount: 4_000, frozenAmount: 0, availableAmount: 4_000, status: 'ACTIVE', version: 0, scopeType: 'ALL_PRODUCTS', scopeDescription: '全部商品可用', eligibleAmount: 7_000, maximumDeductibleAmount: 4_000, itemApplicability: [{ skuId: '40000000-0000-4000-8000-000000000001', eligible: true, eligibleAmount: 7_000, reason: 'ALL_PRODUCTS' }], deliveryFeeApplicability: { eligible: false, eligibleAmount: 0 } }],
        } });
      },
      requestPayment: (options: MiniappPaymentOptions) => { requestPayments.push(options); options.success({ errMsg: 'requestPayment:ok' }); },
    },
  });
  vm.runInContext(readFileSync(path.resolve('apps/user-miniapp/dist/pages/checkout/index.js'), 'utf8'), context);
  const checkoutPage = page as CheckoutPage | null;
  if (!checkoutPage) throw new Error('checkout page registration missing');
  checkoutPage.setData = (patch: Record<string, unknown>) => Object.assign(checkoutPage.data, patch);
  await checkoutPage.onLoad.call(checkoutPage);
  checkoutPage.selectAccount.call(checkoutPage, { currentTarget: { dataset: { accountId } } });
  await checkoutPage.submitSelectedPayment.call(checkoutPage);
  const command = requests.find(({ url }) => url.includes('/welfare-card-wechat-payment'));
  if (!command) throw new Error('mixed payment request missing');
  if (!command.header) throw new Error('mixed payment headers missing');
  expect(command).toMatchObject({ method: 'POST', data: { accountId } });
  expect(command.header['Idempotency-Key']).toMatch(/^welfare-wechat-/u);
  expect(requestPayments).toHaveLength(1);
  expect(requestPayments[0]).toMatchObject(clientPayment);
  expect(checkoutPage.data.state).toBe('unknown');
  expect(JSON.stringify(command)).not.toMatch(/companyId|consumerUserId|buyerId|supplierId|price|amount/iu);
});
