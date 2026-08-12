import { describe, expect, it } from 'vitest';

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

describe('M2-P063 M3-ready internal atomic inventory contract', () => {
  it('reserves, releases and confirms against the same SKU balance with append-only versions', async () => {
    const repository = createRepository();
    const reserved = await repository.reserve(command('reserve', 3, 0));
    expect(reserved).toMatchObject({ kind: 'OK', replayed: false, value: { balance: { availableQty: 5, reservedQty: 3, soldQty: 0, version: 1 } } });
    const replay = await repository.reserve(command('reserve', 3, 0));
    expect(replay).toMatchObject({ kind: 'OK', replayed: true });
    const released = await repository.release(command('release', 1, 1));
    expect(released).toMatchObject({ kind: 'OK', value: { balance: { availableQty: 6, reservedQty: 2, version: 2 } } });
    const confirmed = await repository.confirmSale(command('confirm', 2, 2));
    expect(confirmed).toMatchObject({ kind: 'OK', value: { balance: { availableQty: 6, reservedQty: 0, soldQty: 2, version: 3 } } });
    expect(await repository.history(supplierId, skuId)).toMatchObject([
      { type: 'RESERVE', resultingVersion: 1 },
      { type: 'RELEASE', resultingVersion: 2 },
      { type: 'CONFIRM_SALE', resultingVersion: 3 },
    ]);
  });

  it('allows only one same-version reservation and never partially writes a losing or negative command', async () => {
    const repository = createRepository();
    const [left, right] = await Promise.all([
      repository.reserve(command('concurrent-left', 6, 0)),
      repository.reserve(command('concurrent-right', 6, 0)),
    ]);
    expect([left.kind, right.kind].sort()).toEqual(['OK', 'VERSION_CONFLICT']);
    expect((await repository.list(supplierId))[0]).toMatchObject({ availableQty: 2, reservedQty: 6, version: 1 });
    expect(await repository.history(supplierId, skuId)).toHaveLength(1);

    const negative = await repository.reserve(command('negative', 3, 1));
    expect(negative).toEqual({ kind: 'NEGATIVE' });
    expect((await repository.list(supplierId))[0]).toMatchObject({ availableQty: 2, reservedQty: 6, version: 1 });
    expect(await repository.history(supplierId, skuId)).toHaveLength(1);
  });
});
