import { SafeApiError } from '../http/api-error.js';

export type CustomerCatalogPriceChannel = 'RETAIL' | 'ENTERPRISE';

const normalizeKey = (key: string): string =>
  key.replaceAll(/[^a-z0-9]/giu, '').toLowerCase();

const sensitiveKeys = new Set([
  'approvedsupplyprice',
  'currentsupplyprice',
  'grossmargin',
  'grossmarginrate',
  'internalmargin',
  'supplierpayable',
  'supplyprice',
  'supplypricesnapshot',
]);

export const assertCatalogPricePayloadAllowed = (
  payload: unknown,
  channel: CustomerCatalogPriceChannel,
): void => {
  if (Array.isArray(payload)) {
    for (const item of payload) assertCatalogPricePayloadAllowed(item, channel);
    return;
  }
  if (!payload || typeof payload !== 'object') return;

  for (const [key, value] of Object.entries(payload)) {
    const normalized = normalizeKey(key);
    if (sensitiveKeys.has(normalized)) {
      throw new SafeApiError(
        500,
        'SENSITIVE_FIELD_LEAK',
        'Sensitive catalog price field reached a customer boundary',
      );
    }
    if (
      (channel === 'RETAIL' && normalized === 'enterprisesaleprice') ||
      (channel === 'ENTERPRISE' && normalized === 'retailsaleprice')
    ) {
      throw new SafeApiError(
        500,
        'FIELD_FORBIDDEN',
        'A selling price from another catalog channel reached the response',
      );
    }
    assertCatalogPricePayloadAllowed(value, channel);
  }
};
