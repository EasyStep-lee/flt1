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
  assert.deepEqual(schema.properties.templateProfile.enum, ['FOOD']);
  assert.deepEqual(schema.properties.checkoutMode.enum, ['COMPANY_UNIFIED']);
  assert.doesNotMatch(
    JSON.stringify({ operation, schema }),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|settlement|margin|functionalAccountId|identityId/iu,
  );
});

test('P0-013 template contracts classify FOOD explicitly without claiming later profiles', () => {
  const request = openApi.components.schemas.CategoryTemplateCreateRequestDto;
  const response = openApi.components.schemas.CategoryTemplateResponseDto;
  assert.deepEqual(request.properties.profile.enum, ['FOOD', 'GENERIC']);
  assert.deepEqual(response.properties.profile.enum, ['FOOD', 'GENERIC']);
  assert.doesNotMatch(JSON.stringify({ request, response }), /FRESH|APPAREL|DIGITAL|GIFT_BOX/iu);
});
