import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

import { SafeApiError } from '../http/api-error.js';
import type {
  CategoryTemplateDefinition,
  TemplateFieldDefinition,
} from './category-template.policy.js';

const requiredProductFields = Object.freeze([
  ['dimensions', 'technical-parameters', 'TEXT'],
  ['power', 'technical-parameters', 'TEXT'],
  ['voltage', 'technical-parameters', 'TEXT'],
  ['interfaces', 'technical-parameters', 'TEXT'],
  ['energy-efficiency', 'energy-efficiency', 'TEXT'],
  ['execution-standard', 'technical-parameters', 'TEXT'],
  ['package-list', 'package-and-installation', 'RICH_TEXT'],
  ['installation-instructions', 'package-and-installation', 'RICH_TEXT'],
  ['warranty-period', 'warranty', 'TEXT'],
] as const);

const requiredSkuFields = Object.freeze([
  ['color', 'specifications', 'TEXT'],
  ['capacity', 'specifications', 'TEXT'],
  ['model', 'specifications', 'TEXT'],
] as const);

const requiredModules = Object.freeze([
  ['technical-parameters', 'FIELDS'],
  ['energy-efficiency', 'FIELDS'],
  ['package-and-installation', 'FIELDS'],
  ['warranty', 'FIELDS'],
  ['specifications', 'FIELDS'],
  ['digital-after-sales', 'AFTER_SALE'],
] as const);

const unsafeMarkupPattern = /<[^>]+>|javascript:|data:text\/html|on(?:error|load|click)\s*=/iu;
const afterSaleOverridePattern = /after[-_]?sales?|return[-_]?policy|refund[-_]?rule|warranty[-_]?rule/iu;

const schemaInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_SCHEMA_INVALID', message);
};

const dataInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_DATA_INVALID', message);
};

const requiredMissing = (fieldKey: string): never => {
  throw new SafeApiError(
    422,
    'DIGITAL_REQUIRED_FIELD_MISSING',
    `DIGITAL field ${fieldKey} is required`,
  );
};

const duplicateModel = (): never => {
  throw new SafeApiError(
    422,
    'DIGITAL_MODEL_DUPLICATE',
    'DIGITAL model identifiers must be unique after normalization',
  );
};

const fieldByKey = (
  definition: CategoryTemplateDefinition,
  fieldKey: string,
): TemplateFieldDefinition | undefined =>
  definition.fieldSchema.fields.find(({ key }) => key === fieldKey);

export const assertDigitalTemplateDefinition = (
  definition: CategoryTemplateDefinition,
): void => {
  if (definition.profile !== 'DIGITAL') return;

  for (const [moduleKey, kind] of requiredModules) {
    const module = definition.detailModules.modules.find(({ key }) => key === moduleKey);
    if (!module || module.kind !== kind) {
      schemaInvalid(`DIGITAL template requires ${moduleKey} as ${kind}`);
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
      schemaInvalid(`DIGITAL template field ${fieldKey} is missing or invalid`);
    }
  }

  const dimensions = new Map(
    definition.skuDimensions.dimensions.map(({ key, fieldKey }) => [key, fieldKey]),
  );
  if (
    dimensions.size !== requiredSkuFields.length ||
    requiredSkuFields.some(([fieldKey]) => dimensions.get(fieldKey) !== fieldKey)
  ) {
    schemaInvalid('DIGITAL template requires color, capacity and model SKU dimensions');
  }

  if (
    definition.fieldSchema.fields.some(
      ({ detailModuleKey }) => detailModuleKey === 'digital-after-sales',
    )
  ) {
    schemaInvalid('The DIGITAL after-sales module cannot contain supplier fields');
  }
  if (
    definition.afterSaleRules.returnPolicy !== 'CATEGORY_RESTRICTED' ||
    !definition.afterSaleRules.notice.includes(COMPANY_LEGAL_NAME) ||
    unsafeMarkupPattern.test(definition.afterSaleRules.notice)
  ) {
    schemaInvalid('DIGITAL after-sales must use the company category-restricted rule');
  }
};

type TemplateContent = {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly skus: readonly { readonly attributes: Readonly<Record<string, unknown>> }[];
};

const inspectAfterSaleOverride = (value: unknown, key = ''): void => {
  if (afterSaleOverridePattern.test(key)) {
    dataInvalid('DIGITAL supplier content cannot override the company after-sales or warranty rule');
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
  if (typeof value !== 'string') return requiredMissing(field.key);
  const normalized = value.trim();
  if (!normalized) return requiredMissing(field.key);
  const maximum = field.validation.maxLength ?? 500;
  if (normalized.length > Math.min(maximum, 2000) || unsafeMarkupPattern.test(normalized)) {
    dataInvalid(`DIGITAL field ${field.key} is invalid`);
  }
  return normalized;
};

const modelKey = (value: string): string =>
  value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');

export const validateDigitalSupplierProductTemplateContent = (
  definition: CategoryTemplateDefinition,
  content: TemplateContent,
): void => {
  if (definition.profile !== 'DIGITAL') return;
  inspectAfterSaleOverride(content);

  const productFields = definition.fieldSchema.fields.filter(({ specification }) => !specification);
  const skuFields = definition.fieldSchema.fields.filter(({ specification }) => specification);
  const productFieldKeys = new Set(productFields.map(({ key }) => key));
  const skuFieldKeys = new Set(skuFields.map(({ key }) => key));
  if (Object.keys(content.attributes).some((key) => !productFieldKeys.has(key))) {
    dataInvalid('DIGITAL product attributes contain a field outside the published template whitelist');
  }
  for (const field of productFields) {
    if (field.required || Object.prototype.hasOwnProperty.call(content.attributes, field.key)) {
      requireValue(content.attributes[field.key], field);
    }
  }
  if (content.skus.length < 1) requiredMissing('sku');

  const models = new Set<string>();
  for (const sku of content.skus) {
    if (Object.keys(sku.attributes).some((key) => !skuFieldKeys.has(key))) {
      dataInvalid('DIGITAL SKU attributes contain a field outside the published template whitelist');
    }
    for (const field of skuFields) {
      if (field.required || Object.prototype.hasOwnProperty.call(sku.attributes, field.key)) {
        requireValue(sku.attributes[field.key], field);
      }
    }
    requireValue(sku.attributes.color, fieldByKey(definition, 'color')!);
    requireValue(sku.attributes.capacity, fieldByKey(definition, 'capacity')!);
    const model = requireValue(sku.attributes.model, fieldByKey(definition, 'model')!);
    const normalizedModel = modelKey(model);
    if (models.has(normalizedModel)) duplicateModel();
    models.add(normalizedModel);
  }
};

export const DIGITAL_PRODUCT_FIELD_KEYS = requiredProductFields.map(([key]) => key);
export const DIGITAL_SKU_FIELD_KEYS = requiredSkuFields.map(([key]) => key);
