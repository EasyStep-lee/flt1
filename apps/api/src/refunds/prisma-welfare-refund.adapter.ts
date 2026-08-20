import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import {
  RefundAdapterError,
  type RefundAdapterResult,
  type WelfareRefundAdapter,
  type WelfareRefundCommand,
} from './refund.adapter.js';

const reject = (message: string): never => {
  throw new RefundAdapterError('REFUND_CHANNEL_REJECTED', message);
};

@Injectable()
export class PrismaWelfareRefundAdapter implements WelfareRefundAdapter {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async refund(command: WelfareRefundCommand): Promise<RefundAdapterResult> {
    if (!Number.isSafeInteger(command.refundAmount) || command.refundAmount <= 0) {
      return reject('Welfare-card refund amount must be a positive integer cent value');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const refund = await tx.refundTransaction.findUnique({
          where: { id: command.refundId },
          include: { order: { select: { welfareCardAccountId: true } } },
        });
        if (!refund) return reject('Refund transaction was not found');
        const originalAccountId = refund.order.welfareCardAccountId;
        if (
          refund.refundNo !== command.refundNo ||
          refund.welfareCardRefundAmount !== command.refundAmount ||
          !originalAccountId ||
          originalAccountId !== command.originalWelfareCardAccountId
        ) {
          return reject('Welfare-card refund must use the server-owned original allocation and account');
        }

        const existingLedger = await tx.welfareCardLedger.findFirst({
          where: {
            accountId: originalAccountId,
            refundId: refund.id,
            businessType: 'REFUND',
          },
        });
        if (existingLedger) {
          if (
            existingLedger.direction !== 'CREDIT' ||
            existingLedger.amount !== command.refundAmount ||
            refund.welfareChannelStatus !== 'SUCCEEDED'
          ) {
            return reject('Existing welfare-card refund ledger conflicts with the refund transaction');
          }
          return { kind: 'SUCCEEDED' };
        }
        if (refund.welfareChannelStatus !== 'PROCESSING') {
          return reject('Welfare-card refund channel is not processing');
        }

        const account = await tx.welfareCardAccount.findUnique({
          where: { id: originalAccountId },
        });
        if (!account) return reject('Original welfare-card account was not found');
        const afterBalance = account.balanceAmount + command.refundAmount;
        if (!Number.isSafeInteger(afterBalance)) {
          return reject('Welfare-card balance would exceed the safe integer range');
        }
        const ledgerSequence = Number.isSafeInteger(account.ledgerSequence) ? account.ledgerSequence : account.version + 1;

        const accountChanged = await tx.welfareCardAccount.updateMany({
          where: { id: account.id, version: account.version },
          data: {
            balanceAmount: { increment: command.refundAmount },
            ledgerSequence: { increment: 1 },
            version: { increment: 1 },
          },
        });
        if (accountChanged.count !== 1) {
          return reject('Original welfare-card account changed concurrently');
        }

        await tx.welfareCardLedger.create({
          data: {
            accountId: account.id,
            sequence: ledgerSequence + 1,
            orderId: refund.orderId,
            refundId: refund.id,
            adjustmentId: null,
            businessType: 'REFUND',
            direction: 'CREDIT',
            amount: command.refundAmount,
            beforeBalance: account.balanceAmount,
            afterBalance,
            beforeFrozen: account.frozenAmount,
            afterFrozen: account.frozenAmount,
            idempotencyKey: `refund:${refund.id}:welfare`,
          },
        });

        const nextStatus = refund.cashRefundAmount > 0
          ? 'PARTIAL_CHANNEL_DONE'
          : 'SUCCEEDED';
        const nextVersion = refund.version + 1;
        const refundChanged = await tx.refundTransaction.updateMany({
          where: {
            id: refund.id,
            version: refund.version,
            welfareChannelStatus: 'PROCESSING',
          },
          data: {
            welfareChannelStatus: 'SUCCEEDED',
            status: nextStatus,
            version: { increment: 1 },
          },
        });
        if (refundChanged.count !== 1) {
          return reject('Refund transaction changed concurrently');
        }
        await tx.refundTransactionEvent.create({
          data: {
            refundTransactionId: refund.id,
            fromStatus: refund.status,
            toStatus: nextStatus,
            event: 'WELFARE_REFUND_APPLIED',
            version: nextVersion,
            snapshot: {
              channel: 'WELFARE',
              result: 'SUCCEEDED',
              accountStatusUnchanged: account.status,
              refundAmount: command.refundAmount,
            },
            actorType: 'SYSTEM',
            actorId: refund.orderId,
            requestId: command.requestId,
          },
        });
        return { kind: 'SUCCEEDED' };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (
        error instanceof RefundAdapterError ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        (error.code !== 'P2002' && error.code !== 'P2034')
      ) {
        throw error;
      }
      return reject('Welfare-card refund conflicted with a concurrent request');
    }
  }
}
