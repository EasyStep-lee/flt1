import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

import { assertM1OpenApiContracts } from '../../dist/openapi/m1-openapi-contract.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

test('NEG-M1-047-01 rejects a forbidden field injected into a protected response schema', () => {
  const generated = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const leaked = JSON.parse(JSON.stringify(generated));
  leaked.components.schemas.SupplierRegistrationResponseDto.properties.supplyPrice = {
    description: 'must never be exposed',
    type: 'integer',
  };

  assert.throws(
    () => assertM1OpenApiContracts(leaked),
    /PUBLIC_RESPONSE_FIELD_FORBIDDEN:API-005:.*supplyPrice/u,
  );
});

test('NEG-M1-047-01 follows arrays, compositions and nested references', () => {
  const generated = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages', 'contracts', 'openapi.json'), 'utf8'),
  );
  const leaked = JSON.parse(JSON.stringify(generated));
  leaked.components.schemas.SupplierRegistrationResponseDto.properties.nested = {
    type: 'array',
    items: {
      allOf: [
        {
          anyOf: [
            {
              oneOf: [{ $ref: '#/components/schemas/NestedInternalPricingDto' }],
            },
          ],
        },
      ],
    },
  };
  leaked.components.schemas.NestedInternalPricingDto = {
    type: 'object',
    properties: {
      grossMarginRate: { type: 'number' },
    },
  };

  assert.throws(
    () => assertM1OpenApiContracts(leaked),
    /PUBLIC_RESPONSE_FIELD_FORBIDDEN:API-005:.*grossMarginRate/u,
  );
});
