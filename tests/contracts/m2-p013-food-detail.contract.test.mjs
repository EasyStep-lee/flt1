import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-013 exposes a public FOOD detail DTO whitelist with company-unified checkout', () => {
  const operation = openApi.paths['/v1/catalog/products/{productId}'].get;
  assert.equal(operation.operationId, 'catalog.getProductDetail');
  assert.equal(
    operation.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/PublicFoodProductDetailResponseDto',
  );
  const schema = openApi.components.schemas.PublicFoodProductDetailResponseDto;
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    'brand',
    'bundleItems',
    'categoryId',
    'checkoutMode',
    'detailModules',
    'name',
    'productId',
    'retailSalePrice',
    'sellerName',
    'skus',
    'supplierId',
    'templateProfile',
    'templateVersion',
  ]);
  assert.deepEqual(schema.properties.templateProfile.enum.slice(0, 3), ['FOOD', 'FRESH', 'APPAREL']);
  assert.deepEqual(schema.properties.checkoutMode.enum, ['COMPANY_UNIFIED']);
  assert.doesNotMatch(
    JSON.stringify({ operation, schema }),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|settlement|margin|functionalAccountId|identityId/iu,
  );
});

test('P0-013 remains explicit when later product profiles are added', () => {
  const request = openApi.components.schemas.CategoryTemplateCreateRequestDto;
  const response = openApi.components.schemas.CategoryTemplateResponseDto;
  assert.deepEqual(request.properties.profile.enum.slice(0, 3), ['FOOD', 'FRESH', 'APPAREL']);
  assert.deepEqual(response.properties.profile.enum.slice(0, 3), ['FOOD', 'FRESH', 'APPAREL']);
  assert.equal(request.properties.profile.enum.at(-1), 'GENERIC');
  assert.equal(response.properties.profile.enum.at(-1), 'GENERIC');
  assert.ok(request.properties.profile.enum.includes('GIFT_BOX'));
  assert.ok(response.properties.profile.enum.includes('GIFT_BOX'));
});
