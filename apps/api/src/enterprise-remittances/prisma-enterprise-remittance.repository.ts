import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  EnterpriseRemittanceRecord,
  EnterpriseRemittanceRepository,
  ReviewEnterpriseRemittanceCommand,
  ReviewEnterpriseRemittanceResult,
  SubmitEnterpriseRemittanceCommand,
  SubmitEnterpriseRemittanceResult,
} from './enterprise-remittance.repository.js';

const SELLER_NAME = '江苏福礼团供应链科技有限公司' as const;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

class RemittanceMutationFailure extends Error {
  constructor(readonly kind: 'STATE_CONFLICT' | 'CONCURRENT_CONFLICT') {
    super(kind);
  }
}

const remittanceInclude = Prisma.validator<Prisma.EnterpriseRemittanceSubmissionInclude>()({
  buyerOrder: { include: { enterpriseProcurementOrder: true } },
  review: true,
});

type StoredRemittance = Prisma.EnterpriseRemittanceSubmissionGetPayload<{
  include: typeof remittanceInclude;
}>;

const toRecord = (submission: StoredRemittance): EnterpriseRemittanceRecord => ({
  remittanceId: submission.id,
  orderId: submission.buyerOrderId,
  orderNo: submission.buyerOrder.orderNo,
  sellerName: SELLER_NAME,
  checkoutMode: 'COMPANY_UNIFIED',
  paymentMethod: 'BANK_TRANSFER',
  totalAmount: submission.buyerOrder.totalAmount,
  paymentStatus: submission.buyerOrder.paymentStatus === 'PAID' ? 'PAID' : 'PENDING',
  orderStatus: submission.buyerOrder.orderStatus === 'PAID' ? 'PAID' : 'PENDING_PAYMENT',
  remittanceStatus: submission.status,
  version: submission.version,
  submittedAt: submission.submittedAt.toISOString(),
  reviewedAt: submission.reviewedAt?.toISOString() ?? null,
});

@Injectable()
export class PrismaEnterpriseRemittanceRepository implements EnterpriseRemittanceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async submit(command: SubmitEnterpriseRemittanceCommand): Promise<SubmitEnterpriseRemittanceResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await tx.enterpriseRemittanceSubmission.findUnique({
          where: {
            buyerOrderId_idempotencyKey: {
              buyerOrderId: command.orderId,
              idempotencyKey: command.idempotencyKey,
            },
          },
          include: remittanceInclude,
        });
        if (replay) {
          return replay.requestHash === command.requestHash
            ? { kind: 'REPLAY' as const, remittance: toRecord(replay) }
            : { kind: 'IDEMPOTENCY_CONFLICT' as const };
        }

        const order = await tx.buyerOrder.findUnique({
          where: { id: command.orderId },
          include: {
            paymentTransactions: { select: { id: true }, take: 1 },
            enterpriseRemittances: { orderBy: { submissionVersion: 'desc' }, take: 1 },
            enterpriseProcurementOrder: true,
          },
        });
        if (!order) return { kind: 'NOT_FOUND' as const };
        if (
          order.orderType !== 'ENTERPRISE' ||
          order.enterpriseCustomerId !== command.actor.enterpriseCustomerId ||
          order.companyId !== command.actor.companyId
        ) {
          return { kind: 'ACCESS_DENIED' as const };
        }
        if (order.totalAmount !== command.amount || order.cashAmount !== command.amount) {
          return { kind: 'AMOUNT_MISMATCH' as const };
        }
        if (
          order.welfareCardAmount !== 0 ||
          order.externalPaymentMethod === 'WECHAT_PAY' ||
          order.paymentTransactions.length > 0 ||
          order.enterpriseProcurementOrder?.paymentMethod !== 'BANK_TRANSFER' ||
          order.enterpriseProcurementOrder.status !== 'PENDING_PAYMENT'
        ) {
          return { kind: 'PAYMENT_METHOD_INVALID' as const };
        }
        if (order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT') {
          return { kind: 'STATE_CONFLICT' as const };
        }
        const latest = order.enterpriseRemittances[0];
        if (latest && latest.status !== 'REJECTED') {
          return { kind: 'ALREADY_SUBMITTED' as const };
        }
        const submissionVersion = (latest?.submissionVersion ?? 0) + 1;
        const nextOrderVersion = order.version + 1;
        const submissionId = randomUUID();
        await tx.enterpriseRemittanceSubmission.create({
          data: {
            id: submissionId,
            buyerOrderId: order.id,
            submissionVersion,
            amount: command.amount,
            proofObjectKey: command.proofObjectKey,
            submittedByEnterpriseUserId: command.actor.enterpriseUserId,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            status: 'PENDING_REVIEW',
          },
        });
        const changed = await tx.buyerOrder.updateMany({
          where: {
            id: order.id,
            version: order.version,
            paymentStatus: 'PENDING',
            orderStatus: 'PENDING_PAYMENT',
          },
          data: {
            externalPaymentMethod: 'BANK_TRANSFER',
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new RemittanceMutationFailure('CONCURRENT_CONFLICT');
        const procurementChanged = await tx.enterpriseProcurementOrder.updateMany({
          where: {
            buyerOrderId: order.id,
            version: order.enterpriseProcurementOrder.version,
            paymentMethod: 'BANK_TRANSFER',
            status: 'PENDING_PAYMENT',
          },
          data: {
            remittanceReviewStatus: 'PENDING_REVIEW',
            status: 'PAYMENT_CONFIRMING',
            version: { increment: 1 },
          },
        });
        if (procurementChanged.count !== 1) throw new RemittanceMutationFailure('CONCURRENT_CONFLICT');
        await tx.buyerOrderEvent.create({
          data: {
            buyerOrderId: order.id,
            event: 'REMITTANCE_SUBMITTED',
            fromStatus: 'PENDING_PAYMENT',
            toStatus: 'PENDING_PAYMENT',
            version: nextOrderVersion,
            snapshot: json({
              paymentMethod: 'BANK_TRANSFER',
              remittanceId: submissionId,
              submissionVersion,
              amount: command.amount,
            }),
            actorType: 'ENTERPRISE',
            actorId: command.actor.enterpriseUserId,
            requestId: command.requestId,
          },
        });
        const stored = await tx.enterpriseRemittanceSubmission.findUniqueOrThrow({
          where: { id: submissionId },
          include: remittanceInclude,
        });
        return { kind: 'SUBMITTED' as const, remittance: toRecord(stored) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof RemittanceMutationFailure) return { kind: error.kind };
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return { kind: 'CONCURRENT_CONFLICT' };
      }
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const existing = await this.prisma.enterpriseRemittanceSubmission.findUnique({
        where: {
          buyerOrderId_idempotencyKey: {
            buyerOrderId: command.orderId,
            idempotencyKey: command.idempotencyKey,
          },
        },
        include: remittanceInclude,
      });
      if (existing) {
        return existing.requestHash === command.requestHash
          ? { kind: 'REPLAY', remittance: toRecord(existing) }
          : { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      return { kind: 'CONCURRENT_CONFLICT' };
    }
  }

  async review(command: ReviewEnterpriseRemittanceCommand): Promise<ReviewEnterpriseRemittanceResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const submission = await tx.enterpriseRemittanceSubmission.findFirst({
          where: { buyerOrderId: command.orderId },
          orderBy: { submissionVersion: 'desc' },
          include: {
            review: true,
            buyerOrder: {
              include: {
                items: { orderBy: { skuId: 'asc' } },
                supplierFulfillments: { orderBy: { supplierId: 'asc' } },
                paymentTransactions: { select: { id: true }, take: 1 },
                enterpriseProcurementOrder: true,
              },
            },
          },
        });
        if (!submission) return { kind: 'NOT_FOUND' as const };
        if (submission.buyerOrder.companyId !== command.actor.companyId) {
          return { kind: 'ACCESS_DENIED' as const };
        }
        if (submission.review) {
          return submission.review.idempotencyKey === command.idempotencyKey &&
            submission.review.requestHash === command.requestHash
            ? { kind: 'REPLAY' as const, remittance: toRecord(submission) }
            : submission.review.idempotencyKey === command.idempotencyKey
              ? { kind: 'IDEMPOTENCY_CONFLICT' as const }
              : { kind: 'STATE_CONFLICT' as const };
        }
        if (submission.version !== command.expectedVersion) {
          return { kind: 'VERSION_CONFLICT' as const };
        }
        const order = submission.buyerOrder;
        if (submission.amount !== command.amount || order.totalAmount !== command.amount || order.cashAmount !== command.amount) {
          return { kind: 'AMOUNT_MISMATCH' as const };
        }
        if (
          submission.status !== 'PENDING_REVIEW' ||
          order.orderType !== 'ENTERPRISE' ||
          order.externalPaymentMethod !== 'BANK_TRANSFER' ||
          order.paymentStatus !== 'PENDING' ||
          order.orderStatus !== 'PENDING_PAYMENT' ||
          order.welfareCardAmount !== 0 ||
          order.paymentTransactions.length > 0 ||
          order.enterpriseProcurementOrder?.paymentMethod !== 'BANK_TRANSFER' ||
          order.enterpriseProcurementOrder.status !== 'PAYMENT_CONFIRMING' ||
          order.enterpriseProcurementOrder.remittanceReviewStatus !== 'PENDING_REVIEW'
        ) {
          return { kind: 'STATE_CONFLICT' as const };
        }

        const reviewedAt = new Date();
        const updated = await tx.enterpriseRemittanceSubmission.updateMany({
          where: { id: submission.id, version: submission.version, status: 'PENDING_REVIEW' },
          data: {
            status: command.decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED',
            reviewedAt,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new RemittanceMutationFailure('CONCURRENT_CONFLICT');
        await tx.enterpriseRemittanceReview.create({
          data: {
            submissionId: submission.id,
            decision: command.decision,
            reviewedAmount: command.amount,
            reason: command.reason,
            reviewerFunctionalAccountId: command.actor.functionalAccountId,
            reviewerIdentityId: command.actor.identityId,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            submissionVersion: command.expectedVersion,
          },
        });

        const nextOrderVersion = order.version + 1;
        if (command.decision === 'CONFIRM') {
          for (const item of order.items) {
            const confirmed = await tx.inventoryChangeLog.findFirst({
              where: { skuId: item.skuId, referenceType: 'ORDER_CONFIRM', referenceId: order.id },
              select: { id: true },
            });
            const reserved = await tx.inventoryChangeLog.findFirst({
              where: { skuId: item.skuId, referenceType: 'ORDER_RESERVATION', referenceId: order.id },
              select: { id: true },
            });
            if (confirmed || !reserved) throw new RemittanceMutationFailure('STATE_CONFLICT');
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
            if (!before || before.reservedQty < item.quantity) throw new RemittanceMutationFailure('STATE_CONFLICT');
            const changed = await tx.inventoryBalance.updateMany({
              where: { id: before.id, version: before.version, reservedQty: { gte: item.quantity } },
              data: {
                reservedQty: { decrement: item.quantity },
                soldQty: { increment: item.quantity },
                version: { increment: 1 },
              },
            });
            if (changed.count !== 1) throw new RemittanceMutationFailure('CONCURRENT_CONFLICT');
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
                referenceId: order.id,
                reason: 'BANK_TRANSFER_CONFIRMED',
              },
            });
          }
          const orderChanged = await tx.buyerOrder.updateMany({
            where: {
              id: order.id,
              version: order.version,
              paymentStatus: 'PENDING',
              orderStatus: 'PENDING_PAYMENT',
              externalPaymentMethod: 'BANK_TRANSFER',
            },
            data: {
              paymentStatus: 'PAID',
              orderStatus: 'PAID',
              version: { increment: 1 },
            },
          });
          if (orderChanged.count !== 1) throw new RemittanceMutationFailure('CONCURRENT_CONFLICT');
          const procurementChanged = await tx.enterpriseProcurementOrder.updateMany({
            where: {
              buyerOrderId: order.id,
              version: order.enterpriseProcurementOrder.version,
              status: 'PAYMENT_CONFIRMING',
              remittanceReviewStatus: 'PENDING_REVIEW',
            },
            data: {
              status: 'PAID',
              remittanceReviewStatus: 'CONFIRMED',
              version: { increment: 1 },
            },
          });
          if (procurementChanged.count !== 1) throw new RemittanceMutationFailure('CONCURRENT_CONFLICT');
          await tx.supplierFulfillmentOrder.updateMany({
            where: { buyerOrderId: order.id, activationStatus: 'PENDING_PAYMENT' },
            data: { activationStatus: 'ACTIVE' },
          });
          await tx.inventoryCommand.create({
            data: {
              scope: `order-confirm:${order.id}`,
              idempotencyKey: `remittance:${submission.id}`,
              requestHash: createHash('sha256').update(`${submission.id}:${command.amount}`).digest('hex'),
              responseSnapshot: json({ orderId: order.id, status: 'SOLD', itemCount: order.items.length }),
            },
          });
          await tx.buyerOrderEvent.create({
            data: {
              buyerOrderId: order.id,
              event: 'REMITTANCE_CONFIRMED',
              fromStatus: 'PENDING_PAYMENT',
              toStatus: 'PAID',
              version: nextOrderVersion,
              snapshot: json({
                paymentMethod: 'BANK_TRANSFER',
                remittanceId: submission.id,
                amount: command.amount,
                supplierFulfillmentCount: order.supplierFulfillments.length,
                itemCount: order.items.length,
              }),
              actorType: 'COMPANY',
              actorId: command.actor.identityId,
              requestId: command.requestId,
            },
          });
          await tx.paymentOutbox.create({
            data: {
              buyerOrderId: order.id,
              eventType: 'BUYER_ORDER_PAID_V1',
              eventVersion: nextOrderVersion,
              payload: json({
                buyerOrderId: order.id,
                orderType: 'ENTERPRISE',
                orderVersion: nextOrderVersion,
                supplierFulfillments: order.supplierFulfillments.map((item) => ({
                  fulfillmentOrderId: item.id,
                  supplierId: item.supplierId,
                })),
              }),
              status: 'PENDING',
            },
          });
        } else {
          const orderChanged = await tx.buyerOrder.updateMany({
            where: { id: order.id, version: order.version, orderStatus: 'PENDING_PAYMENT' },
            data: { version: { increment: 1 } },
          });
          if (orderChanged.count !== 1) throw new RemittanceMutationFailure('CONCURRENT_CONFLICT');
          const procurementChanged = await tx.enterpriseProcurementOrder.updateMany({
            where: {
              buyerOrderId: order.id,
              version: order.enterpriseProcurementOrder.version,
              status: 'PAYMENT_CONFIRMING',
              remittanceReviewStatus: 'PENDING_REVIEW',
            },
            data: {
              status: 'PENDING_PAYMENT',
              remittanceReviewStatus: 'REJECTED',
              version: { increment: 1 },
            },
          });
          if (procurementChanged.count !== 1) throw new RemittanceMutationFailure('CONCURRENT_CONFLICT');
          await tx.buyerOrderEvent.create({
            data: {
              buyerOrderId: order.id,
              event: 'REMITTANCE_REJECTED',
              fromStatus: 'PENDING_PAYMENT',
              toStatus: 'PENDING_PAYMENT',
              version: nextOrderVersion,
              snapshot: json({
                paymentMethod: 'BANK_TRANSFER',
                remittanceId: submission.id,
                amount: command.amount,
                reason: command.reason,
              }),
              actorType: 'COMPANY',
              actorId: command.actor.identityId,
              requestId: command.requestId,
            },
          });
        }

        const stored = await tx.enterpriseRemittanceSubmission.findUniqueOrThrow({
          where: { id: submission.id },
          include: remittanceInclude,
        });
        return {
          kind: command.decision === 'CONFIRM' ? 'CONFIRMED' as const : 'REJECTED' as const,
          remittance: toRecord(stored),
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof RemittanceMutationFailure) return { kind: error.kind };
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return { kind: 'CONCURRENT_CONFLICT' };
      }
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const submission = await this.prisma.enterpriseRemittanceSubmission.findFirst({
        where: { buyerOrderId: command.orderId },
        orderBy: { submissionVersion: 'desc' },
        include: remittanceInclude,
      });
      if (submission?.review) {
        return submission.review.idempotencyKey === command.idempotencyKey &&
          submission.review.requestHash === command.requestHash
          ? { kind: 'REPLAY', remittance: toRecord(submission) }
          : submission.review.idempotencyKey === command.idempotencyKey
            ? { kind: 'IDEMPOTENCY_CONFLICT' }
            : { kind: 'STATE_CONFLICT' };
      }
      return { kind: 'CONCURRENT_CONFLICT' };
    }
  }
}
