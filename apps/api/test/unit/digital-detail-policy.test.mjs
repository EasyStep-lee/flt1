import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCategoryTemplateDefinition } from '../../dist/category-templates/category-template.policy.js';
import { validateDigitalSupplierProductTemplateContent } from '../../dist/category-templates/digital-template.policy.js';
import { buildDigitalProductDetailResponse } from '../../dist/catalog/digital-product-detail.policy.js';

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

const digitalTemplate = () => ({
  profile: 'DIGITAL',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      field('dimensions', '尺寸', 'technical-parameters'),
      field('power', '功率', 'technical-parameters'),
      field('voltage', '电压', 'technical-parameters'),
      field('interfaces', '接口', 'technical-parameters'),
      field('energy-efficiency', '能效', 'energy-efficiency'),
      field('execution-standard', '执行标准', 'technical-parameters'),
      field('package-list', '包装清单', 'package-and-installation', { type: 'RICH_TEXT' }),
      field('installation-instructions', '安装说明', 'package-and-installation', { type: 'RICH_TEXT' }),
      field('warranty-period', '保修期', 'warranty'),
      field('color', '颜色', 'specifications', { specification: true }),
      field('capacity', '容量', 'specifications', { specification: true }),
      field('model', '型号', 'specifications', { specification: true }),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'color', label: '颜色', fieldKey: 'color' },
      { key: 'capacity', label: '容量', fieldKey: 'capacity' },
      { key: 'model', label: '型号', fieldKey: 'model' },
    ],
  },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [
      { key: 'technical-parameters', title: '规格参数', kind: 'FIELDS', sortWeight: 10 },
      { key: 'energy-efficiency', title: '能效信息', kind: 'FIELDS', sortWeight: 20 },
      { key: 'package-and-installation', title: '包装与安装', kind: 'FIELDS', sortWeight: 30 },
      { key: 'warranty', title: '保修信息', kind: 'FIELDS', sortWeight: 40 },
      { key: 'specifications', title: '型号规格', kind: 'FIELDS', sortWeight: 50 },
      { key: 'digital-after-sales', title: '安装与保修服务', kind: 'AFTER_SALE', sortWeight: 60 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理；安装与保修按已发布规则执行。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'PRODUCT_PHOTO'],
  },
});

const digitalContent = () => ({
  attributes: {
    dimensions: '300mm × 200mm × 50mm',
    power: '65W',
    voltage: '220V',
    interfaces: 'USB-C、HDMI',
    'energy-efficiency': '一级能效',
    'execution-standard': 'GB 4943.1-2022',
    'package-list': '主机×1、电源适配器×1、说明书×1',
    'installation-instructions': '接通电源后按说明书完成首次配置',
    'warranty-period': '整机一年',
  },
  skus: [
    { attributes: { color: '白色', capacity: '256GB', model: 'FL-D1' } },
    { attributes: { color: '黑色', capacity: '512GB', model: 'FL-D2' } },
  ],
});

test('NEG-M2-016-01 and NEG-M2-016-02 reject missing digital fields and duplicate normalized model combinations', () => {
  const template = normalizeCategoryTemplateDefinition(digitalTemplate());
  const missing = digitalContent();
  delete missing.attributes['energy-efficiency'];
  assert.throws(
    () => validateDigitalSupplierProductTemplateContent(template, missing),
    (error) => error?.code === 'DIGITAL_REQUIRED_FIELD_MISSING',
  );

  const duplicate = digitalContent();
  duplicate.skus[1].attributes = { color: ' 白色 ', capacity: '２５６ＧＢ', model: ' fl-d1 ' };
  assert.throws(
    () => validateDigitalSupplierProductTemplateContent(template, duplicate),
    (error) => error?.code === 'DIGITAL_MODEL_DUPLICATE',
  );
});

test('P0-016 builds the public digital whitelist with models, parameters, energy, package and warranty', () => {
  const template = normalizeCategoryTemplateDefinition(digitalTemplate());
  const content = digitalContent();
  const source = {
    productId: '11111111-1111-4111-8111-111111111111',
    supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoryId: '22222222-2222-4222-8222-222222222222',
    templateVersion: 1,
    name: '高效办公一体机',
    saleStatus: 'ACTIVE',
    isRetailEnabled: true,
    detailSnapshot: {
      name: '高效办公一体机',
      brand: '福礼团严选',
      attributes: content.attributes,
      qualificationSnapshot: { references: ['object://private/never-return'] },
      approvedSupplyPrice: 299900,
    },
    template,
    skus: content.skus.map((sku, index) => ({
      skuId: `${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}-${index + 3}${index + 3}${index + 3}${index + 3}-4${index + 3}${index + 3}${index + 3}-8${index + 3}${index + 3}${index + 3}-${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}`,
      status: 'ACTIVE',
      retailSalePrice: 399900 + index * 10000,
      approvedSupplyPrice: 299900,
      attributes: sku.attributes,
    })),
  };
  const response = buildDigitalProductDetailResponse(source);
  assert.equal(response.templateProfile, 'DIGITAL');
  assert.deepEqual(
    response.detailModules.flatMap((module) => module.fields.map(({ key }) => key)),
    [
      'dimensions', 'power', 'voltage', 'interfaces', 'execution-standard',
      'energy-efficiency', 'package-list', 'installation-instructions', 'warranty-period',
    ],
  );
  assert.deepEqual(response.skus[0].specifications.map(({ key }) => key), [
    'color', 'capacity', 'model',
  ]);
  assert.equal(response.detailModules.at(-1).kind, 'AFTER_SALE');
  assert.match(response.detailModules.at(-1).notice, /江苏福礼团/u);
  assert.doesNotMatch(
    JSON.stringify(response),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private|settlement/iu,
  );

  const before = JSON.parse(JSON.stringify(response));
  const laterTemplate = digitalTemplate();
  laterTemplate.afterSaleRules.notice = '由江苏福礼团供应链科技有限公司统一受理；这是后续版本保修口径。';
  normalizeCategoryTemplateDefinition(laterTemplate);
  assert.deepEqual(buildDigitalProductDetailResponse(source), before);
});
