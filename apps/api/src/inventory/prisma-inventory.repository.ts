import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  AdjustInventoryCommand,
  InventoryBalanceRecord,
  InventoryChangeRecord,
  InventoryMutationRecord,
  InventoryMutationResult,
  InventoryReferenceType,
  InventoryRepository,
  InventoryReservationCommand,
} from './inventory.repository.js';

type Transaction = Prisma.TransactionClient;
type BalanceRow = Prisma.InventoryBalanceGetPayload<{ include: { sku: { include: { product: true } } } }>;
type LogRow = Prisma.InventoryChangeLogGetPayload<Record<string, never>>;

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private balance(row: BalanceRow): InventoryBalanceRecord {
    return {
      id: row.id,
      skuId: row.skuId,
      supplierId: row.sku.product.supplierId,
      productName: row.sku.product.name,
      skuCode: row.sku.code,
      status: row.availableQty === 0 ? 'OUT_OF_STOCK' : row.availableQty <= row.safetyStockQty ? 'LOW_STOCK' : 'AVAILABLE',
      availableQty: row.availableQty,
      reservedQty: row.reservedQty,
      soldQty: row.soldQty,
      damagedQty: row.damagedQty,
      safetyStockQty: row.safetyStockQty,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private log(row: LogRow): InventoryChangeRecord {
    return {
      id: row.id,
      skuId: row.skuId,
      type: row.type,
      availableDelta: row.availableDelta,
      reservedDelta: row.reservedDelta,
      soldDelta: row.soldDelta,
      damagedDelta: row.damagedDelta,
      beforeAvailableQty: row.beforeAvailableQty,
      afterAvailableQty: row.afterAvailableQty,
      beforeReservedQty: row.beforeReservedQty,
      afterReservedQty: row.afterReservedQty,
      beforeSoldQty: row.beforeSoldQty,
      afterSoldQty: row.afterSoldQty,
      resultingVersion: row.resultingVersion,
      reason: row.reason,
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  async list(supplierId: string): Promise<readonly InventoryBalanceRecord[]> {
    const rows = await this.prisma.inventoryBalance.findMany({
      where: { sku: { status: 'ACTIVE', product: { supplierId, saleStatus: 'ACTIVE' } } },
      include: { sku: { include: { product: true } } },
      orderBy: [{ updatedAt: 'desc' }, { skuId: 'asc' }],
    });
    return rows.map((row) => this.balance(row));
  }

  async history(supplierId: string, skuId: string): Promise<readonly InventoryChangeRecord[] | null> {
    const owned = await this.prisma.inventoryBalance.findFirst({
      where: { skuId, sku: { status: 'ACTIVE', product: { supplierId, saleStatus: 'ACTIVE' } } },
      select: { id: true },
    });
    if (!owned) return null;
    const rows = await this.prisma.inventoryChangeLog.findMany({
      where: { inventoryBalanceId: owned.id, supplierId, skuId },
      orderBy: [{ resultingVersion: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.log(row));
  }

  private async replay(
    database: Transaction | PrismaService,
    scope: string,
    key: string,
    requestHash: string,
  ): Promise<InventoryMutationResult<InventoryMutationRecord> | null> {
    const stored = await database.inventoryCommand.findUnique({
      where: { scope_idempotencyKey: { scope, idempotencyKey: key } },
    });
    if (!stored) return null;
    if (stored.requestHash !== requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    const snapshot = stored.responseSnapshot as unknown as InventoryMutationRecord;
    return { kind: 'OK', value: snapshot, replayed: true };
  }

  private async ownedBalance(
    tx: Transaction,
    skuId: string,
    supplierId?: string,
  ): Promise<BalanceRow | null> {
    return tx.inventoryBalance.findFirst({
      where: {
        skuId,
        sku: {
          status: 'ACTIVE',
          product: { saleStatus: 'ACTIVE', ...(supplierId ? { supplierId } : {}) },
        },
      },
      include: { sku: { include: { product: true } } },
    });
  }

  private async mutate(
    parameters: {
      scope: string;
      key: string;
      requestHash: string;
      skuId: string;
      supplierId?: string;
      expectedVersion: number;
      availableDelta: number;
      reservedDelta: number;
      soldDelta: number;
      damagedDelta: number;
      safetyStockQty?: number;
      type: LogRow['type'];
      referenceType: InventoryReferenceType;
      referenceId: string;
      reason: string;
      actorIdentityId?: string;
      functionalAccountId?: string;
      requestId?: string;
      ip?: string | null;
    },
  ): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await this.replay(tx, parameters.scope, parameters.key, parameters.requestHash);
        if (replay) return replay;
        const before = await this.ownedBalance(tx, parameters.skuId, parameters.supplierId);
        if (!before) return { kind: 'NOT_FOUND' } as const;
        if (before.version !== parameters.expectedVersion) return { kind: 'VERSION_CONFLICT' } as const;
        const after = {
          availableQty: before.availableQty + parameters.availableDelta,
          reservedQty: before.reservedQty + parameters.reservedDelta,
          soldQty: before.soldQty + parameters.soldDelta,
          damagedQty: before.damagedQty + parameters.damagedDelta,
          safetyStockQty: parameters.safetyStockQty ?? before.safetyStockQty,
        };
        if (Object.values(after).some((value) => value < 0)) return { kind: 'NEGATIVE' } as const;
        const changed = await tx.inventoryBalance.updateMany({
          where: {
            id: before.id,
            version: before.version,
            availableQty: before.availableQty,
            reservedQty: before.reservedQty,
            soldQty: before.soldQty,
            damagedQty: before.damagedQty,
          },
          data: { ...after, version: { increment: 1 } },
        });
        if (changed.count !== 1) return { kind: 'VERSION_CONFLICT' } as const;
        const log = await tx.inventoryChangeLog.create({
          data: {
            inventoryBalanceId: before.id,
            supplierId: before.sku.product.supplierId,
            skuId: before.skuId,
            type: parameters.type,
            availableDelta: parameters.availableDelta,
            reservedDelta: parameters.reservedDelta,
            soldDelta: parameters.soldDelta,
            damagedDelta: parameters.damagedDelta,
            beforeAvailableQty: before.availableQty,
            afterAvailableQty: after.availableQty,
            beforeReservedQty: before.reservedQty,
            afterReservedQty: after.reservedQty,
            beforeSoldQty: before.soldQty,
            afterSoldQty: after.soldQty,
            beforeDamagedQty: before.damagedQty,
            afterDamagedQty: after.damagedQty,
            resultingVersion: before.version + 1,
            referenceType: parameters.referenceType,
            referenceId: parameters.referenceId,
            reason: parameters.reason,
            actorIdentityId: parameters.actorIdentityId ?? null,
            functionalAccountId: parameters.functionalAccountId ?? null,
          },
        });
        const current = await tx.inventoryBalance.findUniqueOrThrow({
          where: { id: before.id },
          include: { sku: { include: { product: true } } },
        });
        const value: InventoryMutationRecord = { balance: this.balance(current), log: this.log(log) };
        await tx.inventoryCommand.create({
          data: {
            scope: parameters.scope,
            idempotencyKey: parameters.key,
            requestHash: parameters.requestHash,
            responseSnapshot: json(value),
          },
        });
        if (parameters.actorIdentityId && parameters.functionalAccountId && parameters.requestId) {
          await tx.auditLog.create({
            data: {
              actorType: 'SUPPLIER_USER',
              actorId: parameters.actorIdentityId,
              supplierId: before.sku.product.supplierId,
              functionalAccountId: parameters.functionalAccountId,
              action: 'INVENTORY_ADJUST',
              objectType: 'INVENTORY_BALANCE',
              objectId: before.id,
              beforeSnapshot: json({
                availableQty: before.availableQty,
                reservedQty: before.reservedQty,
                soldQty: before.soldQty,
                damagedQty: before.damagedQty,
                safetyStockQty: before.safetyStockQty,
                version: before.version,
              }),
              afterSnapshot: json({ ...after, version: before.version + 1 }),
              requestId: parameters.requestId,
              ip: parameters.ip ?? null,
            },
          });
        }
        return { kind: 'OK', value, replayed: false } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return (await this.replay(this.prisma, parameters.scope, parameters.key, parameters.requestHash))
          ?? { kind: 'VERSION_CONFLICT' };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return { kind: 'VERSION_CONFLICT' };
      }
      throw error;
    }
  }

  async adjust(command: AdjustInventoryCommand): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    const current = await this.prisma.inventoryBalance.findFirst({
      where: { skuId: command.skuId, sku: { status: 'ACTIVE', product: { supplierId: command.supplierId, saleStatus: 'ACTIVE' } } },
      select: { availableQty: true },
    });
    if (!current) return { kind: 'NOT_FOUND' };
    const availableDelta = command.mode === 'SET_AVAILABLE'
      ? command.quantity - current.availableQty
      : command.quantity;
    const damagedDelta = command.type === 'DAMAGE' ? -availableDelta : 0;
    const referenceType: InventoryReferenceType = command.type === 'DAMAGE'
      ? 'DAMAGE'
      : command.type.startsWith('STOCKTAKE') ? 'STOCKTAKE' : 'MANUAL_ADJUSTMENT';
    return this.mutate({
      scope: `supplier-adjust:${command.supplierId}:${command.skuId}`,
      key: command.idempotencyKey,
      requestHash: command.requestHash,
      skuId: command.skuId,
      supplierId: command.supplierId,
      expectedVersion: command.expectedVersion,
      availableDelta,
      reservedDelta: 0,
      soldDelta: 0,
      damagedDelta,
      ...(command.safetyStockQty === undefined ? {} : { safetyStockQty: command.safetyStockQty }),
      type: command.type,
      referenceType,
      referenceId: command.idempotencyKey,
      reason: command.reason,
      actorIdentityId: command.actorIdentityId,
      functionalAccountId: command.functionalAccountId,
      requestId: command.requestId,
      ip: command.ip,
    });
  }

  async reserve(command: InventoryReservationCommand): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) return { kind: 'STATE_INVALID' };
    return this.mutate({
      scope: `order-reserve:${command.skuId}`,
      key: command.idempotencyKey,
      requestHash: command.requestHash,
      skuId: command.skuId,
      expectedVersion: command.expectedVersion,
      availableDelta: -command.quantity,
      reservedDelta: command.quantity,
      soldDelta: 0,
      damagedDelta: 0,
      type: 'RESERVE',
      referenceType: 'ORDER_RESERVATION',
      referenceId: command.referenceId,
      reason: 'ORDER_RESERVATION',
    });
  }

  async release(command: InventoryReservationCommand): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) return { kind: 'STATE_INVALID' };
    return this.mutate({
      scope: `order-release:${command.skuId}`,
      key: command.idempotencyKey,
      requestHash: command.requestHash,
      skuId: command.skuId,
      expectedVersion: command.expectedVersion,
      availableDelta: command.quantity,
      reservedDelta: -command.quantity,
      soldDelta: 0,
      damagedDelta: 0,
      type: 'RELEASE',
      referenceType: 'ORDER_RELEASE',
      referenceId: command.referenceId,
      reason: 'ORDER_RELEASE',
    });
  }

  async confirmSale(command: InventoryReservationCommand): Promise<InventoryMutationResult<InventoryMutationRecord>> {
    if (!Number.isSafeInteger(command.quantity) || command.quantity <= 0) return { kind: 'STATE_INVALID' };
    return this.mutate({
      scope: `order-confirm:${command.skuId}`,
      key: command.idempotencyKey,
      requestHash: command.requestHash,
      skuId: command.skuId,
      expectedVersion: command.expectedVersion,
      availableDelta: 0,
      reservedDelta: -command.quantity,
      soldDelta: command.quantity,
      damagedDelta: 0,
      type: 'CONFIRM_SALE',
      referenceType: 'ORDER_CONFIRM',
      referenceId: command.referenceId,
      reason: 'ORDER_CONFIRM',
    });
  }
}
