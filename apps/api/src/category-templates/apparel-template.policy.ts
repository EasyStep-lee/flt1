import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

import { SafeApiError } from '../http/api-error.js';
import type {
  CategoryTemplateDefinition,
  TemplateFieldDefinition,
} from './category-template.policy.js';

const requiredProductFields = Object.freeze([
  ['fabric', 'materials', 'TEXT'],
  ['lining', 'materials', 'TEXT'],
  ['fit', 'size-assistant', 'TEXT'],
  ['execution-standard', 'materials', 'TEXT'],
  ['care-instructions', 'care-instructions', 'TEXT'],
  ['size-chart', 'size-assistant', 'RICH_TEXT'],
] as const);

const requiredSkuFields = Object.freeze([
  ['color', 'specifications', 'TEXT'],
  ['size', 'specifications', 'TEXT'],
] as const);

const requiredModules = Object.freeze([
  ['size-assistant', 'FIELDS'],
  ['materials', 'FIELDS'],
  ['care-instructions', 'FIELDS'],
  ['specifications', 'FIELDS'],
  ['apparel-after-sales', 'AFTER_SALE'],
] as const);

const unsafeMarkupPattern = /<[^>]+>|javascript:|data:text\/html|on(?:error|load|click)\s*=/iu;
const afterSaleOverridePattern = /after[-_]?sales?|return[-_]?policy|refund[-_]?rule|try[-_]?on[-_]?return/iu;

const schemaInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_SCHEMA_INVALID', message);
};

const dataInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_DATA_INVALID', message);
};

const requiredMissing = (fieldKey: string): never => {
  throw new SafeApiError(
    422,
    'APPAREL_REQUIRED_FIELD_MISSING',
    `APPAREL field ${fieldKey} is required`,
  );
};

const duplicateSku = (): never => {
  throw new SafeApiError(
    422,
    'SKU_DIMENSION_DUPLICATE',
    'APPAREL color and size combinations must be unique',
  );
};

const fieldByKey = (
  definition: CategoryTemplateDefinition,
  fieldKey: string,
): TemplateFieldDefinition | undefined =>
  definition.fieldSchema.fields.find(({ key }) => key === fieldKey);

export const assertApparelTemplateDefinition = (
  definition: CategoryTemplateDefinition,
): void => {
  if (definition.profile !== 'APPAREL') return;

  for (const [moduleKey, kind] of requiredModules) {
    const module = definition.detailModules.modules.find(({ key }) => key === moduleKey);
    if (!module || module.kind !== kind) {
      schemaInvalid(`APPAREL template requires ${moduleKey} as ${kind}`);
    }
  }

  for (const [fieldKey, moduleKey, type] of [
    ...requiredProductFields,
    ...requiredSkuFields,
  ]) {
    const field = fieldByKey(definition, fieldKey);
    if (
      !field ||
      !field.required ||
      field.type !== type ||
      field.enumValues.length !== 0 ||
      field.detailModuleKey !== moduleKey ||
      field.specification !== requiredSkuFields.some(([key]) => key === fieldKey)
    ) {
      schemaInvalid(`APPAREL template field ${fieldKey} is missing or invalid`);
    }
  }

  const dimensions = new Map(
    definition.skuDimensions.dimensions.map(({ key, fieldKey }) => [key, fieldKey]),
  );
  if (
    dimensions.size !== requiredSkuFields.length ||
    requiredSkuFields.some(([fieldKey]) => dimensions.get(fieldKey) !== fieldKey)
  ) {
    schemaInvalid('APPAREL template requires color and size SKU dimensions');
  }

  if (
    definition.fieldSchema.fields.some(
      ({ detailModuleKey }) => detailModuleKey === 'apparel-after-sales',
    )
  ) {
    schemaInvalid('The APPAREL after-sales module cannot contain supplier fields');
  }
  if (
    definition.afterSaleRules.returnPolicy !== 'CATEGORY_RESTRICTED' ||
    !definition.afterSaleRules.notice.includes(COMPANY_LEGAL_NAME) ||
    unsafeMarkupPattern.test(definition.afterSaleRules.notice)
  ) {
    schemaInvalid('APPAREL after-sales must use the company category-restricted rule');
  }
};

type TemplateContent = {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly skus: readonly { readonly attributes: Readonly<Record<string, unknown>> }[];
};

const inspectAfterSaleOverride = (value: unknown, key = ''): void => {
  if (afterSaleOverridePattern.test(key)) {
    dataInvalid('APPAREL supplier content cannot override the company after-sales rule');
  }
  if (Array.isArray(value)) {
    value.forEach((child) => inspectAfterSaleOverride(child, key));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
    inspectAfterSaleOverride(child, childKey);
  }
};

const requireValue = (value: unknown, field: TemplateFieldDefinition): string => {
  if (typeof value !== 'string') {
    return requiredMissing(field.key);
  }
  const normalized = value.trim();
  if (!normalized) {
    return requiredMissing(field.key);
  }
  const maximum = field.validation.maxLength ?? 500;
  if (
    normalized.length > Math.min(maximum, 2000) ||
    unsafeMarkupPattern.test(normalized)
  ) {
    dataInvalid(`APPAREL field ${field.key} is invalid`);
  }
  return normalized;
};

const dimensionKey = (value: string): string =>
  value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');

export const validateApparelSupplierProductTemplateContent = (
  definition: CategoryTemplateDefinition,
  content: TemplateContent,
): void => {
  if (definition.profile !== 'APPAREL') return;
  inspectAfterSaleOverride(content);

  const productFields = definition.fieldSchema.fields.filter(({ specification }) => !specification);
  const skuFields = definition.fieldSchema.fields.filter(({ specification }) => specification);
  const productFieldKeys = new Set(productFields.map(({ key }) => key));
  const skuFieldKeys = new Set(skuFields.map(({ key }) => key));
  if (Object.keys(content.attributes).some((key) => !productFieldKeys.has(key))) {
    dataInvalid('APPAREL product attributes contain a field outside the published template whitelist');
  }
  for (const field of productFields) {
    if (field.required || Object.prototype.hasOwnProperty.call(content.attributes, field.key)) {
      requireValue(content.attributes[field.key], field);
    }
  }
  if (content.skus.length < 1) requiredMissing('sku');

  const combinations = new Set<string>();
  for (const sku of content.skus) {
    if (Object.keys(sku.attributes).some((key) => !skuFieldKeys.has(key))) {
      dataInvalid('APPAREL SKU attributes contain a field outside the published template whitelist');
    }
    for (const field of skuFields) {
      if (field.required || Object.prototype.hasOwnProperty.call(sku.attributes, field.key)) {
        requireValue(sku.attributes[field.key], field);
      }
    }
    const color = requireValue(sku.attributes.color, fieldByKey(definition, 'color')!);
    const size = requireValue(sku.attributes.size, fieldByKey(definition, 'size')!);
    const combination = `${dimensionKey(color)}\u0000${dimensionKey(size)}`;
    if (combinations.has(combination)) duplicateSku();
    combinations.add(combination);
  }
};

export const APPAREL_PRODUCT_FIELD_KEYS = requiredProductFields.map(([key]) => key);
export const APPAREL_SKU_FIELD_KEYS = requiredSkuFields.map(([key]) => key);
