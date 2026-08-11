import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCategoryTemplateDefinition } from '../../dist/category-templates/category-template.policy.js';
import { validateFreshSupplierProductTemplateContent } from '../../dist/category-templates/fresh-template.policy.js';
import { buildFreshProductDetailResponse } from '../../dist/catalog/fresh-product-detail.policy.js';

const field = (
  key,
  label,
  detailModuleKey,
  { enumValues = [], specification = false, type = 'TEXT' } = {},
) => ({
  key,
  label,
  type,
  required: true,
  unit: null,
  enumValues,
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false,
  specification,
  detailModuleKey,
});

const freshTemplate = () => ({
  profile: 'FRESH',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      field('variety', '品种', 'origin-traceability'),
      field('grade', '等级', 'origin-traceability'),
      field('origin', '产地', 'origin-traceability'),
      field('harvest-slaughter-date', '采收/屠宰日期', 'freshness-storage', { type: 'DATE' }),
      field('freshness-period', '保鲜期', 'freshness-storage'),
      field('temperature-zone', '温区', 'freshness-storage', {
        type: 'ENUM',
        enumValues: ['AMBIENT', 'CHILLED', 'FROZEN'],
      }),
      field('weighing-rule', '称重规则', 'weighing-difference', {
        type: 'ENUM',
        enumValues: ['FIXED_WEIGHT', 'ACTUAL_WEIGHT'],
      }),
      field('weight-tier', '重量档', 'specifications', { specification: true }),
      field('specification', '规格', 'specifications', { specification: true }),
      field('processing-method', '处理方式', 'specifications', { specification: true }),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'weight-tier', label: '重量档', fieldKey: 'weight-tier' },
      { key: 'specification', label: '规格', fieldKey: 'specification' },
      { key: 'processing-method', label: '处理方式', fieldKey: 'processing-method' },
    ],
  },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [
      { key: 'origin-traceability', title: '产地溯源', kind: 'FIELDS', sortWeight: 10 },
      { key: 'freshness-storage', title: '保鲜与温区', kind: 'FIELDS', sortWeight: 20 },
      { key: 'weighing-difference', title: '称重差异', kind: 'FIELDS', sortWeight: 30 },
      { key: 'specifications', title: '规格参数', kind: 'FIELDS', sortWeight: 40 },
      { key: 'fresh-after-sales', title: '生鲜售后规则', kind: 'AFTER_SALE', sortWeight: 50 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'CATEGORY_RESTRICTED',
    notice: '由江苏福礼团供应链科技有限公司统一受理；称重差异按实际称重和已审核规则处理。',
    evidenceRequirements: ['PACKAGE_PHOTO', 'WEIGHT_PHOTO'],
  },
});

const freshContent = () => ({
  attributes: {
    variety: '红颜草莓',
    grade: '一级',
    origin: '江苏连云港',
    'harvest-slaughter-date': '2026-08-10',
    'freshness-period': '0-4℃冷藏3天',
    'temperature-zone': 'CHILLED',
    'weighing-rule': 'ACTUAL_WEIGHT',
  },
  skus: [{ attributes: { 'weight-tier': '500克档', specification: '篮装', 'processing-method': '原果' } }],
});

test('P0-014 accepts the formal FRESH template and rejects a missing required field', () => {
  const normalized = normalizeCategoryTemplateDefinition(freshTemplate());
  assert.equal(normalized.profile, 'FRESH');
  const missingOrigin = freshTemplate();
  missingOrigin.fieldSchema.fields = missingOrigin.fieldSchema.fields.filter(({ key }) => key !== 'origin');
  assert.throws(
    () => normalizeCategoryTemplateDefinition(missingOrigin),
    (error) => error?.code === 'TEMPLATE_SCHEMA_INVALID',
  );
});

test('NEG-M2-014-01 and NEG-M2-014-02 reject missing fields and invalid weighing rules', () => {
  const template = normalizeCategoryTemplateDefinition(freshTemplate());
  const missing = freshContent();
  delete missing.attributes.origin;
  assert.throws(
    () => validateFreshSupplierProductTemplateContent(template, missing),
    (error) => error?.code === 'FRESH_REQUIRED_FIELD_MISSING',
  );
  const invalid = freshContent();
  invalid.attributes['weighing-rule'] = 'SUPPLIER_FREE_TEXT';
  assert.throws(
    () => validateFreshSupplierProductTemplateContent(template, invalid),
    (error) => error?.code === 'FRESH_WEIGHT_RULE_INVALID',
  );
});

test('P0-014 builds the public fresh whitelist, SKU dimensions and company after-sales rule', () => {
  const template = normalizeCategoryTemplateDefinition(freshTemplate());
  const content = freshContent();
  const source = {
    productId: '11111111-1111-4111-8111-111111111111',
    supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoryId: '22222222-2222-4222-8222-222222222222',
    templateVersion: 1,
    name: '红颜草莓',
    saleStatus: 'ACTIVE',
    isRetailEnabled: true,
    detailSnapshot: {
      name: '红颜草莓',
      brand: null,
      attributes: content.attributes,
      qualificationSnapshot: { references: ['object://private/never-return'] },
      approvedSupplyPrice: 1290,
    },
    template,
    skus: [{
      skuId: '33333333-3333-4333-8333-333333333333',
      status: 'ACTIVE',
      retailSalePrice: 1990,
      approvedSupplyPrice: 1290,
      attributes: content.skus[0].attributes,
    }],
  };
  const response = buildFreshProductDetailResponse(source);
  assert.equal(response.templateProfile, 'FRESH');
  assert.deepEqual(
    response.detailModules.flatMap((module) => module.fields.map(({ key }) => key)),
    ['variety', 'grade', 'origin', 'harvest-slaughter-date', 'freshness-period', 'temperature-zone', 'weighing-rule'],
  );
  assert.equal(response.detailModules.at(-1).kind, 'AFTER_SALE');
  assert.match(response.detailModules.at(-1).notice, /江苏福礼团/u);
  assert.deepEqual(response.skus[0].specifications.map(({ key }) => key), [
    'weight-tier',
    'specification',
    'processing-method',
  ]);
  assert.doesNotMatch(
    JSON.stringify(response),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|object:\/\/private|settlement/iu,
  );

  const before = JSON.parse(JSON.stringify(response));
  const laterTemplate = freshTemplate();
  laterTemplate.afterSaleRules.notice = '由江苏福礼团供应链科技有限公司统一受理；这是后续版本售后口径。';
  normalizeCategoryTemplateDefinition(laterTemplate);
  assert.deepEqual(buildFreshProductDetailResponse(source), before);
});
