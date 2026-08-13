import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));

test('P0-071 exposes scoped read models for supplier applications and company opinion history', () => {
  const supplier = openApi.paths['/v1/supplier/pricing/supply-price-changes']?.get;
  const history = openApi.paths['/v1/company/price-reviews/supply-price-changes/{taskId}/history']?.get;
  assert.equal(supplier?.operationId, 'supplierListedPricing.listSupplyPriceChanges');
  assert.equal(history?.operationId, 'companySupplyPriceReviews.history');
  assert.equal(supplier.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/SupplyPriceChangePageDto');
  assert.equal(history.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/SupplyPriceReviewHistoryPageDto');
});
test('P0-071 history DTO is an explicit whitelist without ownership or natural-person identifiers', () => {
  const schema = openApi.components.schemas.SupplyPriceReviewHistoryItemDto;
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    'event', 'fromStatus', 'occurredAt', 'opinion', 'toStatus', 'version',
  ]);
  assert.doesNotMatch(JSON.stringify(schema), /supplierId|companyId|identityId|functionalAccountId|actorId|reviewerId|applicantId/iu);
  assert.equal(openApi.paths['/v1/company/price-reviews/supply-price-changes/batch/decision'], undefined);
});
