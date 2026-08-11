import { SafeApiError } from '../http/api-error.js';
import { assertApparelTemplateDefinition } from './apparel-template.policy.js';
import { assertDigitalTemplateDefinition } from './digital-template.policy.js';
import { assertFoodTemplateDefinition } from './food-template.policy.js';
import { assertFreshTemplateDefinition } from './fresh-template.policy.js';
import {
  requestHash,
  requireIdempotencyKey,
  requireSupplierProductId,
  requireVersion,
} from '../supplier-products/supplier-product.policy.js';

export type CategoryTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type CategoryTemplateProfile = 'APPAREL' | 'DIGITAL' | 'FOOD' | 'FRESH' | 'GENERIC';
export type TemplateFieldType =
  | 'BOOLEAN'
  | 'DATE'
  | 'DECIMAL'
  | 'ENUM'
  | 'INTEGER'
  | 'RICH_TEXT'
  | 'TEXT';

export interface TemplateValidationRule {
  readonly min: number | null;
  readonly max: number | null;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly pattern: string | null;
}

export interface TemplateFieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly type: TemplateFieldType;
  readonly required: boolean;
  readonly unit: string | null;
  readonly enumValues: readonly string[];
  readonly validation: TemplateValidationRule;
  readonly searchable: boolean;
  readonly specification: boolean;
  readonly detailModuleKey: string;
}

export interface CategoryTemplateDefinition {
  readonly profile: CategoryTemplateProfile;
  readonly fieldSchema: {
    readonly schemaVersion: '1.0';
    readonly fields: readonly TemplateFieldDefinition[];
  };
  readonly skuDimensions: {
    readonly dimensions: readonly {
      readonly key: string;
      readonly label: string;
      readonly fieldKey: string;
    }[];
  };
  readonly qualificationRules: {
    readonly rules: readonly {
      readonly key: string;
      readonly label: string;
      readonly required: boolean;
      readonly expiryRequired: boolean;
      readonly objectTypes: readonly ('IMAGE' | 'PDF')[];
    }[];
  };
  readonly detailModules: {
    readonly modules: readonly {
      readonly key: string;
      readonly title: string;
      readonly kind: 'AFTER_SALE' | 'FIELDS' | 'NOTICE' | 'QUALIFICATIONS';
      readonly sortWeight: number;
    }[];
  };
  readonly afterSaleRules: {
    readonly returnPolicy: 'CATEGORY_RESTRICTED' | 'COMPANY_STANDARD' | 'NON_RETURNABLE';
    readonly notice: string;
    readonly evidenceRequirements: readonly string[];
  };
}

const dangerousPattern = /<script|javascript:|data:text\/html|on(?:error|load|click)\s*=/iu;
const keyPattern = /^[a-z][a-z0-9-]{0,63}$/u;

const invalid = (message: string): never => {
  throw new SafeApiError(422, 'TEMPLATE_SCHEMA_INVALID', message);
};

const record = (
  value: unknown,
  label: string,
  allowed: readonly string[],
): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid(`${label} must be an object`);
  }
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).some((key) => !allowed.includes(key)) ||
    allowed.some((key) => !Object.prototype.hasOwnProperty.call(result, key))
  ) {
    return invalid(`${label} fields are invalid`);
  }
  return result;
};

const text = (value: unknown, label: string, maximum: number): string => {
  if (typeof value !== 'string') return invalid(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || dangerousPattern.test(normalized)) {
    return invalid(`${label} is invalid`);
  }
  return normalized;
};

const key = (value: unknown, label: string): string => {
  const normalized = text(value, label, 64);
  if (!keyPattern.test(normalized)) return invalid(`${label} must be a stable lowercase key`);
  return normalized;
};

const booleanValue = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') return invalid(`${label} must be boolean`);
  return value;
};

const integer = (value: unknown, label: string, minimum?: number): number => {
  if (!Number.isSafeInteger(value) || (minimum !== undefined && (value as number) < minimum)) {
    return invalid(`${label} must be a safe integer`);
  }
  return value as number;
};

const nullableNumber = (value: unknown, label: string): number | null => {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return invalid(`${label} must be a finite number or null`);
  }
  return value;
};

const nullableInteger = (value: unknown, label: string): number | null =>
  value === null ? null : integer(value, label, 0);

const unique = (values: readonly string[], label: string): void => {
  if (new Set(values).size !== values.length) invalid(`${label} contains duplicate keys`);
};

const stringArray = (
  value: unknown,
  label: string,
  maximum: number,
  itemMaximum: number,
): readonly string[] => {
  if (!Array.isArray(value) || value.length > maximum) return invalid(`${label} is invalid`);
  const values = value.map((item, index) => text(item, `${label}[${index}]`, itemMaximum));
  unique(values, label);
  return values;
};

const normalizeModules = (value: unknown): CategoryTemplateDefinition['detailModules'] => {
  const container = record(value, 'detailModules', ['modules']);
  if (!Array.isArray(container.modules) || container.modules.length < 1 || container.modules.length > 20) {
    return invalid('detailModules.modules must contain 1 to 20 modules');
  }
  const modules = container.modules.map((candidate, index) => {
    const input = record(candidate, `detailModules.modules[${index}]`, [
      'key',
      'title',
      'kind',
      'sortWeight',
    ]);
    if (!['AFTER_SALE', 'FIELDS', 'NOTICE', 'QUALIFICATIONS'].includes(input.kind as string)) {
      return invalid(`detailModules.modules[${index}].kind is invalid`);
    }
    return {
      key: key(input.key, `detailModules.modules[${index}].key`),
      title: text(input.title, `detailModules.modules[${index}].title`, 80),
      kind: input.kind as 'AFTER_SALE' | 'FIELDS' | 'NOTICE' | 'QUALIFICATIONS',
      sortWeight: integer(input.sortWeight, `detailModules.modules[${index}].sortWeight`),
    };
  });
  unique(modules.map(({ key: valueKey }) => valueKey), 'detailModules.modules');
  return { modules };
};

const normalizeFields = (
  value: unknown,
  moduleKeys: ReadonlySet<string>,
): CategoryTemplateDefinition['fieldSchema'] => {
  const container = record(value, 'fieldSchema', ['schemaVersion', 'fields']);
  if (container.schemaVersion !== '1.0') return invalid('fieldSchema.schemaVersion must be 1.0');
  if (!Array.isArray(container.fields) || container.fields.length < 1 || container.fields.length > 100) {
    return invalid('fieldSchema.fields must contain 1 to 100 fields');
  }
  const fields = container.fields.map((candidate, index) => {
    const input = record(candidate, `fieldSchema.fields[${index}]`, [
      'key',
      'label',
      'type',
      'required',
      'unit',
      'enumValues',
      'validation',
      'searchable',
      'specification',
      'detailModuleKey',
    ]);
    if (!['BOOLEAN', 'DATE', 'DECIMAL', 'ENUM', 'INTEGER', 'RICH_TEXT', 'TEXT'].includes(input.type as string)) {
      return invalid(`fieldSchema.fields[${index}].type is invalid`);
    }
    const type = input.type as TemplateFieldType;
    const enumValues = stringArray(
      input.enumValues,
      `fieldSchema.fields[${index}].enumValues`,
      50,
      80,
    );
    if ((type === 'ENUM' && enumValues.length === 0) || (type !== 'ENUM' && enumValues.length > 0)) {
      return invalid(`fieldSchema.fields[${index}].enumValues do not match the field type`);
    }
    const validationInput = record(input.validation, `fieldSchema.fields[${index}].validation`, [
      'min',
      'max',
      'minLength',
      'maxLength',
      'pattern',
    ]);
    const validation: TemplateValidationRule = {
      min: nullableNumber(validationInput.min, `fieldSchema.fields[${index}].validation.min`),
      max: nullableNumber(validationInput.max, `fieldSchema.fields[${index}].validation.max`),
      minLength: nullableInteger(
        validationInput.minLength,
        `fieldSchema.fields[${index}].validation.minLength`,
      ),
      maxLength: nullableInteger(
        validationInput.maxLength,
        `fieldSchema.fields[${index}].validation.maxLength`,
      ),
      pattern:
        validationInput.pattern === null
          ? null
          : text(validationInput.pattern, `fieldSchema.fields[${index}].validation.pattern`, 128),
    };
    if (validation.min !== null && validation.max !== null && validation.min > validation.max) {
      return invalid(`fieldSchema.fields[${index}] minimum exceeds maximum`);
    }
    if (
      validation.minLength !== null &&
      validation.maxLength !== null &&
      validation.minLength > validation.maxLength
    ) {
      return invalid(`fieldSchema.fields[${index}] minimum length exceeds maximum length`);
    }
    if (validation.pattern !== null) {
      try {
        new RegExp(validation.pattern, 'u');
      } catch {
        return invalid(`fieldSchema.fields[${index}].validation.pattern is invalid`);
      }
    }
    const detailModuleKey = key(
      input.detailModuleKey,
      `fieldSchema.fields[${index}].detailModuleKey`,
    );
    if (!moduleKeys.has(detailModuleKey)) {
      return invalid(`fieldSchema.fields[${index}] references a missing detail module`);
    }
    return {
      key: key(input.key, `fieldSchema.fields[${index}].key`),
      label: text(input.label, `fieldSchema.fields[${index}].label`, 80),
      type,
      required: booleanValue(input.required, `fieldSchema.fields[${index}].required`),
      unit:
        input.unit === null ? null : text(input.unit, `fieldSchema.fields[${index}].unit`, 32),
      enumValues,
      validation,
      searchable: booleanValue(input.searchable, `fieldSchema.fields[${index}].searchable`),
      specification: booleanValue(
        input.specification,
        `fieldSchema.fields[${index}].specification`,
      ),
      detailModuleKey,
    };
  });
  unique(fields.map(({ key: fieldKey }) => fieldKey), 'fieldSchema.fields');
  return { schemaVersion: '1.0', fields };
};

const normalizeSkuDimensions = (
  value: unknown,
  fields: readonly TemplateFieldDefinition[],
): CategoryTemplateDefinition['skuDimensions'] => {
  const container = record(value, 'skuDimensions', ['dimensions']);
  if (!Array.isArray(container.dimensions) || container.dimensions.length > 3) {
    return invalid('skuDimensions.dimensions must contain at most 3 dimensions');
  }
  const dimensions = container.dimensions.map((candidate, index) => {
    const input = record(candidate, `skuDimensions.dimensions[${index}]`, [
      'key',
      'label',
      'fieldKey',
    ]);
    const fieldKey = key(input.fieldKey, `skuDimensions.dimensions[${index}].fieldKey`);
    const field = fields.find(({ key: candidateKey }) => candidateKey === fieldKey);
    if (!field || !field.specification || !['ENUM', 'TEXT'].includes(field.type)) {
      return invalid(`skuDimensions.dimensions[${index}] must reference a specification field`);
    }
    return {
      key: key(input.key, `skuDimensions.dimensions[${index}].key`),
      label: text(input.label, `skuDimensions.dimensions[${index}].label`, 80),
      fieldKey,
    };
  });
  unique(dimensions.map(({ key: dimensionKey }) => dimensionKey), 'skuDimensions.dimensions');
  unique(dimensions.map(({ fieldKey }) => fieldKey), 'skuDimensions field references');
  return { dimensions };
};

const normalizeQualifications = (
  value: unknown,
): CategoryTemplateDefinition['qualificationRules'] => {
  const container = record(value, 'qualificationRules', ['rules']);
  if (!Array.isArray(container.rules) || container.rules.length > 20) {
    return invalid('qualificationRules.rules must contain at most 20 rules');
  }
  const rules = container.rules.map((candidate, index) => {
    const input = record(candidate, `qualificationRules.rules[${index}]`, [
      'key',
      'label',
      'required',
      'expiryRequired',
      'objectTypes',
    ]);
    const objectTypes = stringArray(
      input.objectTypes,
      `qualificationRules.rules[${index}].objectTypes`,
      2,
      16,
    );
    if (objectTypes.length === 0 || objectTypes.some((item) => !['IMAGE', 'PDF'].includes(item))) {
      return invalid(`qualificationRules.rules[${index}].objectTypes are invalid`);
    }
    return {
      key: key(input.key, `qualificationRules.rules[${index}].key`),
      label: text(input.label, `qualificationRules.rules[${index}].label`, 80),
      required: booleanValue(input.required, `qualificationRules.rules[${index}].required`),
      expiryRequired: booleanValue(
        input.expiryRequired,
        `qualificationRules.rules[${index}].expiryRequired`,
      ),
      objectTypes: objectTypes as readonly ('IMAGE' | 'PDF')[],
    };
  });
  unique(rules.map(({ key: ruleKey }) => ruleKey), 'qualificationRules.rules');
  return { rules };
};

const normalizeAfterSale = (value: unknown): CategoryTemplateDefinition['afterSaleRules'] => {
  const input = record(value, 'afterSaleRules', [
    'returnPolicy',
    'notice',
    'evidenceRequirements',
  ]);
  if (!['CATEGORY_RESTRICTED', 'COMPANY_STANDARD', 'NON_RETURNABLE'].includes(input.returnPolicy as string)) {
    return invalid('afterSaleRules.returnPolicy is invalid');
  }
  return {
    returnPolicy: input.returnPolicy as
      | 'CATEGORY_RESTRICTED'
      | 'COMPANY_STANDARD'
      | 'NON_RETURNABLE',
    notice: text(input.notice, 'afterSaleRules.notice', 500),
    evidenceRequirements: stringArray(
      input.evidenceRequirements,
      'afterSaleRules.evidenceRequirements',
      20,
      64,
    ),
  };
};

export const normalizeCategoryTemplateDefinition = (
  value: unknown,
): CategoryTemplateDefinition => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('template must be an object');
  }
  const candidate = value as Record<string, unknown>;
  const input = record(
    {
      ...candidate,
      profile: candidate.profile ?? 'GENERIC',
    },
    'template',
    [
    'profile',
    'fieldSchema',
    'skuDimensions',
    'qualificationRules',
    'detailModules',
    'afterSaleRules',
    ],
  );
  if (!['FOOD', 'FRESH', 'APPAREL', 'DIGITAL', 'GENERIC'].includes(input.profile as string)) {
    return invalid('template.profile is invalid');
  }
  const detailModules = normalizeModules(input.detailModules);
  const fieldSchema = normalizeFields(
    input.fieldSchema,
    new Set(detailModules.modules.map(({ key: moduleKey }) => moduleKey)),
  );
  const definition: CategoryTemplateDefinition = {
    profile: input.profile as CategoryTemplateProfile,
    fieldSchema,
    skuDimensions: normalizeSkuDimensions(input.skuDimensions, fieldSchema.fields),
    qualificationRules: normalizeQualifications(input.qualificationRules),
    detailModules,
    afterSaleRules: normalizeAfterSale(input.afterSaleRules),
  };
  assertFoodTemplateDefinition(definition);
  assertFreshTemplateDefinition(definition);
  assertApparelTemplateDefinition(definition);
  assertDigitalTemplateDefinition(definition);
  return definition;
};

export const normalizeCategoryTemplatePatch = (
  value: unknown,
): { readonly expectedRevision: number; readonly definition: CategoryTemplateDefinition } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('Template patch body must be an object');
  }
  const { revision, ...definition } = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(value, 'revision')) {
    return invalid('revision is required');
  }
  return {
    expectedRevision: requireVersion(revision),
    definition: normalizeCategoryTemplateDefinition(definition),
  };
};

export const normalizeCategoryTemplatePublish = (value: unknown): number => {
  const input = record(value, 'publish', ['revision']);
  return requireVersion(input.revision);
};

export const requireCategoryTemplateId = (value: unknown): string =>
  requireSupplierProductId(value, 'templateId');
export const requireCategoryTemplateCategoryId = (value: unknown): string =>
  requireSupplierProductId(value, 'categoryId');
export const requireCategoryTemplateIdempotencyKey = requireIdempotencyKey;
export const categoryTemplateRequestHash = requestHash;
