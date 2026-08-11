import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCategoryTemplateDefinition } from '../../dist/category-templates/category-template.policy.js';
import {
  assertGiftBoxChildReferencesOwned,
  validateGiftBoxSupplierProductTemplateContent,
} from '../../dist/category-templates/gift-box-template.policy.js';
import { buildGiftBoxProductDetailResponse } from '../../dist/catalog/gift-box-product-detail.policy.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const field = (
  key,
  label,
  detailModuleKey,
  { specification = false, type = 'TEXT' } = {},
) => ({
  key,
  label,
  type,
  required: true,
  unit: null,
  enumValues: [],
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false,
  specification,
  detailModuleKey,
});

const giftBoxTemplate = () => ({
  profile: 'GIFT_BOX',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      field('bundle-items', '组合清单', 'bundle-list', { type: 'BUNDLE_ITEMS' }),
      field('packaging', '包装说明', 'customization'),
      field('customization', '定制项', 'customization'),
      field('delivery-cycle', '交付周期', 'customization'),
      field('welfare-scenario', '福利场景', 'welfare-scenario'),
      field('package', '套餐', 'specifications', { specification: true }),
      field('tier', '档位', 'specifications', { specification: true }),
      field('custom-version', '定制版本', 'specifications', { specification: true }),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'package', label: '套餐', fieldKey: 'package' },
      { key: 'tier', label: '档位', fieldKey: 'tier' },
      { key: 'custom-version', label: '定制版本', fieldKey: 'custom-version' },
    ],
  },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [
      { key: 'bundle-list', title: '组合清单', kind: 'FIELDS', sortWeight: 10 },
      { key: 'welfare-scenario', title: '福利场景', kind: 'FIELDS', sortWeight: 20 },
      { key: 'customization', title: '定制说明', kind: 'FIELDS', sortWeight: 30 },
      { key: 'specifications', title: '套餐规格', kind: 'FIELDS', sortWeight: 40 },
      { key: 'gift-box-after-sales', title: '统一售后口径', kind: 'AFTER_SALE', sortWeight: 50 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'COMPANY_STANDARD',
    notice: '由江苏福礼团供应链科技有限公司统一受理礼盒售后。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'PRODUCT_PHOTO'],
  },
});

const ownChildId = '22222222-2222-4222-8222-222222222222';
const foreignChildId = '33333333-3333-4333-8333-333333333333';
const giftBoxContent = () => ({
  attributes: {
    'bundle-items': [
      {
        supplierProductId: ownChildId,
        name: '有机大米',
        quantity: 2,
        specification: '2.5kg/袋',
        minimumExpiryDays: 180,
      },
      {
        name: '坚果组合',
        quantity: 1,
        specification: '750g/盒',
        minimumExpiryDays: 120,
      },
    ],
    packaging: '节庆礼盒与手提袋',
    customization: '支持企业贺卡，不支持改写商品标签',
    'delivery-cycle': '确认定制稿后 7 个工作日',
    'welfare-scenario': '企业节日福利与员工慰问',
  },
  skus: [
    { attributes: { package: '经典套餐', tier: 'A档', 'custom-version': '标准版' } },
    { attributes: { package: '经典套餐', tier: 'B档', 'custom-version': '企业贺卡版' } },
  ],
});

test('NEG-M2-017-01 rejects a gift box item without quantity, specification or minimum expiry', () => {
  const template = normalizeCategoryTemplateDefinition(giftBoxTemplate());
  const content = giftBoxContent();
  content.attributes['bundle-items'][0].quantity = 0;
  assert.throws(
    () => validateGiftBoxSupplierProductTemplateContent(template, content),
    (error) => error?.code === 'BUNDLE_SCHEMA_INVALID',
  );
});

test('NEG-M2-017-02 rejects an editable child reference outside the current supplier scope', async () => {
  const template = normalizeCategoryTemplateDefinition(giftBoxTemplate());
  const content = giftBoxContent();
  content.attributes['bundle-items'][1].supplierProductId = foreignChildId;
  const references = validateGiftBoxSupplierProductTemplateContent(template, content);
  await assert.rejects(
    () => assertGiftBoxChildReferencesOwned(references, async (id) => id === ownChildId),
    (error) => error?.code === 'SUPPLIER_SCOPE_FORBIDDEN',
  );
});

test('P0-017 builds an immutable public gift-box snapshot without internal child references', () => {
  const template = normalizeCategoryTemplateDefinition(giftBoxTemplate());
  const content = giftBoxContent();
  const source = {
    productId: '11111111-1111-4111-8111-111111111111',
    supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoryId: '44444444-4444-4444-8444-444444444444',
    templateVersion: 1,
    name: '员工关怀礼盒',
    saleStatus: 'ACTIVE',
    isRetailEnabled: true,
    detailSnapshot: {
      name: '员工关怀礼盒',
      brand: '福礼团',
      attributes: clone(content.attributes),
      qualificationSnapshot: { references: ['object://private/never-return'] },
      approvedSupplyPrice: 18800,
    },
    template,
    skus: content.skus.map((sku, index) => ({
      skuId: index === 0
        ? '55555555-5555-4555-8555-555555555555'
        : '66666666-6666-4666-8666-666666666666',
      status: 'ACTIVE',
      retailSalePrice: 26800 + index * 1000,
      approvedSupplyPrice: 18800,
      attributes: sku.attributes,
    })),
  };
  const response = buildGiftBoxProductDetailResponse(source);
  assert.equal(response.templateProfile, 'GIFT_BOX');
  assert.deepEqual(response.bundleItems, [
    { name: '有机大米', quantity: 2, specification: '2.5kg/袋', minimumExpiryDays: 180 },
    { name: '坚果组合', quantity: 1, specification: '750g/盒', minimumExpiryDays: 120 },
  ]);
  assert.deepEqual(response.skus[0].specifications.map(({ key }) => key), [
    'package', 'tier', 'custom-version',
  ]);
  assert.match(response.detailModules.at(-1).notice, /江苏福礼团供应链科技有限公司/u);
  assert.doesNotMatch(
    JSON.stringify(response),
    /supplierProductId|approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private|settlement/iu,
  );

  const before = clone(response);
  content.attributes['bundle-items'][0].name = '后续子商品改名';
  assert.deepEqual(buildGiftBoxProductDetailResponse(source), before);
});
