import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  BeginWechatPrepayCommand,
  BeginWechatPrepayResult,
  CompleteWechatPrepayCommand,
  CompleteWechatPrepayResult,
  ConfirmWechatPaymentCommand,
  ConfirmWechatPaymentResult,
  PaymentRecord,
  PaymentRepository,
} from './payment.repository.js';
import type { WechatPrepayResponse } from './wechat-payment.adapter.js';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const COLLECTOR_NAME = '江苏福礼团供应链科技有限公司' as const;

interface CompanyWechatMerchant {
  readonly legalName: string;
  readonly wechatPayConfigRef: string | null;
}

const isPrepayResponse = (value: unknown): value is WechatPrepayResponse => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.prepayId !== 'string' || !record.clientPayment || typeof record.clientPayment !== 'object') return false;
  const client = record.clientPayment as Record<string, unknown>;
  return (
    typeof client.timeStamp === 'string' &&
    typeof client.nonceStr === 'string' &&
    typeof client.package === 'string' &&
    client.signType === 'RSA' &&
    typeof client.paySign === 'string'
  );
};

const paymentRecord = (
  payment: {
    readonly id: string;
    readonly orderId: string;
    readonly amount: number;
    readonly outTradeNo: string;
    readonly status: string;
  },
  merchant: CompanyWechatMerchant,
  response?: WechatPrepayResponse,
): PaymentRecord => ({
  paymentTransactionId: payment.id,
  orderId: payment.orderId,
  amount: payment.amount,
  outTradeNo: payment.outTradeNo,
  merchantConfigRef: merchant.wechatPayConfigRef ?? '',
  collectorName: COLLECTOR_NAME,
  status: payment.status === 'PAID' ? 'PAID' : payment.status === 'PREPAY_CREATED' ? 'PREPAY_CREATED' : 'CREATED',
  ...(response ? { response } : {}),
});

const ownsOrder = (
  order: {
    readonly companyId: string;
    readonly orderType: string;
    readonly consumerUserId: string | null;
    readonly enterpriseCustomerId: string | null;
  },
  command: BeginWechatPrepayCommand,
): boolean =>
  order.companyId === command.actor.companyId &&
  ((command.actor.kind === 'CONSUMER' &&
    order.orderType === 'CONSUMER' &&
    order.consumerUserId === command.actor.consumerUserId) ||
    (command.actor.kind === 'ENTERPRISE' &&
      order.orderType === 'ENTERPRISE' &&
      order.enterpriseCustomerId === command.actor.enterpriseCustomerId));

const newOutTradeNo = (): string =>
  `WP${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 15).toUpperCase()}`;

class PaymentMutationFailure extends Error {
  constructor(
    readonly kind: 'STATE_CONFLICT' | 'CONCURRENT_CONFLICT',
  ) {
    super(kind);
  }
}

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async beginWechatPrepay(command: BeginWechatPrepayCommand): Promise<BeginWechatPrepayResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.buyerOrder.findUnique({
          where: { id: command.orderId },
          include: {
            items: { orderBy: { lineNo: 'asc' } },
            company: { select: { legalName: true, wechatPayConfigRef: true } },
            enterpriseProcurementOrder: true,
          },
        });
        if (!order) return { kind: 'NOT_FOUND' as const };
        if (!ownsOrder(order, command)) return { kind: 'ACCESS_DENIED' as const };
        if (
          order.orderStatus !== 'PENDING_PAYMENT' ||
          order.paymentStatus !== 'PENDING' ||
          order.welfareCardAmount !== 0 ||
          order.welfareCardAccountId !== null ||
          order.cashAmount !== order.totalAmount ||
          order.cashAmount <= 0 ||
          order.company.legalName !== COLLECTOR_NAME ||
          !order.company.wechatPayConfigRef?.trim()
        ) {
          return { kind: 'STATE_CONFLICT' as const };
        }
        if (
          order.orderType === 'ENTERPRISE' &&
          (order.enterpriseProcurementOrder?.paymentMethod !== 'WECHAT_PAY' ||
            order.enterpriseProcurementOrder.status !== 'PENDING_PAYMENT')
        ) {
          return { kind: 'STATE_CONFLICT' as const };
        }

        const existing = await tx.paymentTransaction.findUnique({
          where: { orderId: order.id },
          include: {
            attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
            order: { select: { company: { select: { legalName: true, wechatPayConfigRef: true } } } },
          },
        });
        if (existing) {
          if (existing.idempotencyKey !== command.idempotencyKey || existing.requestHash !== command.requestHash) {
            return { kind: 'IDEMPOTENCY_CONFLICT' as const };
          }
          const snapshot = existing.attempts[0]?.responseSnapshot;
          if (existing.status === 'PREPAY_CREATED' && isPrepayResponse(snapshot)) {
            return { kind: 'REPLAY' as const, payment: { ...paymentRecord(existing, existing.order.company, snapshot), response: snapshot } };
          }
          if (existing.status === 'CREATED') {
            return { kind: 'NEEDS_PREPAY' as const, payment: paymentRecord(existing, existing.order.company) };
          }
          return { kind: 'STATE_CONFLICT' as const };
        }

        if (order.items.length === 0 || order.items.reduce((sum, item) => sum + item.lineAmount, 0) !== order.cashAmount) {
          return { kind: 'STATE_CONFLICT' as const };
        }
        const paymentId = randomUUID();
        const payment = await tx.paymentTransaction.create({
          data: {
            id: paymentId,
            orderId: order.id,
            channel: 'WECHAT_PAY',
            amount: order.cashAmount,
            outTradeNo: newOutTradeNo(),
            status: 'CREATED',
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
          },
        });
        await tx.paymentAttempt.create({
          data: {
            paymentTransactionId: paymentId,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            status: 'CREATED',
          },
        });
        await tx.orderPaymentAllocation.createMany({
          data: order.items.map((item) => ({
            orderId: order.id,
            orderItemId: item.id,
            welfareCardAmount: 0,
            cashAmount: item.lineAmount,
            allocationRuleVersion: 1,
          })),
        });
        await tx.buyerOrder.update({
          where: { id: order.id },
          data: { externalPaymentMethod: 'WECHAT_PAY' },
        });
        return { kind: 'NEEDS_PREPAY' as const, payment: paymentRecord(payment, order.company) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
        const existing = await this.prisma.paymentTransaction.findUnique({
          where: { orderId: command.orderId },
          include: {
            attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
            order: { select: { company: { select: { legalName: true, wechatPayConfigRef: true } } } },
          },
        });
        if (!existing) return { kind: 'CONCURRENT_CONFLICT' };
        if (existing.idempotencyKey !== command.idempotencyKey || existing.requestHash !== command.requestHash) {
          return { kind: 'IDEMPOTENCY_CONFLICT' };
        }
        const snapshot = existing.attempts[0]?.responseSnapshot;
        if (existing.status === 'PREPAY_CREATED' && isPrepayResponse(snapshot)) {
          return { kind: 'REPLAY', payment: { ...paymentRecord(existing, existing.order.company, snapshot), response: snapshot } };
        }
        return existing.status === 'CREATED'
          ? { kind: 'NEEDS_PREPAY', payment: paymentRecord(existing, existing.order.company) }
          : { kind: 'CONCURRENT_CONFLICT' };
      }
      throw error;
    }
  }

  async completeWechatPrepay(command: CompleteWechatPrepayCommand): Promise<CompleteWechatPrepayResult> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.findUnique({
        where: { id: command.paymentTransactionId },
        include: {
          attempts: { where: { idempotencyKey: command.idempotencyKey }, take: 1 },
          order: { select: { company: { select: { legalName: true, wechatPayConfigRef: true } } } },
        },
      });
      if (!payment) return { kind: 'STATE_CONFLICT' as const };
      if (payment.idempotencyKey !== command.idempotencyKey || payment.requestHash !== command.requestHash) {
        return { kind: 'IDEMPOTENCY_CONFLICT' as const };
      }
      const attempt = payment.attempts[0];
      if (!attempt || attempt.requestHash !== command.requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' as const };
      if (payment.status === 'PREPAY_CREATED' && isPrepayResponse(attempt.responseSnapshot)) {
        return {
          kind: 'REPLAY' as const,
          payment: { ...paymentRecord(payment, payment.order.company, attempt.responseSnapshot), response: attempt.responseSnapshot },
        };
      }
      if (payment.status !== 'CREATED' || attempt.status !== 'CREATED') return { kind: 'STATE_CONFLICT' as const };
      const now = new Date();
      await tx.paymentAttempt.update({
        where: {
          paymentTransactionId_idempotencyKey: {
            paymentTransactionId: payment.id,
            idempotencyKey: command.idempotencyKey,
          },
        },
        data: { status: 'SUCCEEDED', responseSnapshot: json(command.response), completedAt: now },
      });
      const changed = await tx.paymentTransaction.updateMany({
        where: { id: payment.id, status: 'CREATED', version: payment.version },
        data: { status: 'PREPAY_CREATED', version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new PaymentMutationFailure('CONCURRENT_CONFLICT');
      return {
        kind: 'COMPLETED' as const,
        payment: {
          ...paymentRecord({ ...payment, status: 'PREPAY_CREATED' }, payment.order.company, command.response),
          response: command.response,
        },
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
      if (error instanceof PaymentMutationFailure) return { kind: 'STATE_CONFLICT' as const };
      throw error;
    });
  }

  async confirmWechatPayment(command: ConfirmWechatPaymentCommand): Promise<ConfirmWechatPaymentResult> {
    const notification = command.notification;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const duplicate = await tx.paymentNotification.findUnique({
          where: { notificationId: notification.notificationId },
        });
        if (duplicate) {
          return duplicate.rawBodyHash === notification.rawBodyHash &&
            duplicate.outTradeNo === notification.outTradeNo &&
            duplicate.wechatTransactionId === notification.wechatTransactionId &&
            duplicate.amount === notification.amount
            ? { kind: 'REPLAY' as const, orderId: '', paymentTransactionId: duplicate.paymentTransactionId }
            : { kind: 'TRANSACTION_CONFLICT' as const };
        }

        const payment = await tx.paymentTransaction.findUnique({
          where: { outTradeNo: notification.outTradeNo },
          include: {
            order: {
              include: {
                items: { orderBy: { skuId: 'asc' } },
                supplierFulfillments: { orderBy: { supplierId: 'asc' } },
                enterpriseProcurementOrder: true,
              },
            },
          },
        });
        if (!payment) return { kind: 'NOT_FOUND' as const };
        if (payment.amount !== notification.amount || payment.order.cashAmount !== notification.amount) {
          return { kind: 'AMOUNT_MISMATCH' as const };
        }
        const conflicting = await tx.paymentTransaction.findUnique({
          where: { wechatTransactionId: notification.wechatTransactionId },
          select: { id: true },
        });
        if (conflicting && conflicting.id !== payment.id) return { kind: 'TRANSACTION_CONFLICT' as const };
        if (payment.status === 'PAID') {
          if (payment.wechatTransactionId !== notification.wechatTransactionId) {
            return { kind: 'TRANSACTION_CONFLICT' as const };
          }
          await tx.paymentNotification.create({
            data: {
              paymentTransactionId: payment.id,
              notificationId: notification.notificationId,
              rawBodyHash: notification.rawBodyHash,
              outTradeNo: notification.outTradeNo,
              wechatTransactionId: notification.wechatTransactionId,
              amount: notification.amount,
              result: 'REPLAYED',
              verifiedAt: notification.verifiedAt,
            },
          });
          return { kind: 'REPLAY' as const, orderId: payment.orderId, paymentTransactionId: payment.id };
        }
        if (
          (payment.status !== 'PREPAY_CREATED' && payment.status !== 'UNKNOWN') ||
          payment.order.paymentStatus !== 'PENDING' ||
          payment.order.orderStatus !== 'PENDING_PAYMENT' ||
          payment.order.welfareCardAmount !== 0 ||
          payment.order.cashAmount !== payment.order.totalAmount ||
          (payment.order.orderType === 'ENTERPRISE' &&
            (payment.order.enterpriseProcurementOrder?.paymentMethod !== 'WECHAT_PAY' ||
              payment.order.enterpriseProcurementOrder.status !== 'PENDING_PAYMENT'))
        ) {
          return { kind: 'STATE_CONFLICT' as const };
        }

        for (const item of payment.order.items) {
          const confirmed = await tx.inventoryChangeLog.findFirst({
            where: { skuId: item.skuId, referenceType: 'ORDER_CONFIRM', referenceId: payment.orderId },
            select: { id: true },
          });
          const reserved = await tx.inventoryChangeLog.findFirst({
            where: { skuId: item.skuId, referenceType: 'ORDER_RESERVATION', referenceId: payment.orderId },
            select: { id: true },
          });
          if (confirmed || !reserved) throw new PaymentMutationFailure('STATE_CONFLICT');
          const before = await tx.inventoryBalance.findUnique({
            where: { skuId: item.skuId },
            select: {
              id: true,
              availableQty: true,
              reservedQty: true,
              soldQty: true,
              damagedQty: true,
              version: true,
            },
          });
          if (!before || before.reservedQty < item.quantity) throw new PaymentMutationFailure('STATE_CONFLICT');
          const changed = await tx.inventoryBalance.updateMany({
            where: { id: before.id, version: before.version, reservedQty: { gte: item.quantity } },
            data: { reservedQty: { decrement: item.quantity }, soldQty: { increment: item.quantity }, version: { increment: 1 } },
          });
          if (changed.count !== 1) throw new PaymentMutationFailure('CONCURRENT_CONFLICT');
          await tx.inventoryChangeLog.create({
            data: {
              inventoryBalanceId: before.id,
              supplierId: item.supplierId,
              skuId: item.skuId,
              type: 'CONFIRM_SALE',
              availableDelta: 0,
              reservedDelta: -item.quantity,
              soldDelta: item.quantity,
              damagedDelta: 0,
              beforeAvailableQty: before.availableQty,
              afterAvailableQty: before.availableQty,
              beforeReservedQty: before.reservedQty,
              afterReservedQty: before.reservedQty - item.quantity,
              beforeSoldQty: before.soldQty,
              afterSoldQty: before.soldQty + item.quantity,
              beforeDamagedQty: before.damagedQty,
              afterDamagedQty: before.damagedQty,
              resultingVersion: before.version + 1,
              referenceType: 'ORDER_CONFIRM',
              referenceId: payment.orderId,
              reason: 'WECHAT_PAYMENT_CONFIRMED',
            },
          });
        }

        const orderVersion = payment.order.version + 1;
        const orderChanged = await tx.buyerOrder.updateMany({
          where: {
            id: payment.orderId,
            version: payment.order.version,
            paymentStatus: 'PENDING',
            orderStatus: 'PENDING_PAYMENT',
          },
          data: {
            externalPaymentMethod: 'WECHAT_PAY',
            paymentStatus: 'PAID',
            orderStatus: 'PAID',
            version: { increment: 1 },
          },
        });
        if (orderChanged.count !== 1) throw new PaymentMutationFailure('CONCURRENT_CONFLICT');
        if (payment.order.enterpriseProcurementOrder) {
          const procurementChanged = await tx.enterpriseProcurementOrder.updateMany({
            where: {
              buyerOrderId: payment.orderId,
              version: payment.order.enterpriseProcurementOrder.version,
              paymentMethod: 'WECHAT_PAY',
              status: 'PENDING_PAYMENT',
            },
            data: { status: 'PAID', version: { increment: 1 } },
          });
          if (procurementChanged.count !== 1) throw new PaymentMutationFailure('CONCURRENT_CONFLICT');
        }
        await tx.supplierFulfillmentOrder.updateMany({
          where: { buyerOrderId: payment.orderId, activationStatus: 'PENDING_PAYMENT' },
          data: { activationStatus: 'ACTIVE' },
        });
        const paymentChanged = await tx.paymentTransaction.updateMany({
          where: { id: payment.id, version: payment.version, status: payment.status },
          data: {
            status: 'PAID',
            wechatTransactionId: notification.wechatTransactionId,
            notifyVerifiedAt: notification.verifiedAt,
            paidAt: notification.verifiedAt,
            version: { increment: 1 },
          },
        });
        if (paymentChanged.count !== 1) throw new PaymentMutationFailure('CONCURRENT_CONFLICT');
        await tx.inventoryCommand.create({
          data: {
            scope: `order-confirm:${payment.orderId}`,
            idempotencyKey: payment.id,
            requestHash: createHash('sha256').update(`${payment.id}:${notification.wechatTransactionId}`).digest('hex'),
            responseSnapshot: json({ orderId: payment.orderId, status: 'SOLD', itemCount: payment.order.items.length }),
          },
        });
        await tx.buyerOrderEvent.create({
          data: {
            buyerOrderId: payment.orderId,
            event: 'PAYMENT_CONFIRMED',
            fromStatus: 'PENDING_PAYMENT',
            toStatus: 'PAID',
            version: orderVersion,
            snapshot: json({
              paymentChannel: 'WECHAT_PAY',
              paymentTransactionId: payment.id,
              amount: payment.amount,
              supplierFulfillmentCount: payment.order.supplierFulfillments.length,
              itemCount: payment.order.items.length,
            }),
            actorType: payment.order.orderType,
            actorId: payment.order.consumerUserId ?? payment.order.enterpriseCustomerId ?? payment.order.companyId,
            requestId: command.requestId,
          },
        });
        await tx.paymentOutbox.create({
          data: {
            buyerOrderId: payment.orderId,
            eventType: 'BUYER_ORDER_PAID_V1',
            eventVersion: orderVersion,
            payload: json({
              buyerOrderId: payment.orderId,
              orderType: payment.order.orderType,
              orderVersion,
              supplierFulfillments: payment.order.supplierFulfillments.map((item) => ({
                fulfillmentOrderId: item.id,
                supplierId: item.supplierId,
              })),
            }),
            status: 'PENDING',
          },
        });
        await tx.paymentNotification.create({
          data: {
            paymentTransactionId: payment.id,
            notificationId: notification.notificationId,
            rawBodyHash: notification.rawBodyHash,
            outTradeNo: notification.outTradeNo,
            wechatTransactionId: notification.wechatTransactionId,
            amount: notification.amount,
            result: 'PAID',
            verifiedAt: notification.verifiedAt,
          },
        });
        return { kind: 'PAID' as const, orderId: payment.orderId, paymentTransactionId: payment.id };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof PaymentMutationFailure) return { kind: error.kind };
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
        const duplicate = await this.prisma.paymentNotification.findUnique({
          where: { notificationId: notification.notificationId },
        });
        if (duplicate && duplicate.rawBodyHash === notification.rawBodyHash) {
          return { kind: 'REPLAY', orderId: '', paymentTransactionId: duplicate.paymentTransactionId };
        }
        const payment = await this.prisma.paymentTransaction.findUnique({
          where: { outTradeNo: notification.outTradeNo },
        });
        if (payment?.status === 'PAID' && payment.wechatTransactionId === notification.wechatTransactionId) {
          return { kind: 'REPLAY', orderId: payment.orderId, paymentTransactionId: payment.id };
        }
        return { kind: error.code === 'P2034' ? 'CONCURRENT_CONFLICT' : 'TRANSACTION_CONFLICT' };
      }
      throw error;
    }
  }
}
