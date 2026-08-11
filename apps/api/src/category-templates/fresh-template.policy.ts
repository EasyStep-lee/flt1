import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

import { SafeApiError } from '../http/api-error.js';
import type {
  CategoryTemplateDefinition,
  TemplateFieldDefinition,
  TemplateFieldType,
} from './category-template.policy.js';

const requiredProductFields = Object.freeze([
  ['variety', 'origin-traceability', 'TEXT', []],
  ['grade', 'origin-traceability', 'TEXT', []],
  ['origin', 'origin-traceability', 'TEXT', []],
  ['harvest-slaughter-date', 'freshness-storage', 'DATE', []],
  ['freshness-period', 'freshness-storage', 'TEXT', []],
  ['temperature-zone', 'freshness-storage', 'ENUM', ['AMBIENT', 'CHILLED', 'FROZEN']],
  ['weighing-rule', 'weighing-difference', 'ENUM', ['FIXED_WEIGHT', 'ACTUAL_WEIGHT']],
] as const);

const requiredSkuFields = Object.freeze([
  ['weight-tier', 'specifications', 'TEXT', []],
  ['specification', 'specifications', 'TEXT', []],
  ['processing-method', 'specifications', 'TEXT', []],
] as const);

const requiredModules = Object.freeze([
  ['origin-traceability', 'FIELDS'],
  ['freshness-storage', 'FIELDS'],
  ['weighing-difference', 'FIELDS'],
  ['specifications', 'FIELDS'],
  ['fresh-after-sales', 'AFTER_SALE'],
] as const);

const unsafeMarkupPattern = /<[^>]+>|javascript:|data:text\/html|on(?:error|load|click)\s*=/iu;
const afterSaleOverridePattern = /after[-_]?sales?|return[-_]?policy|refund[-_]?rule/iu;

const schemaInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_SCHEMA_INVALID', message);
};

const dataInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_DATA_INVALID', message);
};

const requiredMissing = (fieldKey: string): never => {
  throw new SafeApiError(
    422,
    'FRESH_REQUIRED_FIELD_MISSING',
    `FRESH field ${fieldKey} is required`,
  );
};

const ruleInvalid = (fieldKey: string): never => {
  throw new SafeApiError(
    422,
    'FRESH_WEIGHT_RULE_INVALID',
    `FRESH field ${fieldKey} does not match the published rule`,
  );
};

const fieldByKey = (
  definition: CategoryTemplateDefinition,
  fieldKey: string,
): TemplateFieldDefinition | undefined =>
  definition.fieldSchema.fields.find(({ key }) => key === fieldKey);

const sameEnum = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && actual.every((value, index) => value === expected[index]);

export const assertFreshTemplateDefinition = (
  definition: CategoryTemplateDefinition,
): void => {
  if (definition.profile !== 'FRESH') return;

  for (const [moduleKey, kind] of requiredModules) {
    const module = definition.detailModules.modules.find(({ key }) => key === moduleKey);
    if (!module || module.kind !== kind) {
      schemaInvalid(`FRESH template requires ${moduleKey} as ${kind}`);
    }
  }

  for (const [fieldKey, moduleKey, type, enumValues] of [
    ...requiredProductFields,
    ...requiredSkuFields,
  ]) {
    const field = fieldByKey(definition, fieldKey);
    if (
      !field ||
      !field.required ||
      field.type !== type ||
      field.detailModuleKey !== moduleKey ||
      field.specification !== requiredSkuFields.some(([key]) => key === fieldKey) ||
      !sameEnum(field.enumValues, enumValues)
    ) {
      schemaInvalid(`FRESH template field ${fieldKey} is missing or invalid`);
    }
  }

  const dimensions = new Map(
    definition.skuDimensions.dimensions.map(({ key, fieldKey }) => [key, fieldKey]),
  );
  if (
    dimensions.size !== requiredSkuFields.length ||
    requiredSkuFields.some(([fieldKey]) => dimensions.get(fieldKey) !== fieldKey)
  ) {
    schemaInvalid(
      'FRESH template requires weight-tier, specification and processing-method SKU dimensions',
    );
  }

  if (
    definition.fieldSchema.fields.some(
      ({ detailModuleKey }) => detailModuleKey === 'fresh-after-sales',
    )
  ) {
    schemaInvalid('The FRESH after-sales module cannot contain supplier fields');
  }
  if (
    definition.afterSaleRules.returnPolicy !== 'CATEGORY_RESTRICTED' ||
    !definition.afterSaleRules.notice.includes(COMPANY_LEGAL_NAME) ||
    unsafeMarkupPattern.test(definition.afterSaleRules.notice)
  ) {
    schemaInvalid('FRESH after-sales must use the company category-restricted rule');
  }
}

type TemplateContent = {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly skus: readonly { readonly attributes: Readonly<Record<string, unknown>> }[];
};

const inspectAfterSaleOverride = (value: unknown, key = ''): void => {
  if (afterSaleOverridePattern.test(key)) {
    dataInvalid('FRESH supplier content cannot override the company after-sales rule');
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

const validIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
  );
};

const requireValue = (
  value: unknown,
  field: TemplateFieldDefinition,
): void => {
  if (typeof value !== 'string' || !value.trim()) requiredMissing(field.key);
  const text = value as string;
  if (text.length > 500 || unsafeMarkupPattern.test(text)) {
    dataInvalid(`FRESH field ${field.key} is invalid`);
  }
  if (field.type === 'DATE' && !validIsoDate(text)) ruleInvalid(field.key);
  if (field.type === 'ENUM' && !field.enumValues.includes(text)) ruleInvalid(field.key);
};

export const validateFreshSupplierProductTemplateContent = (
  definition: CategoryTemplateDefinition,
  content: TemplateContent,
): void => {
  if (definition.profile !== 'FRESH') return;
  inspectAfterSaleOverride(content);

  const productFields = definition.fieldSchema.fields.filter(({ specification }) => !specification);
  const skuFields = definition.fieldSchema.fields.filter(({ specification }) => specification);
  const productFieldKeys = new Set(productFields.map(({ key }) => key));
  const skuFieldKeys = new Set(skuFields.map(({ key }) => key));
  if (Object.keys(content.attributes).some((key) => !productFieldKeys.has(key))) {
    dataInvalid('FRESH product attributes contain a field outside the published template whitelist');
  }
  for (const field of productFields) {
    if (field.required || Object.prototype.hasOwnProperty.call(content.attributes, field.key)) {
      requireValue(content.attributes[field.key], field);
    }
  }
  if (content.skus.length < 1) requiredMissing('sku');
  for (const sku of content.skus) {
    if (Object.keys(sku.attributes).some((key) => !skuFieldKeys.has(key))) {
      dataInvalid('FRESH SKU attributes contain a field outside the published template whitelist');
    }
    for (const field of skuFields) {
      if (field.required || Object.prototype.hasOwnProperty.call(sku.attributes, field.key)) {
        requireValue(sku.attributes[field.key], field);
      }
    }
  }
};

export const FRESH_PRODUCT_FIELD_KEYS = requiredProductFields.map(([key]) => key);
export const FRESH_SKU_FIELD_KEYS = requiredSkuFields.map(([key]) => key);
export const FRESH_FIELD_TYPES = new Map<string, TemplateFieldType>(
  [...requiredProductFields, ...requiredSkuFields].map(([key, , type]) => [key, type]),
);
