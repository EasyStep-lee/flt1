import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const productId = '11111111-1111-4111-8111-111111111111';

const response = () => ({
  productId,
  supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  categoryId: '22222222-2222-4222-8222-222222222222',
  templateVersion: 1,
  templateProfile: 'FOOD',
  name: '有机大米',
  brand: '福礼团严选',
  sellerName: '江苏福礼团供应链科技有限公司',
  checkoutMode: 'COMPANY_UNIFIED',
  retailSalePrice: 6990,
  skus: [
    {
      skuId: '33333333-3333-4333-8333-333333333333',
      retailSalePrice: 6990,
      specifications: [
        { key: 'flavor', label: '口味', value: '原味' },
        { key: 'net-content', label: '净含量', value: '5千克' },
        { key: 'package-count', label: '包装数', value: '1袋' },
      ],
    },
  ],
  detailModules: [
    {
      key: 'ingredients-nutrition',
      title: '配料与营养',
      kind: 'FIELDS',
      fields: [
        { key: 'ingredients', label: '配料表', value: '大米' },
        { key: 'nutrition-facts', label: '营养成分', value: '每100克能量1450千焦' },
      ],
      notice: null,
    },
    {
      key: 'food-safety-warning',
      title: '食品安全提示',
      kind: 'FIXED_NOTICE',
      fields: [],
      notice: '食品信息以商品实际包装标签为准；食用前请核对过敏原、保质期和储存条件。',
    },
  ],
});

const loadBuiltPage = (failuresBeforeSuccess = 0) => {
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
        options.success({ data: response(), statusCode: 200 });
      },
    },
  });
  const source = readFileSync(
    path.join(packageRoot, 'dist', 'pages', 'product-detail', 'index.js'),
    'utf8',
  );
  vm.runInContext(source, context);
  definition.setData = (patch) => Object.assign(definition.data, patch);
  return { attempts: () => attempts, definition, requestedUrl: () => requestedUrl };
};

test('P0-013 loads the generated food detail contract through miniapp-kit', async () => {
  const runtime = loadBuiltPage();
  await runtime.definition.onLoad.call(runtime.definition, { productId });
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.name, '有机大米');
  assert.equal(runtime.definition.data.priceLabel, '¥69.90');
  assert.equal(runtime.definition.data.skus[0].specificationLabel, '口味：原味 · 净含量：5千克 · 包装数：1袋');
  assert.match(runtime.definition.data.detailModules.at(-1).notice, /实际包装标签/u);
  assert.match(runtime.requestedUrl(), new RegExp(`/v1/catalog/products/${productId}`, 'u'));
});

test('P0-013 exposes an honest offline error and retries the same product', async () => {
  const runtime = loadBuiltPage(1);
  await runtime.definition.onLoad.call(runtime.definition, { productId });
  assert.equal(runtime.definition.data.state, 'error');
  assert.equal(runtime.definition.data.errorMessage, '详情加载失败，请检查网络后重试');
  await runtime.definition.retry.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.attempts(), 2);
});

test('P0-013 refuses an invalid product identifier before any request', async () => {
  const runtime = loadBuiltPage();
  await runtime.definition.onLoad.call(runtime.definition, { productId: 'invalid' });
  assert.equal(runtime.definition.data.state, 'error');
  assert.equal(runtime.definition.data.errorMessage, '商品参数无效');
  assert.equal(runtime.attempts(), 0);
});
