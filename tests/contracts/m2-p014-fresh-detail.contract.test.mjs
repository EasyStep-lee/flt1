import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-014 extends the existing public detail whitelist with FRESH without exposing private data', () => {
  const operation = openApi.paths['/v1/catalog/products/{productId}'].get;
  assert.equal(operation.operationId, 'catalog.getProductDetail');
  assert.equal(
    operation.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/PublicFoodProductDetailResponseDto',
  );
  const schema = openApi.components.schemas.PublicFoodProductDetailResponseDto;
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    'brand', 'categoryId', 'checkoutMode', 'detailModules', 'name', 'productId',
    'retailSalePrice', 'sellerName', 'skus', 'supplierId', 'templateProfile', 'templateVersion',
  ]);
  assert.deepEqual(schema.properties.templateProfile.enum, ['FOOD', 'FRESH']);
  assert.deepEqual(
    openApi.components.schemas.PublicFoodDetailModuleResponseDto.properties.kind.enum,
    ['AFTER_SALE', 'FIELDS', 'FIXED_NOTICE'],
  );
  assert.doesNotMatch(
    JSON.stringify({ operation, schema }),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|settlement|margin|functionalAccountId|identityId/iu,
  );
});

test('P0-014 adds only FRESH to category-template profile contracts', () => {
  const request = openApi.components.schemas.CategoryTemplateCreateRequestDto;
  const response = openApi.components.schemas.CategoryTemplateResponseDto;
  assert.deepEqual(request.properties.profile.enum, ['FOOD', 'FRESH', 'GENERIC']);
  assert.deepEqual(response.properties.profile.enum, ['FOOD', 'FRESH', 'GENERIC']);
  assert.doesNotMatch(JSON.stringify({ request, response }), /APPAREL|DIGITAL|GIFT_BOX/iu);
});
