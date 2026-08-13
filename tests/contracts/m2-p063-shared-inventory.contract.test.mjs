import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-063 freezes supplier inventory DTO whitelists and keeps order stock commands internal', () => {
  const list = openApi.paths['/v1/supplier/inventory'].get;
  const adjust = openApi.paths['/v1/supplier/inventory/{skuId}/adjustments'].post;
  const history = openApi.paths['/v1/supplier/inventory/{skuId}/history'].get;
  assert.equal(list.operationId, 'supplierInventory.list');
  assert.equal(adjust.operationId, 'supplierInventory.adjust');
  assert.equal(history.operationId, 'supplierInventory.history');
  assert.ok(adjust.parameters.some(({ in: location, name, required }) =>
    location === 'header' && name === 'Idempotency-Key' && required));
  assert.deepEqual(
    Object.keys(openApi.components.schemas.SupplierInventoryAdjustmentRequestDto.properties).sort(),
    ['expectedVersion', 'mode', 'quantity', 'reason', 'safetyStockQty', 'type'],
  );
  assert.deepEqual(
    Object.keys(openApi.components.schemas.SupplierInventoryBalanceDto.properties).sort(),
    ['availableQty', 'damagedQty', 'productName', 'reservedQty', 'safetyStockQty', 'skuCode', 'skuId', 'soldQty', 'status', 'updatedAt', 'version', 'warning'],
  );
  assert.doesNotMatch(
    JSON.stringify({ list, adjust, history }),
    /supplierId|companyId|approvedSupplyPrice|supplyPrice|supplierPayable|grossMargin/iu,
  );
  assert.equal(openApi.paths['/v1/inventory/reserve'], undefined);
  assert.equal(openApi.paths['/v1/inventory/release'], undefined);
  assert.equal(openApi.paths['/v1/inventory/confirm'], undefined);
});
