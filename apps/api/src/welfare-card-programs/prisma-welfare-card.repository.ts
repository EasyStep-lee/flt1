import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  BindWelfareCardCommand,
  CreateWelfareBatchCommand,
  CreateWelfareProgramCommand,
  WelfareBatchRecord,
  WelfareCardAccountRecord,
  WelfareCardBindingResult,
  WelfareCardRepository,
  WelfareMutationResult,
  WelfareProgramRecord,
} from './welfare-card.repository.js';
import { verifyWelfareCardSecret } from './welfare-card-secret.js';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
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
  status: row.status as 'ACTIVE',
  version: row.version,
  claimedAt: source.claimedAt.toISOString(),
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
              status: 'ACTIVE',
              version: 0,
            },
          });
          await tx.welfareCardLedger.create({
            data: {
              id: randomUUID(),
              accountId: account.id,
              orderId: null,
              refundId: null,
              businessType: 'CLAIM',
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
