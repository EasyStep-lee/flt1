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

const loadBuiltPage = (failuresBeforeSuccess = 0, responseBody = response()) => {
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
        options.success({ data: responseBody, statusCode: 200 });
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

test('P0-014 renders FRESH traceability, weighing and company after-sales through miniapp-kit', async () => {
  const freshResponse = {
    ...response(),
    templateProfile: 'FRESH',
    name: '红颜草莓',
    brand: null,
    retailSalePrice: 1990,
    skus: [{
      skuId: '33333333-3333-4333-8333-333333333333',
      retailSalePrice: 1990,
      specifications: [
        { key: 'weight-tier', label: '重量档', value: '500克档' },
        { key: 'specification', label: '规格', value: '篮装' },
        { key: 'processing-method', label: '处理方式', value: '原果' },
      ],
    }],
    detailModules: [
      {
        key: 'origin-traceability', title: '产地溯源', kind: 'FIELDS', notice: null,
        fields: [{ key: 'origin', label: '产地', value: '江苏连云港' }],
      },
      {
        key: 'weighing-difference', title: '称重差异', kind: 'FIELDS', notice: null,
        fields: [{ key: 'weighing-rule', label: '称重规则', value: '按实际称重计价' }],
      },
      {
        key: 'fresh-after-sales', title: '生鲜售后规则', kind: 'AFTER_SALE', fields: [],
        notice: '由江苏福礼团供应链科技有限公司统一受理。',
      },
    ],
  };
  const runtime = loadBuiltPage(0, freshResponse);
  await runtime.definition.onLoad.call(runtime.definition, { productId });
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.profileLabel, '生鲜详情');
  assert.equal(runtime.definition.data.priceLabel, '¥19.90');
  assert.match(runtime.definition.data.skus[0].specificationLabel, /重量档：500克档/u);
  assert.match(runtime.definition.data.detailModules.at(-1).notice, /江苏福礼团/u);
  assert.match(runtime.requestedUrl(), new RegExp(`/v1/catalog/products/${productId}`, 'u'));
});

test('P0-015 renders APPAREL size, material, care and company return rules through miniapp-kit', async () => {
  const apparelResponse = {
    ...response(),
    templateProfile: 'APPAREL',
    name: '通勤棉衬衫',
    retailSalePrice: 9900,
    skus: [{
      skuId: '33333333-3333-4333-8333-333333333333',
      retailSalePrice: 9900,
      specifications: [
        { key: 'color', label: '颜色', value: '暖红' },
        { key: 'size', label: '尺码', value: 'M' },
      ],
    }],
    detailModules: [
      {
        key: 'size-assistant', title: '尺码助手', kind: 'FIELDS', notice: null,
        fields: [
          { key: 'fit', label: '版型', value: '常规版型' },
          { key: 'size-chart', label: '尺码表', value: 'M：胸围100cm/衣长68cm' },
        ],
      },
      {
        key: 'materials', title: '材质说明', kind: 'FIELDS', notice: null,
        fields: [{ key: 'fabric', label: '面料', value: '棉 95%、氨纶 5%' }],
      },
      {
        key: 'care-instructions', title: '洗护说明', kind: 'FIELDS', notice: null,
        fields: [{ key: 'care-instructions', label: '洗护方式', value: '冷水轻柔洗涤' }],
      },
      {
        key: 'apparel-after-sales', title: '试穿与退换说明', kind: 'AFTER_SALE', fields: [],
        notice: '由江苏福礼团供应链科技有限公司统一受理。',
      },
    ],
  };
  const runtime = loadBuiltPage(0, apparelResponse);
  await runtime.definition.onLoad.call(runtime.definition, { productId });
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.profileLabel, '服饰详情');
  assert.equal(runtime.definition.data.priceLabel, '¥99.00');
  assert.equal(runtime.definition.data.skus[0].specificationLabel, '颜色：暖红 · 尺码：M');
  assert.match(runtime.definition.data.detailModules[0].fields[1].value, /胸围100cm/u);
  assert.match(runtime.definition.data.detailModules.at(-1).notice, /江苏福礼团/u);
  assert.match(runtime.requestedUrl(), new RegExp(`/v1/catalog/products/${productId}`, 'u'));
});
