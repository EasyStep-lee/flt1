import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const supplierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const loadBuiltPage = (response, failuresBeforeSuccess = 0) => {
  let definition;
  let requestedUrl;
  let attempts = 0;
  const context = vm.createContext({
    console,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value) => {
      definition = value;
    },
    Promise,
    URLSearchParams,
    wx: {
      request: (options) => {
        attempts += 1;
        requestedUrl = options.url;
        if (attempts <= failuresBeforeSuccess) {
          options.fail();
          return;
        }
        options.success({ data: response, statusCode: 200 });
      },
    },
  });
  const source = readFileSync(
    path.join(packageRoot, 'dist', 'pages', 'supplier-products', 'index.js'),
    'utf8',
  );
  vm.runInContext(source, context);
  definition.setData = (patch) => Object.assign(definition.data, patch);
  return { attempts: () => attempts, definition, requestedUrl: () => requestedUrl };
};

test('PAGE-054 loads same-source products through the built miniapp-kit adapter', async () => {
  const runtime = loadBuiltPage({
    supplierId,
    sourceLabel: '该供应来源的更多商品',
    sellerName: '江苏福礼团供应链科技有限公司',
    checkoutMode: 'COMPANY_UNIFIED',
    page: 1,
    pageSize: 20,
    total: 1,
    items: [
      {
        productId: '11111111-1111-4111-8111-111111111111',
        name: '有机大米礼盒',
        retailSalePrice: 6990,
        activeSkuCount: 1,
      },
    ],
  });

  await runtime.definition.onLoad.call(runtime.definition, { supplierId });
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.items[0].priceLabel, '¥69.90');
  assert.equal(runtime.definition.data.sellerName, '江苏福礼团供应链科技有限公司');
  assert.match(runtime.requestedUrl(), new RegExp(`/v1/catalog/suppliers/${supplierId}/products`, 'u'));
});

test('PAGE-054 keeps an honest empty state for the selected source', async () => {
  const runtime = loadBuiltPage({
    supplierId,
    sourceLabel: '该供应来源的更多商品',
    sellerName: '江苏福礼团供应链科技有限公司',
    checkoutMode: 'COMPANY_UNIFIED',
    page: 1,
    pageSize: 20,
    total: 0,
    items: [],
  });

  await runtime.definition.onLoad.call(runtime.definition, { supplierId });
  assert.equal(runtime.definition.data.state, 'empty');
  assert.deepEqual(runtime.definition.data.items, []);
});

test('PAGE-054 exposes an offline error and retries through the same adapter', async () => {
  const runtime = loadBuiltPage(
    {
      supplierId,
      sourceLabel: '该供应来源的更多商品',
      sellerName: '江苏福礼团供应链科技有限公司',
      checkoutMode: 'COMPANY_UNIFIED',
      page: 1,
      pageSize: 20,
      total: 0,
      items: [],
    },
    1,
  );

  await runtime.definition.onLoad.call(runtime.definition, { supplierId });
  assert.equal(runtime.definition.data.state, 'error');
  assert.equal(runtime.definition.data.errorMessage, '加载失败，请检查网络后重试');
  await runtime.definition.retry.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'empty');
  assert.equal(runtime.attempts(), 2);
});
