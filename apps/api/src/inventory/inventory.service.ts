import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';
import type { SupplierInventoryActor } from './inventory.actor.js';
import {
  inventoryRequestHash,
  normalizeInventoryAdjustment,
  requireInventoryId,
  requireInventoryIdempotencyKey,
} from './inventory.policy.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryBalanceRecord,
  type InventoryChangeRecord,
  type InventoryMutationResult,
  type InventoryRepository,
} from './inventory.repository.js';

const requireRole = (actor: SupplierInventoryActor): void => {
  if (actor.role !== 'SUPPLIER_INVENTORY') {
    throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权访问库存页面');
  }
};

const balanceDto = (balance: InventoryBalanceRecord) => ({
  skuId: balance.skuId,
  productName: balance.productName,
  skuCode: balance.skuCode,
  status: balance.availableQty === 0
    ? 'OUT_OF_STOCK'
    : balance.availableQty <= balance.safetyStockQty ? 'LOW_STOCK' : 'AVAILABLE',
  availableQty: balance.availableQty,
  reservedQty: balance.reservedQty,
  soldQty: balance.soldQty,
  damagedQty: balance.damagedQty ?? 0,
  safetyStockQty: balance.safetyStockQty,
  warning: balance.availableQty <= balance.safetyStockQty,
  version: balance.version,
  updatedAt: balance.updatedAt,
});

const logDto = (log: InventoryChangeRecord) => ({
  id: log.id,
  skuId: log.skuId,
  type: log.type,
  availableDelta: log.availableDelta ?? log.quantityDelta ?? 0,
  reservedDelta: log.reservedDelta ?? 0,
  soldDelta: log.soldDelta ?? 0,
  damagedDelta: log.damagedDelta ?? 0,
  beforeAvailableQty: log.beforeAvailableQty,
  afterAvailableQty: log.afterAvailableQty,
  beforeReservedQty: log.beforeReservedQty ?? 0,
  afterReservedQty: log.afterReservedQty ?? 0,
  beforeSoldQty: log.beforeSoldQty ?? 0,
  afterSoldQty: log.afterSoldQty ?? 0,
  resultingVersion: log.resultingVersion,
  reason: log.reason,
  occurredAt: log.occurredAt,
});

const failure = (result: Exclude<InventoryMutationResult<never>, { kind: 'OK' }>): never => {
  const definitions: Record<typeof result.kind, readonly [number, ApiErrorCode, string]> = {
    NOT_FOUND: [403, 'SUPPLIER_SCOPE_FORBIDDEN', 'Inventory balance is outside the current supplier scope'],
    NEGATIVE: [422, 'INVENTORY_NEGATIVE', 'Inventory balance cannot become negative'],
    VERSION_CONFLICT: [409, 'INVENTORY_VERSION_CONFLICT', 'Inventory balance version changed'],
    IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts with the original request'],
    STATE_INVALID: [409, 'INVENTORY_STATE_INVALID', 'Inventory state does not permit this command'],
  };
  const [status, code, message] = definitions[result.kind];
  throw new SafeApiError(status, code, message);
};

@Injectable()
export class InventoryService {
  constructor(@Inject(INVENTORY_REPOSITORY) private readonly repository: InventoryRepository) {}

  async list(actor: SupplierInventoryActor, query: Record<string, unknown>) {
    requireRole(actor);
    const allowed = new Set(['page', 'pageSize', 'warningOnly']);
    if (Object.keys(query).some((key) => !allowed.has(key))) {
      throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Unknown inventory query fields are forbidden');
    }
    const page = query.page === undefined ? 1 : Number(query.page);
    const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
    const warningOnly = query.warningOnly === undefined ? false : query.warningOnly === 'true';
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Inventory pagination is invalid');
    }
    if (query.warningOnly !== undefined && query.warningOnly !== 'true' && query.warningOnly !== 'false') {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'warningOnly must be true or false');
    }
    const all = (await this.repository.list(actor.supplierId)).map(balanceDto);
    const filtered = warningOnly ? all.filter((item) => item.warning) : all;
    const offset = (page - 1) * pageSize;
    return { items: filtered.slice(offset, offset + pageSize), total: filtered.length, page, pageSize };
  }

  async history(actor: SupplierInventoryActor, skuIdValue: unknown) {
    requireRole(actor);
    const skuId = requireInventoryId(skuIdValue);
    const history = await this.repository.history(actor.supplierId, skuId);
    if (!history) throw new SafeApiError(403, 'SUPPLIER_SCOPE_FORBIDDEN', 'Inventory history is outside the current supplier scope');
    const items = history.map(logDto);
    return { items, total: items.length };
  }

  async adjust(
    actor: SupplierInventoryActor,
    skuIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
    ip: string | null,
  ) {
    requireRole(actor);
    const skuId = requireInventoryId(skuIdValue);
    const body = normalizeInventoryAdjustment(bodyValue);
    const idempotencyKey = requireInventoryIdempotencyKey(idempotencyKeyValue);
    const result = await this.repository.adjust({
      supplierId: actor.supplierId,
      skuId,
      ...body,
      actorIdentityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId,
      idempotencyKey,
      requestHash: inventoryRequestHash({ skuId, ...body }),
      requestId,
      ip,
    });
    if (result.kind !== 'OK') return failure(result);
    return {
      body: { balance: balanceDto(result.value.balance), log: logDto(result.value.log) },
      replayed: result.replayed,
    };
  }
}
