import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('API-031 exposes a generated public whitelist and no supplier-store or supply-price fields', () => {
  const operation =
    openApi.paths['/v1/catalog/suppliers/{supplierId}/products']?.get;
  assert.equal(operation.operationId, 'catalog.listSupplierProducts');
  assert.equal(
    operation.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/PublicProductPageResponseDto',
  );
  const pageProperties =
    openApi.components.schemas.PublicProductPageResponseDto.properties;
  assert.deepEqual(Object.keys(pageProperties).sort(), [
    'checkoutMode',
    'items',
    'page',
    'pageSize',
    'sellerName',
    'sourceLabel',
    'supplierId',
    'total',
  ]);
  const contract = JSON.stringify({ operation, pageProperties });
  assert.doesNotMatch(
    contract,
    /approvedSupplyPrice|supplyPrice|supplierPayment|settlement|storefront|storeCart|storeCoupon|creditCode|phone/iu,
  );
});
