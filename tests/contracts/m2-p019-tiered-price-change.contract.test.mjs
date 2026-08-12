import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));

test('P0-019 freezes reviewed supply changes and approval-free sale-price changes', () => {
  const supply = openApi.paths['/v1/supplier/pricing/skus/{skuId}/supply-price-change'].post;
  const sales = openApi.paths['/v1/supplier/pricing/skus/{skuId}/sale-prices'].patch;
  const reviews = openApi.paths['/v1/company/price-reviews/supply-price-changes'].get;
  const decision = openApi.paths['/v1/company/price-reviews/supply-price-changes/{taskId}/decision'].post;
  const initialDecision = openApi.paths['/v1/company/price-reviews/{taskId}/decision'].post;
  assert.equal(supply.operationId, 'supplierListedPricing.submitSupplyPriceChange');
  assert.equal(sales.operationId, 'supplierListedPricing.patchSalePrices');
  assert.equal(reviews.operationId, 'companySupplyPriceReviews.list');
  assert.equal(decision.operationId, 'companySupplyPriceReviews.decide');
  assert.equal(
    initialDecision.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/ProductApprovalDecisionResponseDto',
  );
  assert.equal(supply.parameters.find(({ name }) => name === 'Idempotency-Key').required, true);
  assert.equal(sales.parameters.find(({ name }) => name === 'Idempotency-Key').required, true);
  assert.equal(decision.parameters.find(({ name }) => name === 'Idempotency-Key').required, true);
  assert.equal(openApi.components.schemas.SalePriceChangeResponseDto.properties.reviewCreated.type, 'boolean');
});

test('P0-019 uses DTO allowlists and keeps ownership and natural-person identifiers out of responses', () => {
  const supplierList = openApi.components.schemas.ListedSkuPriceDto;
  const review = openApi.components.schemas.SupplyPriceChangeDto;
  assert.deepEqual(Object.keys(supplierList.properties).sort(), [
    'approvedSupplyPrice', 'code', 'currentEnterpriseSalePrice', 'currentRetailSalePrice',
    'enterprisePriceVersion', 'id', 'productName', 'retailPriceVersion', 'supplyPriceVersion',
  ]);
  assert.doesNotMatch(JSON.stringify({ supplierList, review }), /companyId|supplierId|identityId|functionalAccountId/iu);
  assert.match(JSON.stringify(openApi.components.schemas.ApiErrorResponseDto), /PRICE_CHANGE_PENDING/u);
  assert.match(JSON.stringify(openApi.components.schemas.ApiErrorResponseDto), /PRICE_EFFECT_SCHEDULE_FAILED/u);
});
