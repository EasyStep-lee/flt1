import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import { evaluateWelfareScope, parseWelfareScopeRules } from '../welfare-card-programs/welfare-card-scope.policy.js';
import type {
  BeginWelfareCardWechatPrepayCommand,
  BeginWelfareCardWechatPrepayResult,
  BeginWechatPrepayCommand,
  BeginWechatPrepayResult,
  CompleteWechatPrepayCommand,
  CompleteWechatPrepayResult,
  ConfirmWechatPaymentCommand,
  ConfirmWechatPaymentResult,
  PaymentRecord,
  PaymentRepository,
  WelfareCardWechatPaymentRecord,
} from './payment.repository.js';
import type { WechatPrepayResponse } from './wechat-payment.adapter.js';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const COLLECTOR_NAME = '江苏福礼团供应链科技有限公司' as const;

const categoryIdOf = (snapshot: Prisma.JsonValue): string | null => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>).categoryId;
  return typeof value === 'string' ? value : null;
};

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

const mixedPaymentRecord = (
  payment: Parameters<typeof paymentRecord>[0],
  merchant: CompanyWechatMerchant,
  amounts: { readonly welfareCardAmount: number; readonly cashAmount: number; readonly totalAmount: number },
  response?: WechatPrepayResponse,
): WelfareCardWechatPaymentRecord => ({
  ...paymentRecord(payment, merchant, response),
  ...amounts,
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

  async beginWelfareCardWechatPrepay(
    command: BeginWelfareCardWechatPrepayCommand,
  ): Promise<BeginWelfareCardWechatPrepayResult> {
    try {
      return await this.prisma.$transaction(async (tx): Promise<BeginWelfareCardWechatPrepayResult> => {
        const order = await tx.buyerOrder.findUnique({
          where: { id: command.orderId },
          include: {
            items: { orderBy: { lineNo: 'asc' } },
            supplierFulfillments: { orderBy: { supplierId: 'asc' } },
            paymentAllocations: { select: { id: true } },
            company: { select: { legalName: true, wechatPayConfigRef: true } },
          },
        });
        if (!order) return { kind: 'NOT_FOUND' };
        if (
          order.companyId !== command.actor.companyId || order.orderType !== 'CONSUMER'
          || order.consumerUserId !== command.actor.consumerUserId
        ) return { kind: 'ACCESS_DENIED' };
        if (
          order.orderStatus !== 'PENDING_PAYMENT' || order.paymentStatus !== 'PENDING'
          || order.totalAmount <= 1 || order.company.legalName !== COLLECTOR_NAME
          || !order.company.wechatPayConfigRef?.trim()
        ) return { kind: 'STATE_CONFLICT' };

        const existing = await tx.paymentTransaction.findUnique({
          where: { orderId: order.id },
          include: {
            attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
            order: { select: { company: { select: { legalName: true, wechatPayConfigRef: true } } } },
          },
        });
        if (existing) {
          if (existing.idempotencyKey !== command.idempotencyKey || existing.requestHash !== command.requestHash) {
            return { kind: 'IDEMPOTENCY_CONFLICT' };
          }
          if (
            order.welfareCardAccountId !== command.accountId || order.welfareCardAmount <= 0
            || order.cashAmount <= 0 || order.welfareCardAmount + order.cashAmount !== order.totalAmount
            || existing.amount !== order.cashAmount
          ) return { kind: 'STATE_CONFLICT' };
          const amounts = {
            welfareCardAmount: order.welfareCardAmount,
            cashAmount: order.cashAmount,
            totalAmount: order.totalAmount,
          };
          const snapshot = existing.attempts[0]?.responseSnapshot;
          if (existing.status === 'PREPAY_CREATED' && isPrepayResponse(snapshot)) {
            return {
              kind: 'REPLAY',
              payment: { ...mixedPaymentRecord(existing, existing.order.company, amounts, snapshot), response: snapshot },
            };
          }
          return existing.status === 'CREATED'
            ? { kind: 'NEEDS_PREPAY', payment: mixedPaymentRecord(existing, existing.order.company, amounts) }
            : { kind: 'STATE_CONFLICT' };
        }

        if (
          order.welfareCardAmount !== 0 || order.welfareCardAccountId !== null
          || order.cashAmount !== order.totalAmount || order.externalPaymentMethod !== null
          || order.paymentAllocations.length > 0 || order.deliveryFee !== 0 || order.discountAmount !== 0
          || order.items.length < 1
          || order.items.reduce((sum, item) => sum + item.lineAmount, 0) !== order.totalAmount
        ) return { kind: 'STATE_CONFLICT' };
        const supplierIds = new Set(order.items.map((item) => item.supplierId));
        if (
          order.supplierFulfillments.length !== supplierIds.size
          || new Set(order.supplierFulfillments.map((item) => item.supplierId)).size !== supplierIds.size
          || order.supplierFulfillments.some((item) => !supplierIds.has(item.supplierId) || item.activationStatus !== 'PENDING_PAYMENT')
        ) return { kind: 'STATE_CONFLICT' };

        const account = await tx.welfareCardAccount.findUnique({
          where: { id: command.accountId },
          include: { program: true, batch: true, cardCode: true },
        });
        if (!account || account.consumerUserId !== command.actor.consumerUserId) return { kind: 'ACCESS_DENIED' };
        if (
          account.status !== 'ACTIVE' || account.program.companyId !== command.actor.companyId
          || account.program.status !== 'ACTIVE' || account.program.complianceStatus !== 'APPROVED'
          || account.batch.companyId !== command.actor.companyId || account.batch.status !== 'ISSUED'
          || account.cardCode.status !== 'CLAIMED' || account.cardCode.claimedByConsumerUserId !== command.actor.consumerUserId
        ) return { kind: 'ACCOUNT_NOT_ELIGIBLE' };
        const scopeType = account.program.scopeType as 'ALL_PRODUCTS' | 'CATEGORY' | 'PRODUCT' | 'SKU' | 'COMPOSITE';
        const rules = parseWelfareScopeRules(scopeType, account.program.scopeRules);
        if (!rules) return { kind: 'ACCOUNT_NOT_ELIGIBLE' };
        const eligibleItems = order.items.map((item) => {
          const categoryId = categoryIdOf(item.productSnapshot);
          return {
            item,
            eligible: Boolean(categoryId && evaluateWelfareScope(scopeType, rules, {
              categoryId, productId: item.productId, skuId: item.skuId,
            }).eligible),
          };
        });
        const eligibleAmount = eligibleItems.reduce((sum, entry) => sum + (entry.eligible ? entry.item.lineAmount : 0), 0);
        const availableAmount = account.balanceAmount - account.frozenAmount;
        if (!Number.isSafeInteger(availableAmount) || availableAmount <= 0 || eligibleAmount <= 0) {
          return { kind: 'ACCOUNT_NOT_ELIGIBLE' };
        }
        const welfareCardAmount = Math.min(availableAmount, eligibleAmount, order.totalAmount);
        const cashAmount = order.totalAmount - welfareCardAmount;
        if (welfareCardAmount <= 0 || cashAmount <= 0) return { kind: 'NOT_APPLICABLE' };

        for (const { item } of eligibleItems) {
          const confirmed = await tx.inventoryChangeLog.findFirst({
            where: { skuId: item.skuId, referenceType: 'ORDER_CONFIRM', referenceId: order.id }, select: { id: true },
          });
          const reserved = await tx.inventoryChangeLog.findFirst({
            where: { skuId: item.skuId, referenceType: 'ORDER_RESERVATION', referenceId: order.id }, select: { id: true },
          });
          if (confirmed || !reserved) throw new PaymentMutationFailure('STATE_CONFLICT');
        }

        const frozen = await tx.welfareCardAccount.updateMany({
          where: {
            id: account.id, version: account.version, status: 'ACTIVE',
            balanceAmount: account.balanceAmount, frozenAmount: account.frozenAmount,
          },
          data: { frozenAmount: { increment: welfareCardAmount }, version: { increment: 1 } },
        });
        if (frozen.count !== 1) throw new PaymentMutationFailure('CONCURRENT_CONFLICT');
        await tx.welfareCardLedger.create({
          data: {
            id: randomUUID(), accountId: account.id, orderId: order.id, refundId: null,
            businessType: 'FREEZE', direction: 'DEBIT', amount: welfareCardAmount,
            beforeBalance: account.balanceAmount, afterBalance: account.balanceAmount,
            beforeFrozen: account.frozenAmount, afterFrozen: account.frozenAmount + welfareCardAmount,
            idempotencyKey: `ORDER:${order.id}:FREEZE`,
          },
        });

        let remainingWelfare = welfareCardAmount;
        const allocations = eligibleItems.map(({ item, eligible }) => {
          const lineWelfare = eligible ? Math.min(remainingWelfare, item.lineAmount) : 0;
          remainingWelfare -= lineWelfare;
          return {
            id: randomUUID(), orderId: order.id, orderItemId: item.id,
            welfareCardAmount: lineWelfare, cashAmount: item.lineAmount - lineWelfare, allocationRuleVersion: 1,
          };
        });
        if (
          remainingWelfare !== 0
          || allocations.reduce((sum, item) => sum + item.welfareCardAmount, 0) !== welfareCardAmount
          || allocations.reduce((sum, item) => sum + item.cashAmount, 0) !== cashAmount
        ) throw new PaymentMutationFailure('STATE_CONFLICT');
        await tx.orderPaymentAllocation.createMany({ data: allocations });

        const orderChanged = await tx.buyerOrder.updateMany({
          where: { id: order.id, version: order.version, paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT' },
          data: {
            welfareCardAmount, welfareCardAccountId: account.id, cashAmount,
            externalPaymentMethod: 'WECHAT_PAY', version: { increment: 1 },
          },
        });
        if (orderChanged.count !== 1) throw new PaymentMutationFailure('CONCURRENT_CONFLICT');
        const paymentId = randomUUID();
        const payment = await tx.paymentTransaction.create({
          data: {
            id: paymentId, orderId: order.id, channel: 'WECHAT_PAY', amount: cashAmount,
            outTradeNo: newOutTradeNo(), status: 'CREATED',
            idempotencyKey: command.idempotencyKey, requestHash: command.requestHash,
          },
        });
        await tx.paymentAttempt.create({
          data: {
            paymentTransactionId: paymentId, idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash, status: 'CREATED',
          },
        });
        return {
          kind: 'NEEDS_PREPAY',
          payment: mixedPaymentRecord(payment, order.company, { welfareCardAmount, cashAmount, totalAmount: order.totalAmount }),
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof PaymentMutationFailure) return { kind: error.kind };
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
        const existing = await this.prisma.paymentTransaction.findUnique({
          where: { orderId: command.orderId },
          include: {
            attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
            order: {
              select: {
                welfareCardAccountId: true, welfareCardAmount: true, cashAmount: true, totalAmount: true,
                company: { select: { legalName: true, wechatPayConfigRef: true } },
              },
            },
          },
        });
        if (!existing) return { kind: 'CONCURRENT_CONFLICT' };
        if (existing.idempotencyKey !== command.idempotencyKey || existing.requestHash !== command.requestHash) {
          return { kind: 'IDEMPOTENCY_CONFLICT' };
        }
        if (existing.order.welfareCardAccountId !== command.accountId) return { kind: 'IDEMPOTENCY_CONFLICT' };
        const amounts = {
          welfareCardAmount: existing.order.welfareCardAmount,
          cashAmount: existing.order.cashAmount,
          totalAmount: existing.order.totalAmount,
        };
        const snapshot = existing.attempts[0]?.responseSnapshot;
        if (existing.status === 'PREPAY_CREATED' && isPrepayResponse(snapshot)) {
          return {
            kind: 'REPLAY',
            payment: { ...mixedPaymentRecord(existing, existing.order.company, amounts, snapshot), response: snapshot },
          };
        }
        return existing.status === 'CREATED'
          ? { kind: 'NEEDS_PREPAY', payment: mixedPaymentRecord(existing, existing.order.company, amounts) }
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
        const pureWechat = payment.order.welfareCardAmount === 0
          && payment.order.welfareCardAccountId === null
          && payment.order.cashAmount === payment.order.totalAmount;
        const mixedWechat = payment.order.orderType === 'CONSUMER'
          && payment.order.welfareCardAmount > 0
          && payment.order.welfareCardAccountId !== null
          && payment.order.cashAmount > 0
          && payment.order.welfareCardAmount + payment.order.cashAmount === payment.order.totalAmount;
        if (
          (payment.status !== 'PREPAY_CREATED' && payment.status !== 'UNKNOWN') ||
          payment.order.paymentStatus !== 'PENDING' ||
          payment.order.orderStatus !== 'PENDING_PAYMENT' ||
          (!pureWechat && !mixedWechat) ||
          (payment.order.orderType === 'ENTERPRISE' &&
            (payment.order.enterpriseProcurementOrder?.paymentMethod !== 'WECHAT_PAY' ||
              payment.order.enterpriseProcurementOrder.status !== 'PENDING_PAYMENT'))
        ) {
          return { kind: 'STATE_CONFLICT' as const };
        }

        if (mixedWechat) {
          const account = await tx.welfareCardAccount.findUnique({
            where: { id: payment.order.welfareCardAccountId! },
            select: { id: true, status: true, balanceAmount: true, frozenAmount: true, version: true },
          });
          if (
            !account || account.status !== 'ACTIVE'
            || account.balanceAmount < payment.order.welfareCardAmount
            || account.frozenAmount < payment.order.welfareCardAmount
          ) throw new PaymentMutationFailure('STATE_CONFLICT');
          const captured = await tx.welfareCardAccount.updateMany({
            where: {
              id: account.id, version: account.version, status: 'ACTIVE',
              balanceAmount: account.balanceAmount, frozenAmount: account.frozenAmount,
            },
            data: {
              balanceAmount: { decrement: payment.order.welfareCardAmount },
              frozenAmount: { decrement: payment.order.welfareCardAmount },
              version: { increment: 1 },
            },
          });
          if (captured.count !== 1) throw new PaymentMutationFailure('CONCURRENT_CONFLICT');
          await tx.welfareCardLedger.create({
            data: {
              id: randomUUID(), accountId: account.id, orderId: payment.orderId, refundId: null,
              businessType: 'CAPTURE', direction: 'DEBIT', amount: payment.order.welfareCardAmount,
              beforeBalance: account.balanceAmount, afterBalance: account.balanceAmount - payment.order.welfareCardAmount,
              beforeFrozen: account.frozenAmount, afterFrozen: account.frozenAmount - payment.order.welfareCardAmount,
              idempotencyKey: `ORDER:${payment.orderId}:CAPTURE`,
            },
          });
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
              reason: mixedWechat ? 'WELFARE_WECHAT_PAYMENT_CONFIRMED' : 'WECHAT_PAYMENT_CONFIRMED',
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
              paymentMode: mixedWechat ? 'WELFARE_CARD_WECHAT' : 'WECHAT_PAY',
              paymentTransactionId: payment.id,
              welfareCardAmount: payment.order.welfareCardAmount,
              cashAmount: payment.amount,
              amount: payment.order.totalAmount,
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
