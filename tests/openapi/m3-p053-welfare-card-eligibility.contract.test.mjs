import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const document = JSON.parse(readFileSync(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));

test('API-039 freezes read-only owner-derived welfare-card eligibility without sensitive price or owner fields', () => {
  const operation = document.paths['/v1/consumer/welfare-card-accounts/eligible'].get;
  assert.equal(operation.operationId, 'consumerWelfareCard.listEligibleAccounts');
  assert.deepEqual(operation.parameters.filter(({ in: location }) => location === 'query').map(({ name }) => name).sort(), ['quantity', 'skuId']);
  const responseRef = operation.responses['200'].content['application/json'].schema.$ref;
  const response = document.components.schemas[responseRef.split('/').at(-1)];
  assert.deepEqual(response.required.sort(), ['accounts', 'deliveryFee', 'goodsAmount', 'totalAmount']);
  const itemRef = response.properties.accounts.items.$ref;
  const item = document.components.schemas[itemRef.split('/').at(-1)];
  assert.deepEqual(item.required.sort(), [
    'availableAmount', 'balanceAmount', 'eligibleAmount', 'frozenAmount', 'id', 'maskedCardNo',
    'maximumDeductibleAmount', 'programName', 'scopeDescription', 'scopeType', 'status', 'version',
  ]);
  assert.doesNotMatch(JSON.stringify({ operation, response, item }), /"(?:companyId|consumerUserId|buyerId|programId|batchId|cardNo|supplyPrice|supplierPayable|secret)"\s*:/iu);
});
