import assert from 'node:assert/strict';
import test from 'node:test';

import { assertCatalogPricePayloadAllowed } from '../../dist/catalog/catalog-price-isolation.policy.js';

test('P0-021 accepts only the selling-price field for the selected customer channel', () => {
  assert.doesNotThrow(() =>
    assertCatalogPricePayloadAllowed(
      { retailSalePrice: 6990, skus: [{ retailSalePrice: 6990 }] },
      'RETAIL',
    ),
  );
  assert.doesNotThrow(() =>
    assertCatalogPricePayloadAllowed(
      { enterpriseSalePrice: 6190, skus: [{ enterpriseSalePrice: 6190 }] },
      'ENTERPRISE',
    ),
  );
});

test('NEG-M2-021-01 rejects a deeply nested supply price before response/cache/analytics projection', () => {
  assert.throws(
    () =>
      assertCatalogPricePayloadAllowed(
        { cache: { analytics: [{ supplyPriceSnapshot: 5000 }] } },
        'RETAIL',
      ),
    (error) => error?.code === 'SENSITIVE_FIELD_LEAK',
  );
});

test('NEG-M2-021-03 rejects a selling price from the other customer channel', () => {
  assert.throws(
    () => assertCatalogPricePayloadAllowed({ enterpriseSalePrice: 6190 }, 'RETAIL'),
    (error) => error?.code === 'FIELD_FORBIDDEN',
  );
  assert.throws(
    () => assertCatalogPricePayloadAllowed({ retailSalePrice: 6990 }, 'ENTERPRISE'),
    (error) => error?.code === 'FIELD_FORBIDDEN',
  );
});
