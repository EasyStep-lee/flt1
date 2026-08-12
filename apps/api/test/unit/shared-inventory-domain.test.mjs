import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryInventoryRepository } from '../../dist/inventory/in-memory-inventory.repository.js';

const skuId = '23333333-3333-4333-8333-333333333333';
const supplierId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const createRepository = () => new InMemoryInventoryRepository([{
  skuId, supplierId, productName: '共享礼盒', skuCode: 'SHARED-01', availableQty: 8,
}]);
const command = (suffix, quantity, expectedVersion) => ({
  skuId,
  quantity,
  expectedVersion,
  referenceId: `order-${suffix}`,
  idempotencyKey: `inventory-${suffix}`,
  requestHash: `hash-${suffix}`,
});

test('M2-P063 reserves, releases and confirms against the same SKU balance with append-only versions', async () => {
  const repository = createRepository();
  const reserved = await repository.reserve(command('reserve', 3, 0));
  assert.equal(reserved.kind, 'OK');
  assert.equal(reserved.replayed, false);
  assert.deepEqual(
    pickBalance(reserved.value.balance),
    { availableQty: 5, reservedQty: 3, soldQty: 0, version: 1 },
  );
  const replay = await repository.reserve(command('reserve', 3, 0));
  assert.equal(replay.kind, 'OK');
  assert.equal(replay.replayed, true);
  const released = await repository.release(command('release', 1, 1));
  assert.equal(released.kind, 'OK');
  assert.deepEqual(
    pickBalance(released.value.balance),
    { availableQty: 6, reservedQty: 2, soldQty: 0, version: 2 },
  );
  const confirmed = await repository.confirmSale(command('confirm', 2, 2));
  assert.equal(confirmed.kind, 'OK');
  assert.deepEqual(
    pickBalance(confirmed.value.balance),
    { availableQty: 6, reservedQty: 0, soldQty: 2, version: 3 },
  );
  assert.deepEqual(
    (await repository.history(supplierId, skuId)).map(
      ({ type, resultingVersion }) => ({ type, resultingVersion }),
    ),
    [
      { type: 'RESERVE', resultingVersion: 1 },
      { type: 'RELEASE', resultingVersion: 2 },
      { type: 'CONFIRM_SALE', resultingVersion: 3 },
    ],
  );
});

test('M2-P063 allows only one same-version reservation and never partially writes a losing or negative command', async () => {
  const repository = createRepository();
  const [left, right] = await Promise.all([
    repository.reserve(command('concurrent-left', 6, 0)),
    repository.reserve(command('concurrent-right', 6, 0)),
  ]);
  assert.deepEqual([left.kind, right.kind].sort(), ['OK', 'VERSION_CONFLICT']);
  assert.deepEqual(
    pickBalance((await repository.list(supplierId))[0]),
    { availableQty: 2, reservedQty: 6, soldQty: 0, version: 1 },
  );
  assert.equal((await repository.history(supplierId, skuId)).length, 1);

  const negative = await repository.reserve(command('negative', 3, 1));
  assert.deepEqual(negative, { kind: 'NEGATIVE' });
  assert.deepEqual(
    pickBalance((await repository.list(supplierId))[0]),
    { availableQty: 2, reservedQty: 6, soldQty: 0, version: 1 },
  );
  assert.equal((await repository.history(supplierId, skuId)).length, 1);
});

const pickBalance = ({ availableQty, reservedQty, soldQty, version }) => ({
  availableQty,
  reservedQty,
  soldQty,
  version,
});
