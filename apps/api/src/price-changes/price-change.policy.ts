import { createHash } from 'node:crypto';

import { SafeApiError } from '../http/api-error.js';

const ownershipFields = new Set([
  'buyerId',
  'companyId',
  'functionalAccountId',
  'identityId',
  'supplierId',
]);

const findForbiddenOwnershipField = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findForbiddenOwnershipField(entry);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, entry] of Object.entries(value)) {
    if (ownershipFields.has(key)) return key;
    const found = findForbiddenOwnershipField(entry);
    if (found) return found;
  }
  return null;
};

export const rejectOwnershipFields = (body: unknown): void => {
  if (findForbiddenOwnershipField(body)) {
    throw new SafeApiError(
      403,
      'SUPPLIER_SCOPE_FORBIDDEN',
      'Ownership fields are derived from the verified session',
    );
  }
};

export const assertAllowedFields = (
  body: Record<string, unknown>,
  allowed: readonly string[],
): void => {
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request contains unsupported fields');
  }
};

export const requireIdempotencyKey = (value: string | undefined): string => {
  const key = value?.trim();
  if (!key || key.length > 128) {
    throw new SafeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required');
  }
  return key;
};

export const requireIntegerCents = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new SafeApiError(422, 'PRICE_INVALID', `${name} must be a non-negative integer in cents`);
  }
  return value as number;
};

export const requireVersion = (value: unknown, name = 'version'): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new SafeApiError(422, 'VERSION_CONFLICT', `${name} must be a non-negative integer`);
  }
  return value as number;
};

export const requireText = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 1000) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${name} must contain 2 to 1000 characters`);
  }
  return value.trim();
};

export const requireEffectiveAt = (value: unknown): string => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'effectiveAt must be an ISO date-time');
  }
  return new Date(value).toISOString();
};

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
};

export const hashPriceCommand = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(sortValue(value))).digest('hex');
