import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const document = JSON.parse(readFileSync(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));

test('P0-054 freezes composite scope input and line-level API-039 applicability without rule leakage', () => {
  const rules = document.components.schemas.WelfareScopeRulesDto;
  assert.deepEqual(rules.properties.schemaVersion.enum, [1, 2]);
  for (const field of [
    'categoryIncludedIds', 'productIncludedIds', 'skuIncludedIds',
    'categoryExcludedIds', 'productExcludedIds', 'skuExcludedIds',
  ]) assert.equal(rules.properties[field].type, 'array');

  const account = document.components.schemas.EligibleWelfareAccountResponseDto;
  assert.ok(account.properties.scopeType.enum.includes('COMPOSITE'));
  const itemRef = account.properties.itemApplicability.items.$ref;
  const item = document.components.schemas[itemRef.split('/').at(-1)];
  assert.deepEqual(item.required.sort(), ['eligible', 'eligibleAmount', 'reason', 'skuId']);
  assert.ok(item.properties.reason.enum.includes('PRODUCT_EXCLUDED'));
  assert.ok(item.properties.reason.enum.includes('OUTSIDE_WHITELIST'));
  const deliveryRef = account.properties.deliveryFeeApplicability.$ref;
  const delivery = document.components.schemas[deliveryRef.split('/').at(-1)];
  assert.deepEqual(delivery.required.sort(), ['eligible', 'eligibleAmount']);
  assert.doesNotMatch(JSON.stringify({ account, item, delivery }), /scopeRules|categoryIncludedIds|productExcludedIds|companyId|consumerUserId|supplyPrice/iu);
});
