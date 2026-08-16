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
  }],
};

const loadPage = ({ fail = false, responseBody = response } = {}) => {
  let definition;
  const requests = [];
  const storage = new Map([['fulishe.pendingCartItems', structuredClone(cartItems)]]);
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
        if (fail) return options.fail({ errMsg: 'request:fail timeout' });
        return options.success({ data: structuredClone(responseBody), statusCode: 200 });
      },
    },
  });
  vm.runInContext(readFileSync(path.join(packageRoot, 'dist', 'pages', 'checkout', 'index.js'), 'utf8'), context);
  definition.setData = (patch) => Object.assign(definition.data, patch);
  return { definition, requests, storage };
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

test('PAGE-056 exposes loading, empty, error, permission, offline and success states without payment claims', async () => {
  const app = JSON.parse(readFileSync(path.join(packageRoot, 'dist', 'app.json'), 'utf8'));
  assert.ok(app.pages.includes('pages/checkout/index'));
  const template = readFileSync(path.join(packageRoot, 'dist', 'pages', 'checkout', 'index.wxml'), 'utf8');
  assert.match(template, /loading|empty|error|permission|offline|success/iu);
  assert.doesNotMatch(template, /支付成功|已扣款|充值|提现|转让/iu);
  const offline = loadPage({ fail: true });
  await offline.definition.onLoad.call(offline.definition);
  assert.equal(offline.definition.data.state, 'offline');
});
