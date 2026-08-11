import { SafeApiError } from '../http/api-error.js';
import type { CategoryTemplateDefinition, TemplateFieldDefinition } from './category-template.policy.js';

export const FOOD_FIXED_WARNING =
  '食品信息以商品实际包装标签为准；食用前请核对过敏原、保质期和储存条件。';

const requiredProductFields = Object.freeze([
  ['ingredients', 'ingredients-nutrition'],
  ['nutrition-facts', 'ingredients-nutrition'],
  ['production-license', 'production-information'],
  ['shelf-life', 'production-information'],
  ['storage-method', 'consumption-storage'],
  ['allergens', 'consumption-storage'],
] as const);

const requiredSkuFields = Object.freeze([
  ['flavor', 'specifications'],
  ['net-content', 'specifications'],
  ['package-count', 'specifications'],
] as const);

const requiredModules = Object.freeze([
  ['ingredients-nutrition', 'FIELDS'],
  ['production-information', 'FIELDS'],
  ['consumption-storage', 'FIELDS'],
  ['specifications', 'FIELDS'],
  ['food-safety-warning', 'NOTICE'],
] as const);

const warningKeyPattern = /food[-_]?safety|regulatory[-_]?warning|fixed[-_]?warning/iu;
const unsafeMarkupPattern = /<[^>]+>|display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0/iu;

const schemaInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_SCHEMA_INVALID', message);
};

const dataInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_DATA_INVALID', message);
};

const warningInvalid = (): never => {
  throw new SafeApiError(
    422,
    'REGULATORY_WARNING_REQUIRED',
    'The fixed food safety warning cannot be hidden or replaced',
  );
};

const fieldByKey = (
  definition: CategoryTemplateDefinition,
  fieldKey: string,
): TemplateFieldDefinition | undefined =>
  definition.fieldSchema.fields.find(({ key }) => key === fieldKey);

export const assertFoodTemplateDefinition = (
  definition: CategoryTemplateDefinition,
): void => {
  if (definition.profile !== 'FOOD') return;

  for (const [moduleKey, kind] of requiredModules) {
    const module = definition.detailModules.modules.find(({ key }) => key === moduleKey);
    if (!module || module.kind !== kind) {
      schemaInvalid(`FOOD template requires ${moduleKey} as ${kind}`);
    }
  }

  for (const [fieldKey, moduleKey] of [...requiredProductFields, ...requiredSkuFields]) {
    const field = fieldByKey(definition, fieldKey);
    if (
      !field ||
      !field.required ||
      field.type !== 'TEXT' ||
      field.detailModuleKey !== moduleKey ||
      field.specification !== requiredSkuFields.some(([key]) => key === fieldKey)
    ) {
      schemaInvalid(`FOOD template field ${fieldKey} is missing or invalid`);
    }
  }

  const dimensions = new Map(
    definition.skuDimensions.dimensions.map(({ key, fieldKey }) => [key, fieldKey]),
  );
  if (
    dimensions.size !== requiredSkuFields.length ||
    requiredSkuFields.some(([fieldKey]) => dimensions.get(fieldKey) !== fieldKey)
  ) {
    schemaInvalid('FOOD template requires flavor, net-content and package-count SKU dimensions');
  }

  if (
    definition.fieldSchema.fields.some(
      ({ detailModuleKey }) => detailModuleKey === 'food-safety-warning',
    )
  ) {
    schemaInvalid('The fixed food warning module cannot contain supplier fields');
  }
  if (definition.fieldSchema.fields.some(({ type }) => type !== 'TEXT')) {
    schemaInvalid('FOOD template supplier fields must be plain text');
  }
}

type TemplateContent = {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly skus: readonly { readonly attributes: Readonly<Record<string, unknown>> }[];
};

const inspectWarningOverride = (value: unknown, key = ''): void => {
  if (warningKeyPattern.test(key)) warningInvalid();
  if (typeof value === 'string' && unsafeMarkupPattern.test(value)) warningInvalid();
  if (Array.isArray(value)) {
    value.forEach((child) => inspectWarningOverride(child, key));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
    inspectWarningOverride(child, childKey);
  }
};

const requirePlainText = (value: unknown, fieldKey: string): void => {
  if (typeof value !== 'string') {
    return dataInvalid(`FOOD field ${fieldKey} is required`);
  }
  const textValue = value as string;
  if (!textValue.trim() || textValue.length > 500) {
    dataInvalid(`FOOD field ${fieldKey} is required`);
  }
  if (unsafeMarkupPattern.test(textValue)) warningInvalid();
};

export const validateSupplierProductTemplateContent = (
  definition: CategoryTemplateDefinition,
  content: TemplateContent,
): void => {
  if (definition.profile !== 'FOOD') return;
  inspectWarningOverride(content);

  const productFields = definition.fieldSchema.fields.filter(({ specification }) => !specification);
  const skuFields = definition.fieldSchema.fields.filter(({ specification }) => specification);
  const productFieldKeys = new Set(productFields.map(({ key }) => key));
  const skuFieldKeys = new Set(skuFields.map(({ key }) => key));
  if (Object.keys(content.attributes).some((key) => !productFieldKeys.has(key))) {
    dataInvalid('FOOD product attributes contain a field outside the published template whitelist');
  }
  for (const field of productFields) {
    if (field.required || Object.prototype.hasOwnProperty.call(content.attributes, field.key)) {
      requirePlainText(content.attributes[field.key], field.key);
    }
  }
  if (content.skus.length < 1) dataInvalid('FOOD product requires at least one SKU');
  for (const sku of content.skus) {
    if (Object.keys(sku.attributes).some((key) => !skuFieldKeys.has(key))) {
      dataInvalid('FOOD SKU attributes contain a field outside the published template whitelist');
    }
    for (const field of skuFields) {
      if (field.required || Object.prototype.hasOwnProperty.call(sku.attributes, field.key)) {
        requirePlainText(sku.attributes[field.key], field.key);
      }
    }
  }
};

export const FOOD_PRODUCT_FIELD_KEYS = requiredProductFields.map(([key]) => key);
export const FOOD_SKU_FIELD_KEYS = requiredSkuFields.map(([key]) => key);
