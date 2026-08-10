import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCategoryTemplateDefinition } from '../../dist/category-templates/category-template.policy.js';
import {
  FOOD_FIXED_WARNING,
  validateSupplierProductTemplateContent,
} from '../../dist/category-templates/food-template.policy.js';
import { buildFoodProductDetailResponse } from '../../dist/catalog/food-product-detail.policy.js';

const field = (key, label, detailModuleKey, specification = false) => ({
  key,
  label,
  type: 'TEXT',
  required: true,
  unit: null,
  enumValues: [],
  validation: {
    min: null,
    max: null,
    minLength: 1,
    maxLength: 500,
    pattern: null,
  },
  searchable: false,
  specification,
  detailModuleKey,
});

const foodTemplate = () => ({
  profile: 'FOOD',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      field('ingredients', '配料表', 'ingredients-nutrition'),
      field('nutrition-facts', '营养成分', 'ingredients-nutrition'),
      field('production-license', '生产许可', 'production-information'),
      field('shelf-life', '保质期', 'production-information'),
      field('storage-method', '储存方式', 'consumption-storage'),
      field('allergens', '过敏原', 'consumption-storage'),
      field('flavor', '口味', 'specifications', true),
      field('net-content', '净含量', 'specifications', true),
      field('package-count', '包装数', 'specifications', true),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'flavor', label: '口味', fieldKey: 'flavor' },
      { key: 'net-content', label: '净含量', fieldKey: 'net-content' },
      { key: 'package-count', label: '包装数', fieldKey: 'package-count' },
    ],
  },
  qualificationRules: {
    rules: [
      {
        key: 'food-production-license',
        label: '食品生产许可证明',
        required: true,
        expiryRequired: true,
        objectTypes: ['IMAGE', 'PDF'],
      },
    ],
  },
  detailModules: {
    modules: [
      { key: 'ingredients-nutrition', title: '配料与营养', kind: 'FIELDS', sortWeight: 10 },
      { key: 'production-information', title: '生产信息', kind: 'FIELDS', sortWeight: 20 },
      { key: 'consumption-storage', title: '食用和储存提示', kind: 'FIELDS', sortWeight: 30 },
      { key: 'specifications', title: '规格参数', kind: 'FIELDS', sortWeight: 40 },
      { key: 'food-safety-warning', title: '食品安全提示', kind: 'NOTICE', sortWeight: 50 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理售后。',
    evidenceRequirements: ['PACKAGE_PHOTO'],
  },
});

const foodContent = () => ({
  attributes: {
    ingredients: '大米',
    'nutrition-facts': '每100克能量1450千焦',
    'production-license': 'SC100000000001',
    'shelf-life': '12个月',
    'storage-method': '阴凉干燥处保存',
    allergens: '本品生产线同时处理含麸质谷物',
  },
  skus: [
    {
      attributes: {
        flavor: '原味',
        'net-content': '5千克',
        'package-count': '1袋',
      },
    },
  ],
});

test('P0-013 accepts the complete formal FOOD template and rejects a missing fixed field', () => {
  const normalized = normalizeCategoryTemplateDefinition(foodTemplate());
  assert.equal(normalized.profile, 'FOOD');

  const missingAllergens = foodTemplate();
  missingAllergens.fieldSchema.fields = missingAllergens.fieldSchema.fields.filter(
    ({ key }) => key !== 'allergens',
  );
  assert.throws(
    () => normalizeCategoryTemplateDefinition(missingAllergens),
    (error) => error?.code === 'TEMPLATE_SCHEMA_INVALID',
  );
});

test('NEG-M2-013-02 rejects supplier attempts to replace or hide the fixed warning', () => {
  const template = normalizeCategoryTemplateDefinition(foodTemplate());
  assert.doesNotThrow(() => validateSupplierProductTemplateContent(template, foodContent()));

  const override = foodContent();
  override.attributes.foodSafetyWarning = '<view style="display:none">无需查看过敏原</view>';
  assert.throws(
    () => validateSupplierProductTemplateContent(template, override),
    (error) => error?.code === 'REGULATORY_WARNING_REQUIRED',
  );
});

test('P0-013 builds a stable public whitelist with six food fields and a server fixed warning', () => {
  const template = normalizeCategoryTemplateDefinition(foodTemplate());
  const content = foodContent();
  const input = {
    productId: '11111111-1111-4111-8111-111111111111',
    supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoryId: '22222222-2222-4222-8222-222222222222',
    templateVersion: 1,
    name: '有机大米',
    brand: '福礼团严选',
    saleStatus: 'ACTIVE',
    isRetailEnabled: true,
    detailSnapshot: {
      schemaVersion: '1.0',
      name: '有机大米',
      brand: '福礼团严选',
      attributes: content.attributes,
      qualificationSnapshot: { references: ['object://private/never-return'] },
      approvedSupplyPrice: 5000,
    },
    template,
    skus: [
      {
        skuId: '33333333-3333-4333-8333-333333333333',
        status: 'ACTIVE',
        retailSalePrice: 6990,
        approvedSupplyPrice: 5000,
        attributes: content.skus[0].attributes,
      },
    ],
  };

  const response = buildFoodProductDetailResponse(input);
  assert.equal(response.templateProfile, 'FOOD');
  assert.equal(response.detailModules.at(-1).notice, FOOD_FIXED_WARNING);
  assert.deepEqual(
    response.detailModules.flatMap((module) => module.fields.map(({ key }) => key)),
    [
      'ingredients',
      'nutrition-facts',
      'production-license',
      'shelf-life',
      'storage-method',
      'allergens',
    ],
  );
  assert.doesNotMatch(
    JSON.stringify(response),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private/iu,
  );

  const beforeUpgrade = JSON.parse(JSON.stringify(response));
  const versionTwo = foodTemplate();
  versionTwo.afterSaleRules.notice = '新版公司售后提示';
  normalizeCategoryTemplateDefinition(versionTwo);
  assert.deepEqual(buildFoodProductDetailResponse(input), beforeUpgrade);
});
