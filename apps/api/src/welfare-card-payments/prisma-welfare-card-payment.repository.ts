import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import { evaluateWelfareScope, parseWelfareScopeRules } from '../welfare-card-programs/welfare-card-scope.policy.js';
import type {
  WelfareCardFullPaymentCommand,
  WelfareCardFullPaymentRecord,
  WelfareCardFullPaymentResult,
  WelfareCardPaymentRepository,
} from './welfare-card-payment.repository.js';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

class WelfarePaymentMutationFailure extends Error {
  constructor(readonly kind: 'CONCURRENT_CONFLICT' | 'STATE_CONFLICT') {
    super(kind);
  }
}

const categoryIdOf = (snapshot: Prisma.JsonValue): string | null => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>).categoryId;
  return typeof value === 'string' ? value : null;
};

@Injectable()
export class PrismaWelfareCardPaymentRepository implements WelfareCardPaymentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async replay(command: WelfareCardFullPaymentCommand): Promise<WelfareCardFullPaymentResult | undefined> {
    const previous = await this.prisma.welfareCardPaymentCommand.findUnique({
      where: {
        companyId_consumerUserId_idempotencyKey: {
          companyId: command.companyId,
          consumerUserId: command.consumerUserId,
          idempotencyKey: command.idempotencyKey,
        },
      },
    });
    if (!previous) return undefined;
    if (previous.requestHash !== command.requestHash || previous.orderId !== command.orderId || previous.accountId !== command.accountId) {
      return { kind: 'IDEMPOTENCY_CONFLICT' };
    }
    return { kind: 'OK', replayed: true, value: previous.responseSnapshot as unknown as WelfareCardFullPaymentRecord };
  }

  async payFull(command: WelfareCardFullPaymentCommand): Promise<WelfareCardFullPaymentResult> {
    const replay = await this.replay(command);
    if (replay) return replay;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx): Promise<WelfareCardFullPaymentResult> => {
          const previous = await tx.welfareCardPaymentCommand.findUnique({
            where: {
              companyId_consumerUserId_idempotencyKey: {
                companyId: command.companyId,
                consumerUserId: command.consumerUserId,
                idempotencyKey: command.idempotencyKey,
              },
            },
          });
          if (previous) {
            if (previous.requestHash !== command.requestHash || previous.orderId !== command.orderId || previous.accountId !== command.accountId) {
              return { kind: 'IDEMPOTENCY_CONFLICT' };
            }
            return { kind: 'OK', replayed: true, value: previous.responseSnapshot as unknown as WelfareCardFullPaymentRecord };
          }

          const order = await tx.buyerOrder.findUnique({
            where: { id: command.orderId },
            include: {
              items: { orderBy: { lineNo: 'asc' } },
              supplierFulfillments: { orderBy: { supplierId: 'asc' } },
              paymentTransactions: { select: { id: true } },
              paymentAllocations: { select: { id: true } },
            },
          });
          if (!order) return { kind: 'NOT_FOUND' };
          if (order.companyId !== command.companyId || order.consumerUserId !== command.consumerUserId || order.orderType !== 'CONSUMER') {
            return { kind: 'ACCESS_DENIED' };
          }
          if (
            order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT'
            || order.welfareCardAmount !== 0 || order.cashAmount !== order.totalAmount
            || order.externalPaymentMethod !== null || order.paymentTransactions.length > 0
            || order.paymentAllocations.length > 0 || order.totalAmount <= 0
            || order.deliveryFee !== 0 || order.discountAmount !== 0
            || order.items.length < 1
            || order.items.reduce((sum, item) => sum + item.lineAmount, 0) !== order.totalAmount
          ) {
            return { kind: 'STATE_CONFLICT' };
          }
          const itemSupplierIds = new Set(order.items.map((item) => item.supplierId));
          const fulfillmentSupplierIds = new Set(order.supplierFulfillments.map((item) => item.supplierId));
          if (
            order.supplierFulfillments.length !== itemSupplierIds.size
            || fulfillmentSupplierIds.size !== itemSupplierIds.size
            || [...itemSupplierIds].some((supplierId) => !fulfillmentSupplierIds.has(supplierId))
            || order.supplierFulfillments.some((item) => item.activationStatus !== 'PENDING_PAYMENT')
          ) {
            return { kind: 'STATE_CONFLICT' };
          }

          const account = await tx.welfareCardAccount.findUnique({
            where: { id: command.accountId },
            include: { program: true, batch: true, cardCode: true },
          });
          if (!account || account.consumerUserId !== command.consumerUserId) return { kind: 'ACCESS_DENIED' };
          if (
            account.status !== 'ACTIVE' || account.program.companyId !== command.companyId
            || account.program.status !== 'ACTIVE' || account.program.complianceStatus !== 'APPROVED'
            || account.batch.companyId !== command.companyId || account.batch.status !== 'ISSUED'
            || account.cardCode.status !== 'CLAIMED' || account.cardCode.claimedByConsumerUserId !== command.consumerUserId
          ) {
            return { kind: 'ACCOUNT_NOT_ELIGIBLE' };
          }
          const rules = parseWelfareScopeRules(
            account.program.scopeType as 'ALL_PRODUCTS' | 'CATEGORY' | 'PRODUCT' | 'SKU' | 'COMPOSITE',
            account.program.scopeRules,
          );
          if (!rules || order.items.some((item) => {
            const categoryId = categoryIdOf(item.productSnapshot);
            return !categoryId || !evaluateWelfareScope(
              account.program.scopeType as 'ALL_PRODUCTS' | 'CATEGORY' | 'PRODUCT' | 'SKU' | 'COMPOSITE',
              rules,
              { categoryId, productId: item.productId, skuId: item.skuId },
            ).eligible;
          })) {
            return { kind: 'ACCOUNT_NOT_ELIGIBLE' };
          }
          if (
            !Number.isSafeInteger(account.balanceAmount) || !Number.isSafeInteger(account.frozenAmount)
            || account.balanceAmount - account.frozenAmount < order.totalAmount
          ) {
            return { kind: 'INSUFFICIENT_BALANCE' };
          }

          for (const item of order.items) {
            const confirmed = await tx.inventoryChangeLog.findFirst({
              where: { skuId: item.skuId, referenceType: 'ORDER_CONFIRM', referenceId: order.id },
              select: { id: true },
            });
            const reserved = await tx.inventoryChangeLog.findFirst({
              where: { skuId: item.skuId, referenceType: 'ORDER_RESERVATION', referenceId: order.id },
              select: { id: true },
            });
            if (confirmed || !reserved) throw new WelfarePaymentMutationFailure('STATE_CONFLICT');
          }

          const frozen = await tx.welfareCardAccount.updateMany({
            where: {
              id: account.id,
              version: account.version,
              status: 'ACTIVE',
              balanceAmount: account.balanceAmount,
              frozenAmount: account.frozenAmount,
            },
            data: { frozenAmount: { increment: order.totalAmount }, version: { increment: 1 } },
          });
          if (frozen.count !== 1) throw new WelfarePaymentMutationFailure('CONCURRENT_CONFLICT');
          await tx.welfareCardLedger.create({
            data: {
              id: randomUUID(), accountId: account.id, orderId: order.id, refundId: null,
              businessType: 'FREEZE', direction: 'DEBIT', amount: order.totalAmount,
              beforeBalance: account.balanceAmount, afterBalance: account.balanceAmount,
              beforeFrozen: account.frozenAmount, afterFrozen: account.frozenAmount + order.totalAmount,
              idempotencyKey: `ORDER:${order.id}:FREEZE`,
            },
          });
          const captured = await tx.welfareCardAccount.updateMany({
            where: {
              id: account.id,
              version: account.version + 1,
              status: 'ACTIVE',
              balanceAmount: account.balanceAmount,
              frozenAmount: account.frozenAmount + order.totalAmount,
            },
            data: {
              balanceAmount: { decrement: order.totalAmount },
              frozenAmount: { decrement: order.totalAmount },
              version: { increment: 1 },
            },
          });
          if (captured.count !== 1) throw new WelfarePaymentMutationFailure('CONCURRENT_CONFLICT');
          await tx.welfareCardLedger.create({
            data: {
              id: randomUUID(), accountId: account.id, orderId: order.id, refundId: null,
              businessType: 'CAPTURE', direction: 'DEBIT', amount: order.totalAmount,
              beforeBalance: account.balanceAmount, afterBalance: account.balanceAmount - order.totalAmount,
              beforeFrozen: account.frozenAmount + order.totalAmount, afterFrozen: account.frozenAmount,
              idempotencyKey: `ORDER:${order.id}:CAPTURE`,
            },
          });

          await tx.orderPaymentAllocation.createMany({
            data: order.items.map((item) => ({
              id: randomUUID(), orderId: order.id, orderItemId: item.id,
              welfareCardAmount: item.lineAmount, cashAmount: 0, allocationRuleVersion: 1,
            })),
          });

          for (const item of [...order.items].sort((left, right) => left.skuId.localeCompare(right.skuId))) {
            const before = await tx.inventoryBalance.findUnique({
              where: { skuId: item.skuId },
              select: { id: true, availableQty: true, reservedQty: true, soldQty: true, damagedQty: true, version: true },
            });
            if (!before || before.reservedQty < item.quantity) throw new WelfarePaymentMutationFailure('STATE_CONFLICT');
            const changed = await tx.inventoryBalance.updateMany({
              where: { id: before.id, version: before.version, reservedQty: { gte: item.quantity } },
              data: { reservedQty: { decrement: item.quantity }, soldQty: { increment: item.quantity }, version: { increment: 1 } },
            });
            if (changed.count !== 1) throw new WelfarePaymentMutationFailure('CONCURRENT_CONFLICT');
            await tx.inventoryChangeLog.create({
              data: {
                inventoryBalanceId: before.id, supplierId: item.supplierId, skuId: item.skuId,
                type: 'CONFIRM_SALE', availableDelta: 0, reservedDelta: -item.quantity, soldDelta: item.quantity, damagedDelta: 0,
                beforeAvailableQty: before.availableQty, afterAvailableQty: before.availableQty,
                beforeReservedQty: before.reservedQty, afterReservedQty: before.reservedQty - item.quantity,
                beforeSoldQty: before.soldQty, afterSoldQty: before.soldQty + item.quantity,
                beforeDamagedQty: before.damagedQty, afterDamagedQty: before.damagedQty,
                resultingVersion: before.version + 1, referenceType: 'ORDER_CONFIRM', referenceId: order.id,
                reason: 'WELFARE_CARD_PAYMENT_CONFIRMED',
              },
            });
          }

          const orderVersion = order.version + 1;
          const orderChanged = await tx.buyerOrder.updateMany({
            where: { id: order.id, version: order.version, paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT' },
            data: {
              welfareCardAmount: order.totalAmount,
              welfareCardAccountId: account.id,
              cashAmount: 0,
              externalPaymentMethod: null,
              paymentStatus: 'PAID',
              orderStatus: 'PAID',
              version: { increment: 1 },
            },
          });
          if (orderChanged.count !== 1) throw new WelfarePaymentMutationFailure('CONCURRENT_CONFLICT');
          const activated = await tx.supplierFulfillmentOrder.updateMany({
            where: { buyerOrderId: order.id, activationStatus: 'PENDING_PAYMENT' },
            data: { activationStatus: 'ACTIVE' },
          });
          if (activated.count !== order.supplierFulfillments.length) {
            throw new WelfarePaymentMutationFailure('CONCURRENT_CONFLICT');
          }
          await tx.inventoryCommand.create({
            data: {
              scope: `order-confirm:${order.id}`,
              idempotencyKey: `welfare:${account.id}`,
              requestHash: createHash('sha256').update(`${order.id}:${account.id}:${order.totalAmount}`).digest('hex'),
              responseSnapshot: json({ orderId: order.id, status: 'SOLD', itemCount: order.items.length }),
            },
          });
          await tx.buyerOrderEvent.create({
            data: {
              buyerOrderId: order.id, event: 'PAYMENT_CONFIRMED', fromStatus: 'PENDING_PAYMENT', toStatus: 'PAID',
              version: orderVersion,
              snapshot: json({
                paymentChannel: 'WELFARE_CARD', amount: order.totalAmount,
                supplierFulfillmentCount: order.supplierFulfillments.length, itemCount: order.items.length,
              }),
              actorType: 'CONSUMER', actorId: command.consumerUserId, requestId: command.requestId,
            },
          });
          await tx.paymentOutbox.create({
            data: {
              buyerOrderId: order.id, eventType: 'BUYER_ORDER_PAID_V1', eventVersion: orderVersion,
              payload: json({
                buyerOrderId: order.id, orderType: 'CONSUMER', orderVersion,
                supplierFulfillments: order.supplierFulfillments.map((item) => ({
                  fulfillmentOrderId: item.id, supplierId: item.supplierId,
                })),
              }),
              status: 'PENDING',
            },
          });
          const paidAt = new Date().toISOString();
          const value: WelfareCardFullPaymentRecord = {
            orderId: order.id,
            orderNo: order.orderNo,
            paymentStatus: 'PAID',
            orderStatus: 'PAID',
            paymentMode: 'WELFARE_CARD',
            welfareCardAmount: order.totalAmount,
            cashAmount: 0,
            paidAt,
            itemCount: order.items.length,
            supplierFulfillmentCount: order.supplierFulfillments.length,
          };
          await tx.welfareCardPaymentCommand.create({
            data: {
              id: randomUUID(), companyId: command.companyId, consumerUserId: command.consumerUserId,
              orderId: order.id, accountId: account.id, idempotencyKey: command.idempotencyKey,
              requestHash: command.requestHash, requestId: command.requestId, responseSnapshot: json(value),
            },
          });
          return { kind: 'OK', replayed: false, value };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof WelfarePaymentMutationFailure) return { kind: error.kind };
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034' && attempt < 2) continue;
          if (error.code === 'P2002' || error.code === 'P2034') {
            const after = await this.replay(command);
            if (after) return after;
            const paid = await this.prisma.welfareCardPaymentCommand.findUnique({ where: { orderId: command.orderId } });
            return paid ? { kind: 'STATE_CONFLICT' } : { kind: 'CONCURRENT_CONFLICT' };
          }
        }
        throw error;
      }
    }
    return { kind: 'CONCURRENT_CONFLICT' };
  }
}
