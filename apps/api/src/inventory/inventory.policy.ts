import { createHash } from 'node:crypto';

import { SafeApiError } from '../http/api-error.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const allowed = new Set(['type', 'mode', 'quantity', 'safetyStockQty', 'expectedVersion', 'reason']);
const types = new Set(['INCREASE', 'DECREASE', 'STOCKTAKE_GAIN', 'STOCKTAKE_LOSS', 'DAMAGE']);
const modes = new Set(['DELTA_AVAILABLE', 'SET_AVAILABLE']);

export type SupplierInventoryAdjustmentType =
  | 'INCREASE'
  | 'DECREASE'
  | 'STOCKTAKE_GAIN'
  | 'STOCKTAKE_LOSS'
  | 'DAMAGE';
export type SupplierInventoryAdjustmentMode = 'DELTA_AVAILABLE' | 'SET_AVAILABLE';

export const inventoryRequestHash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const requireInventoryId = (value: unknown, field = 'skuId'): string => {
  if (typeof value !== 'string' || !uuid.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be a UUID`);
  }
  return value;
};

export const requireInventoryIdempotencyKey = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 128) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Idempotency-Key is required');
  }
  return value;
};

export const normalizeInventoryAdjustment = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request body must be an object');
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Client ownership or unknown fields are forbidden');
  }
  if (typeof body.type !== 'string' || !types.has(body.type)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Inventory change type is invalid');
  }
  if (typeof body.mode !== 'string' || !modes.has(body.mode)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Inventory adjustment mode is invalid');
  }
  if (!Number.isSafeInteger(body.quantity) || (body.mode === 'SET_AVAILABLE' && Number(body.quantity) < 0)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'quantity must be a valid integer');
  }
  if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'expectedVersion must be non-negative');
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length < 2 || body.reason.length > 1000) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'reason must contain 2 to 1000 characters');
  }
  if (body.safetyStockQty !== undefined && (!Number.isSafeInteger(body.safetyStockQty) || Number(body.safetyStockQty) < 0)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'safetyStockQty must be non-negative');
  }
  if (body.mode === 'DELTA_AVAILABLE' && Number(body.quantity) === 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'quantity must change the inventory balance');
  }
  if (body.type === 'DAMAGE' && body.mode !== 'DELTA_AVAILABLE') {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'damage must use DELTA_AVAILABLE');
  }
  if (
    body.mode === 'DELTA_AVAILABLE'
    && ((['INCREASE', 'STOCKTAKE_GAIN'].includes(body.type) && Number(body.quantity) < 0)
      || (['DECREASE', 'STOCKTAKE_LOSS', 'DAMAGE'].includes(body.type) && Number(body.quantity) > 0))
  ) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'quantity direction does not match inventory change type');
  }
  return {
    type: body.type as SupplierInventoryAdjustmentType,
    mode: body.mode as SupplierInventoryAdjustmentMode,
    quantity: Number(body.quantity),
    ...(body.safetyStockQty === undefined ? {} : { safetyStockQty: Number(body.safetyStockQty) }),
    expectedVersion: Number(body.expectedVersion),
    reason: body.reason.trim(),
  };
};

export type AdjustInventoryInput = ReturnType<typeof normalizeInventoryAdjustment>;
