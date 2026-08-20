import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import { assertAuditRequestId } from '../audit/audit-log.policy.js';
import { fundingLedgerBusinessType } from '../welfare-card-ledger/welfare-card-ledger.policy.js';
import type {
  BindWelfareCardCommand,
  CreateWelfareBatchCommand,
  CreateWelfareCardAdjustmentCommand,
  CreateWelfareProgramCommand,
  DecideWelfareCardAdjustmentCommand,
  WelfareBatchRecord,
  WelfareCardAccountRecord,
  WelfareCardAdjustmentMutationResult,
  WelfareCardAdjustmentRecord,
  WelfareCardEligibilityAccountRecord,
  WelfareCardBindingResult,
  WelfareCardLedgerLookupResult,
  WelfareCardLedgerRecord,
  WelfareCardRepository,
  WelfareMutationResult,
  WelfareProgramRecord,
} from './welfare-card.repository.js';
import { verifyWelfareCardSecret } from './welfare-card-secret.js';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
class WelfareAdjustmentTransactionConflict extends Error {}
const history = (row: { event: string; resultingVersion: number; occurredAt: Date }) => ({
  event: row.event as 'PROGRAM_CREATED' | 'BATCH_CREATED',
  resultingVersion: row.resultingVersion,
  occurredAt: row.occurredAt.toISOString(),
});
const batchRecord = (row: {
  id: string; companyId: string; programId: string; enterpriseCustomerId: string | null; batchNo: string;
  totalAmount: number; unitAmount: number; issueCount: number; claimMode: string; agreementVersion: number;
  status: string; version: number; createdAt: Date;
}, histories: readonly { event: string; resultingVersion: number; occurredAt: Date }[]): WelfareBatchRecord => ({
  id: row.id, companyId: row.companyId, programId: row.programId, enterpriseCustomerId: row.enterpriseCustomerId,
  batchNo: row.batchNo, totalAmount: row.totalAmount, unitAmount: row.unitAmount, issueCount: row.issueCount,
  claimMode: row.claimMode as WelfareBatchRecord['claimMode'], agreementVersion: row.agreementVersion,
  status: row.status as 'DRAFT', version: row.version, createdAt: row.createdAt.toISOString(),
  history: histories.map(history),
} as WelfareBatchRecord);
const programRecord = (row: {
  id: string; companyId: string; name: string; fundingType: string; issuerType: string; scopeType: string;
  scopeRules: Prisma.JsonValue; canPayDeliveryFee: boolean; refundPolicy: string; complianceStatus: string;
  status: string; version: number; createdAt: Date; updatedAt: Date;
}, histories: readonly { event: string; resultingVersion: number; occurredAt: Date }[], batches: readonly WelfareBatchRecord[]): WelfareProgramRecord => ({
  id: row.id, companyId: row.companyId, name: row.name, fundingType: row.fundingType as WelfareProgramRecord['fundingType'],
  issuerType: row.issuerType as 'COMPANY', scopeType: row.scopeType as WelfareProgramRecord['scopeType'],
  scopeRules: row.scopeRules as unknown as WelfareProgramRecord['scopeRules'], canPayDeliveryFee: row.canPayDeliveryFee,
  refundPolicy: row.refundPolicy, complianceStatus: row.complianceStatus as 'DRAFT', status: row.status as 'DRAFT',
  version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  history: histories.map(history), batches,
});
const accountRecord = (row: {
  id: string; consumerUserId: string; programId: string; batchId: string; balanceAmount: number;
  frozenAmount: number; status: string; version: number;
}, source: { companyId: string; programName: string; batchNo: string; cardNo: string; claimedAt: Date }): WelfareCardAccountRecord => ({
  id: row.id,
  companyId: source.companyId,
  consumerUserId: row.consumerUserId,
  programId: row.programId,
  programName: source.programName,
  batchId: row.batchId,
  batchNo: source.batchNo,
  cardNo: source.cardNo,
  balanceAmount: row.balanceAmount,
  frozenAmount: row.frozenAmount,
  status: row.status as WelfareCardAccountRecord['status'],
  version: row.version,
  claimedAt: source.claimedAt.toISOString(),
});
const ledgerRecord = (row: {
  id: string; accountId: string; sequence: number; orderId: string | null; refundId: string | null;
  adjustmentId: string | null; businessType: string; direction: string; amount: number;
  beforeBalance: number; afterBalance: number; beforeFrozen: number; afterFrozen: number; occurredAt: Date;
}): WelfareCardLedgerRecord => ({
  id: row.id,
  accountId: row.accountId,
  sequence: row.sequence,
  orderId: row.orderId,
  refundId: row.refundId,
  adjustmentId: row.adjustmentId,
  businessType: row.businessType as WelfareCardLedgerRecord['businessType'],
  direction: row.direction as WelfareCardLedgerRecord['direction'],
  amount: row.amount,
  beforeBalance: row.beforeBalance,
  afterBalance: row.afterBalance,
  beforeFrozen: row.beforeFrozen,
  afterFrozen: row.afterFrozen,
  occurredAt: row.occurredAt.toISOString(),
});
const adjustmentRecord = (row: {
  id: string; accountId: string; businessType: string; direction: string; amount: number;
  reversalOfLedgerId: string | null; reason: string; status: string; version: number;
  applicantIdentityId: string; applicantFunctionalAccountId: string;
  reviewerIdentityId: string | null; reviewerFunctionalAccountId: string | null;
  reviewOpinion: string | null; createdAt: Date; updatedAt: Date;
}): WelfareCardAdjustmentRecord => ({
  id: row.id,
  accountId: row.accountId,
  businessType: row.businessType as WelfareCardAdjustmentRecord['businessType'],
  direction: row.direction as WelfareCardAdjustmentRecord['direction'],
  amount: row.amount,
  reversalOfLedgerId: row.reversalOfLedgerId,
  reason: row.reason,
  status: row.status as WelfareCardAdjustmentRecord['status'],
  version: row.version,
  applicantIdentityId: row.applicantIdentityId,
  applicantFunctionalAccountId: row.applicantFunctionalAccountId,
  reviewerIdentityId: row.reviewerIdentityId,
  reviewerFunctionalAccountId: row.reviewerFunctionalAccountId,
  reviewOpinion: row.reviewOpinion,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class PrismaWelfareCardRepository implements WelfareCardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async loadBatch(id: string): Promise<WelfareBatchRecord> {
    const row = await this.prisma.welfareCardBatch.findUniqueOrThrow({ where: { id } });
    const histories = await this.prisma.welfareCardBatchHistory.findMany({ where: { batchId: id }, orderBy: { occurredAt: 'asc' } });
    return batchRecord(row, histories);
  }

  private async loadProgram(id: string): Promise<WelfareProgramRecord> {
    const row = await this.prisma.welfareCardProgram.findUniqueOrThrow({ where: { id } });
    const histories = await this.prisma.welfareCardProgramHistory.findMany({ where: { programId: id }, orderBy: { occurredAt: 'asc' } });
    const batchRows = await this.prisma.welfareCardBatch.findMany({ where: { programId: id }, orderBy: { createdAt: 'desc' } });
    const batches = await Promise.all(batchRows.map((entry) => this.loadBatch(entry.id)));
    return programRecord(row, histories, batches);
  }

  async listPrograms(companyId: string): Promise<readonly WelfareProgramRecord[]> {
    const rows = await this.prisma.welfareCardProgram.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
    return Promise.all(rows.map((entry) => this.loadProgram(entry.id)));
  }

  async listEligibilityAccounts(companyId: string, consumerUserId: string): Promise<readonly WelfareCardEligibilityAccountRecord[]> {
    const rows = await this.prisma.welfareCardAccount.findMany({
      where: {
        consumerUserId,
        status: 'ACTIVE',
        program: { companyId, status: 'ACTIVE', complianceStatus: 'APPROVED' },
        batch: { companyId, status: 'ISSUED' },
      },
      include: { program: true, batch: true, cardCode: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.flatMap((row) => {
      if (!row.cardCode.claimedAt) return [];
      return [{
        ...accountRecord(row, {
          companyId,
          programName: row.program.name,
          batchNo: row.batch.batchNo,
          cardNo: row.cardCode.cardNo,
          claimedAt: row.cardCode.claimedAt,
        }),
        scopeType: row.program.scopeType as WelfareProgramRecord['scopeType'],
        scopeRules: row.program.scopeRules as unknown as WelfareProgramRecord['scopeRules'],
        canPayDeliveryFee: row.program.canPayDeliveryFee,
      }];
    });
  }

  private async loadLedger(companyId: string, accountId: string, consumerUserId?: string): Promise<WelfareCardLedgerLookupResult> {
    const account = await this.prisma.welfareCardAccount.findFirst({
      where: {
        id: accountId,
        ...(consumerUserId ? { consumerUserId } : {}),
        program: { companyId },
        batch: { companyId },
      },
      include: { program: true, batch: true, cardCode: true },
    });
    if (!account || !account.cardCode.claimedAt) return { kind: 'NOT_FOUND' };
    const items = await this.prisma.welfareCardLedger.findMany({ where: { accountId }, orderBy: { sequence: 'asc' } });
    if (items.length < 1) return { kind: 'INCONSISTENT' };
    return {
      kind: 'OK',
      value: {
        account: accountRecord(account, {
          companyId,
          programName: account.program.name,
          batchNo: account.batch.batchNo,
          cardNo: account.cardCode.cardNo,
          claimedAt: account.cardCode.claimedAt,
        }),
        items: items.map(ledgerRecord),
      },
    };
  }

  getConsumerLedger(companyId: string, consumerUserId: string, accountId: string): Promise<WelfareCardLedgerLookupResult> {
    return this.loadLedger(companyId, accountId, consumerUserId);
  }

  getCompanyLedger(companyId: string, accountId: string): Promise<WelfareCardLedgerLookupResult> {
    return this.loadLedger(companyId, accountId);
  }

  async listCompanyAccounts(companyId: string): Promise<readonly WelfareCardAccountRecord[]> {
    const rows = await this.prisma.welfareCardAccount.findMany({
      where: { program: { companyId }, batch: { companyId } },
      include: { program: true, batch: true, cardCode: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.flatMap((row) => row.cardCode.claimedAt ? [accountRecord(row, {
      companyId,
      programName: row.program.name,
      batchNo: row.batch.batchNo,
      cardNo: row.cardCode.cardNo,
      claimedAt: row.cardCode.claimedAt,
    })] : []);
  }

  async listAdjustments(companyId: string): Promise<readonly WelfareCardAdjustmentRecord[]> {
    const rows = await this.prisma.welfareCardAdjustment.findMany({
      where: { companyId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(adjustmentRecord);
  }

  private async replayAdjustment(scope: string, key: string, hash: string): Promise<WelfareCardAdjustmentMutationResult | undefined> {
    const previous = await this.prisma.welfareCardAdjustmentCommand.findUnique({
      where: { scope_idempotencyKey: { scope, idempotencyKey: key } },
    });
    if (!previous) return undefined;
    if (previous.requestHash !== hash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', replayed: true, value: previous.responseSnapshot as unknown as WelfareCardAdjustmentRecord };
  }

  async createAdjustment(command: CreateWelfareCardAdjustmentCommand): Promise<WelfareCardAdjustmentMutationResult> {
    const scope = `create:${command.companyId}:${command.actorIdentityId}`;
    const replay = await this.replayAdjustment(scope, command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    try {
      return await this.prisma.$transaction(async (tx): Promise<WelfareCardAdjustmentMutationResult> => {
        const account = await tx.welfareCardAccount.findFirst({
          where: { id: command.accountId, program: { companyId: command.companyId }, batch: { companyId: command.companyId } },
          select: { id: true },
        });
        if (!account) return { kind: 'NOT_FOUND' };
        let direction = command.direction;
        let amount = command.amount;
        if (command.businessType === 'REVERSAL') {
          const original = command.reversalOfLedgerId ? await tx.welfareCardLedger.findFirst({
            where: { id: command.reversalOfLedgerId, accountId: command.accountId, businessType: 'ADJUSTMENT', adjustmentId: { not: null } },
          }) : null;
          const existing = command.reversalOfLedgerId ? await tx.welfareCardAdjustment.findUnique({ where: { reversalOfLedgerId: command.reversalOfLedgerId } }) : null;
          if (!original || existing) return { kind: 'REVERSAL_INVALID' };
          direction = original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
          amount = original.amount;
        }
        if ((direction !== 'CREDIT' && direction !== 'DEBIT') || !Number.isSafeInteger(amount) || Number(amount) <= 0) {
          return { kind: 'STATE_INVALID' };
        }
        const row = await tx.welfareCardAdjustment.create({ data: {
          id: randomUUID(), companyId: command.companyId, accountId: command.accountId,
          businessType: command.businessType, direction, amount: Number(amount),
          reversalOfLedgerId: command.reversalOfLedgerId, reason: command.reason,
          status: 'PENDING', version: 0, applicantIdentityId: command.actorIdentityId,
          applicantFunctionalAccountId: command.functionalAccountId,
        } });
        await tx.welfareCardAdjustmentHistory.create({ data: {
          id: randomUUID(), adjustmentId: row.id, fromStatus: null, toStatus: 'PENDING', event: 'CREATE',
          actorIdentityId: command.actorIdentityId, functionalAccountId: command.functionalAccountId,
          opinion: command.reason, version: 0,
        } });
        const value = adjustmentRecord(row);
        await tx.auditLog.create({ data: {
          id: randomUUID(), actorType: 'COMPANY_USER', actorId: command.actorIdentityId, supplierId: null,
          functionalAccountId: command.functionalAccountId, action: 'welfare_card.adjustment.create',
          objectType: 'welfare_card_adjustment', objectId: row.id, beforeSnapshot: json({}),
          afterSnapshot: json({ accountId: row.accountId, businessType: row.businessType, direction: row.direction, amount: row.amount, status: row.status, version: row.version }),
          requestId: assertAuditRequestId(command.requestId), ip: command.ip,
        } });
        await tx.welfareCardAdjustmentCommand.create({ data: {
          id: randomUUID(), scope, idempotencyKey: command.idempotencyKey, requestHash: command.requestHash,
          responseSnapshot: json(value),
        } });
        return { kind: 'OK', replayed: false, value };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || (error.code !== 'P2002' && error.code !== 'P2034')) throw error;
      const after = await this.replayAdjustment(scope, command.idempotencyKey, command.requestHash);
      return after ?? (command.businessType === 'REVERSAL' ? { kind: 'REVERSAL_INVALID' } : { kind: 'STATE_INVALID' });
    }
  }

  async decideAdjustment(command: DecideWelfareCardAdjustmentCommand): Promise<WelfareCardAdjustmentMutationResult> {
    const scope = `decide:${command.adjustmentId}:${command.reviewerIdentityId}`;
    const replay = await this.replayAdjustment(scope, command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx): Promise<WelfareCardAdjustmentMutationResult> => {
          const row = await tx.welfareCardAdjustment.findFirst({ where: { id: command.adjustmentId, companyId: command.companyId } });
          if (!row) return { kind: 'NOT_FOUND' };
          if (row.applicantIdentityId === command.reviewerIdentityId) return { kind: 'SAME_NATURAL_PERSON' };
          if (row.status !== 'PENDING') return { kind: 'STATE_INVALID' };
          if (row.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };

          let account: Awaited<ReturnType<typeof tx.welfareCardAccount.findFirst>> | null = null;
          let afterBalance: number | null = null;
          if (command.decision === 'APPROVE') {
            account = await tx.welfareCardAccount.findFirst({
              where: { id: row.accountId, program: { companyId: command.companyId }, batch: { companyId: command.companyId } },
            });
            if (!account) return { kind: 'NOT_FOUND' };
            afterBalance = account.balanceAmount + (row.direction === 'CREDIT' ? row.amount : -row.amount);
            if (!Number.isSafeInteger(afterBalance) || afterBalance < account.frozenAmount) return { kind: 'INSUFFICIENT_BALANCE' };
          }

          const status = command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
          const adjustmentChanged = await tx.welfareCardAdjustment.updateMany({
            where: { id: row.id, status: 'PENDING', version: row.version },
            data: {
              status, version: { increment: 1 }, reviewerIdentityId: command.reviewerIdentityId,
              reviewerFunctionalAccountId: command.functionalAccountId, reviewOpinion: command.opinion,
            },
          });
          if (adjustmentChanged.count !== 1) return { kind: 'VERSION_CONFLICT' };

          if (command.decision === 'APPROVE' && account && afterBalance !== null) {
            const changed = await tx.welfareCardAccount.updateMany({
              where: { id: account.id, version: account.version, balanceAmount: account.balanceAmount, frozenAmount: account.frozenAmount },
              data: { balanceAmount: afterBalance, ledgerSequence: { increment: 1 }, version: { increment: 1 } },
            });
            if (changed.count !== 1) throw new WelfareAdjustmentTransactionConflict();
            await tx.welfareCardLedger.create({ data: {
              id: randomUUID(), accountId: account.id, sequence: account.ledgerSequence + 1, orderId: null, refundId: null,
              adjustmentId: row.id, businessType: row.businessType, direction: row.direction, amount: row.amount,
              beforeBalance: account.balanceAmount, afterBalance, beforeFrozen: account.frozenAmount,
              afterFrozen: account.frozenAmount, idempotencyKey: `ADJUSTMENT:${row.id}`,
            } });
          }
          await tx.welfareCardAdjustmentHistory.create({ data: {
            id: randomUUID(), adjustmentId: row.id, fromStatus: 'PENDING', toStatus: status,
            event: command.decision === 'APPROVE' ? 'APPROVE' : 'REJECT',
            actorIdentityId: command.reviewerIdentityId, functionalAccountId: command.functionalAccountId,
            opinion: command.opinion, version: row.version + 1,
          } });
          const current = await tx.welfareCardAdjustment.findUniqueOrThrow({ where: { id: row.id } });
          const value = adjustmentRecord(current);
          await tx.auditLog.create({ data: {
            id: randomUUID(), actorType: 'COMPANY_USER', actorId: command.reviewerIdentityId, supplierId: null,
            functionalAccountId: command.functionalAccountId, action: `welfare_card.adjustment.${command.decision.toLowerCase()}`,
            objectType: 'welfare_card_adjustment', objectId: row.id,
            beforeSnapshot: json({ status: row.status, version: row.version }),
            afterSnapshot: json({ status: current.status, version: current.version, accountId: current.accountId, businessType: current.businessType, direction: current.direction, amount: current.amount }),
            requestId: assertAuditRequestId(command.requestId), ip: command.ip,
          } });
          await tx.welfareCardAdjustmentCommand.create({ data: {
            id: randomUUID(), scope, idempotencyKey: command.idempotencyKey, requestHash: command.requestHash,
            responseSnapshot: json(value),
          } });
          return { kind: 'OK', replayed: false, value };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof WelfareAdjustmentTransactionConflict) return { kind: 'VERSION_CONFLICT' };
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || (error.code !== 'P2002' && error.code !== 'P2034')) throw error;
        const after = await this.replayAdjustment(scope, command.idempotencyKey, command.requestHash);
        if (after) return after;
        if (error.code === 'P2034' && attempt < 2) continue;
        return { kind: 'VERSION_CONFLICT' };
      }
    }
    return { kind: 'VERSION_CONFLICT' };
  }

  private async replay<T extends WelfareProgramRecord | WelfareBatchRecord>(companyId: string, operation: string, key: string, hash: string): Promise<WelfareMutationResult<T> | undefined> {
    const command = await this.prisma.welfareCardCommand.findUnique({ where: { companyId_idempotencyKey: { companyId, idempotencyKey: key } } });
    if (!command) return undefined;
    if (command.operation !== operation || command.requestHash !== hash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', replayed: true, value: command.responseSnapshot as unknown as T };
  }

  async createProgram(command: CreateWelfareProgramCommand): Promise<WelfareMutationResult<WelfareProgramRecord>> {
    const replay = await this.replay<WelfareProgramRecord>(command.companyId, 'CREATE_PROGRAM', command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const id = randomUUID();
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const row = await tx.welfareCardProgram.create({ data: {
          id, companyId: command.companyId, name: command.name, fundingType: command.fundingType,
          issuerType: 'COMPANY', scopeType: command.scopeType, scopeRules: json(command.scopeRules),
          canPayDeliveryFee: command.canPayDeliveryFee, refundPolicy: command.refundPolicy,
          complianceStatus: 'DRAFT', status: 'DRAFT', version: 0,
          createdByIdentityId: command.actorIdentityId, functionalAccountId: command.functionalAccountId,
        } });
        const created = programRecord(row, [{ event: 'PROGRAM_CREATED', resultingVersion: 0, occurredAt: row.createdAt }], []);
        await tx.welfareCardProgramHistory.create({ data: {
          id: randomUUID(), programId: id, event: 'PROGRAM_CREATED', snapshot: json(created), resultingVersion: 0,
          actorIdentityId: command.actorIdentityId, functionalAccountId: command.functionalAccountId,
          requestId: command.requestId, ip: command.ip,
        } });
        await tx.welfareCardCommand.create({ data: {
          id: randomUUID(), companyId: command.companyId, operation: 'CREATE_PROGRAM', idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash, responseSnapshot: json(created),
        } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { kind: 'OK', replayed: false, value: result };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const after = await this.replay<WelfareProgramRecord>(command.companyId, 'CREATE_PROGRAM', command.idempotencyKey, command.requestHash);
      return after ?? { kind: 'DUPLICATE' };
    }
  }

  async createBatch(command: CreateWelfareBatchCommand): Promise<WelfareMutationResult<WelfareBatchRecord>> {
    const replay = await this.replay<WelfareBatchRecord>(command.companyId, 'CREATE_BATCH', command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const program = await this.prisma.welfareCardProgram.findFirst({ where: { id: command.programId, companyId: command.companyId, status: 'DRAFT' } });
    if (!program) return { kind: 'NOT_FOUND' };
    const expectedMode = { ENTERPRISE_GRANT: 'ENTERPRISE_ASSIGNED', COMPANY_GIFT: 'COMPANY_ASSIGNED', PHYSICAL_CARD_OR_CODE: 'PHYSICAL_CARD_OR_CODE' } as const;
    if (expectedMode[program.fundingType as keyof typeof expectedMode] !== command.claimMode) return { kind: 'DUPLICATE' };
    if (command.enterpriseCustomerId) {
      const enterprise = await this.prisma.enterpriseCustomer.findFirst({ where: { id: command.enterpriseCustomerId, companyId: command.companyId, status: 'ACTIVE' } });
      if (!enterprise) return { kind: 'NOT_FOUND' };
    }
    const id = randomUUID();
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const row = await tx.welfareCardBatch.create({ data: {
          id, companyId: command.companyId, programId: command.programId,
          enterpriseCustomerId: command.enterpriseCustomerId, batchNo: command.batchNo,
          totalAmount: command.totalAmount, unitAmount: command.unitAmount, issueCount: command.issueCount,
          claimMode: command.claimMode, agreementVersion: command.agreementVersion, status: 'DRAFT', version: 0,
          createdByIdentityId: command.actorIdentityId, functionalAccountId: command.functionalAccountId,
        } });
        const created = batchRecord(row, [{ event: 'BATCH_CREATED', resultingVersion: 0, occurredAt: row.createdAt }]);
        await tx.welfareCardBatchHistory.create({ data: {
          id: randomUUID(), batchId: id, event: 'BATCH_CREATED', snapshot: json(created), resultingVersion: 0,
          actorIdentityId: command.actorIdentityId, functionalAccountId: command.functionalAccountId,
          requestId: command.requestId, ip: command.ip,
        } });
        await tx.welfareCardCommand.create({ data: {
          id: randomUUID(), companyId: command.companyId, operation: 'CREATE_BATCH', idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash, responseSnapshot: json(created),
        } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { kind: 'OK', replayed: false, value: result };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const after = await this.replay<WelfareBatchRecord>(command.companyId, 'CREATE_BATCH', command.idempotencyKey, command.requestHash);
      return after ?? { kind: 'DUPLICATE' };
    }
  }

  private async replayBinding(command: BindWelfareCardCommand): Promise<WelfareCardBindingResult | undefined> {
    const previous = await this.prisma.welfareCardBindingCommand.findUnique({
      where: {
        companyId_consumerUserId_idempotencyKey: {
          companyId: command.companyId,
          consumerUserId: command.consumerUserId,
          idempotencyKey: command.idempotencyKey,
        },
      },
    });
    if (!previous) return undefined;
    if (previous.requestHash !== command.requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', replayed: true, value: previous.responseSnapshot as unknown as WelfareCardAccountRecord };
  }

  async bindCard(command: BindWelfareCardCommand): Promise<WelfareCardBindingResult> {
    const replay = await this.replayBinding(command);
    if (replay) return replay;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx): Promise<WelfareCardBindingResult> => {
          const previous = await tx.welfareCardBindingCommand.findUnique({
            where: {
              companyId_consumerUserId_idempotencyKey: {
                companyId: command.companyId,
                consumerUserId: command.consumerUserId,
                idempotencyKey: command.idempotencyKey,
              },
            },
          });
          if (previous) {
            if (previous.requestHash !== command.requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
            return { kind: 'OK', replayed: true, value: previous.responseSnapshot as unknown as WelfareCardAccountRecord };
          }

          const card = await tx.welfareCardCode.findUnique({
            where: { cardNo: command.cardNo },
            include: { batch: { include: { program: true } } },
          });
          const secretMatches = verifyWelfareCardSecret(command.secret, card?.secretHash);
          if (!card || card.batch.companyId !== command.companyId || !secretMatches) {
            return { kind: 'CARD_CODE_INVALID', reason: 'CREDENTIAL' };
          }
          if (card.status === 'CLAIMED') {
            return card.claimedByConsumerUserId === command.consumerUserId
              ? { kind: 'CARD_ALREADY_CLAIMED' }
              : { kind: 'CARD_RECIPIENT_MISMATCH' };
          }
          if (
            card.status !== 'UNCLAIMED'
            || card.batch.status !== 'ISSUED'
            || card.batch.program.status !== 'ACTIVE'
            || card.batch.program.complianceStatus !== 'APPROVED'
          ) {
            return { kind: 'CARD_CODE_INVALID', reason: 'STATE' };
          }
          if (card.batch.agreementVersion !== command.agreementVersion) {
            return { kind: 'CARD_CODE_INVALID', reason: 'AGREEMENT' };
          }

          const claimedAt = new Date();
          const claimed = await tx.welfareCardCode.updateMany({
            where: { id: card.id, status: 'UNCLAIMED', version: card.version },
            data: {
              status: 'CLAIMED',
              claimedByConsumerUserId: command.consumerUserId,
              claimedAt,
              version: { increment: 1 },
            },
          });
          if (claimed.count !== 1) {
            const current = await tx.welfareCardCode.findUnique({ where: { id: card.id } });
            return current?.claimedByConsumerUserId === command.consumerUserId
              ? { kind: 'CARD_ALREADY_CLAIMED' }
              : { kind: 'CARD_RECIPIENT_MISMATCH' };
          }

          const account = await tx.welfareCardAccount.create({
            data: {
              id: randomUUID(),
              consumerUserId: command.consumerUserId,
              programId: card.batch.programId,
              batchId: card.batchId,
              cardCodeId: card.id,
              balanceAmount: card.amount,
              frozenAmount: 0,
              ledgerSequence: 1,
              status: 'ACTIVE',
              version: 0,
            },
          });
          await tx.welfareCardLedger.create({
            data: {
              id: randomUUID(),
              accountId: account.id,
              sequence: 1,
              orderId: null,
              refundId: null,
              adjustmentId: null,
              businessType: fundingLedgerBusinessType(card.batch.program.fundingType),
              direction: 'CREDIT',
              amount: card.amount,
              beforeBalance: 0,
              afterBalance: card.amount,
              beforeFrozen: 0,
              afterFrozen: 0,
              idempotencyKey: `CLAIM:${card.id}`,
            },
          });
          const created = accountRecord(account, {
            companyId: command.companyId,
            programName: card.batch.program.name,
            batchNo: card.batch.batchNo,
            cardNo: card.cardNo,
            claimedAt,
          });
          await tx.welfareCardBindingCommand.create({
            data: {
              id: randomUUID(),
              companyId: command.companyId,
              consumerUserId: command.consumerUserId,
              idempotencyKey: command.idempotencyKey,
              requestHash: command.requestHash,
              requestId: command.requestId,
              responseSnapshot: json(created),
            },
          });
          return { kind: 'OK', replayed: false, value: created };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
        if (error.code === 'P2034' && attempt < 2) continue;
        if (error.code === 'P2002') {
          const after = await this.replayBinding(command);
          if (after) return after;
          const card = await this.prisma.welfareCardCode.findUnique({ where: { cardNo: command.cardNo } });
          return card?.claimedByConsumerUserId === command.consumerUserId
            ? { kind: 'CARD_ALREADY_CLAIMED' }
            : { kind: 'CARD_RECIPIENT_MISMATCH' };
        }
        throw error;
      }
    }
    throw new Error('WELFARE_CARD_BINDING_SERIALIZATION_RETRY_EXHAUSTED');
  }
}
