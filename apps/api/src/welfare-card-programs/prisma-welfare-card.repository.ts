import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  CreateWelfareBatchCommand,
  CreateWelfareProgramCommand,
  WelfareBatchRecord,
  WelfareCardRepository,
  WelfareMutationResult,
  WelfareProgramRecord,
} from './welfare-card.repository.js';

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
}
