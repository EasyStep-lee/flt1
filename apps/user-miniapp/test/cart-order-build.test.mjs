import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const items = [
  ['30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '供应来源甲', '商品甲', 1, 1200],
  ['30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '供应来源乙', '商品乙', 2, 2300],
  ['30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '供应来源丙', '商品丙', 3, 3400],
].map(([skuId, supplierId, supplierLabel, productName, quantity, retailSalePrice]) => ({
  skuId, supplierId, supplierLabel, productName, quantity, retailSalePrice,
}));

const orderResponse = {
  orderId: '60000000-0000-4000-8000-000000000001',
  orderNo: 'FS202608140000000001',
  orderType: 'CONSUMER',
  sellerName: '江苏福礼团供应链科技有限公司',
  checkoutMode: 'COMPANY_UNIFIED',
  goodsAmount: 16000,
  deliveryFee: 0,
  discountAmount: 0,
  totalAmount: 16000,
  paymentStatus: 'PENDING',
  orderStatus: 'PENDING_PAYMENT',
  items: [],
  supplierFulfillments: [],
};

const loadBuiltPage = ({ failFirst = false } = {}) => {
  let definition;
  let attempts = 0;
  const requests = [];
  const storage = new Map([['fulishe.pendingCartItems', structuredClone(items)]]);
  const context = vm.createContext({
    console,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value) => { definition = value; },
    Promise,
    wx: {
      getStorageSync: (key) => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
      removeStorageSync: (key) => storage.delete(key),
      request: (options) => {
        attempts += 1;
        requests.push({ data: structuredClone(options.data), header: structuredClone(options.header), method: options.method, url: options.url });
        if (failFirst && attempts === 1) return options.fail();
        return options.success({ data: orderResponse, statusCode: attempts === 1 ? 201 : 200 });
      },
    },
  });
  vm.runInContext(readFileSync(path.join(packageRoot, 'dist', 'pages', 'cart', 'index.js'), 'utf8'), context);
  definition.setData = (patch) => Object.assign(definition.data, patch);
  return { definition, requests, storage };
};

test('P0-022 cart groups three suppliers but submits only SKU and quantity to one company order endpoint', async () => {
  const runtime = loadBuiltPage();
  runtime.definition.onLoad.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'ready');
  assert.equal(runtime.definition.data.groups.length, 3);
  assert.equal(runtime.definition.data.totalAmountLabel, '¥160.00');
  await runtime.definition.submitOrder.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.orderNo, orderResponse.orderNo);
  assert.equal(runtime.requests.length, 1);
  assert.equal(runtime.requests[0].method, 'POST');
  assert.match(runtime.requests[0].url, /\/v1\/consumer\/orders$/u);
  assert.deepEqual(
    Array.from(runtime.requests[0].data.items, (item) => ({ ...item })),
    items.map(({ skuId, quantity }) => ({ skuId, quantity })),
  );
  assert.doesNotMatch(JSON.stringify(runtime.requests[0].data), /supplierId|companyId|price|amount|buyerId/iu);
});

test('P0-022 unknown result reuses the exact idempotency key and never creates a client-side second command', async () => {
  const runtime = loadBuiltPage({ failFirst: true });
  runtime.definition.onLoad.call(runtime.definition);
  await runtime.definition.submitOrder.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'unknown');
  assert.match(runtime.definition.data.message, /待确认/u);
  const firstKey = runtime.requests[0].header['Idempotency-Key'];
  await runtime.definition.submitOrder.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.requests[1].header['Idempotency-Key'], firstKey);
  assert.equal(runtime.storage.has('fulishe.pendingOrderCommand'), false);
});
