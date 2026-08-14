import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

const response = (items = [
  {
    productId: '11111111-1111-4111-8111-111111111111',
    supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoryId: '22222222-2222-4222-8222-222222222222',
    name: '员工关怀礼盒',
    retailSalePrice: 12800,
    activeSkuCount: 2,
    media: [{ url: 'https://cdn.example.test/gift-box.webp', alt: '员工关怀礼盒' }],
  },
]) => ({
  sellerName: '江苏福礼团供应链科技有限公司',
  checkoutMode: 'COMPANY_UNIFIED',
  region: { code: null, label: '请选择配送区域', status: 'UNSELECTED' },
  page: 1,
  pageSize: 20,
  total: items.length,
  items,
});

const loadBuiltPage = (failuresBeforeSuccess = 0, body = response()) => {
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
    wx: {
      request: (options) => {
        attempts += 1;
        requestedUrl = options.url;
        if (attempts <= failuresBeforeSuccess) {
          options.fail();
          return;
        }
        options.success({ data: body, statusCode: 200 });
      },
    },
  });
  const source = readFileSync(
    path.join(packageRoot, 'dist', 'pages', 'home', 'index.js'),
    'utf8',
  );
  vm.runInContext(source, context);
  definition.setData = (patch) => Object.assign(definition.data, patch);
  return { attempts: () => attempts, definition, requestedUrl: () => requestedUrl };
};

test('P0-020 guest home exposes all personal entrances and only generated retail data', async () => {
  const runtime = loadBuiltPage();
  await runtime.definition.onLoad.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.regionLabel, '请选择配送区域');
  assert.deepEqual(
    Array.from(runtime.definition.data.entrances, ({ id }) => id),
    ['search', 'category', 'campaign', 'welfare-card', 'delivery-region', 'personal-orders'],
  );
  assert.equal(runtime.definition.data.products[0].priceLabel, '¥128.00');
  assert.match(runtime.requestedUrl(), /\/v1\/catalog\/products\?page=1&pageSize=20/u);
  assert.doesNotMatch(
    JSON.stringify(runtime.definition.data),
    /enterprise|supplyPrice|approvedSupplyPrice|supplierPayable|settlement|margin/iu,
  );
});

test('P0-020 home renders honest empty and offline recovery states', async () => {
  const empty = loadBuiltPage(0, response([]));
  await empty.definition.onLoad.call(empty.definition);
  assert.equal(empty.definition.data.state, 'empty');
  assert.match(empty.definition.data.emptyMessage, /暂无可售商品/u);

  const offline = loadBuiltPage(1);
  await offline.definition.onLoad.call(offline.definition);
  assert.equal(offline.definition.data.state, 'error');
  assert.match(offline.definition.data.errorMessage, /网络/u);
  await offline.definition.retry.call(offline.definition);
  assert.equal(offline.definition.data.state, 'success');
  assert.equal(offline.attempts(), 2);
});

test('P0-020 app navigation is exactly four personal tabs and never includes orders or enterprise', () => {
  const app = JSON.parse(readFileSync(path.join(packageRoot, 'dist', 'app.json'), 'utf8'));
  assert.equal(app.pages[0], 'pages/home/index');
  assert.deepEqual(
    app.tabBar.list.map(({ pagePath, text }) => ({ pagePath, text })),
    [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/category/index', text: '分类' },
      { pagePath: 'pages/cart/index', text: '购物车' },
      { pagePath: 'pages/profile/index', text: '我的' },
    ],
  );
  assert.doesNotMatch(JSON.stringify(app.tabBar), /订单|enterprise|企业采购/iu);
});
