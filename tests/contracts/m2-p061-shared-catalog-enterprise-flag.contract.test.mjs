import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-061 freezes one enterprise shelf DTO over shared Product and SKU identifiers', () => {
  const operation = openApi.paths['/v1/enterprise/catalog/products'].get;
  assert.equal(operation.operationId, 'enterpriseCatalog.listProducts');
  assert.deepEqual(operation.security, [{ enterpriseSession: [] }]);
  assert.deepEqual(
    operation.parameters.map(({ in: location, name }) => [location, name]).sort(),
    [['query', 'page'], ['query', 'pageSize']],
  );
  const item = openApi.components.schemas.EnterpriseCatalogProductResponseDto;
  assert.deepEqual(
    Object.keys(item.properties).sort(),
    [
      'activeSkuCount',
      'categoryId',
      'enterpriseSalePrice',
      'media',
      'name',
      'productId',
      'skuIds',
      'supplierId',
      'templateVersion',
    ],
  );
  assert.doesNotMatch(
    JSON.stringify({ operation, item }),
    /retailSalePrice|supplyPrice|inventoryBalance|grossMargin|supplierPayable/iu,
  );
});

test('P0-061 freezes an idempotent supplier channel command and immutable history query', () => {
  const mutation = openApi.paths[
    '/v1/supplier/products/{supplierProductId}/channel-visibility'
  ].patch;
  const history = openApi.paths[
    '/v1/supplier/products/{supplierProductId}/channel-visibility-history'
  ].get;
  assert.equal(mutation.operationId, 'supplierProducts.changeChannelVisibility');
  assert.equal(history.operationId, 'supplierProducts.listChannelVisibilityHistory');
  assert.ok(
    mutation.parameters.some(
      ({ in: location, name, required }) =>
        location === 'header' && name === 'Idempotency-Key' && required,
    ),
  );
  const request = openApi.components.schemas.SupplierProductChannelVisibilityRequestDto;
  assert.deepEqual(
    Object.keys(request.properties).sort(),
    [
      'enterpriseMinOrderQty',
      'enterprisePackageMultiple',
      'isEnterpriseProcurementEnabled',
      'isRetailEnabled',
      'reason',
      'version',
    ],
  );
  assert.ok(!Object.hasOwn(request.properties, 'supplierId'));
  assert.ok(!Object.hasOwn(request.properties, 'companyId'));
});
