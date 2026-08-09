import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executionPackRoot = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
);
const outputPath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M2-000',
  'm2-contract-freeze.json',
);

const expectedP0Ids = [
  'P0-006',
  'P0-007',
  'P0-008',
  'P0-009',
  'P0-010',
  'P0-011',
  'P0-012',
  'P0-013',
  'P0-014',
  'P0-015',
  'P0-016',
  'P0-017',
  'P0-018',
  'P0-019',
  'P0-021',
  'P0-061',
  'P0-063',
  'P0-071',
];

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(current);
  return values;
};

const parseCsvText = (source) => {
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
  });
};

const readCsv = (relativePath) =>
  readFile(path.join(executionPackRoot, relativePath), 'utf8').then(parseCsvText);

const p0Fallbacks = {
  InventoryChangeLog: ['P0-063'],
  PriceChangeLog: ['P0-019', 'P0-021', 'P0-071'],
  Product: [
    'P0-006',
    'P0-007',
    'P0-009',
    'P0-010',
    'P0-011',
    'P0-012',
    'P0-018',
    'P0-021',
    'P0-061',
  ],
  SupplierProductSku: [
    'P0-006',
    'P0-007',
    'P0-008',
    'P0-019',
    'P0-061',
    'P0-063',
  ],
};

const enumTypes = {
  'Category.status': 'Enum<CategoryStatus>',
  'CategoryTemplate.status': 'Enum<CategoryTemplateStatus>',
  'InventoryChangeLog.referenceType': 'Enum<InventoryReferenceType>',
  'InventoryChangeLog.type': 'Enum<InventoryChangeType>',
  'PriceChangeLog.priceType': 'Enum<PriceType>',
  'PriceChangeLog.reviewStatus': 'Enum<PriceReviewStatus>',
  'Product.saleStatus': 'Enum<ProductSaleStatus>',
  'Sku.status': 'Enum<SkuStatus>',
  'SupplierProduct.status': 'Enum<SupplierProductStatus>',
  'SupplierProductSku.status': 'Enum<SupplierProductSkuStatus>',
  'SupplyPriceChangeRequest.reviewStatus': 'Enum<SupplyPriceReviewStatus>',
};

const enumFormats = {
  'Category.status': 'ENABLED|DISABLED',
  'CategoryTemplate.status': 'DRAFT|PUBLISHED|RETIRED',
  'InventoryChangeLog.referenceType':
    'MANUAL_ADJUSTMENT|STOCKTAKE|DAMAGE|ORDER_RESERVATION|ORDER_RELEASE|ORDER_CONFIRM',
  'InventoryChangeLog.type':
    'INCREASE|DECREASE|STOCKTAKE_GAIN|STOCKTAKE_LOSS|DAMAGE|RESERVE|RELEASE|CONFIRM_SALE',
  'PriceChangeLog.priceType': 'SUPPLY|RETAIL_SALE|ENTERPRISE_SALE',
  'PriceChangeLog.reviewStatus': 'NOT_REQUIRED|PENDING|APPROVED|REJECTED',
  'Product.saleStatus': 'DRAFT|READY_TO_PUBLISH|ACTIVE|OFF_SHELF|FORCE_OFFLINE|ARCHIVED',
  'Sku.status': 'DRAFT|ACTIVE|INACTIVE|ARCHIVED',
  'SupplierProduct.status':
    'DRAFT|PENDING_MATERIAL_REVIEW|CORRECTION_REQUIRED|MATERIAL_APPROVED|ACTIVE|OFF_SHELF|REJECTED|ARCHIVED',
  'SupplierProductSku.status': 'DRAFT|ACTIVE|INACTIVE|ARCHIVED',
  'SupplyPriceChangeRequest.reviewStatus':
    'DRAFT|SUBMITTED|APPROVED|REJECTED|CANCELLED|EFFECTIVE',
};

const stringLengths = {
  'Category.name': 100,
  'InventoryChangeLog.referenceId': 191,
  'PriceChangeLog.changeReason': 1000,
  'PriceChangeLog.changedBy': 191,
  'PriceChangeLog.riskWarning': 1000,
  'Product.name': 200,
  'Sku.skuCode': 64,
  'SupplierProduct.brand': 120,
  'SupplierProduct.name': 200,
  'SupplierProductSku.supplierSkuCode': 64,
  'SupplyPriceChangeRequest.reviewReason': 1000,
  'SupplyPriceChangeRequest.reviewedBy': 191,
};

const isMoneyField = (name) => /Price$/u.test(name) && !/Version$/u.test(name);
const isQuantityField = (name) =>
  /Qty$|Stock$|Multiple$|Minutes$|level$|sortWeight$/u.test(name);

const resolveP0Ids = (row) => {
  if (row.P0 && row.P0 !== '待切片细化') {
    return row.P0.split(',').filter(Boolean);
  }
  const fallback = p0Fallbacks[row.Entity];
  if (!fallback) throw new Error(`M2_FIELD_P0_MISSING:${row.Entity}.${row.Field}`);
  return fallback;
};

const resolveFieldType = (row) => {
  const key = `${row.Entity}.${row.Field}`;
  if (enumTypes[key]) return enumTypes[key];
  if (key === 'SupplierProduct.enterprisePackageMultiple') return 'Int';
  if (key === 'SupplierProductSku.initialStock') return 'Int';
  if (/PriceVersion$/u.test(row.Field)) return 'Int';
  if (row.SuggestedType === 'String/UUID') return 'String(36)';
  if (row.SuggestedType === 'String') return `String(${stringLengths[key] ?? 191})`;
  if (/^String\(\d+\)$/u.test(row.SuggestedType)) return row.SuggestedType;
  if (row.SuggestedType === 'Int(分)') return isMoneyField(row.Field) ? 'Int' : 'Int';
  if (/^Enum<[^>]+>$/u.test(row.SuggestedType)) return row.SuggestedType;
  if (row.SuggestedType === 'Enum/String') {
    throw new Error(`M2_ENUM_TYPE_UNRESOLVED:${key}`);
  }
  if (['Boolean', 'DateTime', 'Int', 'Json'].includes(row.SuggestedType)) {
    return row.SuggestedType;
  }
  throw new Error(`M2_FIELD_TYPE_UNRESOLVED:${key}:${row.SuggestedType}`);
};

const resolveFieldFormat = (row, type) => {
  const key = `${row.Entity}.${row.Field}`;
  if (enumFormats[key]) return enumFormats[key];
  if (type === 'String(36)') return row.Required === 'NO' ? 'UUID v4; nullable' : 'UUID v4';
  if (type.startsWith('String(')) return `UTF-8; max ${type.slice(7, -1)} chars`;
  if (type === 'DateTime') return row.Required === 'NO'
    ? 'UTC ISO-8601; nullable'
    : 'UTC ISO-8601';
  if (type === 'Boolean') return 'true|false';
  if (type === 'Json') return 'canonical JSON object; schema-versioned';
  if (isMoneyField(row.Field)) return 'integer cents; >=0';
  if (/PriceVersion$|^version$/u.test(row.Field)) return 'positive monotonic integer';
  if (row.Field === 'quantityDelta') return 'signed non-zero integer quantity';
  if (row.Field === 'sortWeight') return 'signed integer sort weight';
  if (row.Field === 'level') return '1|2|3';
  if (isQuantityField(row.Field) || /Qty$|Stock$/u.test(row.Field)) {
    return 'non-negative integer quantity';
  }
  if (type === 'Int') return 'integer';
  throw new Error(`M2_FIELD_FORMAT_UNRESOLVED:${key}:${type}`);
};

const resolveSensitivity = (row) => {
  if (/SupplyPrice/u.test(row.Field) || row.Sensitivity === 'STRICT_INTERNAL_SUPPLY_PRICE') {
    return 'STRICT_INTERNAL_SUPPLY_PRICE';
  }
  return 'INTERNAL';
};

const resolveValidation = (row) => {
  if (['companyId', 'supplierId'].includes(row.Field)) {
    return 'derived from authenticated server session; client value rejected';
  }
  if (row.Field === 'skuId' && row.Entity === 'InventoryBalance') {
    return 'server-resolved active Sku; unique exactly once';
  }
  if (/SupplyPrice/u.test(row.Field)) {
    return 'integer cents; supplier pricing/company price review scope only; never public';
  }
  if (/RetailSalePrice|EnterpriseSalePrice/u.test(row.Field)) {
    return 'integer cents; pricing role only; versioned effective time; no approval task after listing';
  }
  if (/PriceVersion$|^version$/u.test(row.Field)) {
    return 'optimistic lock; increment exactly once per successful write';
  }
  if (row.Entity === 'InventoryBalance' && /Qty$/u.test(row.Field)) {
    return 'non-negative; transactional invariant; no lost update';
  }
  if (row.Entity === 'InventoryChangeLog') {
    return 'append-only; before/after arithmetic and idempotent reference must reconcile';
  }
  if (row.Field === 'templateVersion') {
    return 'must reference an immutable published template version';
  }
  if (row.Field === 'categoryId') {
    return 'must reference an enabled leaf category for product submission';
  }
  if (row.Field === 'fieldSchema') {
    return 'server validates field type, required, unit, enum, dependency and display-module schema';
  }
  if (row.Entity === 'CategoryTemplate' && row.Field !== 'id') {
    return 'new version only after publication; referenced versions cannot be overwritten';
  }
  if (row.Field === 'reviewedBy') {
    return 'authenticated natural identity; must differ from applicant identity when review separation applies';
  }
  if (row.Field === 'reviewReason' || row.Field === 'changeReason') {
    return 'trimmed non-empty reason for review or change';
  }
  if (row.Field === 'status' || row.Field === 'saleStatus' || row.Field === 'reviewStatus') {
    return 'enum value and legal transition enforced by domain state machine';
  }
  if (row.Field === 'parentId') {
    return 'nullable only for level 1; no cycles; parent level must be exactly one less';
  }
  if (row.Field === 'level') return 'integer 1..3; products bind only level 3';
  if (row.Field === 'name') return 'trimmed; non-empty; uniqueness enforced in owner scope';
  if (row.Field === 'initialStock') {
    return 'non-negative requested setup value; never a transaction inventory truth';
  }
  if (row.Field === 'enterprisePackageMultiple' || row.Field === 'enterpriseMinOrderQty') {
    return 'positive integer when enterprise procurement is enabled';
  }
  if (row.Field === 'isEnterpriseProcurementEnabled') {
    return 'true exposes only after Product ACTIVE, enterprise price effective, and shared inventory available';
  }
  if (row.Field === 'id' || /Id$/u.test(row.Field)) {
    return 'server-owned identifier; ownership verified before lookup result';
  }
  if (row.SuggestedType === 'Json') {
    return 'validated against frozen schema; canonicalized; dangerous rich-text content rejected';
  }
  return 'DTO whitelist; length/enum/ownership/state validation; client-derived ownership rejected';
};

const resolveField = (row) => {
  const type = resolveFieldType(row);
  return {
    name: row.Field,
    type,
    required: row.Required === 'YES',
    format: resolveFieldFormat(row, type),
    sensitivity: resolveSensitivity(row),
    visibility: row.Visibility,
    forbiddenExposure: row.ForbiddenExposure,
    validation: resolveValidation(row),
    historyRule: row.HistoryRule,
    p0Ids: resolveP0Ids(row),
  };
};

const validateFields = (fields) => {
  for (const field of fields) {
    const text = `${field.type}|${field.format}|${field.p0Ids.join(',')}`;
    if (/待M阶段冻结|待切片细化|String\/UUID|Enum\/String/u.test(text)) {
      throw new Error(`M2_FIELD_PLACEHOLDER:${field.entity}.${field.name}`);
    }
    if (!field.p0Ids.length) throw new Error(`M2_FIELD_P0_MISSING:${field.entity}.${field.name}`);
  }
  const byKey = new Map(fields.map((field) => [`${field.entity}.${field.name}`, field]));
  const expected = {
    'PriceChangeLog.priceType': 'Enum<PriceType>',
    'Sku.supplyPriceVersion': 'Int',
    'SupplierProduct.enterprisePackageMultiple': 'Int',
    'SupplierProductSku.initialStock': 'Int',
  };
  for (const [key, type] of Object.entries(expected)) {
    if (byKey.get(key)?.type !== type) throw new Error(`M2_FIELD_TYPE_INVALID:${key}`);
  }
};

const validatePermissions = (roles) => {
  const byCode = new Map(roles.map((role) => [role.roleCode, role]));
  for (const roleCode of ['COMPANY_PRODUCT_OPS', 'SUPPLIER_PRODUCT', 'SUPPLIER_INVENTORY']) {
    if (!['HIDDEN', 'STRICTLY_HIDDEN'].includes(byCode.get(roleCode)?.supplyPriceVisibility)) {
      throw new Error(`M2_PRODUCT_PAGE_SUPPLY_PRICE_EXPOSURE:${roleCode}`);
    }
  }
  if (byCode.get('SUPPLIER_PRICING')?.dataScope !== 'supplierId=当前供应商') {
    throw new Error('M2_PRICING_SUPPLIER_SCOPE_MISSING');
  }
};

const negativePlans = {
  'P0-006': [
    ['SUPPLIER_PRODUCT_NOT_SELLABLE', 'A SupplierProduct draft is queried as a sellable item', 'Return not-saleable and create no cart/order reference', 'PRODUCT_NOT_SALEABLE'],
    ['COMPANY_MAPPING_REQUIRED', 'Product/Sku creation is attempted before both approvals', 'Reject creation and keep supplier submission isolated', 'PRODUCT_APPROVAL_INCOMPLETE'],
    ['DIRECT_ENTITY_SERIALIZATION', 'A database product entity is returned directly', 'Response-whitelist test fails', 'RESPONSE_WHITELIST_VIOLATION'],
  ],
  'P0-007': [
    ['DUAL_APPROVAL_GATE', 'Material approval exists but initial price approval is missing', 'Product remains unavailable and unpublishable', 'PRODUCT_APPROVAL_INCOMPLETE'],
    ['ROLE_SPLIT', 'Product operations account decides a price review or price account decides material review', 'Return workspace forbidden with no state change', 'WORKSPACE_FORBIDDEN'],
    ['DUPLICATE_APPROVAL', 'The same approval decision is retried or submitted concurrently', 'Exactly one decision applies and duplicates are idempotent/conflict', 'APPROVAL_VERSION_CONFLICT'],
  ],
  'P0-008': [
    ['PRODUCT_PAGE_PRICE_LEAK', 'Supplier product page requests or receives any of the three prices', 'Reject request or fail response whitelist', 'PRICE_FIELD_FORBIDDEN'],
    ['COMPANY_SILENT_PRICE_CHANGE', 'Company attempts to write a supplier price without supplier submission', 'Reject the write and keep effective price unchanged', 'PRICE_APPLICANT_REQUIRED'],
    ['CROSS_SUPPLIER_PRICE', 'Supplier pricing account reads another supplier price', 'Return scope forbidden before lookup result', 'SUPPLIER_SCOPE_FORBIDDEN'],
  ],
  'P0-009': [
    ['SUPPLIER_STOREFRONT', 'A supplier storefront or decoration route is introduced', 'Forbidden-capability contract fails', 'FORBIDDEN_CAPABILITY'],
    ['SUPPLIER_DIRECT_PAYMENT', 'Catalog response offers supplier payment or settlement', 'Reject capability and expose company as sole counterparty', 'FORBIDDEN_CAPABILITY'],
    ['SUPPLIER_STORE_CART', 'Cart or coupon ownership is scoped as a supplier store', 'Boundary test fails', 'FORBIDDEN_CAPABILITY'],
  ],
  'P0-010': [
    ['SUPPLIER_FILTER_ESCAPE', 'More-products query returns a different supplierId', 'Omit foreign products', 'SUPPLIER_SCOPE_FORBIDDEN'],
    ['INACTIVE_PRODUCT_EXPOSURE', 'Query includes draft/off-shelf/force-offline products', 'Omit all non-ACTIVE products', 'PRODUCT_NOT_SALEABLE'],
    ['STORE_SEMANTICS', 'More-products response contains store decoration, store cart or supplier settlement fields', 'Response contract fails', 'FORBIDDEN_CAPABILITY'],
  ],
  'P0-011': [
    ['NON_LEAF_BINDING', 'A product binds to level 1 or 2 category', 'Reject the submission', 'CATEGORY_NOT_LEAF'],
    ['DISABLED_CATEGORY', 'A product submits against a disabled category', 'Reject the submission and publish nothing', 'CATEGORY_DISABLED'],
    ['REFERENCED_CATEGORY_DELETE', 'A referenced category is physically deleted', 'Reject deletion and retain historical references', 'CATEGORY_REFERENCED'],
    ['CATEGORY_CYCLE', 'A category parent creates a cycle or skips a level', 'Reject the write', 'CATEGORY_PARENT_INVALID'],
  ],
  'P0-012': [
    ['TEMPLATE_VERSION_OVERWRITE', 'A published/referenced template version is edited in place', 'Reject overwrite and require a new version', 'TEMPLATE_VERSION_IMMUTABLE'],
    ['UNPUBLISHED_TEMPLATE', 'A product submits with draft or retired template', 'Reject the submission', 'CATEGORY_TEMPLATE_INVALID'],
    ['TEMPLATE_SCHEMA_INVALID', 'Field type, unit, enum, SKU dimension or module schema is invalid', 'Reject version publication', 'TEMPLATE_SCHEMA_INVALID'],
  ],
  'P0-013': [
    ['FOOD_REQUIRED_FIELD_MISSING', 'Food template omits ingredients, nutrition, licence, shelf life, storage or allergens', 'Template/publication validation fails', 'TEMPLATE_SCHEMA_INVALID'],
    ['FOOD_WARNING_OVERRIDE', 'Supplier rich text hides or rewrites a fixed food warning', 'Reject content and retain fixed warning module', 'REGULATORY_WARNING_REQUIRED'],
    ['FOOD_HISTORY_REWRITE', 'Template upgrade changes an existing food snapshot', 'Historical snapshot remains unchanged', 'TEMPLATE_VERSION_IMMUTABLE'],
  ],
  'P0-014': [
    ['FRESH_REQUIRED_FIELD_MISSING', 'Fresh template omits origin, grade, freshness, temperature, weighing or after-sale rules', 'Template/publication validation fails', 'TEMPLATE_SCHEMA_INVALID'],
    ['FRESH_WEIGHT_RULE_INVALID', 'Weighing rule conflicts with SKU/unit contract', 'Reject template or product submission', 'TEMPLATE_VALIDATION_FAILED'],
    ['FRESH_HISTORY_REWRITE', 'Template upgrade changes an existing fresh-product snapshot', 'Historical snapshot remains unchanged', 'TEMPLATE_VERSION_IMMUTABLE'],
  ],
  'P0-015': [
    ['APPAREL_REQUIRED_FIELD_MISSING', 'Apparel template omits color/size SKU, material, size chart or care', 'Template/publication validation fails', 'TEMPLATE_SCHEMA_INVALID'],
    ['APPAREL_SKU_DUPLICATE', 'Color and size dimensions generate duplicate SKU combinations', 'Reject SKU matrix', 'SKU_DIMENSION_DUPLICATE'],
    ['APPAREL_HISTORY_REWRITE', 'Template upgrade changes an existing apparel snapshot', 'Historical snapshot remains unchanged', 'TEMPLATE_VERSION_IMMUTABLE'],
  ],
  'P0-016': [
    ['DIGITAL_REQUIRED_FIELD_MISSING', 'Digital template omits model, specifications, efficiency, package or warranty', 'Template/publication validation fails', 'TEMPLATE_SCHEMA_INVALID'],
    ['DIGITAL_MODEL_DUPLICATE', 'Two enabled SKUs use an indistinguishable model key', 'Reject product submission', 'SKU_DIMENSION_DUPLICATE'],
    ['DIGITAL_HISTORY_REWRITE', 'Template upgrade changes an existing digital snapshot', 'Historical snapshot remains unchanged', 'TEMPLATE_VERSION_IMMUTABLE'],
  ],
  'P0-017': [
    ['BUNDLE_ITEM_MISSING', 'Bundle has no child item, quantity, specification or minimum expiry', 'Reject submission', 'BUNDLE_SCHEMA_INVALID'],
    ['BUNDLE_CROSS_SUPPLIER', 'Bundle references another supplier draft as an editable child', 'Reject object scope', 'SUPPLIER_SCOPE_FORBIDDEN'],
    ['BUNDLE_HISTORY_REWRITE', 'Child changes rewrite a published bundle snapshot', 'Historical bundle snapshot remains unchanged', 'TEMPLATE_VERSION_IMMUTABLE'],
  ],
  'P0-018': [
    ['REGULATED_DEFAULT_DENY', 'A regulated category lacks an explicit company enablement', 'Keep listing and trading disabled', 'REGULATED_CATEGORY_DISABLED'],
    ['REGULATED_QUALIFICATION_MISSING', 'Company or product qualification is missing/expired', 'Reject approval or force item unavailable', 'QUALIFICATION_REQUIRED'],
    ['REGULATED_TEMPLATE_MISSING', 'A regulated category has no published compliant template', 'Reject product submission', 'CATEGORY_TEMPLATE_INVALID'],
  ],
  'P0-019': [
    ['UNAPPROVED_SUPPLY_PRICE_EFFECT', 'Listed SKU requested supply price is applied before approval/effective time', 'Keep old approved supply price', 'SUPPLY_PRICE_REVIEW_REQUIRED'],
    ['SALE_PRICE_APPROVAL_CREATED', 'Retail or enterprise sale-price change creates an approval task', 'Reject the workflow regression; append PriceChangeLog only', 'SALE_PRICE_APPROVAL_FORBIDDEN'],
    ['PRICE_HISTORY_OVERWRITE', 'A prior price version/log is updated in place', 'Reject overwrite and append a new version/log', 'PRICE_HISTORY_IMMUTABLE'],
    ['CONCURRENT_PRICE_EFFECT', 'Two changes affect the same SKU/version concurrently', 'Exactly one version wins; the other receives conflict', 'VERSION_CONFLICT'],
  ],
  'P0-021': [
    ['SUPPLY_PRICE_RESPONSE_LEAK', 'Public/consumer/enterprise/runner response contains supply price or derivable margin', 'Response-whitelist test fails', 'SENSITIVE_FIELD_LEAK'],
    ['SUPPLY_PRICE_CACHE_INDEX_LEAK', 'Supply price appears in public cache, search index or analytics payload', 'Security scan fails and payload is rejected', 'SENSITIVE_FIELD_LEAK'],
    ['WRONG_CHANNEL_SALE_PRICE', 'Consumer receives enterprise price or enterprise receives retail price', 'Channel DTO contract fails', 'FIELD_FORBIDDEN'],
  ],
  'P0-061': [
    ['DUPLICATE_CHANNEL_PRODUCT', 'Retail and enterprise channels create different Product/Sku resources', 'Uniqueness contract fails', 'DUPLICATE_CATALOG_RESOURCE'],
    ['ENTERPRISE_FLAG_DISABLED', 'Non-procurement product enters enterprise catalog', 'Omit the product', 'PRODUCT_NOT_SALEABLE'],
    ['CHANNEL_FLAG_HISTORY', 'Disabling enterprise flag changes historical enterprise orders', 'Existing snapshots remain unchanged', 'HISTORY_IMMUTABLE'],
  ],
  'P0-063': [
    ['DUPLICATE_INVENTORY_BALANCE', 'A second InventoryBalance is created for one SKU/channel', 'Reject unique constraint', 'INVENTORY_BALANCE_DUPLICATE'],
    ['INVENTORY_NEGATIVE', 'Adjustment makes any balance quantity negative', 'Reject transaction and write no partial log', 'INVENTORY_NEGATIVE'],
    ['CONCURRENT_LOST_UPDATE', 'Concurrent adjustments use the same version', 'Exactly one succeeds and the other receives conflict', 'INVENTORY_VERSION_CONFLICT'],
    ['DUPLICATE_ADJUSTMENT', 'Same idempotency key is retried', 'Return original result and append no duplicate log', 'IDEMPOTENCY_CONFLICT'],
  ],
  'P0-071': [
    ['SAME_NATURAL_PERSON_REVIEW', 'Applicant and reviewer share identityType+identityId through different accounts', 'Reject review with no state change', 'SAME_NATURAL_PERSON_REVIEW_FORBIDDEN'],
    ['PRICE_PAGE_ROLE_MISMATCH', 'Product role opens price page/API or price role edits product material', 'Return workspace forbidden', 'WORKSPACE_FORBIDDEN'],
    ['CONCURRENT_REVIEW', 'Two price reviewers decide the same version concurrently', 'Exactly one succeeds and the other receives conflict', 'APPROVAL_VERSION_CONFLICT'],
    ['REASONLESS_BULK_APPROVAL', 'Supply-price requests are approved in bulk without item reasons', 'Reject the operation', 'REVIEW_REASON_REQUIRED'],
  ],
};

const buildNegativeTests = (taskByP0) =>
  expectedP0Ids.flatMap((p0Id) => {
    const taskId = taskByP0.get(p0Id)?.TaskID;
    const plans = negativePlans[p0Id];
    if (!taskId || !plans?.length) throw new Error(`M2_NEGATIVE_PLAN_MISSING:${p0Id}`);
    return plans.map(([category, scenario, expected, errorCode], index) => ({
      id: `NEG-M2-${p0Id.slice(3)}-${String(index + 1).padStart(2, '0')}`,
      taskId,
      p0Id,
      category,
      scenario,
      expected,
      errorCode,
      executionStatus: 'NOT_EXECUTED',
      evidenceRequired: 'AUTOMATED_TEST_ID_AND_COMMAND',
    }));
  });

const generate = async () => {
  const [fields, states, permissions, pages, apis, tasks, p0Rows, dependencies, migrations] =
    await Promise.all([
      readCsv('05-字段字典初始版.csv'),
      readCsv('06-状态机总表.csv'),
      readCsv('07-权限与数据可见矩阵.csv'),
      readCsv('08-页面路由接口P0映射.csv'),
      readCsv('12-OpenAPI-DTO-错误码台账.csv'),
      readCsv('03-任务台账.csv'),
      readCsv('04-P0-1至P0-119验收矩阵.csv'),
      readCsv('09-外部依赖与人工事项.csv'),
      readCsv('11-数据库迁移台账.csv'),
    ]);

  const m2Fields = fields.filter(({ Stage }) => Stage === 'M2');
  const resolvedFields = m2Fields.map((row) => ({ entity: row.Entity, ...resolveField(row) }));
  validateFields(resolvedFields);
  const entities = [...new Set(resolvedFields.map(({ entity }) => entity))].map((entity) => ({
    entity,
    fields: resolvedFields
      .filter((field) => field.entity === entity)
      .map((field) =>
        Object.fromEntries(Object.entries(field).filter(([key]) => key !== 'entity')),
      ),
  }));

  const m2States = states.filter(({ Stage }) => Stage === 'M2');
  const transitions = m2States.map((row) => ({
    id: `${row.StateMachine}:${row.CurrentState}:${row.Event}`,
    stateMachine: row.StateMachine,
    currentState: row.CurrentState,
    event: row.Event,
    nextState: row.NextState,
    allowedActor: row.AllowedActor,
    guard: row.Guard,
    sideEffect: row.SideEffect,
    idempotency: row.Idempotency,
    illegalTransition: row.IllegalTransition,
    concurrencyControl: row.ConcurrencyControl,
    history: row.History,
    p0Ids: row.P0.split(',').filter(Boolean),
  }));

  const roles = permissions
    .filter(({ Stage }) => Stage === 'M2')
    .map((row) => ({
      ownerType: row.OwnerType,
      roleCode: row.RoleCode,
      roleName: row.RoleName,
      entryRoute: row.EntryRoute,
      readScope: row.ReadScope,
      writeScope: row.WriteScope,
      approvalAuthority: row.ApprovalAuthority,
      supplyPriceVisibility: row.SupplyPriceVisibility,
      dataScope: row.DataScope,
      forbiddenActions: row.ForbiddenActions,
      secondVerification: row.SecondVerification,
      sessionBoundary: row.SessionBoundary,
      p0Ids: row.P0.split(',').filter(Boolean),
    }));
  validatePermissions(roles);

  const pageContracts = pages
    .filter(({ Stage }) => Stage === 'M2')
    .map((row) => ({
      pageId: row.PageID,
      platform: row.Platform,
      pageName: row.PageName,
      route: row.Route,
      actor: row.Actor,
      authPolicy: row.AuthPolicy,
      supplyPricePolicy: row.SupplyPricePolicy,
      apiGroup: row.APIGroup,
      requiredUiStates: row.RequiredUIStates.split(/[；,]/u).map((value) => value.trim()).filter(Boolean),
      shellImplementationStatus: row.ImplementationStatus,
      businessImplementationStatus: 'NOT_IMPLEMENTED',
      p0Ids: row.P0.split(',').filter(Boolean),
    }));

  const apiRows = apis.filter(({ Stage }) => Stage === 'M2');
  const apiContracts = apiRows.map((row) => ({
    contractId: row.ContractID,
    domain: row.Domain,
    method: row.Method,
    path: row.Path,
    actor: row.Actor,
    requestDto: row.RequestDTO,
    responseDto: row.ResponseDTO,
    errorCodes: row.ErrorCodes.split('|').filter(Boolean),
    idempotency: row.Idempotency,
    sensitiveFieldPolicy: row.SensitiveFieldPolicy,
    moneyRule: 'INTEGER_CENTS_ONLY',
    p0Ids: row.P0.split(',').filter(Boolean),
    openApiStatus: 'PLANNED',
    runtimeStatus: 'NOT_IMPLEMENTED',
  }));

  const taskByP0 = new Map(
    tasks
      .filter(({ Stage, P0ID }) => Stage === 'M2' && expectedP0Ids.includes(P0ID))
      .map((row) => [row.P0ID, row]),
  );
  const negativeTests = buildNegativeTests(taskByP0);
  const p0ById = new Map(p0Rows.map((row) => [row.P0ID, row]));

  const contractRefsFor = (p0Id) => ({
    fields: resolvedFields
      .filter((field) => field.p0Ids.includes(p0Id))
      .map((field) => `${field.entity}.${field.name}`),
    states: transitions
      .filter((transition) => transition.p0Ids.includes(p0Id))
      .map(({ id }) => id),
    roles: roles
      .filter((role) => role.p0Ids.includes(p0Id))
      .map(({ roleCode }) => roleCode),
    pages: pageContracts
      .filter((page) => page.p0Ids.includes(p0Id))
      .map(({ pageId }) => pageId),
    apis: apiContracts
      .filter((contract) => contract.p0Ids.includes(p0Id))
      .map(({ contractId }) => contractId),
  });

  const slices = expectedP0Ids.map((p0Id) => {
    const task = taskByP0.get(p0Id);
    const p0 = p0ById.get(p0Id);
    if (!task || !p0) throw new Error(`M2_SLICE_TRACE_MISSING:${p0Id}`);
    const contractRefs = contractRefsFor(p0Id);
    if (Object.values(contractRefs).flat().length === 0) {
      throw new Error(`M2_SLICE_CONTRACT_REF_MISSING:${p0Id}`);
    }
    return {
      taskId: task.TaskID,
      p0Id,
      title: task.Title,
      acceptance: p0.Acceptance,
      dependencies: task.Dependencies.split(',').filter(Boolean),
      contractRefs,
      negativeTestIds: negativeTests
        .filter((negative) => negative.p0Id === p0Id)
        .map(({ id }) => id),
      implementationStatus: 'NOT_STARTED',
    };
  });

  return {
    schemaVersion: '1.0.0',
    taskId: 'M2-000',
    stage: 'M2',
    status: 'CONTRACT_FROZEN',
    implementationStatus: 'NOT_IMPLEMENTED',
    frozenAt: '2026-08-09T02:00:00-04:00',
    baseline: {
      schemeSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
      mainCommit: '162787ae1687116badf0972664005332220976f9',
      m1GatePullRequest: 34,
      m1GateMergeCommit: '162787ae1687116badf0972664005332220976f9',
      m1GateMainCiRun: '31295823535',
      m1GateMainCiJob: '93200635788',
    },
    scope: {
      p0Ids: expectedP0Ids,
      businessTaskIds: expectedP0Ids.map((p0Id) => taskByP0.get(p0Id).TaskID),
      businessSliceStarted: false,
      nextAllowedAfterMergeAndGreenCi: 'M2-P006',
      nonGoals: ['ORDERING', 'PAYMENT', 'WELFARE_CARD', 'DELIVERY', 'SETTLEMENT'],
    },
    sourceLedgers: {
      fields: '福礼社Codex5.6开发执行包V1.1/05-字段字典初始版.csv',
      states: '福礼社Codex5.6开发执行包V1.1/06-状态机总表.csv',
      permissions: '福礼社Codex5.6开发执行包V1.1/07-权限与数据可见矩阵.csv',
      pages: '福礼社Codex5.6开发执行包V1.1/08-页面路由接口P0映射.csv',
      apis: '福礼社Codex5.6开发执行包V1.1/12-OpenAPI-DTO-错误码台账.csv',
      p0: '福礼社Codex5.6开发执行包V1.1/04-P0-1至P0-119验收矩阵.csv',
      tasks: '福礼社Codex5.6开发执行包V1.1/03-任务台账.csv',
    },
    fieldContract: { entityCount: entities.length, fieldCount: resolvedFields.length, entities },
    stateContract: {
      transitionCount: transitions.length,
      transitions,
      illegalTransition: {
        errorCode: 'STATE_TRANSITION_INVALID',
        httpStatus: 409,
        sideEffect: 'NONE_EXCEPT_AUDIT',
      },
      concurrency: { mode: 'OPTIMISTIC_VERSION_AND_UNIQUE_KEY', affectedRows: 1 },
      history: 'APPEND_ONLY_OR_IMMUTABLE_SNAPSHOT',
    },
    permissionContract: {
      roleCodes: roles.map(({ roleCode }) => roleCode),
      roles,
      defaultDecision: 'DENY',
      ownershipDerivedFromSession: true,
      objectScopeCheckedBeforeLookupResult: true,
      session: { activeFunctionalAccountLimit: 1, roleSwitchReissuesSession: true },
    },
    pageContract: {
      pageIds: pageContracts.map(({ pageId }) => pageId),
      pages: pageContracts,
      businessModulesDeferred: true,
    },
    apiContract: {
      contractIds: apiContracts.map(({ contractId }) => contractId),
      contracts: apiContracts,
      commonResponse: 'ApiResponse<T>',
      commonErrors: ['AUTHENTICATION_REQUIRED', 'WORKSPACE_FORBIDDEN', 'VALIDATION_FAILED'],
      objectScopeCheckedBeforeLookupResult: true,
      databaseEntityReturnedDirectly: false,
      forbiddenPublicFields: [
        'supplyPrice',
        'approvedSupplyPrice',
        'requestedSupplyPrice',
        'supplyPriceSnapshot',
        'supplierPayable',
        'grossMargin',
      ],
      deterministicOpenApiRequired: true,
      generatedTypesRequired: true,
    },
    migrationContract: migrations
      .filter(({ Stage }) => Stage === 'M2')
      .map((row) => ({
        migrationId: row.MigrationID,
        plannedName: row.PlannedName,
        dependsOn: row.DependsOn,
        objects: row.Objects.split('/'),
        status: 'PLANNED_NOT_CREATED',
        recovery: row.BackwardOrRecovery,
        verification: row.Verification,
      })),
    invariants: {
      singleMerchant: {
        customerCounterparty: 'COMPANY_ONLY',
        supplierIsStore: false,
        supplierDirectPayment: false,
      },
      catalog: {
        supplierProductSellable: false,
        productSkuOwnedBy: 'COMPANY',
        channelsShareProductSku: true,
        enterpriseFlagCreatesDuplicateResource: false,
      },
      categoryTemplate: {
        productBindsLeafCategoryOnly: true,
        publishedVersionImmutable: true,
        regulatedDefault: 'DENY',
      },
      supplyPrice: {
        defaultPolicy: 'NEVER_RETURN',
        customerVisibility: [],
        authorizedRoles: [
          'COMPANY_PRICE_REVIEW',
          'COMPANY_FINANCE',
          'SUPPLIER_PRICING_OWN',
          'SUPPLIER_FINANCE_OWN',
        ],
      },
      priceChange: {
        amountUnit: 'INTEGER_CENTS',
        supplyPriceRequiresApproval: true,
        salePriceRequiresApproval: false,
        appendOnlyPriceLog: true,
        historicalOrderSnapshotMutable: false,
      },
      inventory: {
        uniqueBalancePerSku: true,
        duplicateChannelInventory: false,
        negativeQuantityAllowed: false,
        optimisticVersionRequired: true,
        changeLogAppendOnly: true,
      },
      makerChecker: {
        identityKey: 'identityType+identityId',
        superAdminBypass: false,
      },
    },
    slices,
    negativeTests,
    humanDependencies: dependencies
      .filter(({ EarliestStage }) => EarliestStage === 'M2')
      .map((row) => ({
        dependencyId: row.DependencyID,
        category: row.Category,
        requiredInputOrDecision: row.RequiredInputOrDecision,
        owner: row.Owner,
        status: row.CurrentStatus,
        blockingTask: row.BlockingTask,
        blocksFormalAcceptance: row.BlocksFormalAcceptance === 'YES',
        blocksContractFreeze: false,
        safetyBoundary: row.SafeFallback,
        guessedByCode: false,
      })),
    inheritedEvidence: {
      p0Ids: ['P0-045', 'P0-046', 'P0-047', 'P0-048', 'P0-049', 'P0-068', 'P0-070', 'P0-072'],
      source: 'M1 merged-main technical evidence and M0 quality gates',
      downgradeAllowed: false,
    },
    evidenceBoundary: {
      contractReview: 'LOCAL_PASS_AFTER_TEST',
      negativeTests: 'PLANNED_NOT_EXECUTED',
      businessApis: 'NOT_IMPLEMENTED',
      prismaMigrations: 'NOT_CREATED',
      businessPages: 'NOT_IMPLEMENTED',
      staging: 'NOT_EXECUTED',
      device: 'NOT_REQUIRED_M2_PC_CONTRACT_FREEZE',
      production: 'NOT_EXECUTED',
    },
  };
};

const mode = process.argv[2] ?? '--write';
if (mode === '--validate-field-fixture') {
  const fields = JSON.parse(await readFile(path.resolve(process.argv[3]), 'utf8'));
  validateFields(fields);
  process.stdout.write('M2_FIELD_FIXTURE_OK\n');
} else if (mode === '--validate-permission-fixture') {
  const roles = JSON.parse(await readFile(path.resolve(process.argv[3]), 'utf8'));
  validatePermissions(roles);
  process.stdout.write('M2_PERMISSION_FIXTURE_OK\n');
} else {
  const artifact = await generate();
  const generated = `${JSON.stringify(artifact, null, 2)}\n`;
  if (mode === '--check') {
    const committed = await readFile(outputPath, 'utf8');
    const frozen = JSON.parse(committed);
    const canonical = `${JSON.stringify(frozen, null, 2)}\n`;
    if (committed !== canonical) throw new Error('M2_CONTRACT_FREEZE_NOT_CANONICAL');
    if (frozen.taskId !== 'M2-000' || frozen.status !== 'CONTRACT_FROZEN') {
      throw new Error('M2_CONTRACT_FREEZE_IDENTITY_INVALID');
    }
    validateFields(
      frozen.fieldContract.entities.flatMap(({ entity, fields }) =>
        fields.map((field) => ({ entity, ...field })),
      ),
    );
    validatePermissions(frozen.permissionContract.roles);
    process.stdout.write('M2_CONTRACT_FREEZE_CHECK_OK\n');
  } else if (mode === '--write') {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, generated, 'utf8');
    process.stdout.write(`M2_CONTRACT_FREEZE_WRITTEN:${outputPath}\n`);
  } else {
    throw new Error(`M2_CONTRACT_FREEZE_MODE_INVALID:${mode}`);
  }
}
