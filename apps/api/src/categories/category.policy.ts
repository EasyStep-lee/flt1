import { SafeApiError } from '../http/api-error.js';
import {
  requestHash,
  requireIdempotencyKey,
  requireSupplierProductId,
  requireVersion,
} from '../supplier-products/supplier-product.policy.js';

export type CategoryStatus = 'ENABLED' | 'DISABLED';

export interface CategoryCreateInput {
  readonly parentId: string | null;
  readonly name: string;
  readonly level: 1 | 2 | 3;
  readonly sortWeight: number;
}

export interface CategoryPatchInput {
  readonly parentId?: string | null;
  readonly name?: string;
  readonly sortWeight?: number;
  readonly status?: CategoryStatus;
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request body must be an object');
  }
  return value as Record<string, unknown>;
};

const integer = (value: unknown, field: string): number => {
  if (!Number.isSafeInteger(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be a safe integer`);
  }
  return value as number;
};

const name = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'name must be a string');
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 100 || /<script|javascript:/iu.test(normalized)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'name is invalid');
  }
  return normalized;
};

const parentId = (value: unknown): string | null => {
  if (value === null) return null;
  return requireSupplierProductId(value, 'parentId');
};

export const normalizeCategoryCreate = (value: unknown): CategoryCreateInput => {
  const body = asRecord(value);
  if (
    Object.keys(body).some((key) => !['level', 'name', 'parentId', 'sortWeight'].includes(key)) ||
    !['level', 'name', 'parentId', 'sortWeight'].every((key) =>
      Object.prototype.hasOwnProperty.call(body, key),
    )
  ) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Category create body is invalid');
  }
  const levelValue = integer(body.level, 'level');
  if (![1, 2, 3].includes(levelValue)) {
    throw new SafeApiError(422, 'CATEGORY_LEVEL_INVALID', 'Category level must be 1, 2 or 3');
  }
  return {
    parentId: parentId(body.parentId),
    name: name(body.name),
    level: levelValue as 1 | 2 | 3,
    sortWeight: integer(body.sortWeight, 'sortWeight'),
  };
};

export const normalizeCategoryPatch = (
  value: unknown,
): { readonly expectedVersion: number; readonly patch: CategoryPatchInput } => {
  const body = asRecord(value);
  const allowed = new Set(['name', 'parentId', 'sortWeight', 'status', 'version']);
  if (
    Object.keys(body).some((key) => !allowed.has(key)) ||
    !Object.prototype.hasOwnProperty.call(body, 'version')
  ) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Category patch body is invalid');
  }
  const patch: {
    parentId?: string | null;
    name?: string;
    sortWeight?: number;
    status?: CategoryStatus;
  } = {};
  if (Object.prototype.hasOwnProperty.call(body, 'parentId')) patch.parentId = parentId(body.parentId);
  if (Object.prototype.hasOwnProperty.call(body, 'name')) patch.name = name(body.name);
  if (Object.prototype.hasOwnProperty.call(body, 'sortWeight')) {
    patch.sortWeight = integer(body.sortWeight, 'sortWeight');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (!['ENABLED', 'DISABLED'].includes(body.status as string)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'status is invalid');
    }
    patch.status = body.status as CategoryStatus;
  }
  if (Object.keys(patch).length === 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'At least one patch field is required');
  }
  return { expectedVersion: requireVersion(body.version), patch };
};

export const normalizeCategoryStatus = (value: unknown): CategoryStatus | undefined => {
  if (value === undefined) return undefined;
  if (value !== 'ENABLED' && value !== 'DISABLED') {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'status query is invalid');
  }
  return value;
};

export const categoryRequestHash = requestHash;
export const requireCategoryId = (value: unknown): string =>
  requireSupplierProductId(value, 'categoryId');
export const requireCategoryIdempotencyKey = requireIdempotencyKey;
export const requireCategoryVersion = requireVersion;

