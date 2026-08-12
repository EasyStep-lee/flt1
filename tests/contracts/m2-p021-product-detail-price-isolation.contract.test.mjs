import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-021 freezes mutually exclusive retail and enterprise detail DTO whitelists', () => {
  const retailOperation = openApi.paths['/v1/catalog/products/{productId}'].get;
  const enterpriseOperation = openApi.paths['/v1/enterprise/catalog/products/{productId}'].get;
  assert.equal(retailOperation.operationId, 'catalog.getProductDetail');
  assert.equal(enterpriseOperation.operationId, 'enterpriseCatalog.getProductDetail');
  assert.deepEqual(enterpriseOperation.security, [{ enterpriseSession: [] }]);

  const retail = openApi.components.schemas.PublicFoodProductDetailResponseDto;
  const enterprise = openApi.components.schemas.EnterpriseProductDetailResponseDto;
  assert.ok(Object.hasOwn(retail.properties, 'retailSalePrice'));
  assert.ok(!Object.hasOwn(retail.properties, 'enterpriseSalePrice'));
  assert.ok(Object.hasOwn(enterprise.properties, 'enterpriseSalePrice'));
  assert.ok(!Object.hasOwn(enterprise.properties, 'retailSalePrice'));
  assert.doesNotMatch(
    JSON.stringify({ retailOperation, enterpriseOperation, retail, enterprise }),
    /approvedSupplyPrice|supplyPrice|supplierPayable|grossMargin|internalMargin/iu,
  );
});

test('P0-021 enterprise catalog auth is an HttpOnly-style cookie contract, not a client ownership parameter', () => {
  const security = openApi.components.securitySchemes.enterpriseSession;
  assert.deepEqual(security, {
    in: 'cookie',
    name: '__Host-fulishe-enterprise-portal',
    type: 'apiKey',
  });
  const operation = openApi.paths['/v1/enterprise/catalog/products/{productId}'].get;
  assert.deepEqual(operation.parameters.map(({ in: location, name }) => [location, name]), [
    ['path', 'productId'],
  ]);
});
