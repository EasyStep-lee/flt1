import { SafeApiError } from '../http/api-error.js';
import {
  requestHash,
  requireIdempotencyKey,
  requireRequestId,
  requireSupplierProductId,
} from '../supplier-products/supplier-product.policy.js';

const ownerKeys = new Set([
  'buyerId',
  'companyId',
  'functionalAccountId',
  'identityId',
  'supplierId',
  'userId',
]);

export interface NormalizedInitialPricesRequest {
  readonly requestId: string;
  readonly prices: readonly {
    readonly supplierSkuCode: string;
    readonly requestedSupplyPrice: number;
    readonly requestedRetailSalePrice: number;
    readonly requestedEnterpriseSalePrice: number;
  }[];
}

const inspectOwnerKeys = (value: unknown): void => {
  if (Array.isArray(value)) {
    value.forEach(inspectOwnerKeys);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (ownerKeys.has(key)) {
      throw new SafeApiError(
        403,
        'SUPPLIER_SCOPE_FORBIDDEN',
        'Supplier ownership is derived from the fixed pricing session',
      );
    }
    inspectOwnerKeys(child);
  }
};

const cents = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new SafeApiError(422, 'PRICE_INVALID', 'Prices must be non-negative integer cents');
  }
  return Number(value);
};

export const normalizeInitialPricesRequest = (
  value: unknown,
): NormalizedInitialPricesRequest => {
  inspectOwnerKeys(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'PRICE_INVALID', 'Initial price body must be an object');
  }
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !['prices', 'requestId'].includes(key)) ||
    !Array.isArray(body.prices) ||
    body.prices.length === 0 ||
    body.prices.length > 200
  ) {
    throw new SafeApiError(422, 'PRICE_INVALID', 'Initial price body is invalid');
  }
  const requestId = requireRequestId(body.requestId);
  const prices = body.prices.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new SafeApiError(422, 'PRICE_INVALID', 'Initial price row is invalid');
    }
    const row = candidate as Record<string, unknown>;
    if (
      Object.keys(row).some(
        (key) =>
          ![
            'requestedEnterpriseSalePrice',
            'requestedRetailSalePrice',
            'requestedSupplyPrice',
            'supplierSkuCode',
          ].includes(key),
      ) ||
      typeof row.supplierSkuCode !== 'string' ||
      !row.supplierSkuCode.trim() ||
      row.supplierSkuCode.trim().length > 64
    ) {
      throw new SafeApiError(422, 'PRICE_INVALID', 'Initial price row is invalid');
    }
    return {
      supplierSkuCode: row.supplierSkuCode.trim(),
      requestedSupplyPrice: cents(row.requestedSupplyPrice),
      requestedRetailSalePrice: cents(row.requestedRetailSalePrice),
      requestedEnterpriseSalePrice: cents(row.requestedEnterpriseSalePrice),
    };
  });
  if (new Set(prices.map(({ supplierSkuCode }) => supplierSkuCode)).size !== prices.length) {
    throw new SafeApiError(422, 'PRICE_INVALID', 'Supplier SKU codes must be unique');
  }
  return { requestId, prices };
};

export const normalizeInitialPriceCommand = (
  supplierProductIdValue: unknown,
  bodyValue: unknown,
  idempotencyKeyValue: string | undefined,
) => {
  const supplierProductId = requireSupplierProductId(supplierProductIdValue);
  const body = normalizeInitialPricesRequest(bodyValue);
  const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
  return {
    supplierProductId,
    body,
    idempotencyKey,
    requestHash: requestHash({ supplierProductId, ...body }),
  };
};
