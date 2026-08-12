import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-017 exposes GIFT_BOX and structured bundle snapshots through the existing public detail route', () => {
  const operation = openApi.paths['/v1/catalog/products/{productId}'].get;
  assert.equal(operation.operationId, 'catalog.getProductDetail');
  const schema = openApi.components.schemas.PublicFoodProductDetailResponseDto;
  assert.deepEqual(schema.properties.templateProfile.enum, [
    'FOOD', 'FRESH', 'APPAREL', 'DIGITAL', 'GIFT_BOX',
  ]);
  assert.equal(schema.properties.bundleItems.items.$ref, '#/components/schemas/PublicGiftBoxItemResponseDto');
  const item = openApi.components.schemas.PublicGiftBoxItemResponseDto;
  assert.deepEqual(Object.keys(item.properties).sort(), [
    'minimumExpiryDays', 'name', 'quantity', 'specification',
  ]);
  assert.deepEqual(item.required.sort(), [
    'minimumExpiryDays', 'name', 'quantity', 'specification',
  ]);
  assert.doesNotMatch(
    JSON.stringify({ operation, schema, item }),
    /supplierProductId|approvedSupplyPrice|supplyPrice|qualificationSnapshot|settlement|margin/iu,
  );
});

test('P0-017 preserves its exact GIFT_BOX and BUNDLE_ITEMS contract after the P0-018 regulatory extension', () => {
  const request = openApi.components.schemas.CategoryTemplateCreateRequestDto;
  const response = openApi.components.schemas.CategoryTemplateResponseDto;
  assert.deepEqual(request.properties.profile.enum, [
    'FOOD', 'FRESH', 'APPAREL', 'DIGITAL', 'GIFT_BOX', 'GENERIC',
  ]);
  assert.deepEqual(response.properties.profile.enum, request.properties.profile.enum);
  const fieldType = openApi.components.schemas.TemplateFieldDefinitionDto.properties.type.enum;
  assert.deepEqual(fieldType, [
    'BOOLEAN', 'BUNDLE_ITEMS', 'DATE', 'DECIMAL', 'ENUM', 'INTEGER', 'RICH_TEXT', 'TEXT',
  ]);
  assert.match(JSON.stringify(openApi.components.schemas), /BUNDLE_SCHEMA_INVALID/u);
  assert.match(JSON.stringify(openApi.components.schemas), /TEMPLATE_VERSION_IMMUTABLE/u);
  assert.deepEqual(request.properties.regulatoryMode.enum, ['STANDARD', 'HIGH_RISK']);
  assert.equal(request.properties.regulatoryMode.default, 'STANDARD');
  assert.deepEqual(response.properties.regulatoryMode, request.properties.regulatoryMode);
});

test('the user miniapp renders a dedicated bundle list and keeps internal references out of view state', async () => {
  const [page, template] = await Promise.all([
    readFile(
      new URL('../../apps/user-miniapp/src/pages/product-detail/index.wxml', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../../apps/user-miniapp/src/pages/product-detail/index.ts', import.meta.url),
      'utf8',
    ),
  ]);
  assert.match(page, /组合清单/u);
  assert.match(page, /quantityLabel/u);
  assert.match(page, /minimumExpiryLabel/u);
  assert.match(template, /response\.bundleItems/u);
  assert.match(template, /minimumExpiryDays/u);
  assert.doesNotMatch(`${page}\n${template}`, /supplierProductId|supplyPrice|approvedSupplyPrice/iu);
});
