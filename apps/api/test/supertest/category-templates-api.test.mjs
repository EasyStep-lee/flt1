import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { InMemoryAuditLogRepository } from '../../dist/audit/in-memory-audit-log.repository.js';
import { createApplication } from '../../dist/bootstrap.js';
import { InMemoryCategoryTemplateRepository } from '../../dist/category-templates/in-memory-category-template.repository.js';
import { InMemoryCategoryRepository } from '../../dist/categories/in-memory-category.repository.js';
import { loadRuntimeConfig } from '../../dist/config/runtime-config.js';
import { InMemorySupplierProductRepository } from '../../dist/supplier-products/in-memory-supplier-product.repository.js';

const company = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  legalName: '江苏福礼团供应链科技有限公司',
  platformName: '福礼社',
  status: 'ACTIVE',
};
const otherCompany = {
  id: '99999999-9999-4999-8999-999999999999',
  legalName: '越权公司',
  platformName: '越权公司',
  status: 'ACTIVE',
};
const supplier = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  companyId: company.id,
  status: 'ACTIVE',
};

const config = () =>
  loadRuntimeConfig({
    NODE_ENV: 'test',
    API_HOST: '127.0.0.1',
    API_PORT: '3000',
    DATABASE_URL:
      'mysql://fulishe:development-only@127.0.0.1:3306/fulishe?connect_timeout=3&pool_timeout=5',
    REDIS_URL: 'redis://:development-only@127.0.0.1:6379/0',
    INFRA_HEALTH_TIMEOUT_MS: '50',
  });

const probes = () =>
  ['database', 'redis', 'queue'].map((name) => ({
    name,
    check: async () => ({ status: 'UP', code: 'OK', latencyMs: 1 }),
  }));

const templateBody = (overrides = {}) => ({
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      {
        key: 'description',
        label: '商品说明',
        type: 'TEXT',
        required: true,
        unit: null,
        enumValues: [],
        validation: {
          min: null,
          max: null,
          minLength: 1,
          maxLength: 200,
          pattern: null,
        },
        searchable: false,
        specification: false,
        detailModuleKey: 'base',
      },
      {
        key: 'pack',
        label: '包装规格',
        type: 'ENUM',
        required: true,
        unit: null,
        enumValues: ['单盒', '整箱'],
        validation: {
          min: null,
          max: null,
          minLength: null,
          maxLength: null,
          pattern: null,
        },
        searchable: true,
        specification: true,
        detailModuleKey: 'specifications',
      },
    ],
  },
  skuDimensions: {
    dimensions: [{ key: 'pack', label: '包装规格', fieldKey: 'pack' }],
  },
  qualificationRules: {
    rules: [
      {
        key: 'business-license',
        label: '经营资质',
        required: true,
        expiryRequired: true,
        objectTypes: ['IMAGE', 'PDF'],
      },
    ],
  },
  detailModules: {
    modules: [
      { key: 'base', title: '基础信息', kind: 'FIELDS', sortWeight: 10 },
      { key: 'specifications', title: '规格参数', kind: 'FIELDS', sortWeight: 20 },
    ],
  },
  afterSaleRules: {
    returnPolicy: 'COMPANY_STANDARD',
    notice: '由江苏福礼团供应链科技有限公司统一受理售后。',
    evidenceRequirements: ['PACKAGE_PHOTO'],
  },
  ...overrides,
});

const foodField = (key, label, detailModuleKey, specification = false) => ({
  key,
  label,
  type: 'TEXT',
  required: true,
  unit: null,
  enumValues: [],
  validation: { min: null, max: null, minLength: 1, maxLength: 500, pattern: null },
  searchable: false,
  specification,
  detailModuleKey,
});

const foodTemplateBody = () => ({
  profile: 'FOOD',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      foodField('ingredients', '配料表', 'ingredients-nutrition'),
      foodField('nutrition-facts', '营养成分', 'ingredients-nutrition'),
      foodField('production-license', '生产许可', 'production-information'),
      foodField('shelf-life', '保质期', 'production-information'),
      foodField('storage-method', '储存方式', 'consumption-storage'),
      foodField('allergens', '过敏原', 'consumption-storage'),
      foodField('flavor', '口味', 'specifications', true),
      foodField('net-content', '净含量', 'specifications', true),
      foodField('package-count', '包装数', 'specifications', true),
    ],
  },
  skuDimensions: {
    dimensions: [
      { key: 'flavor', label: '口味', fieldKey: 'flavor' },
      { key: 'net-content', label: '净含量', fieldKey: 'net-content' },
      { key: 'package-count', label: '包装数', fieldKey: 'package-count' },
    ],
  },
  qualificationRules: { rules: [] },
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

const foodProductBody = (categoryId, templateVersion, name = '食品模板商品') => ({
  categoryId,
  templateVersion,
  name,
  brand: '福礼团严选',
  attributes: {
    ingredients: '大米',
    'nutrition-facts': '每100克能量1450千焦',
    'production-license': 'SC100000000001',
    'shelf-life': '12个月',
    'storage-method': '阴凉干燥处保存',
    allergens: '本品生产线同时处理含麸质谷物',
  },
  qualificationReferences: ['object://supplier-product/food-license-001'],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: false,
  enterpriseMinOrderQty: 1,
  enterprisePackageMultiple: 1,
  preparationMinutes: 30,
  skus: [
    {
      supplierSkuCode: `${name}-SKU`,
      attributes: { flavor: '原味', 'net-content': '5千克', 'package-count': '1袋' },
      initialStock: 10,
    },
  ],
});

const freshField = (
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

const freshTemplateBody = () => ({
  profile: 'FRESH',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      freshField('variety', '品种', 'origin-traceability'),
      freshField('grade', '等级', 'origin-traceability'),
      freshField('origin', '产地', 'origin-traceability'),
      freshField('harvest-slaughter-date', '采收/屠宰日期', 'freshness-storage', { type: 'DATE' }),
      freshField('freshness-period', '保鲜期', 'freshness-storage'),
      freshField('temperature-zone', '温区', 'freshness-storage', {
        type: 'ENUM', enumValues: ['AMBIENT', 'CHILLED', 'FROZEN'],
      }),
      freshField('weighing-rule', '称重规则', 'weighing-difference', {
        type: 'ENUM', enumValues: ['FIXED_WEIGHT', 'ACTUAL_WEIGHT'],
      }),
      freshField('weight-tier', '重量档', 'specifications', { specification: true }),
      freshField('specification', '规格', 'specifications', { specification: true }),
      freshField('processing-method', '处理方式', 'specifications', { specification: true }),
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

const freshProductBody = (categoryId, templateVersion, name = '生鲜模板商品') => ({
  categoryId,
  templateVersion,
  name,
  brand: null,
  attributes: {
    variety: '红颜草莓',
    grade: '一级',
    origin: '江苏连云港',
    'harvest-slaughter-date': '2026-08-10',
    'freshness-period': '0-4℃冷藏3天',
    'temperature-zone': 'CHILLED',
    'weighing-rule': 'ACTUAL_WEIGHT',
  },
  qualificationReferences: ['object://supplier-product/fresh-origin-001'],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: false,
  enterpriseMinOrderQty: 1,
  enterprisePackageMultiple: 1,
  preparationMinutes: 20,
  skus: [{
    supplierSkuCode: `${name}-SKU`,
    attributes: { 'weight-tier': '500克档', specification: '篮装', 'processing-method': '原果' },
    initialStock: 10,
  }],
});

const apparelField = (
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

const apparelTemplateBody = () => ({
  profile: 'APPAREL',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      apparelField('fabric', '面料', 'materials'),
      apparelField('lining', '里料', 'materials'),
      apparelField('fit', '版型', 'size-assistant'),
      apparelField('execution-standard', '执行标准', 'materials'),
      apparelField('care-instructions', '洗护方式', 'care-instructions'),
      apparelField('size-chart', '尺码表', 'size-assistant', { type: 'RICH_TEXT' }),
      apparelField('color', '颜色', 'specifications', { specification: true }),
      apparelField('size', '尺码', 'specifications', { specification: true }),
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

const apparelProductBody = (categoryId, templateVersion, name = '服饰模板商品') => ({
  categoryId,
  templateVersion,
  name,
  brand: '福礼团严选',
  attributes: {
    fabric: '棉 95%、氨纶 5%',
    lining: '棉 100%',
    fit: '常规版型',
    'execution-standard': 'GB/T 2660-2017',
    'care-instructions': '冷水轻柔洗涤，不可漂白，悬挂晾干',
    'size-chart': 'M：胸围100cm/衣长68cm；L：胸围104cm/衣长70cm',
  },
  qualificationReferences: [],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: false,
  enterpriseMinOrderQty: 1,
  enterprisePackageMultiple: 1,
  preparationMinutes: 30,
  skus: [
    { supplierSkuCode: `${name}-RED-M`, attributes: { color: '暖红', size: 'M' }, initialStock: 10 },
    { supplierSkuCode: `${name}-RED-L`, attributes: { color: '暖红', size: 'L' }, initialStock: 10 },
  ],
});

const digitalField = (
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

const digitalTemplateBody = () => ({
  profile: 'DIGITAL',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      digitalField('dimensions', '尺寸', 'technical-parameters'),
      digitalField('power', '功率', 'technical-parameters'),
      digitalField('voltage', '电压', 'technical-parameters'),
      digitalField('interfaces', '接口', 'technical-parameters'),
      digitalField('energy-efficiency', '能效', 'energy-efficiency'),
      digitalField('execution-standard', '执行标准', 'technical-parameters'),
      digitalField('package-list', '包装清单', 'package-and-installation', { type: 'RICH_TEXT' }),
      digitalField('installation-instructions', '安装说明', 'package-and-installation', { type: 'RICH_TEXT' }),
      digitalField('warranty-period', '保修期', 'warranty'),
      digitalField('color', '颜色', 'specifications', { specification: true }),
      digitalField('capacity', '容量', 'specifications', { specification: true }),
      digitalField('model', '型号', 'specifications', { specification: true }),
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

const digitalProductBody = (categoryId, templateVersion, name = '数码模板商品') => ({
  categoryId,
  templateVersion,
  name,
  brand: '福礼团严选',
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
  qualificationReferences: [],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: false,
  enterpriseMinOrderQty: 1,
  enterprisePackageMultiple: 1,
  preparationMinutes: 30,
  skus: [
    {
      supplierSkuCode: `${name}-D1`,
      attributes: { color: '白色', capacity: '256GB', model: 'FL-D1' },
      initialStock: 10,
    },
    {
      supplierSkuCode: `${name}-D2`,
      attributes: { color: '黑色', capacity: '512GB', model: 'FL-D2' },
      initialStock: 10,
    },
  ],
});

const giftBoxTemplateBody = () => ({
  profile: 'GIFT_BOX',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      digitalField('bundle-items', '组合清单', 'bundle-list', { type: 'BUNDLE_ITEMS' }),
      digitalField('packaging', '包装说明', 'customization'),
      digitalField('customization', '定制项', 'customization'),
      digitalField('delivery-cycle', '交付周期', 'customization'),
      digitalField('welfare-scenario', '福利场景', 'welfare-scenario'),
      digitalField('package', '套餐', 'specifications', { specification: true }),
      digitalField('tier', '档位', 'specifications', { specification: true }),
      digitalField('custom-version', '定制版本', 'specifications', { specification: true }),
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

const giftBoxProductBody = (categoryId, templateVersion, name = '礼盒组合商品') => ({
  categoryId,
  templateVersion,
  name,
  brand: '福礼团',
  attributes: {
    'bundle-items': [
      { name: '有机大米', quantity: 2, specification: '2.5kg/袋', minimumExpiryDays: 180 },
      { name: '坚果组合', quantity: 1, specification: '750g/盒', minimumExpiryDays: 120 },
    ],
    packaging: '节庆礼盒与手提袋',
    customization: '支持企业贺卡，不支持改写商品标签',
    'delivery-cycle': '确认定制稿后 7 个工作日',
    'welfare-scenario': '企业节日福利与员工慰问',
  },
  qualificationReferences: [],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: true,
  enterpriseMinOrderQty: 10,
  enterprisePackageMultiple: 5,
  preparationMinutes: 240,
  skus: [
    {
      supplierSkuCode: `${name}-A`,
      attributes: { package: '经典套餐', tier: 'A档', 'custom-version': '标准版' },
      initialStock: 10,
    },
  ],
});

const productBody = (categoryId, templateVersion, name = '模板绑定商品') => ({
  categoryId,
  templateVersion,
  name,
  brand: null,
  attributes: { description: '受模板约束', pack: '单盒' },
  qualificationReferences: ['object://supplier-product/business-license-001'],
  isRetailEnabled: true,
  isEnterpriseProcurementEnabled: false,
  enterpriseMinOrderQty: 1,
  enterprisePackageMultiple: 1,
  preparationMinutes: 30,
  skus: [
    {
      supplierSkuCode: `${name}-SKU`,
      attributes: { pack: '单盒' },
      initialStock: 10,
    },
  ],
});

const createFixture = async ({ auditFail = false, safeDefault = false } = {}) => {
  const audit = new InMemoryAuditLogRepository({ failAppend: auditFail });
  const categories = new InMemoryCategoryRepository({
    auditLogRepository: audit,
    companies: [company, otherCompany],
    suppliers: [supplier],
  });
  const root = await categories.seedForTest({
    companyId: company.id,
    parentId: null,
    name: '食品饮料',
    level: 1,
    sortWeight: 10,
  });
  const middle = await categories.seedForTest({
    companyId: company.id,
    parentId: root.id,
    name: '粮油米面',
    level: 2,
    sortWeight: 10,
  });
  const leaf = await categories.seedForTest({
    companyId: company.id,
    parentId: middle.id,
    name: '大米',
    level: 3,
    sortWeight: 10,
  });
  const disabledLeaf = await categories.seedForTest({
    companyId: company.id,
    parentId: middle.id,
    name: '停用末级',
    level: 3,
    sortWeight: 20,
    status: 'DISABLED',
  });
  const foreignRoot = await categories.seedForTest({
    companyId: otherCompany.id,
    parentId: null,
    name: '外部一级',
    level: 1,
    sortWeight: 10,
  });
  const foreignMiddle = await categories.seedForTest({
    companyId: otherCompany.id,
    parentId: foreignRoot.id,
    name: '外部二级',
    level: 2,
    sortWeight: 10,
  });
  const foreignLeaf = await categories.seedForTest({
    companyId: otherCompany.id,
    parentId: foreignMiddle.id,
    name: '外部末级',
    level: 3,
    sortWeight: 10,
  });
  const templates = new InMemoryCategoryTemplateRepository({
    auditLogRepository: audit,
    categoryRepository: categories,
  });
  const products = new InMemorySupplierProductRepository({
    auditLogRepository: audit,
    companies: [company],
    suppliers: [supplier],
  });
  const actor = {
    accountTypeCode: 'COMPANY_PRODUCT_OPS',
    companyId: company.id,
    functionalAccountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    identityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    workspaceRoute: '/company-admin/workspaces/product-ops',
  };
  const app = await createApplication({
    config: config(),
    probes: probes(),
    auditLogRepository: audit,
    categoryRepository: categories,
    categoryTemplateRepository: templates,
    supplierProductRepository: products,
    supplierProductActorResolver: {
      resolve: async () => ({
        role: 'SUPPLIER_PRODUCT',
        supplierId: supplier.id,
        identityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        functionalAccountId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      }),
    },
    ...(safeDefault
      ? {}
      : { companyProductApprovalActorResolver: { resolve: async () => ({ ...actor }) } }),
    logger: false,
  });
  await app.listen(0, '127.0.0.1');
  return {
    app,
    audit,
    categories,
    disabledLeaf,
    foreignLeaf,
    leaf,
    middle,
    products,
    root,
    templates,
  };
};

const createTemplate = (fixture, categoryId, body = templateBody(), key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .post(`/v1/company/categories/${categoryId}/template-versions`)
    .set('Idempotency-Key', key)
    .send(body);

const patchTemplate = (fixture, templateId, body, key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .patch(`/v1/company/category-template-versions/${templateId}`)
    .set('Idempotency-Key', key)
    .send(body);

const publishTemplate = (fixture, templateId, revision, key = randomUUID()) =>
  request(fixture.app.getHttpServer())
    .post(`/v1/company/category-template-versions/${templateId}/publish`)
    .set('Idempotency-Key', key)
    .send({ revision });

describe('P0-012 versioned category templates', () => {
  it('creates, edits and publishes immutable versions while retiring the prior active version', async () => {
    const fixture = await createFixture();
    try {
      const key = 'template-v1-create-0001';
      const created = await createTemplate(fixture, fixture.leaf.id, templateBody(), key);
      const replayed = await createTemplate(fixture, fixture.leaf.id, templateBody(), key);
      expect(created.status).toBe(201);
      expect(created.headers['cache-control']).toContain('private');
      expect(created.body).toMatchObject({
        categoryId: fixture.leaf.id,
        version: 1,
        revision: 0,
        status: 'DRAFT',
      });
      expect(replayed.status).toBe(201);
      expect(replayed.body).toEqual(created.body);
      expect(replayed.headers['idempotency-replayed']).toBe('true');
      expect(JSON.stringify(created.body)).not.toMatch(
        /companyId|functionalAccountId|identityId|supplyPrice|settlement|margin/iu,
      );

      const publishedV1 = await publishTemplate(
        fixture,
        created.body.id,
        created.body.revision,
        'template-v1-publish-0001',
      );
      expect(publishedV1.status).toBe(200);
      expect(publishedV1.body).toMatchObject({ version: 1, revision: 1, status: 'PUBLISHED' });
      const v1Snapshot = globalThis.structuredClone(publishedV1.body);

      const createdV2 = await createTemplate(
        fixture,
        fixture.leaf.id,
        templateBody(),
        'template-v2-create-0001',
      );
      expect(createdV2.status).toBe(201);
      expect(createdV2.body).toMatchObject({ version: 2, revision: 0, status: 'DRAFT' });
      const nextBody = templateBody({
        afterSaleRules: {
          returnPolicy: 'CATEGORY_RESTRICTED',
          notice: '公司统一受理；生鲜属性商品按页面提示核验。',
          evidenceRequirements: ['PACKAGE_PHOTO', 'UNBOXING_VIDEO'],
        },
      });
      const patched = await patchTemplate(fixture, createdV2.body.id, {
        revision: 0,
        ...nextBody,
      });
      expect(patched.status).toBe(200);
      expect(patched.body).toMatchObject({ version: 2, revision: 1, status: 'DRAFT' });

      const publishedV2 = await publishTemplate(fixture, patched.body.id, patched.body.revision);
      expect(publishedV2.status).toBe(200);
      expect(publishedV2.body).toMatchObject({ version: 2, revision: 2, status: 'PUBLISHED' });
      const listed = await request(fixture.app.getHttpServer()).get(
        `/v1/company/categories/${fixture.leaf.id}/template-versions`,
      );
      expect(listed.status).toBe(200);
      expect(listed.body.activeVersion).toBe(2);
      expect(listed.body.items.map(({ version, status }) => [version, status])).toEqual([
        [2, 'PUBLISHED'],
        [1, 'RETIRED'],
      ]);
      expect(listed.body.items[1]).toMatchObject({
        ...v1Snapshot,
        status: 'RETIRED',
        revision: 2,
        retiredAt: expect.any(String),
      });
      expect(listed.body.items[1].fieldSchema).toEqual(v1Snapshot.fieldSchema);
      expect(await fixture.templates.historyCount()).toBe(6);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-012-01/02 rejects invalid schemas and non-leaf, disabled or cross-company categories', async () => {
    const fixture = await createFixture();
    try {
      const duplicateFields = templateBody({
        fieldSchema: {
          ...templateBody().fieldSchema,
          fields: [
            templateBody().fieldSchema.fields[0],
            { ...templateBody().fieldSchema.fields[0], label: '重复字段' },
          ],
        },
      });
      for (const [categoryId, body, expectedCode] of [
        [fixture.leaf.id, duplicateFields, 'TEMPLATE_SCHEMA_INVALID'],
        [fixture.root.id, templateBody(), 'CATEGORY_NOT_LEAF'],
        [fixture.middle.id, templateBody(), 'CATEGORY_NOT_LEAF'],
        [fixture.disabledLeaf.id, templateBody(), 'CATEGORY_DISABLED'],
        [fixture.foreignLeaf.id, templateBody(), 'CATEGORY_NOT_FOUND'],
      ]) {
        const response = await createTemplate(fixture, categoryId, body);
        expect(response.status).toBe(expectedCode === 'CATEGORY_NOT_FOUND' ? 404 : 422);
        expect(response.body).toMatchObject({ code: expectedCode });
      }

      const danglingModule = templateBody({
        detailModules: { modules: [{ key: 'other', title: '错误模块', kind: 'FIELDS', sortWeight: 1 }] },
      });
      const dangling = await createTemplate(fixture, fixture.leaf.id, danglingModule);
      expect(dangling.status).toBe(422);
      expect(dangling.body).toMatchObject({ code: 'TEMPLATE_SCHEMA_INVALID' });
      expect(await fixture.templates.count()).toBe(0);
      expect(await fixture.templates.historyCount()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-012-03 rejects stale or published edits under concurrent publish attempts', async () => {
    const fixture = await createFixture();
    try {
      const created = await createTemplate(fixture, fixture.leaf.id);
      expect(created.status).toBe(201);
      const stale = await patchTemplate(fixture, created.body.id, {
        revision: 99,
        ...templateBody(),
      });
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT' });

      const attempts = await Promise.all(
        Array.from({ length: 4 }, (_, index) =>
          publishTemplate(fixture, created.body.id, 0, `template-publish-race-${index}`),
        ),
      );
      expect(attempts.filter(({ status }) => status === 200)).toHaveLength(1);
      expect(attempts.filter(({ status }) => status === 409)).toHaveLength(3);
      expect(await fixture.templates.publishedCount(fixture.leaf.id)).toBe(1);

      const immutable = await patchTemplate(fixture, created.body.id, {
        revision: 1,
        ...templateBody(),
      });
      expect(immutable.status).toBe(409);
      expect(immutable.body).toMatchObject({ code: 'TEMPLATE_IMMUTABLE' });
    } finally {
      await fixture.app.close();
    }
  });

  it('NEG-M2-012-05 returns structured 503 and rolls back mandatory audit failures', async () => {
    const failed = await createFixture({ auditFail: true });
    try {
      const response = await createTemplate(failed, failed.leaf.id);
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'AUDIT_REQUIRED' });
      expect(await failed.templates.count()).toBe(0);
      expect(await failed.templates.historyCount()).toBe(0);
    } finally {
      await failed.app.close();
    }
  });

  it('NEG-M2-012-04 allows SupplierProduct only on the current published template version', async () => {
    const fixture = await createFixture();
    try {
      const beforePublish = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'template-product-before-publish')
        .send(productBody(fixture.leaf.id, 1, '发布前商品'));
      expect(beforePublish.status).toBe(422);
      expect(beforePublish.body).toMatchObject({ code: 'TEMPLATE_VERSION_INACTIVE' });

      const v1 = await createTemplate(fixture, fixture.leaf.id);
      await publishTemplate(fixture, v1.body.id, v1.body.revision);
      const productV1 = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'template-product-v1')
        .send(productBody(fixture.leaf.id, 1, '版本一商品'));
      expect(productV1.status).toBe(201);

      const v2 = await createTemplate(fixture, fixture.leaf.id);
      await publishTemplate(fixture, v2.body.id, v2.body.revision);
      const oldVersion = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'template-product-retired-v1')
        .send(productBody(fixture.leaf.id, 1, '退役版本商品'));
      expect(oldVersion.status).toBe(422);
      expect(oldVersion.body).toMatchObject({ code: 'TEMPLATE_VERSION_INACTIVE' });

      const staleSubmit = await request(fixture.app.getHttpServer())
        .post(`/v1/supplier/products/${productV1.body.id}/submit-material`)
        .set('Idempotency-Key', 'template-product-submit-retired-v1')
        .send({ version: 0, requestId: randomUUID() });
      expect(staleSubmit.status).toBe(422);
      expect(staleSubmit.body).toMatchObject({ code: 'TEMPLATE_VERSION_INACTIVE' });
      expect((await fixture.products.getSupplierProduct(productV1.body.id)).status).toBe('DRAFT');

      const productV2 = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'template-product-v2')
        .send(productBody(fixture.leaf.id, 2, '版本二商品'));
      expect(productV2.status).toBe(201);
      expect(productV2.body).toMatchObject({ templateVersion: 2 });
    } finally {
      await fixture.app.close();
    }
  });

  it('defaults template management to deny and prevents category deletion after any version exists', async () => {
    const denied = await createFixture({ safeDefault: true });
    try {
      const response = await request(denied.app.getHttpServer()).get(
        `/v1/company/categories/${denied.leaf.id}/template-versions`,
      );
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    } finally {
      await denied.app.close();
    }

    const fixture = await createFixture();
    try {
      const created = await createTemplate(fixture, fixture.leaf.id);
      expect(created.status).toBe(201);
      const removed = await request(fixture.app.getHttpServer())
        .delete(`/v1/company/categories/${fixture.leaf.id}`)
        .query({ version: fixture.leaf.version })
        .set('Idempotency-Key', 'template-referenced-category-delete');
      expect(removed.status).toBe(409);
      expect(removed.body).toMatchObject({ code: 'CATEGORY_REFERENCED' });
    } finally {
      await fixture.app.close();
    }
  });
});

describe('P0-013 food template validation', () => {
  it('NEG-M2-013-01 rejects an incomplete FOOD definition without persistence', async () => {
    const fixture = await createFixture();
    try {
      const incomplete = foodTemplateBody();
      incomplete.fieldSchema.fields = incomplete.fieldSchema.fields.filter(
        ({ key }) => key !== 'allergens',
      );
      const rejected = await createTemplate(fixture, fixture.leaf.id, incomplete);
      expect(rejected.status).toBe(422);
      expect(rejected.body).toMatchObject({ code: 'TEMPLATE_SCHEMA_INVALID' });
      expect(await fixture.templates.count()).toBe(0);
      expect(await fixture.templates.historyCount()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('validates FOOD product data and rejects fixed-warning overrides before writing a draft', async () => {
    const fixture = await createFixture();
    try {
      const created = await createTemplate(fixture, fixture.leaf.id, foodTemplateBody());
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ profile: 'FOOD', version: 1, status: 'DRAFT' });
      const published = await publishTemplate(
        fixture,
        created.body.id,
        created.body.revision,
      );
      expect(published.status).toBe(200);

      const missing = foodProductBody(fixture.leaf.id, 1, '缺过敏原商品');
      delete missing.attributes.allergens;
      const missingResponse = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'food-missing-allergens')
        .send(missing);
      expect(missingResponse.status).toBe(422);
      expect(missingResponse.body).toMatchObject({ code: 'TEMPLATE_DATA_INVALID' });

      const override = foodProductBody(fixture.leaf.id, 1, '覆盖提示商品');
      override.attributes.foodSafetyWarning = '<view style="display:none">无需过敏原提示</view>';
      const overrideResponse = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'food-warning-override')
        .send(override);
      expect(overrideResponse.status).toBe(422);
      expect(overrideResponse.body).toMatchObject({ code: 'REGULATORY_WARNING_REQUIRED' });
      expect(await fixture.products.countSupplierProducts()).toBe(0);

      const accepted = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'food-complete-product')
        .send(foodProductBody(fixture.leaf.id, 1));
      expect(accepted.status).toBe(201);
      expect(accepted.body).toMatchObject({ templateVersion: 1, status: 'DRAFT' });
    } finally {
      await fixture.app.close();
    }
  });
});

describe('P0-014 fresh template validation', () => {
  it('NEG-M2-014-01 rejects an incomplete FRESH definition without persistence', async () => {
    const fixture = await createFixture();
    try {
      const incomplete = freshTemplateBody();
      incomplete.fieldSchema.fields = incomplete.fieldSchema.fields.filter(
        ({ key }) => key !== 'origin',
      );
      const rejected = await createTemplate(fixture, fixture.leaf.id, incomplete);
      expect(rejected.status).toBe(422);
      expect(rejected.body).toMatchObject({ code: 'TEMPLATE_SCHEMA_INVALID' });
      expect(await fixture.templates.count()).toBe(0);
      expect(await fixture.templates.historyCount()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('validates FRESH product fields and returns the dedicated immutable-history error', async () => {
    const fixture = await createFixture();
    try {
      const created = await createTemplate(fixture, fixture.leaf.id, freshTemplateBody());
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ profile: 'FRESH', version: 1, status: 'DRAFT' });
      const published = await publishTemplate(fixture, created.body.id, created.body.revision);
      expect(published.status).toBe(200);

      const rewrite = await patchTemplate(fixture, created.body.id, {
        revision: published.body.revision,
        ...freshTemplateBody(),
      });
      expect(rewrite.status).toBe(409);
      expect(rewrite.body).toMatchObject({ code: 'FRESH_HISTORY_REWRITE' });

      const missing = freshProductBody(fixture.leaf.id, 1, '缺产地生鲜');
      delete missing.attributes.origin;
      const missingResponse = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'fresh-missing-origin')
        .send(missing);
      expect(missingResponse.status).toBe(422);
      expect(missingResponse.body).toMatchObject({ code: 'FRESH_REQUIRED_FIELD_MISSING' });

      const invalid = freshProductBody(fixture.leaf.id, 1, '非法称重生鲜');
      invalid.attributes['weighing-rule'] = 'SUPPLIER_FREE_TEXT';
      const invalidResponse = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'fresh-invalid-weighing-rule')
        .send(invalid);
      expect(invalidResponse.status).toBe(422);
      expect(invalidResponse.body).toMatchObject({ code: 'FRESH_WEIGHT_RULE_INVALID' });
      expect(await fixture.products.countSupplierProducts()).toBe(0);

      const accepted = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'fresh-complete-product')
        .send(freshProductBody(fixture.leaf.id, 1));
      expect(accepted.status).toBe(201);
      expect(accepted.body).toMatchObject({ templateVersion: 1, status: 'DRAFT' });
    } finally {
      await fixture.app.close();
    }
  });
});

describe('P0-015 apparel template validation', () => {
  it('NEG-M2-015-01 rejects an incomplete APPAREL definition without persistence', async () => {
    const fixture = await createFixture();
    try {
      const incomplete = apparelTemplateBody();
      incomplete.fieldSchema.fields = incomplete.fieldSchema.fields.filter(
        ({ key }) => key !== 'size-chart',
      );
      const rejected = await createTemplate(fixture, fixture.leaf.id, incomplete);
      expect(rejected.status).toBe(422);
      expect(rejected.body).toMatchObject({ code: 'TEMPLATE_SCHEMA_INVALID' });
      expect(await fixture.templates.count()).toBe(0);
      expect(await fixture.templates.historyCount()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('validates unique color-size SKUs and returns the dedicated immutable-history error', async () => {
    const fixture = await createFixture();
    try {
      const created = await createTemplate(fixture, fixture.leaf.id, apparelTemplateBody());
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ profile: 'APPAREL', version: 1, status: 'DRAFT' });
      const published = await publishTemplate(fixture, created.body.id, created.body.revision);
      expect(published.status).toBe(200);

      const rewrite = await patchTemplate(fixture, created.body.id, {
        revision: published.body.revision,
        ...apparelTemplateBody(),
      });
      expect(rewrite.status).toBe(409);
      expect(rewrite.body).toMatchObject({ code: 'APPAREL_HISTORY_REWRITE' });

      const duplicate = apparelProductBody(fixture.leaf.id, 1, '重复颜色尺码服饰');
      duplicate.skus[1].attributes = { color: ' 暖红 ', size: 'ｍ' };
      const duplicateResponse = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'apparel-duplicate-color-size')
        .send(duplicate);
      expect(duplicateResponse.status).toBe(422);
      expect(duplicateResponse.body).toMatchObject({ code: 'SKU_DIMENSION_DUPLICATE' });
      expect(await fixture.products.countSupplierProducts()).toBe(0);

      const accepted = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'apparel-complete-product')
        .send(apparelProductBody(fixture.leaf.id, 1));
      expect(accepted.status).toBe(201);
      expect(accepted.body).toMatchObject({ templateVersion: 1, status: 'DRAFT' });
    } finally {
      await fixture.app.close();
    }
  });
});

describe('P0-016 digital template validation', () => {
  it('NEG-M2-016-01 rejects an incomplete DIGITAL definition without persistence', async () => {
    const fixture = await createFixture();
    try {
      const incomplete = digitalTemplateBody();
      incomplete.fieldSchema.fields = incomplete.fieldSchema.fields.filter(
        ({ key }) => key !== 'energy-efficiency',
      );
      const rejected = await createTemplate(fixture, fixture.leaf.id, incomplete);
      expect(rejected.status).toBe(422);
      expect(rejected.body).toMatchObject({ code: 'TEMPLATE_SCHEMA_INVALID' });
      expect(await fixture.templates.count()).toBe(0);
      expect(await fixture.templates.historyCount()).toBe(0);
    } finally {
      await fixture.app.close();
    }
  });

  it('validates unique models and returns the dedicated immutable-history error', async () => {
    const fixture = await createFixture();
    try {
      const created = await createTemplate(fixture, fixture.leaf.id, digitalTemplateBody());
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ profile: 'DIGITAL', version: 1, status: 'DRAFT' });
      const published = await publishTemplate(fixture, created.body.id, created.body.revision);
      expect(published.status).toBe(200);

      const rewrite = await patchTemplate(fixture, created.body.id, {
        revision: published.body.revision,
        ...digitalTemplateBody(),
      });
      expect(rewrite.status).toBe(409);
      expect(rewrite.body).toMatchObject({ code: 'DIGITAL_HISTORY_REWRITE' });

      const duplicate = digitalProductBody(fixture.leaf.id, 1, '重复型号数码商品');
      duplicate.skus[1].attributes = { color: '黑色', capacity: '512GB', model: ' fl-d1 ' };
      const duplicateResponse = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'digital-duplicate-model')
        .send(duplicate);
      expect(duplicateResponse.status).toBe(422);
      expect(duplicateResponse.body).toMatchObject({ code: 'DIGITAL_MODEL_DUPLICATE' });
      expect(await fixture.products.countSupplierProducts()).toBe(0);

      const accepted = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'digital-complete-product')
        .send(digitalProductBody(fixture.leaf.id, 1));
      expect(accepted.status).toBe(201);
      expect(accepted.body).toMatchObject({ templateVersion: 1, status: 'DRAFT' });
    } finally {
      await fixture.app.close();
    }
  });
});

describe('P0-017 gift-box template and supplier scope validation', () => {
  it('rejects incomplete and cross-supplier child items and preserves published history', async () => {
    const fixture = await createFixture();
    try {
      const created = await createTemplate(fixture, fixture.leaf.id, giftBoxTemplateBody());
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ profile: 'GIFT_BOX', version: 1, status: 'DRAFT' });
      const published = await publishTemplate(fixture, created.body.id, created.body.revision);
      expect(published.status).toBe(200);

      const rewrite = await patchTemplate(fixture, created.body.id, {
        revision: published.body.revision,
        ...giftBoxTemplateBody(),
      });
      expect(rewrite.status).toBe(409);
      expect(rewrite.body).toMatchObject({ code: 'TEMPLATE_VERSION_IMMUTABLE' });

      const incomplete = giftBoxProductBody(fixture.leaf.id, 1, '缺少数量礼盒');
      incomplete.attributes['bundle-items'][0].quantity = 0;
      const incompleteResponse = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'gift-box-missing-item-data')
        .send(incomplete);
      expect(incompleteResponse.status).toBe(422);
      expect(incompleteResponse.body).toMatchObject({ code: 'BUNDLE_SCHEMA_INVALID' });

      const crossSupplier = giftBoxProductBody(fixture.leaf.id, 1, '跨供应商引用礼盒');
      crossSupplier.attributes['bundle-items'][0].supplierProductId =
        '99999999-9999-4999-8999-999999999999';
      const crossSupplierResponse = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'gift-box-cross-supplier-child')
        .send(crossSupplier);
      expect(crossSupplierResponse.status).toBe(403);
      expect(crossSupplierResponse.body).toMatchObject({ code: 'SUPPLIER_SCOPE_FORBIDDEN' });

      const accepted = await request(fixture.app.getHttpServer())
        .post('/v1/supplier/products')
        .set('Idempotency-Key', 'gift-box-complete-product')
        .send(giftBoxProductBody(fixture.leaf.id, 1));
      expect(accepted.status).toBe(201);
      expect(accepted.body).toMatchObject({ templateVersion: 1, status: 'DRAFT' });
      expect(await fixture.products.countSupplierProducts()).toBe(1);
    } finally {
      await fixture.app.close();
    }
  });
});
