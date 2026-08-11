import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCategoryTemplateDefinition } from '../../dist/category-templates/category-template.policy.js';
import { validateApparelSupplierProductTemplateContent } from '../../dist/category-templates/apparel-template.policy.js';
import { buildApparelProductDetailResponse } from '../../dist/catalog/apparel-product-detail.policy.js';

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

const apparelTemplate = () => ({
  profile: 'APPAREL',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      field('fabric', '面料', 'materials'),
      field('lining', '里料', 'materials'),
      field('fit', '版型', 'size-assistant'),
      field('execution-standard', '执行标准', 'materials'),
      field('care-instructions', '洗护方式', 'care-instructions'),
      field('size-chart', '尺码表', 'size-assistant', { type: 'RICH_TEXT' }),
      field('color', '颜色', 'specifications', { specification: true }),
      field('size', '尺码', 'specifications', { specification: true }),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'color', label: '颜色', fieldKey: 'color' },
      { key: 'size', label: '尺码', fieldKey: 'size' },
    ],
  },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [
      { key: 'size-assistant', title: '尺码助手', kind: 'FIELDS', sortWeight: 10 },
      { key: 'materials', title: '材质说明', kind: 'FIELDS', sortWeight: 20 },
      { key: 'care-instructions', title: '洗护说明', kind: 'FIELDS', sortWeight: 30 },
      { key: 'specifications', title: '颜色与尺码', kind: 'FIELDS', sortWeight: 40 },
      { key: 'apparel-after-sales', title: '试穿与退换说明', kind: 'AFTER_SALE', sortWeight: 50 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理；退换商品须保持未洗涤、未污损且不影响二次销售。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'PRODUCT_PHOTO'],
  },
});

const apparelContent = () => ({
  attributes: {
    fabric: '棉 95%、氨纶 5%',
    lining: '棉 100%',
    fit: '常规版型',
    'execution-standard': 'GB/T 2660-2017',
    'care-instructions': '冷水轻柔洗涤，不可漂白，悬挂晾干',
    'size-chart': 'M：胸围100cm/衣长68cm；L：胸围104cm/衣长70cm',
  },
  skus: [
    { attributes: { color: '暖红', size: 'M' } },
    { attributes: { color: '暖红', size: 'L' } },
  ],
});

test('NEG-M2-015-01 accepts the formal APPAREL template and rejects missing material fields', () => {
  const normalized = normalizeCategoryTemplateDefinition(apparelTemplate());
  assert.equal(normalized.profile, 'APPAREL');
  const incomplete = apparelTemplate();
  incomplete.fieldSchema.fields = incomplete.fieldSchema.fields.filter(({ key }) => key !== 'fabric');
  assert.throws(
    () => normalizeCategoryTemplateDefinition(incomplete),
    (error) => error?.code === 'TEMPLATE_SCHEMA_INVALID',
  );
});

test('NEG-M2-015-01 and NEG-M2-015-02 reject missing product fields and duplicate color-size SKUs', () => {
  const template = normalizeCategoryTemplateDefinition(apparelTemplate());
  const missing = apparelContent();
  delete missing.attributes['size-chart'];
  assert.throws(
    () => validateApparelSupplierProductTemplateContent(template, missing),
    (error) => error?.code === 'APPAREL_REQUIRED_FIELD_MISSING',
  );

  const duplicate = apparelContent();
  duplicate.skus[1].attributes = { color: ' 暖红 ', size: 'ｍ' };
  assert.throws(
    () => validateApparelSupplierProductTemplateContent(template, duplicate),
    (error) => error?.code === 'SKU_DIMENSION_DUPLICATE',
  );
});

test('P0-015 builds the public apparel whitelist, color-size SKUs and company return rule', () => {
  const template = normalizeCategoryTemplateDefinition(apparelTemplate());
  const content = apparelContent();
  const source = {
    productId: '11111111-1111-4111-8111-111111111111',
    supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoryId: '22222222-2222-4222-8222-222222222222',
    templateVersion: 1,
    name: '通勤棉衬衫',
    saleStatus: 'ACTIVE',
    isRetailEnabled: true,
    detailSnapshot: {
      name: '通勤棉衬衫',
      brand: '福礼团严选',
      attributes: content.attributes,
      qualificationSnapshot: { references: ['object://private/never-return'] },
      approvedSupplyPrice: 6900,
    },
    template,
    skus: content.skus.map((sku, index) => ({
      skuId: `${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}-${index + 3}${index + 3}${index + 3}${index + 3}-4${index + 3}${index + 3}${index + 3}-8${index + 3}${index + 3}${index + 3}-${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}${index + 3}`,
      status: 'ACTIVE',
      retailSalePrice: 9900 + index * 100,
      approvedSupplyPrice: 6900,
      attributes: sku.attributes,
    })),
  };
  const response = buildApparelProductDetailResponse(source);
  assert.equal(response.templateProfile, 'APPAREL');
  assert.deepEqual(
    response.detailModules.flatMap((module) => module.fields.map(({ key }) => key)),
    ['fit', 'size-chart', 'fabric', 'lining', 'execution-standard', 'care-instructions'],
  );
  assert.deepEqual(response.skus[0].specifications.map(({ key }) => key), ['color', 'size']);
  assert.equal(response.detailModules.at(-1).kind, 'AFTER_SALE');
  assert.match(response.detailModules.at(-1).notice, /江苏福礼团/u);
  assert.doesNotMatch(
    JSON.stringify(response),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private|settlement/iu,
  );

  const before = JSON.parse(JSON.stringify(response));
  const laterTemplate = apparelTemplate();
  laterTemplate.afterSaleRules.notice = '由江苏福礼团供应链科技有限公司统一受理；这是后续版本退换口径。';
  normalizeCategoryTemplateDefinition(laterTemplate);
  assert.deepEqual(buildApparelProductDetailResponse(source), before);
});
