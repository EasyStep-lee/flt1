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

test('P0-021 retail miniapp state keeps only retail prices when transport data is tainted', async () => {
  const tainted = response();
  tainted.enterpriseSalePrice = 6190;
  tainted.supplyPrice = 5000;
  tainted.grossMargin = 1990;
  tainted.skus[0].enterpriseSalePrice = 6190;
  tainted.skus[0].supplyPrice = 5000;
  const runtime = loadBuiltPage(0, tainted);
  await runtime.definition.onLoad.call(runtime.definition, { productId });
  assert.equal(runtime.definition.data.priceLabel, '¥69.90');
  assert.doesNotMatch(
    JSON.stringify(runtime.definition.data),
    /enterpriseSalePrice|supplyPrice|grossMargin|¥61\.90|¥50\.00/iu,
  );
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

test('P0-016 renders DIGITAL models, parameters, energy, package and company warranty through miniapp-kit', async () => {
  const digitalResponse = {
    ...response(),
    templateProfile: 'DIGITAL',
    name: '高效办公一体机',
    retailSalePrice: 399900,
    skus: [{
      skuId: '33333333-3333-4333-8333-333333333333',
      retailSalePrice: 399900,
      specifications: [
        { key: 'color', label: '颜色', value: '白色' },
        { key: 'capacity', label: '容量', value: '512GB' },
        { key: 'model', label: '型号', value: 'FL-D2' },
      ],
    }],
    detailModules: [
      {
        key: 'technical-parameters', title: '规格参数', kind: 'FIELDS', notice: null,
        fields: [
          { key: 'power', label: '功率', value: '65W' },
          { key: 'voltage', label: '电压', value: '220V' },
        ],
      },
      {
        key: 'energy-efficiency', title: '能效信息', kind: 'FIELDS', notice: null,
        fields: [{ key: 'energy-efficiency', label: '能效', value: '一级能效' }],
      },
      {
        key: 'package-and-installation', title: '包装与安装', kind: 'FIELDS', notice: null,
        fields: [{ key: 'package-list', label: '包装清单', value: '主机×1、适配器×1' }],
      },
      {
        key: 'warranty', title: '保修信息', kind: 'FIELDS', notice: null,
        fields: [{ key: 'warranty-period', label: '保修期', value: '整机一年' }],
      },
      {
        key: 'digital-after-sales', title: '安装与保修服务', kind: 'AFTER_SALE', fields: [],
        notice: '由江苏福礼团供应链科技有限公司统一受理。',
      },
    ],
  };
  const runtime = loadBuiltPage(0, digitalResponse);
  await runtime.definition.onLoad.call(runtime.definition, { productId });
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.profileLabel, '数码详情');
  assert.equal(runtime.definition.data.priceLabel, '¥3999.00');
  assert.equal(
    runtime.definition.data.skus[0].specificationLabel,
    '颜色：白色 · 容量：512GB · 型号：FL-D2',
  );
  assert.equal(runtime.definition.data.detailModules[1].fields[0].value, '一级能效');
  assert.match(runtime.definition.data.detailModules.at(-1).notice, /江苏福礼团/u);
  assert.match(runtime.requestedUrl(), new RegExp(`/v1/catalog/products/${productId}`, 'u'));
});

test('P0-017 renders GIFT_BOX child quantities, specifications and minimum expiry through miniapp-kit', async () => {
  const giftBoxResponse = {
    ...response(),
    templateProfile: 'GIFT_BOX',
    name: '员工关怀礼盒',
    retailSalePrice: 26800,
    bundleItems: [
      { name: '有机大米', quantity: 2, specification: '2.5kg/袋', minimumExpiryDays: 180 },
      { name: '坚果组合', quantity: 1, specification: '750g/盒', minimumExpiryDays: 120 },
    ],
    skus: [{
      skuId: '33333333-3333-4333-8333-333333333333',
      retailSalePrice: 26800,
      specifications: [
        { key: 'package', label: '套餐', value: '经典套餐' },
        { key: 'tier', label: '档位', value: 'A档' },
        { key: 'custom-version', label: '定制版本', value: '标准版' },
      ],
    }],
    detailModules: [
      {
        key: 'welfare-scenario', title: '福利场景', kind: 'FIELDS', notice: null,
        fields: [{ key: 'welfare-scenario', label: '福利场景', value: '企业节日福利' }],
      },
      {
        key: 'gift-box-after-sales', title: '统一售后口径', kind: 'AFTER_SALE', fields: [],
        notice: '由江苏福礼团供应链科技有限公司统一受理礼盒售后。',
      },
    ],
  };
  const runtime = loadBuiltPage(0, giftBoxResponse);
  await runtime.definition.onLoad.call(runtime.definition, { productId });
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.profileLabel, '礼盒详情');
  assert.equal(runtime.definition.data.priceLabel, '¥268.00');
  assert.equal(runtime.definition.data.bundleItems[0].quantityLabel, '× 2');
  assert.equal(runtime.definition.data.bundleItems[0].specification, '2.5kg/袋');
  assert.equal(runtime.definition.data.bundleItems[0].minimumExpiryLabel, '有效期下限 180 天');
  assert.equal(
    runtime.definition.data.skus[0].specificationLabel,
    '套餐：经典套餐 · 档位：A档 · 定制版本：标准版',
  );
  assert.match(runtime.definition.data.detailModules.at(-1).notice, /江苏福礼团/u);
  assert.match(runtime.requestedUrl(), new RegExp(`/v1/catalog/products/${productId}`, 'u'));
});
