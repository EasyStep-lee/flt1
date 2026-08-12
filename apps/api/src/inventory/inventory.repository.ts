export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');

export type InventoryChangeType =
  | 'INCREASE' | 'DECREASE' | 'STOCKTAKE_GAIN' | 'STOCKTAKE_LOSS'
  | 'DAMAGE' | 'RESERVE' | 'RELEASE' | 'CONFIRM_SALE';
export type InventoryReferenceType =
  | 'MANUAL_ADJUSTMENT' | 'STOCKTAKE' | 'DAMAGE'
  | 'ORDER_RESERVATION' | 'ORDER_RELEASE' | 'ORDER_CONFIRM';

export interface InventoryBalanceRecord {
  readonly id: string;
  readonly skuId: string;
  readonly supplierId: string;
  readonly productName: string;
  readonly skuCode: string;
  readonly status: 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  readonly availableQty: number;
  readonly reservedQty: number;
  readonly soldQty: number;
  readonly damagedQty?: number;
  readonly safetyStockQty: number;
  readonly version: number;
  readonly updatedAt: string;
}

export interface InventoryChangeRecord {
  readonly id: string;
  readonly skuId: string;
  readonly type: InventoryChangeType;
  readonly quantityDelta?: number;
  readonly availableDelta?: number;
  readonly reservedDelta?: number;
  readonly soldDelta?: number;
  readonly damagedDelta?: number;
  readonly beforeAvailableQty: number;
  readonly afterAvailableQty: number;
  readonly beforeReservedQty?: number;
  readonly afterReservedQty?: number;
  readonly beforeSoldQty?: number;
  readonly afterSoldQty?: number;
  readonly resultingVersion: number;
  readonly reason: string;
  readonly occurredAt: string;
}

export interface AdjustInventoryCommand {
  readonly supplierId: string;
  readonly skuId: string;
  readonly type: 'INCREASE' | 'DECREASE' | 'STOCKTAKE_GAIN' | 'STOCKTAKE_LOSS' | 'DAMAGE';
  readonly mode: 'DELTA_AVAILABLE' | 'SET_AVAILABLE';
  readonly quantity: number;
  readonly safetyStockQty?: number;
  readonly expectedVersion: number;
  readonly reason: string;
  readonly actorIdentityId: string;
  readonly functionalAccountId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly ip: string | null;
}

export interface InventoryReservationCommand {
  readonly skuId: string;
  readonly quantity: number;
  readonly expectedVersion: number;
  readonly referenceId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

export type InventoryMutationResult<T> =
  | { readonly kind: 'OK'; readonly value: T; readonly replayed: boolean }
  | { readonly kind: 'NOT_FOUND' | 'NEGATIVE' | 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT' | 'STATE_INVALID' };

export interface InventoryMutationRecord {
  readonly balance: InventoryBalanceRecord;
  readonly log: InventoryChangeRecord;
}

export interface InventoryRepository {
  list(supplierId: string): Promise<readonly InventoryBalanceRecord[]>;
  history(supplierId: string, skuId: string): Promise<readonly InventoryChangeRecord[] | null>;
  adjust(command: AdjustInventoryCommand): Promise<InventoryMutationResult<InventoryMutationRecord>>;
  reserve(command: InventoryReservationCommand): Promise<InventoryMutationResult<InventoryMutationRecord>>;
  release(command: InventoryReservationCommand): Promise<InventoryMutationResult<InventoryMutationRecord>>;
  confirmSale(command: InventoryReservationCommand): Promise<InventoryMutationResult<InventoryMutationRecord>>;
}
