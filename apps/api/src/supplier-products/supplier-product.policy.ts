import { createHash } from 'node:crypto';

import { SafeApiError } from '../http/api-error.js';

export const SUPPLIER_PRODUCT_STATUSES = [
  'DRAFT',
  'PENDING_MATERIAL_REVIEW',
  'CORRECTION_REQUIRED',
  'MATERIAL_APPROVED',
  'ACTIVE',
  'OFF_SHELF',
  'REJECTED',
  'ARCHIVED',
] as const;

export type SupplierProductStatus = (typeof SUPPLIER_PRODUCT_STATUSES)[number];
export type SupplierProductSkuStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type JsonObject = Readonly<Record<string, unknown>>;

export interface SupplierProductSkuInput {
  readonly supplierSkuCode: string;
  readonly attributes: JsonObject;
  readonly initialStock: number;
}

export interface SupplierProductDraftInput {
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly name: string;
  readonly brand: string | null;
  readonly attributes: JsonObject;
  readonly qualificationReferences: readonly string[];
  readonly qualificationValidUntil: string | null;
  readonly isRetailEnabled: boolean;
  readonly isEnterpriseProcurementEnabled: boolean;
  readonly enterpriseMinOrderQty: number;
  readonly enterprisePackageMultiple: number;
  readonly preparationMinutes: number;
  readonly skus: readonly SupplierProductSkuInput[];
}

export interface ProductChannelVisibilityInput {
  readonly version: number;
  readonly isRetailEnabled: boolean;
  readonly isEnterpriseProcurementEnabled: boolean;
  readonly enterpriseMinOrderQty: number;
  readonly enterprisePackageMultiple: number;
  readonly reason: string;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const dangerousText = /<script|javascript:|data:text\/html/iu;
const ownerKeys = new Set([
  'buyerId',
  'companyId',
  'functionalAccountId',
  'identityId',
  'supplierId',
]);
const priceKeys = new Set([
  'approvedSupplyPrice',
  'currentEnterpriseSalePrice',
  'currentRetailSalePrice',
  'marketPrice',
  'requestedEnterpriseSalePrice',
  'requestedRetailSalePrice',
  'requestedSupplyPrice',
  'supplyPrice',
]);

const asRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const inspectForbiddenKeys = (value: unknown): void => {
  if (Array.isArray(value)) {
    value.forEach(inspectForbiddenKeys);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (ownerKeys.has(key)) {
      throw new SafeApiError(
        403,
        'SUPPLIER_SCOPE_FORBIDDEN',
        'Ownership is derived from the fixed session',
      );
    }
    if (priceKeys.has(key)) {
      throw new SafeApiError(
        403,
        'PRICE_FIELD_FORBIDDEN',
        'Pricing fields are forbidden in the supplier product workspace',
      );
    }
    inspectForbiddenKeys(child);
  }
};

const validateJsonValue = (value: unknown, field: string): JsonObject => {
  const record = asRecord(value, field);
  const visit = (candidate: unknown): void => {
    if (candidate === null || typeof candidate === 'boolean') return;
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) {
        throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} is invalid`);
      }
      return;
    }
    if (typeof candidate === 'string') {
      if (candidate.length > 5_000 || dangerousText.test(candidate)) {
        throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} contains unsafe text`);
      }
      return;
    }
    if (Array.isArray(candidate)) {
      if (candidate.length > 200) {
        throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} is too large`);
      }
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== 'object') {
      throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} is invalid`);
    }
    for (const [key, child] of Object.entries(candidate as Record<string, unknown>)) {
      if (key.length > 128) {
        throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} key is too long`);
      }
      visit(child);
    }
  };
  visit(record);
  return structuredClone(record);
};

const text = (
  value: unknown,
  field: string,
  maxLength: number,
  { nullable = false }: { readonly nullable?: boolean } = {},
): string | null => {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be text`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} is invalid`);
  }
  return normalized;
};

const integer = (
  value: unknown,
  field: string,
  { minimum = 0 }: { readonly minimum?: number } = {},
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be an integer`);
  }
  return value as number;
};

const boolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be boolean`);
  }
  return value;
};

const nullableDateTime = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be an ISO date-time`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be an ISO date-time`);
  }
  return parsed.toISOString();
};

export const normalizeSupplierProductDraft = (
  value: unknown,
): SupplierProductDraftInput => {
  inspectForbiddenKeys(value);
  const input = asRecord(value, 'body');
  const allowed = new Set([
    'attributes',
    'brand',
    'categoryId',
    'enterpriseMinOrderQty',
    'enterprisePackageMultiple',
    'isEnterpriseProcurementEnabled',
    'isRetailEnabled',
    'name',
    'preparationMinutes',
    'qualificationReferences',
    'qualificationValidUntil',
    'skus',
    'templateVersion',
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new SafeApiError(403, 'FIELD_FORBIDDEN', 'Request contains forbidden fields');
  }
  if (typeof input.categoryId !== 'string' || !uuidPattern.test(input.categoryId)) {
    throw new SafeApiError(
      422,
      'CATEGORY_TEMPLATE_INVALID',
      'categoryId must be a valid category identifier',
    );
  }
  const isEnterpriseProcurementEnabled = boolean(
    input.isEnterpriseProcurementEnabled,
    'isEnterpriseProcurementEnabled',
  );
  const enterpriseMinOrderQty = integer(
    input.enterpriseMinOrderQty,
    'enterpriseMinOrderQty',
  );
  const enterprisePackageMultiple = integer(
    input.enterprisePackageMultiple,
    'enterprisePackageMultiple',
  );
  if (
    isEnterpriseProcurementEnabled &&
    (enterpriseMinOrderQty < 1 || enterprisePackageMultiple < 1)
  ) {
    throw new SafeApiError(
      422,
      'VALIDATION_FAILED',
      'Enterprise quantity rules must be positive',
    );
  }
  if (!Array.isArray(input.qualificationReferences) || input.qualificationReferences.length > 50) {
    throw new SafeApiError(
      422,
      'VALIDATION_FAILED',
      'qualificationReferences is invalid',
    );
  }
  const qualificationReferences = input.qualificationReferences.map((reference) => {
    if (
      typeof reference !== 'string' ||
      !reference.startsWith('object://supplier-product/') ||
      reference.length > 500
    ) {
      throw new SafeApiError(
        422,
        'VALIDATION_FAILED',
        'qualification reference is invalid',
      );
    }
    return reference;
  });
  if (!Array.isArray(input.skus) || input.skus.length < 1 || input.skus.length > 100) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'At least one SKU is required');
  }
  const skus = input.skus.map((candidate, index) => {
    const sku = asRecord(candidate, `skus[${index}]`);
    const allowedSku = new Set(['attributes', 'initialStock', 'supplierSkuCode']);
    if (Object.keys(sku).some((key) => !allowedSku.has(key))) {
      throw new SafeApiError(403, 'FIELD_FORBIDDEN', 'SKU contains forbidden fields');
    }
    return {
      supplierSkuCode: text(sku.supplierSkuCode, 'supplierSkuCode', 64)!,
      attributes: validateJsonValue(sku.attributes, 'sku.attributes'),
      initialStock: integer(sku.initialStock, 'initialStock'),
    };
  });
  if (new Set(skus.map(({ supplierSkuCode }) => supplierSkuCode)).size !== skus.length) {
    throw new SafeApiError(409, 'SUPPLIER_SKU_DUPLICATE', 'supplierSkuCode is duplicated');
  }
  return {
    categoryId: input.categoryId,
    templateVersion: integer(input.templateVersion, 'templateVersion', { minimum: 1 }),
    name: text(input.name, 'name', 200)!,
    brand: text(input.brand, 'brand', 120, { nullable: true }),
    attributes: validateJsonValue(input.attributes, 'attributes'),
    qualificationReferences,
    qualificationValidUntil: nullableDateTime(
      input.qualificationValidUntil,
      'qualificationValidUntil',
    ),
    isRetailEnabled: boolean(input.isRetailEnabled, 'isRetailEnabled'),
    isEnterpriseProcurementEnabled,
    enterpriseMinOrderQty,
    enterprisePackageMultiple,
    preparationMinutes: integer(input.preparationMinutes, 'preparationMinutes'),
    skus,
  };
};

export const normalizeSupplierProductPatch = (
  value: unknown,
): Partial<SupplierProductDraftInput> => {
  inspectForbiddenKeys(value);
  const input = asRecord(value, 'body');
  const allowed = new Set([
    'attributes',
    'brand',
    'categoryId',
    'enterpriseMinOrderQty',
    'enterprisePackageMultiple',
    'isEnterpriseProcurementEnabled',
    'isRetailEnabled',
    'name',
    'preparationMinutes',
    'qualificationReferences',
    'qualificationValidUntil',
    'skus',
    'templateVersion',
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new SafeApiError(403, 'FIELD_FORBIDDEN', 'Request contains forbidden fields');
  }
  if (Object.keys(input).length === 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'At least one field is required');
  }

  const patch: Record<string, unknown> = {};
  if ('categoryId' in input) {
    if (typeof input.categoryId !== 'string' || !uuidPattern.test(input.categoryId)) {
      throw new SafeApiError(422, 'CATEGORY_TEMPLATE_INVALID', 'categoryId is invalid');
    }
    patch.categoryId = input.categoryId;
  }
  if ('templateVersion' in input) {
    patch.templateVersion = integer(input.templateVersion, 'templateVersion', { minimum: 1 });
  }
  if ('name' in input) patch.name = text(input.name, 'name', 200)!;
  if ('brand' in input) patch.brand = text(input.brand, 'brand', 120, { nullable: true });
  if ('attributes' in input) patch.attributes = validateJsonValue(input.attributes, 'attributes');
  if ('qualificationReferences' in input) {
    if (!Array.isArray(input.qualificationReferences) || input.qualificationReferences.length > 50) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'qualificationReferences is invalid');
    }
    patch.qualificationReferences = input.qualificationReferences.map((reference) => {
      if (
        typeof reference !== 'string' ||
        !reference.startsWith('object://supplier-product/') ||
        reference.length > 500
      ) {
        throw new SafeApiError(422, 'VALIDATION_FAILED', 'qualification reference is invalid');
      }
      return reference;
    });
  }
  if ('qualificationValidUntil' in input) {
    patch.qualificationValidUntil = nullableDateTime(
      input.qualificationValidUntil,
      'qualificationValidUntil',
    );
  }
  if ('isRetailEnabled' in input) {
    patch.isRetailEnabled = boolean(input.isRetailEnabled, 'isRetailEnabled');
  }
  if ('isEnterpriseProcurementEnabled' in input) {
    patch.isEnterpriseProcurementEnabled = boolean(
      input.isEnterpriseProcurementEnabled,
      'isEnterpriseProcurementEnabled',
    );
  }
  if ('enterpriseMinOrderQty' in input) {
    patch.enterpriseMinOrderQty = integer(input.enterpriseMinOrderQty, 'enterpriseMinOrderQty');
  }
  if ('enterprisePackageMultiple' in input) {
    patch.enterprisePackageMultiple = integer(
      input.enterprisePackageMultiple,
      'enterprisePackageMultiple',
    );
  }
  if ('preparationMinutes' in input) {
    patch.preparationMinutes = integer(input.preparationMinutes, 'preparationMinutes');
  }
  if ('skus' in input) {
    if (!Array.isArray(input.skus) || input.skus.length < 1 || input.skus.length > 100) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'At least one SKU is required');
    }
    const skus = input.skus.map((candidate, index) => {
      const sku = asRecord(candidate, `skus[${index}]`);
      const allowedSku = new Set(['attributes', 'initialStock', 'supplierSkuCode']);
      if (Object.keys(sku).some((key) => !allowedSku.has(key))) {
        throw new SafeApiError(403, 'FIELD_FORBIDDEN', 'SKU contains forbidden fields');
      }
      return {
        supplierSkuCode: text(sku.supplierSkuCode, 'supplierSkuCode', 64)!,
        attributes: validateJsonValue(sku.attributes, 'sku.attributes'),
        initialStock: integer(sku.initialStock, 'initialStock'),
      };
    });
    if (new Set(skus.map(({ supplierSkuCode }) => supplierSkuCode)).size !== skus.length) {
      throw new SafeApiError(409, 'SUPPLIER_SKU_DUPLICATE', 'supplierSkuCode is duplicated');
    }
    patch.skus = skus;
  }
  return patch as Partial<SupplierProductDraftInput>;
};

export const normalizeProductChannelVisibility = (
  value: unknown,
): ProductChannelVisibilityInput => {
  inspectForbiddenKeys(value);
  const input = asRecord(value, 'body');
  const allowed = new Set([
    'enterpriseMinOrderQty',
    'enterprisePackageMultiple',
    'isEnterpriseProcurementEnabled',
    'isRetailEnabled',
    'reason',
    'version',
  ]);
  if (
    Object.keys(input).some((key) => !allowed.has(key)) ||
    [...allowed].some((key) => !Object.prototype.hasOwnProperty.call(input, key))
  ) {
    throw new SafeApiError(
      422,
      'VALIDATION_FAILED',
      'Complete channel visibility settings are required',
    );
  }
  const isEnterpriseProcurementEnabled = boolean(
    input.isEnterpriseProcurementEnabled,
    'isEnterpriseProcurementEnabled',
  );
  const enterpriseMinOrderQty = integer(
    input.enterpriseMinOrderQty,
    'enterpriseMinOrderQty',
  );
  const enterprisePackageMultiple = integer(
    input.enterprisePackageMultiple,
    'enterprisePackageMultiple',
  );
  if (
    isEnterpriseProcurementEnabled &&
    (enterpriseMinOrderQty < 1 || enterprisePackageMultiple < 1)
  ) {
    throw new SafeApiError(
      422,
      'VALIDATION_FAILED',
      'Enterprise quantity rules must be positive while the channel is enabled',
    );
  }
  return {
    version: integer(input.version, 'version'),
    isRetailEnabled: boolean(input.isRetailEnabled, 'isRetailEnabled'),
    isEnterpriseProcurementEnabled,
    enterpriseMinOrderQty,
    enterprisePackageMultiple,
    reason: text(input.reason, 'reason', 1000)!,
  };
};

export const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
};

export const requestHash = (value: unknown): string =>
  createHash('sha256').update(stableSerialize(value)).digest('hex');

export const requireIdempotencyKey = (value: string | undefined): string => {
  if (!value || value.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(value)) {
    throw new SafeApiError(
      428,
      'IDEMPOTENCY_KEY_REQUIRED',
      'A valid Idempotency-Key is required',
    );
  }
  return value;
};

export const requireVersion = (value: unknown): number =>
  integer(value, 'version', { minimum: 0 });

export const requireRequestId = (value: unknown): string => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'requestId must be a UUID');
  }
  return value;
};

export const requireSupplierProductId = (value: unknown, field = 'supplierProductId'): string => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be a UUID`);
  }
  return value;
};

export const normalizeSupplierProductJson = (value: unknown, field: string): JsonObject =>
  validateJsonValue(value, field);
