import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

import { SafeApiError } from '../http/api-error.js';
import type {
  CategoryTemplateDefinition,
  TemplateFieldDefinition,
} from './category-template.policy.js';

const requiredProductFields = Object.freeze([
  ['bundle-items', 'bundle-list', 'BUNDLE_ITEMS'],
  ['packaging', 'customization', 'TEXT'],
  ['customization', 'customization', 'TEXT'],
  ['delivery-cycle', 'customization', 'TEXT'],
  ['welfare-scenario', 'welfare-scenario', 'TEXT'],
] as const);

const requiredSkuFields = Object.freeze([
  ['package', 'specifications', 'TEXT'],
  ['tier', 'specifications', 'TEXT'],
  ['custom-version', 'specifications', 'TEXT'],
] as const);

const requiredModules = Object.freeze([
  ['bundle-list', 'FIELDS'],
  ['welfare-scenario', 'FIELDS'],
  ['customization', 'FIELDS'],
  ['specifications', 'FIELDS'],
  ['gift-box-after-sales', 'AFTER_SALE'],
] as const);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const unsafeMarkupPattern = /<[^>]+>|javascript:|data:text\/html|on(?:error|load|click)\s*=/iu;
const afterSaleOverridePattern = /after[-_]?sales?|return[-_]?policy|refund[-_]?rule/iu;

const schemaInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_SCHEMA_INVALID', message);
};

const bundleInvalid = (message: string): never => {
  throw new SafeApiError(422, 'BUNDLE_SCHEMA_INVALID', message);
};

const dataInvalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_DATA_INVALID', message);
};

const fieldByKey = (
  definition: CategoryTemplateDefinition,
  fieldKey: string,
): TemplateFieldDefinition | undefined =>
  definition.fieldSchema.fields.find(({ key }) => key === fieldKey);

export const assertGiftBoxTemplateDefinition = (
  definition: CategoryTemplateDefinition,
): void => {
  if (definition.profile !== 'GIFT_BOX') return;

  for (const [moduleKey, kind] of requiredModules) {
    const module = definition.detailModules.modules.find(({ key }) => key === moduleKey);
    if (!module || module.kind !== kind) {
      schemaInvalid(`GIFT_BOX template requires ${moduleKey} as ${kind}`);
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
      schemaInvalid(`GIFT_BOX template field ${fieldKey} is missing or invalid`);
    }
  }

  const dimensions = new Map(
    definition.skuDimensions.dimensions.map(({ key, fieldKey }) => [key, fieldKey]),
  );
  if (
    dimensions.size !== requiredSkuFields.length ||
    requiredSkuFields.some(([fieldKey]) => dimensions.get(fieldKey) !== fieldKey)
  ) {
    schemaInvalid('GIFT_BOX template requires package, tier and custom-version SKU dimensions');
  }

  if (
    definition.fieldSchema.fields.some(
      ({ detailModuleKey }) => detailModuleKey === 'gift-box-after-sales',
    )
  ) {
    schemaInvalid('The GIFT_BOX after-sales module cannot contain supplier fields');
  }
  if (
    definition.afterSaleRules.returnPolicy !== 'COMPANY_STANDARD' ||
    !definition.afterSaleRules.notice.includes(COMPANY_LEGAL_NAME) ||
    unsafeMarkupPattern.test(definition.afterSaleRules.notice)
  ) {
    schemaInvalid('GIFT_BOX after-sales must use the company standard rule');
  }
};

export interface GiftBoxBundleItemSnapshot {
  readonly name: string;
  readonly quantity: number;
  readonly specification: string;
  readonly minimumExpiryDays: number;
  readonly supplierProductId?: string;
}

const bundleText = (value: unknown, label: string, maximum: number): string => {
  if (typeof value !== 'string') return bundleInvalid(`${label} is required`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || unsafeMarkupPattern.test(normalized)) {
    return bundleInvalid(`${label} is invalid`);
  }
  return normalized;
};

export const readGiftBoxBundleItemSnapshots = (
  value: unknown,
): readonly GiftBoxBundleItemSnapshot[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    return bundleInvalid('GIFT_BOX bundle-items must contain 1 to 50 items');
  }
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return bundleInvalid(`GIFT_BOX bundle item ${index} is invalid`);
    }
    const input = candidate as Record<string, unknown>;
    if (
      Object.keys(input).some(
        (key) =>
          !['minimumExpiryDays', 'name', 'quantity', 'specification', 'supplierProductId'].includes(
            key,
          ),
      ) ||
      !['minimumExpiryDays', 'name', 'quantity', 'specification'].every((key) =>
        Object.prototype.hasOwnProperty.call(input, key),
      )
    ) {
      return bundleInvalid(`GIFT_BOX bundle item ${index} fields are invalid`);
    }
    if (!Number.isSafeInteger(input.quantity) || (input.quantity as number) < 1) {
      return bundleInvalid(`GIFT_BOX bundle item ${index} quantity is invalid`);
    }
    if (
      !Number.isSafeInteger(input.minimumExpiryDays) ||
      (input.minimumExpiryDays as number) < 1 ||
      (input.minimumExpiryDays as number) > 3650
    ) {
      return bundleInvalid(`GIFT_BOX bundle item ${index} minimum expiry is invalid`);
    }
    const supplierProductId = input.supplierProductId;
    if (supplierProductId !== undefined && !uuidPattern.test(String(supplierProductId))) {
      return bundleInvalid(`GIFT_BOX bundle item ${index} reference is invalid`);
    }
    return {
      name: bundleText(input.name, `GIFT_BOX bundle item ${index} name`, 200),
      quantity: input.quantity as number,
      specification: bundleText(
        input.specification,
        `GIFT_BOX bundle item ${index} specification`,
        200,
      ),
      minimumExpiryDays: input.minimumExpiryDays as number,
      ...(supplierProductId === undefined
        ? {}
        : { supplierProductId: String(supplierProductId).toLowerCase() }),
    };
  });
};

type TemplateContent = {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly skus: readonly { readonly attributes: Readonly<Record<string, unknown>> }[];
};

const inspectAfterSaleOverride = (value: unknown, key = ''): void => {
  if (afterSaleOverridePattern.test(key)) {
    dataInvalid('GIFT_BOX supplier content cannot override the company after-sales rule');
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

const requireTextValue = (value: unknown, field: TemplateFieldDefinition): string => {
  if (typeof value !== 'string') return bundleInvalid(`GIFT_BOX field ${field.key} is required`);
  const normalized = value.trim();
  const maximum = field.validation.maxLength ?? 500;
  if (!normalized || normalized.length > Math.min(maximum, 2000) || unsafeMarkupPattern.test(normalized)) {
    return bundleInvalid(`GIFT_BOX field ${field.key} is invalid`);
  }
  return normalized;
};

const normalizedSkuKey = (attributes: Readonly<Record<string, unknown>>): string =>
  requiredSkuFields
    .map(([fieldKey]) => String(attributes[fieldKey]).normalize('NFKC').trim().toLocaleLowerCase('zh-CN'))
    .join('\u0000');

export const validateGiftBoxSupplierProductTemplateContent = (
  definition: CategoryTemplateDefinition,
  content: TemplateContent,
): readonly string[] => {
  if (definition.profile !== 'GIFT_BOX') return [];
  inspectAfterSaleOverride(content);

  const productFields = definition.fieldSchema.fields.filter(({ specification }) => !specification);
  const skuFields = definition.fieldSchema.fields.filter(({ specification }) => specification);
  const productFieldKeys = new Set(productFields.map(({ key }) => key));
  const skuFieldKeys = new Set(skuFields.map(({ key }) => key));
  if (Object.keys(content.attributes).some((key) => !productFieldKeys.has(key))) {
    dataInvalid('GIFT_BOX product attributes contain a field outside the published template whitelist');
  }
  const bundleItems = readGiftBoxBundleItemSnapshots(content.attributes['bundle-items']);
  for (const field of productFields) {
    if (field.key === 'bundle-items') continue;
    if (field.required || Object.prototype.hasOwnProperty.call(content.attributes, field.key)) {
      requireTextValue(content.attributes[field.key], field);
    }
  }
  if (content.skus.length < 1) return bundleInvalid('GIFT_BOX product requires at least one SKU');

  const combinations = new Set<string>();
  for (const sku of content.skus) {
    if (Object.keys(sku.attributes).some((key) => !skuFieldKeys.has(key))) {
      dataInvalid('GIFT_BOX SKU attributes contain a field outside the published template whitelist');
    }
    for (const field of skuFields) {
      requireTextValue(sku.attributes[field.key], field);
    }
    const combination = normalizedSkuKey(sku.attributes);
    if (combinations.has(combination)) {
      throw new SafeApiError(422, 'SKU_DIMENSION_DUPLICATE', 'GIFT_BOX SKU combination is duplicated');
    }
    combinations.add(combination);
  }
  return bundleItems.flatMap(({ supplierProductId }) =>
    supplierProductId === undefined ? [] : [supplierProductId],
  );
};

export const assertGiftBoxChildReferencesOwned = async (
  references: readonly string[],
  isOwned: (supplierProductId: string) => Promise<boolean>,
): Promise<void> => {
  for (const supplierProductId of new Set(references)) {
    if (!(await isOwned(supplierProductId))) {
      throw new SafeApiError(
        403,
        'SUPPLIER_SCOPE_FORBIDDEN',
        'Gift-box child reference is outside the current supplier scope',
      );
    }
  }
};

export const GIFT_BOX_PRODUCT_FIELD_KEYS = requiredProductFields
  .map(([key]) => key)
  .filter((key) => key !== 'bundle-items');
export const GIFT_BOX_SKU_FIELD_KEYS = requiredSkuFields.map(([key]) => key);
