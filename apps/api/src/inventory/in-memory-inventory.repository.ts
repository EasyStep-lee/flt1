import { randomUUID } from 'node:crypto';

import type {
  AdjustInventoryCommand,
  InventoryBalanceRecord,
  InventoryChangeRecord,
  InventoryMutationRecord,
  InventoryMutationResult,
  InventoryRepository,
  InventoryReservationCommand,
} from './inventory.repository.js';

interface SeedBalance {
  readonly skuId: string;
  readonly supplierId: string;
  readonly productName: string;
  readonly skuCode: string;
  readonly availableQty: number;
  readonly reservedQty?: number;
  readonly soldQty?: number;
  readonly damagedQty?: number;
  readonly safetyStockQty?: number;
}

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryInventoryRepository implements InventoryRepository {
  private readonly balances = new Map<string, InventoryBalanceRecord>();
  private readonly logs = new Map<string, InventoryChangeRecord[]>();
  private readonly commands = new Map<string, { hash: string; value: InventoryMutationRecord }>();
  private queue: Promise<void> = Promise.resolve();

  constructor(seeds: readonly SeedBalance[] = []) {
    for (const seed of seeds) {
      const balance: InventoryBalanceRecord = {
        id: randomUUID(),
        skuId: seed.skuId,
        supplierId: seed.supplierId,
        productName: seed.productName,
        skuCode: seed.skuCode,
        status: 'AVAILABLE',
        availableQty: seed.availableQty,
        reservedQty: seed.reservedQty ?? 0,
        soldQty: seed.soldQty ?? 0,
        damagedQty: seed.damagedQty ?? 0,
        safetyStockQty: seed.safetyStockQty ?? 0,
        version: 0,
        updatedAt: new Date(0).toISOString(),
      };
      this.balances.set(seed.skuId, balance);
      this.logs.set(seed.skuId, []);
    }
  }

  private serialize<T>(work: () => T | Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  async list(supplierId: string): Promise<readonly InventoryBalanceRecord[]> {
    return [...this.balances.values()].filter((item) => item.supplierId === supplierId).map(clone);
  }

  async history(supplierId: string, skuId: string): Promise<readonly InventoryChangeRecord[] | null> {
    const balance = this.balances.get(skuId);
    if (!balance || balance.supplierId !== supplierId) return null;
    return clone(this.logs.get(skuId) ?? []);
  }

  private mutate(parameters: {
    scope: string;
    key: string;
    hash: string;
    skuId: string;
    supplierId?: string;
    expectedVersion: number;
    type: InventoryChangeRecord['type'];
    availableDelta: number;
    reservedDelta: number;
    soldDelta: number;
    damagedDelta: number;
    safetyStockQty?: number;
    reason: string;
  }): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    return this.serialize(() => {
      const commandKey = `${parameters.scope}:${parameters.key}`;
      const prior = this.commands.get(commandKey);
      if (prior) {
        return prior.hash === parameters.hash
          ? { kind: 'OK', value: clone(prior.value), replayed: true }
          : { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      const before = this.balances.get(parameters.skuId);
      if (!before || (parameters.supplierId && before.supplierId !== parameters.supplierId)) return { kind: 'NOT_FOUND' };
      if (before.version !== parameters.expectedVersion) return { kind: 'VERSION_CONFLICT' };
      const quantities = {
        availableQty: before.availableQty + parameters.availableDelta,
        reservedQty: before.reservedQty + parameters.reservedDelta,
        soldQty: before.soldQty + parameters.soldDelta,
        damagedQty: (before.damagedQty ?? 0) + parameters.damagedDelta,
      };
      if (Object.values(quantities).some((value) => value < 0)) return { kind: 'NEGATIVE' };
      const current: InventoryBalanceRecord = {
        ...before,
        ...quantities,
        safetyStockQty: parameters.safetyStockQty ?? before.safetyStockQty,
        version: before.version + 1,
        updatedAt: new Date((before.version + 1) * 1000).toISOString(),
      };
      const log: InventoryChangeRecord = {
        id: randomUUID(),
        skuId: parameters.skuId,
        type: parameters.type,
        availableDelta: parameters.availableDelta,
        reservedDelta: parameters.reservedDelta,
        soldDelta: parameters.soldDelta,
        damagedDelta: parameters.damagedDelta,
        beforeAvailableQty: before.availableQty,
        afterAvailableQty: current.availableQty,
        beforeReservedQty: before.reservedQty,
        afterReservedQty: current.reservedQty,
        beforeSoldQty: before.soldQty,
        afterSoldQty: current.soldQty,
        resultingVersion: current.version,
        reason: parameters.reason,
        occurredAt: current.updatedAt,
      };
      this.balances.set(parameters.skuId, current);
      this.logs.get(parameters.skuId)?.push(log);
      const value = { balance: clone(current), log: clone(log) };
      this.commands.set(commandKey, { hash: parameters.hash, value });
      return { kind: 'OK', value: clone(value), replayed: false };
    });
  }

  async adjust(command: AdjustInventoryCommand): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    const current = this.balances.get(command.skuId);
    if (!current || current.supplierId !== command.supplierId) return { kind: 'NOT_FOUND' };
    const availableDelta = command.mode === 'SET_AVAILABLE' ? command.quantity - current.availableQty : command.quantity;
    return this.mutate({
      scope: `supplier-adjust:${command.supplierId}:${command.skuId}`,
      key: command.idempotencyKey,
      hash: command.requestHash,
      skuId: command.skuId,
      supplierId: command.supplierId,
      expectedVersion: command.expectedVersion,
      type: command.type,
      availableDelta,
      reservedDelta: 0,
      soldDelta: 0,
      damagedDelta: command.type === 'DAMAGE' ? -availableDelta : 0,
      ...(command.safetyStockQty === undefined ? {} : { safetyStockQty: command.safetyStockQty }),
      reason: command.reason,
    });
  }

  async reserve(command: InventoryReservationCommand): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) return { kind: 'STATE_INVALID' };
    return this.mutate({ scope: `order-reserve:${command.skuId}`, key: command.idempotencyKey, hash: command.requestHash,
      skuId: command.skuId, expectedVersion: command.expectedVersion, type: 'RESERVE', availableDelta: -command.quantity,
      reservedDelta: command.quantity, soldDelta: 0, damagedDelta: 0, reason: 'ORDER_RESERVATION' });
  }

  async release(command: InventoryReservationCommand): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) return { kind: 'STATE_INVALID' };
    return this.mutate({ scope: `order-release:${command.skuId}`, key: command.idempotencyKey, hash: command.requestHash,
      skuId: command.skuId, expectedVersion: command.expectedVersion, type: 'RELEASE', availableDelta: command.quantity,
      reservedDelta: -command.quantity, soldDelta: 0, damagedDelta: 0, reason: 'ORDER_RELEASE' });
  }

  async confirmSale(command: InventoryReservationCommand): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) return { kind: 'STATE_INVALID' };
    return this.mutate({ scope: `order-confirm:${command.skuId}`, key: command.idempotencyKey, hash: command.requestHash,
      skuId: command.skuId, expectedVersion: command.expectedVersion, type: 'CONFIRM_SALE', availableDelta: 0,
      reservedDelta: -command.quantity, soldDelta: command.quantity, damagedDelta: 0, reason: 'ORDER_CONFIRM' });
  }
}
