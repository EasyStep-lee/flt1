import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import { allocateOriginalPaymentRefund } from './refund-allocation.policy.js';
import type {
  BeginRefundCommand,
  BeginRefundResult,
  RefundRecord,
  RefundRepository,
} from './refund.repository.js';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const newRefundNo = (): string =>
  `RF${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 13).toUpperCase()}`;

class RefundMutationFailure extends Error {
  constructor(readonly kind: 'CONCURRENT_CONFLICT' | 'STATE_CONFLICT') {
    super(kind);
  }
}

type RefundWithSources = Prisma.RefundTransactionGetPayload<{
  include: {
    authorization: true;
    order: { select: { welfareCardAccountId: true } };
    originalPaymentTransaction: {
      select: { id: true; outTradeNo: true; wechatTransactionId: true };
    };
  };
}>;

const toRecord = (refund: RefundWithSources): RefundRecord => ({
  refundId: refund.id,
  afterSaleId: refund.afterSaleId,
  orderId: refund.orderId,
  orderItemId: refund.orderItemId,
  refundNo: refund.refundNo,
  status: refund.status === 'CREATED' ? 'PROCESSING' : refund.status,
  authorizationVersion: refund.authorization.version,
  welfareCardRefundAmount: refund.welfareCardRefundAmount,
  cashRefundAmount: refund.cashRefundAmount,
  welfareChannelStatus: refund.welfareChannelStatus,
  wechatChannelStatus: refund.wechatChannelStatus,
  originalWelfareCardAccountId: refund.order.welfareCardAccountId,
  originalPaymentTransactionId: refund.originalPaymentTransaction?.id ?? null,
  originalWechatOutTradeNo: refund.originalPaymentTransaction?.outTradeNo ?? null,
  originalWechatTransactionId: refund.originalPaymentTransaction?.wechatTransactionId ?? null,
  idempotencyKey: refund.idempotencyKey,
  requestHash: refund.requestHash,
});

const includeSources = {
  authorization: true,
  order: { select: { welfareCardAccountId: true } },
  originalPaymentTransaction: {
    select: { id: true, outTradeNo: true, wechatTransactionId: true },
  },
} as const;

@Injectable()
export class PrismaRefundRepository implements RefundRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async begin(command: BeginRefundCommand): Promise<BeginRefundResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const authorization = await tx.refundAuthorization.findUnique({
          where: { id: command.afterSaleId },
          include: {
            order: {
              include: {
                paymentTransactions: { orderBy: { createdAt: 'desc' } },
              },
            },
            orderItem: { include: { paymentAllocation: true } },
            refundTransaction: { include: includeSources },
          },
        });
        if (!authorization || authorization.companyId !== command.actor.companyId) {
          return { kind: 'NOT_FOUND' as const };
        }
        const existing = authorization.refundTransaction;
        if (existing) {
          if (
            existing.idempotencyKey !== command.idempotencyKey ||
            existing.requestHash !== command.requestHash
          ) {
            return { kind: 'IDEMPOTENCY_CONFLICT' as const };
          }
          const refund = toRecord(existing);
          return {
            kind: ['SUCCEEDED', 'UNKNOWN', 'FAILED'].includes(existing.status)
              ? 'REPLAY' as const
              : 'CONTINUE' as const,
            refund,
          };
        }
        if (authorization.status !== 'APPROVED') return { kind: 'STATE_CONFLICT' as const };
        if (authorization.version !== command.authorizationVersion) return { kind: 'VERSION_CONFLICT' as const };
        if (
          authorization.approvedByIdentityType === command.actor.identityType &&
          authorization.approvedByIdentityId === command.actor.identityId
        ) {
          return { kind: 'SAME_NATURAL_PERSON' as const };
        }
        if (
          authorization.orderId !== authorization.orderItem.buyerOrderId ||
          authorization.order.companyId !== authorization.companyId ||
          authorization.order.paymentStatus !== 'PAID' ||
          authorization.order.orderStatus === 'CANCELLED'
        ) {
          return { kind: 'STATE_CONFLICT' as const };
        }

        const allocation = authorization.orderItem.paymentAllocation;
        if (!allocation || allocation.orderId !== authorization.orderId) {
          return { kind: 'ALLOCATION_INVALID' as const };
        }
        const originalTotal = allocation.welfareCardAmount + allocation.cashAmount;
        if (
          originalTotal <= 0 ||
          originalTotal !== authorization.orderItem.lineAmount ||
          authorization.approvedAmount <= 0
        ) {
          return { kind: 'ALLOCATION_INVALID' as const };
        }

        const previous = await tx.refundTransaction.aggregate({
          where: {
            orderItemId: authorization.orderItemId,
            status: { not: 'FAILED' },
          },
          _sum: {
            welfareCardRefundAmount: true,
            cashRefundAmount: true,
          },
        });
        const previousWelfare = previous._sum.welfareCardRefundAmount ?? 0;
        const previousCash = previous._sum.cashRefundAmount ?? 0;
        const refundAllocation = allocateOriginalPaymentRefund({
          originalWelfareAmount: allocation.welfareCardAmount,
          originalCashAmount: allocation.cashAmount,
          previousWelfareRefundAmount: previousWelfare,
          previousCashRefundAmount: previousCash,
          approvedRefundAmount: authorization.approvedAmount,
        });
        if (refundAllocation.kind === 'OVERPAID') return { kind: 'OVERPAID' as const };
        if (refundAllocation.kind === 'INVALID') return { kind: 'ALLOCATION_INVALID' as const };
        const welfareAmount = refundAllocation.welfareRefundAmount;
        const cashAmount = refundAllocation.cashRefundAmount;
        if (welfareAmount > 0 && !authorization.order.welfareCardAccountId) {
          return { kind: 'ALLOCATION_INVALID' as const };
        }
        const payment = cashAmount > 0
          ? authorization.order.paymentTransactions.find((candidate) =>
              candidate.channel === 'WECHAT_PAY' &&
              candidate.status === 'PAID' &&
              Boolean(candidate.wechatTransactionId),
            )
          : undefined;
        if (cashAmount > 0 && !payment) return { kind: 'ALLOCATION_INVALID' as const };

        const conflictingKey = await tx.refundTransaction.findUnique({
          where: {
            orderId_idempotencyKey: {
              orderId: authorization.orderId,
              idempotencyKey: command.idempotencyKey,
            },
          },
          select: { id: true },
        });
        if (conflictingKey) return { kind: 'IDEMPOTENCY_CONFLICT' as const };

        const refundId = randomUUID();
        const now = new Date();
        const changed = await tx.refundAuthorization.updateMany({
          where: {
            id: authorization.id,
            version: authorization.version,
            status: 'APPROVED',
          },
          data: { status: 'CONSUMED', consumedAt: now },
        });
        if (changed.count !== 1) throw new RefundMutationFailure('CONCURRENT_CONFLICT');
        const created = await tx.refundTransaction.create({
          data: {
            id: refundId,
            afterSaleId: authorization.id,
            orderId: authorization.orderId,
            orderItemId: authorization.orderItemId,
            refundNo: newRefundNo(),
            welfareCardRefundAmount: welfareAmount,
            cashRefundAmount: cashAmount,
            originalPaymentTransactionId: payment?.id ?? null,
            status: 'PROCESSING',
            welfareChannelStatus: welfareAmount > 0 ? 'PENDING' : 'NOT_REQUIRED',
            wechatChannelStatus: cashAmount > 0 ? 'PENDING' : 'NOT_REQUIRED',
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            version: 0,
          },
          include: includeSources,
        });
        await tx.refundTransactionEvent.create({
          data: {
            refundTransactionId: refundId,
            fromStatus: 'CREATED',
            toStatus: 'PROCESSING',
            event: 'SUBMIT',
            version: 0,
            snapshot: json({
              afterSaleId: authorization.id,
              authorizationVersion: authorization.version,
              welfareCardRefundAmount: welfareAmount,
              cashRefundAmount: cashAmount,
              allocationRuleVersion: allocation.allocationRuleVersion,
              reason: command.reason,
            }),
            actorType: command.actor.identityType,
            actorId: command.actor.identityId,
            requestId: command.requestId,
          },
        });
        await tx.refundImpactRecord.createMany({
          data: [
            {
              refundTransactionId: refundId,
              impactType: 'FINANCIAL',
              payload: json({
                welfareCardRefundAmount: welfareAmount,
                cashRefundAmount: cashAmount,
                originalStructure: true,
              }),
            },
            {
              refundTransactionId: refundId,
              impactType: 'INVENTORY',
              payload: json({
                orderItemId: authorization.orderItemId,
                quantityDelta: 0,
                disposition: 'PENDING_AFTERSALE_DECISION',
              }),
            },
            {
              refundTransactionId: refundId,
              impactType: 'RECONCILIATION',
              payload: json({
                orderItemId: authorization.orderItemId,
                supplierId: authorization.orderItem.supplierId,
                responsibilityStatus: 'PENDING',
                settlementMode: 'OFFLINE',
              }),
            },
          ],
        });
        const complete = await tx.refundTransaction.findUniqueOrThrow({
          where: { id: created.id },
          include: includeSources,
        });
        return { kind: 'CREATED' as const, refund: toRecord(complete) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof RefundMutationFailure) return { kind: error.kind };
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        const existing = await this.prisma.refundTransaction.findUnique({
          where: { afterSaleId: command.afterSaleId },
          include: includeSources,
        });
        if (
          existing &&
          existing.idempotencyKey === command.idempotencyKey &&
          existing.requestHash === command.requestHash
        ) {
          return {
            kind: ['SUCCEEDED', 'UNKNOWN', 'FAILED'].includes(existing.status) ? 'REPLAY' : 'CONTINUE',
            refund: toRecord(existing),
          };
        }
        return { kind: error.code === 'P2034' ? 'CONCURRENT_CONFLICT' : 'IDEMPOTENCY_CONFLICT' };
      }
      throw error;
    }
  }

  async recordWelfareResult(
    refundId: string,
    result: 'SUCCEEDED' | 'UNKNOWN',
    requestId = 'request-id-unavailable',
  ): Promise<RefundRecord> {
    return this.recordChannel(refundId, 'WELFARE', result, requestId);
  }

  async claimChannel(
    refundId: string,
    channel: 'WELFARE' | 'WECHAT',
  ): Promise<{ readonly kind: 'CLAIMED' | 'BUSY' | 'DONE'; readonly refund: RefundRecord }> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.refundTransaction.findUniqueOrThrow({
        where: { id: refundId },
        include: includeSources,
      });
      const channelStatus = channel === 'WELFARE'
        ? current.welfareChannelStatus
        : current.wechatChannelStatus;
      if (channelStatus === 'PROCESSING') return { kind: 'BUSY' as const, refund: toRecord(current) };
      if (channelStatus !== 'PENDING') return { kind: 'DONE' as const, refund: toRecord(current) };
      const changed = await tx.refundTransaction.updateMany({
        where: {
          id: current.id,
          version: current.version,
          ...(channel === 'WELFARE'
            ? { welfareChannelStatus: 'PENDING' as const }
            : { wechatChannelStatus: 'PENDING' as const }),
        },
        data: {
          ...(channel === 'WELFARE'
            ? { welfareChannelStatus: 'PROCESSING' as const }
            : { wechatChannelStatus: 'PROCESSING' as const }),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const latest = await tx.refundTransaction.findUniqueOrThrow({
          where: { id: current.id },
          include: includeSources,
        });
        return { kind: 'BUSY' as const, refund: toRecord(latest) };
      }
      const claimed = await tx.refundTransaction.findUniqueOrThrow({
        where: { id: current.id },
        include: includeSources,
      });
      return { kind: 'CLAIMED' as const, refund: toRecord(claimed) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async recordWechatResult(
    refundId: string,
    result: 'SUCCEEDED' | 'UNKNOWN',
    requestId = 'request-id-unavailable',
    externalRefundNo?: string,
  ): Promise<RefundRecord> {
    return this.recordChannel(refundId, 'WECHAT', result, requestId, externalRefundNo);
  }

  private async recordChannel(
    refundId: string,
    channel: 'WELFARE' | 'WECHAT',
    result: 'SUCCEEDED' | 'UNKNOWN',
    requestId: string,
    externalRefundNo?: string,
  ): Promise<RefundRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.refundTransaction.findUnique({
        where: { id: refundId },
        include: includeSources,
      });
      if (!current) throw new RefundMutationFailure('STATE_CONFLICT');
      const channelStatus = channel === 'WELFARE'
        ? current.welfareChannelStatus
        : current.wechatChannelStatus;
      if (channelStatus !== 'PROCESSING') return toRecord(current);

      const nextStatus: 'UNKNOWN' | 'PARTIAL_CHANNEL_DONE' | 'SUCCEEDED' = result === 'UNKNOWN'
        ? 'UNKNOWN'
        : channel === 'WELFARE' && current.cashRefundAmount > 0
          ? 'PARTIAL_CHANNEL_DONE'
          : 'SUCCEEDED';
      const nextVersion = current.version + 1;
      const data = channel === 'WELFARE'
        ? {
            welfareChannelStatus: result,
            status: nextStatus,
            version: { increment: 1 },
          }
        : {
            wechatChannelStatus: result,
            status: nextStatus,
            ...(externalRefundNo ? { wechatRefundNo: externalRefundNo } : {}),
            version: { increment: 1 },
          };
      const changed = await tx.refundTransaction.updateMany({
        where: { id: current.id, version: current.version, status: current.status },
        data,
      });
      if (changed.count !== 1) throw new RefundMutationFailure('CONCURRENT_CONFLICT');
      await tx.refundTransactionEvent.create({
        data: {
          refundTransactionId: current.id,
          fromStatus: current.status,
          toStatus: nextStatus,
          event: result === 'UNKNOWN'
            ? 'CHANNEL_UNKNOWN'
            : channel === 'WELFARE'
              ? 'WELFARE_REFUND_APPLIED'
              : 'WECHAT_REFUND_SUCCESS',
          version: nextVersion,
          snapshot: json({ channel, result }),
          actorType: 'SYSTEM',
          actorId: current.orderId,
          requestId,
        },
      });
      const updated = await tx.refundTransaction.findUniqueOrThrow({
        where: { id: current.id },
        include: includeSources,
      });
      return toRecord(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
