/* global URL, console, structuredClone */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const cartItems = [
  { skuId: '40000000-0000-4000-8000-000000000001', supplierId: '50000000-0000-4000-8000-000000000001', supplierLabel: '供应来源甲', productName: '商品甲', quantity: 2, retailSalePrice: 2_000 },
  { skuId: '40000000-0000-4000-8000-000000000002', supplierId: '50000000-0000-4000-8000-000000000002', supplierLabel: '供应来源乙', productName: '商品乙', quantity: 1, retailSalePrice: 3_000 },
];
const response = {
  goodsAmount: 7_000, deliveryFee: 0, totalAmount: 7_000,
  accounts: [{
    id: '60000000-0000-4000-8000-000000000001', programName: '全场福利', maskedCardNo: '****0001',
    balanceAmount: 8_000, frozenAmount: 1_000, availableAmount: 7_000, status: 'ACTIVE', version: 0,
    scopeType: 'ALL_PRODUCTS', scopeDescription: '全部商品可用，不含配送费', eligibleAmount: 7_000,
    maximumDeductibleAmount: 7_000,
    itemApplicability: [
      { skuId: cartItems[0].skuId, eligible: true, eligibleAmount: 4_000, reason: 'ALL_PRODUCTS' },
      { skuId: cartItems[1].skuId, eligible: false, eligibleAmount: 0, reason: 'PRODUCT_EXCLUDED' },
    ],
    deliveryFeeApplicability: { eligible: false, eligibleAmount: 0 },
  }],
};

const paidResponse = {
  orderId: '70000000-0000-4000-8000-000000000001', orderNo: 'FS202608170000000001',
  paymentStatus: 'PAID', orderStatus: 'PAID', paymentMode: 'WELFARE_CARD',
  welfareCardAmount: 7_000, cashAmount: 0, paidAt: '2026-08-17T03:00:00.000Z',
  itemCount: 2, supplierFulfillmentCount: 2,
};

const mixedResponse = {
  paymentTransactionId: '71000000-0000-4000-8000-000000000001', orderId: paidResponse.orderId,
  channel: 'WECHAT_PAY', status: 'PREPAY_CREATED', collectorName: '江苏福礼团供应链科技有限公司',
  checkoutMode: 'COMPANY_UNIFIED', paymentMode: 'WELFARE_CARD_WECHAT', welfareCardAmount: 4_000,
  cashAmount: 3_000, totalAmount: 7_000, amount: 3_000, outTradeNo: 'WP2026081700000000000000000001',
  prepayId: 'mixed-prepay-1', clientPayment: { timeStamp: '1786666666', nonceStr: 'nonce', package: 'prepay_id=mixed-prepay-1', signType: 'RSA', paySign: 'test-signature' },
};

const loadPage = ({ fail = false, failPayment = false, responseBody = response, requestPaymentResult = 'success' } = {}) => {
  let definition;
  const requests = [];
  const requestPayments = [];
  const storage = new Map([
    ['fulishe.pendingCartItems', structuredClone(cartItems)],
    ['fulishe.pendingBuyerOrder', { orderId: paidResponse.orderId, totalAmount: 7_000 }],
  ]);
  const context = vm.createContext({
    console, Promise,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value) => { definition = value; },
    wx: {
      getStorageSync: (key) => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
      removeStorageSync: (key) => storage.delete(key),
      request: (options) => {
        requests.push({ data: options.data, header: options.header, method: options.method, url: options.url });
        if (fail || (failPayment && options.url.includes('/welfare-card-full-payment'))) return options.fail({ errMsg: 'request:fail timeout' });
        const fullPayment = options.url.includes('/welfare-card-full-payment');
        const mixedPayment = options.url.includes('/welfare-card-wechat-payment');
        return options.success({ data: structuredClone(fullPayment ? paidResponse : mixedPayment ? mixedResponse : responseBody), statusCode: fullPayment || mixedPayment ? 201 : 200 });
      },
      requestPayment: (options) => {
        requestPayments.push({ ...options });
        return requestPaymentResult === 'success' ? options.success({ errMsg: 'requestPayment:ok' }) : options.fail({ errMsg: 'requestPayment:fail cancel' });
      },
    },
  });
  vm.runInContext(readFileSync(path.join(packageRoot, 'dist', 'pages', 'checkout', 'index.js'), 'utf8'), context);
  definition.setData = (patch) => Object.assign(definition.data, patch);
  return { definition, requests, requestPayments, storage };
};

test('P0-053 checkout loads only server-priced eligible accounts through miniapp-kit and never sends owner or amount fields', async () => {
  const runtime = loadPage();
  await runtime.definition.onLoad.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.accounts.length, 1);
  assert.equal(runtime.definition.data.accounts[0].maximumDeductibleLabel, '¥70.00');
  assert.equal(runtime.requests.length, 1);
  assert.equal(runtime.requests[0].method, 'GET');
  assert.match(runtime.requests[0].url, /\/v1\/consumer\/welfare-card-accounts\/eligible\?/u);
  assert.match(runtime.requests[0].url, /skuId=40000000-0000-4000-8000-000000000001/u);
  assert.match(runtime.requests[0].url, /quantity=2/u);
  assert.doesNotMatch(runtime.requests[0].url, /companyId|consumerUserId|buyerId|supplierId|price|amount/iu);
});

test('P0-053 checkout selects exactly one account or none and never accepts a manual deduction amount', async () => {
  const runtime = loadPage();
  await runtime.definition.onLoad.call(runtime.definition);
  runtime.definition.selectAccount.call(runtime.definition, { currentTarget: { dataset: { accountId: response.accounts[0].id } } });
  assert.equal(runtime.definition.data.selectedAccountId, response.accounts[0].id);
  assert.equal(runtime.storage.get('fulishe.selectedWelfareCardAccountId'), response.accounts[0].id);
  runtime.definition.useNoWelfareCard.call(runtime.definition);
  assert.equal(runtime.definition.data.selectedAccountId, '');
  assert.equal(runtime.storage.has('fulishe.selectedWelfareCardAccountId'), false);
  const template = readFileSync(path.join(packageRoot, 'dist', 'pages', 'checkout', 'index.wxml'), 'utf8');
  assert.doesNotMatch(template, /<input[^>]*(?:amount|抵扣)/iu);
  assert.match(template, /不使用福利卡/u);
});

test('P0-054 checkout renders the same server line reasons and delivery-fee rule without client rule fields', async () => {
  const runtime = loadPage();
  await runtime.definition.onLoad.call(runtime.definition);
  assert.equal(runtime.definition.data.accounts[0].itemApplicability[0].eligibilityLabel, '福利卡可用');
  assert.equal(runtime.definition.data.accounts[0].itemApplicability[1].eligibilityLabel, '商品黑名单不可用');
  assert.equal(runtime.definition.data.accounts[0].deliveryFeeApplicability.label, '配送费不可用福利卡');
  const template = readFileSync(path.join(packageRoot, 'dist', 'pages', 'checkout', 'index.wxml'), 'utf8');
  assert.match(template, /itemApplicability|deliveryFeeApplicability/iu);
  assert.doesNotMatch(JSON.stringify(runtime.definition.data), /scopeRules|categoryIncludedIds|productExcludedIds/iu);
});

test('PAGE-056 exposes selection and payment recovery states without recharge or transfer claims', async () => {
  const app = JSON.parse(readFileSync(path.join(packageRoot, 'dist', 'app.json'), 'utf8'));
  assert.ok(app.pages.includes('pages/checkout/index'));
  const template = readFileSync(path.join(packageRoot, 'dist', 'pages', 'checkout', 'index.wxml'), 'utf8');
  assert.match(template, /loading|empty|error|permission|offline|success|paying|paid|unknown/iu);
  assert.doesNotMatch(template, /充值|提现|转让/iu);
  const offline = loadPage({ fail: true });
  await offline.definition.onLoad.call(offline.definition);
  assert.equal(offline.definition.data.state, 'offline');
});

test('P0-055 checkout submits one selected full-balance account without owner or amount and reports paid only after the API result', async () => {
  const runtime = loadPage();
  await runtime.definition.onLoad.call(runtime.definition);
  runtime.definition.selectAccount.call(runtime.definition, { currentTarget: { dataset: { accountId: response.accounts[0].id } } });
  await runtime.definition.submitFullWelfarePayment.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'paid');
  assert.equal(runtime.definition.data.message, '福利卡支付成功');
  const paymentRequest = runtime.requests.find(({ url }) => url.includes('/welfare-card-full-payment'));
  assert.equal(paymentRequest.method, 'POST');
  assert.match(paymentRequest.url, new RegExp(`/v1/consumer/orders/${paidResponse.orderId}/welfare-card-full-payment$`, 'u'));
  assert.deepEqual({ ...paymentRequest.data }, { accountId: response.accounts[0].id });
  assert.match(paymentRequest.header['Idempotency-Key'], /^welfare-full-/u);
  assert.doesNotMatch(JSON.stringify(paymentRequest), /companyId|consumerUserId|buyerId|supplierId|price|amount/iu);
});

test('P0-055 checkout preserves the payment idempotency key after timeout and refuses partial-card submission', async () => {
  const unknown = loadPage({ failPayment: true });
  await unknown.definition.onLoad.call(unknown.definition);
  unknown.definition.selectAccount.call(unknown.definition, { currentTarget: { dataset: { accountId: response.accounts[0].id } } });
  await unknown.definition.submitFullWelfarePayment.call(unknown.definition);
  assert.equal(unknown.definition.data.state, 'unknown');
  const firstKey = unknown.requests.at(-1).header['Idempotency-Key'];
  await unknown.definition.submitFullWelfarePayment.call(unknown.definition);
  assert.equal(unknown.requests.at(-1).header['Idempotency-Key'], firstKey);

  const partial = loadPage({ responseBody: {
    ...response,
    accounts: [{ ...response.accounts[0], maximumDeductibleAmount: 6_999 }],
  } });
  await partial.definition.onLoad.call(partial.definition);
  partial.definition.selectAccount.call(partial.definition, { currentTarget: { dataset: { accountId: response.accounts[0].id } } });
  await partial.definition.submitFullWelfarePayment.call(partial.definition);
  assert.equal(partial.requests.filter(({ url }) => url.includes('/welfare-card-full-payment')).length, 0);
  assert.match(partial.definition.data.message, /无法全额支付/u);
});

test('P0-056 checkout starts mixed payment from one user gesture with server amounts and one wx.requestPayment call', async () => {
  const runtime = loadPage({ responseBody: {
    ...response,
    accounts: [{ ...response.accounts[0], availableAmount: 4_000, maximumDeductibleAmount: 4_000 }],
  } });
  await runtime.definition.onLoad.call(runtime.definition);
  runtime.definition.selectAccount.call(runtime.definition, { currentTarget: { dataset: { accountId: response.accounts[0].id } } });
  await runtime.definition.submitSelectedPayment.call(runtime.definition);
  const request = runtime.requests.find(({ url }) => url.includes('/welfare-card-wechat-payment'));
  assert.equal(request.method, 'POST');
  assert.deepEqual({ ...request.data }, { accountId: response.accounts[0].id });
  assert.match(request.header['Idempotency-Key'], /^welfare-wechat-/u);
  assert.equal(runtime.requestPayments.length, 1);
  assert.deepEqual(
    (({ timeStamp, nonceStr, package: paymentPackage, signType, paySign }) => ({ timeStamp, nonceStr, package: paymentPackage, signType, paySign }))(runtime.requestPayments[0]),
    mixedResponse.clientPayment,
  );
  assert.equal(runtime.definition.data.state, 'unknown');
  assert.match(runtime.definition.data.message, /结果待确认/u);
  assert.doesNotMatch(JSON.stringify(request), /companyId|consumerUserId|buyerId|supplierId|price|amount/iu);
});
