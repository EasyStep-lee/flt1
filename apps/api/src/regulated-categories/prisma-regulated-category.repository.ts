import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  DisableRegulatedCategoryCommand,
  EnableRegulatedCategoryCommand,
  RegulatedCategoryControlRecord,
  RegulatedCategoryMutationResult,
  RegulatedCategoryRepository,
} from './regulated-category.repository.js';

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const qualification = (value: Prisma.JsonValue): RegulatedCategoryControlRecord['companyQualificationSnapshot'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('REGULATED_CATEGORY_QUALIFICATION_INVALID');
  }
  const input = value as Record<string, Prisma.JsonValue>;
  if (input.schemaVersion !== '1.0' || !Array.isArray(input.references)) {
    throw new Error('REGULATED_CATEGORY_QUALIFICATION_INVALID');
  }
  const references = input.references.map((reference) => {
    if (typeof reference !== 'string') {
      throw new Error('REGULATED_CATEGORY_QUALIFICATION_INVALID');
    }
    return reference;
  });
  return { schemaVersion: '1.0', references };
};

const toRecord = (value: {
  readonly id: string;
  readonly companyId: string;
  readonly categoryId: string;
  readonly status: 'DISABLED' | 'ENABLED';
  readonly companyQualificationSnapshot: Prisma.JsonValue;
  readonly companyQualificationValidUntil: Date | null;
  readonly version: number;
  readonly enabledAt: Date | null;
  readonly disabledAt: Date | null;
}): RegulatedCategoryControlRecord => ({
  id: value.id,
  companyId: value.companyId,
  categoryId: value.categoryId,
  status: value.status,
  companyQualificationSnapshot: qualification(value.companyQualificationSnapshot),
  qualificationValidUntil: value.companyQualificationValidUntil?.toISOString() ?? null,
  version: value.version,
  enabledAt: value.enabledAt?.toISOString() ?? null,
  disabledAt: value.disabledAt?.toISOString() ?? null,
});

@Injectable()
export class PrismaRegulatedCategoryRepository implements RegulatedCategoryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(companyId: string): Promise<readonly RegulatedCategoryControlRecord[]> {
    const values = await this.prisma.regulatedCategoryControl.findMany({
      where: { companyId },
      orderBy: [{ status: 'desc' }, { categoryId: 'asc' }],
    });
    return values.map(toRecord);
  }

  async find(companyId: string, categoryId: string): Promise<RegulatedCategoryControlRecord | null> {
    const value = await this.prisma.regulatedCategoryControl.findFirst({
      where: { companyId, categoryId },
    });
    return value ? toRecord(value) : null;
  }

  enable(command: EnableRegulatedCategoryCommand): Promise<RegulatedCategoryMutationResult> {
    const scope = `ENABLE:${command.companyId}:${command.categoryId}`;
    return this.mutate(scope, command, async (tx) => {
      await tx.$queryRaw`SELECT id FROM category WHERE id = ${command.categoryId} FOR UPDATE`;
      const current = await tx.regulatedCategoryControl.findFirst({
        where: { companyId: command.companyId, categoryId: command.categoryId },
      });
      if ((current?.version ?? 0) !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
      const now = new Date();
      const data = {
        status: 'ENABLED' as const,
        companyQualificationSnapshot: json({
          schemaVersion: '1.0',
          references: command.companyQualificationReferences,
        }),
        companyQualificationValidUntil: new Date(command.qualificationValidUntil),
        enabledAt: now,
        disabledAt: null,
        version: (current?.version ?? 0) + 1,
      };
      const stored = current
        ? await tx.regulatedCategoryControl.update({ where: { id: current.id }, data })
        : await tx.regulatedCategoryControl.create({
            data: {
              id: randomUUID(),
              companyId: command.companyId,
              categoryId: command.categoryId,
              ...data,
            },
          });
      const value = toRecord(stored);
      await this.appendHistory(tx, command, value, 'ENABLE');
      await this.appendAudit(tx, command, value, 'REGULATED_CATEGORY_ENABLED', current ? toRecord(current) : null);
      return { kind: 'OK', replayed: false, value };
    });
  }

  disable(command: DisableRegulatedCategoryCommand): Promise<RegulatedCategoryMutationResult> {
    const scope = `DISABLE:${command.companyId}:${command.categoryId}`;
    return this.mutate(scope, command, async (tx) => {
      await tx.$queryRaw`SELECT id FROM category WHERE id = ${command.categoryId} FOR UPDATE`;
      const current = await tx.regulatedCategoryControl.findFirst({
        where: { companyId: command.companyId, categoryId: command.categoryId },
      });
      if (!current) return { kind: 'CONTROL_NOT_FOUND' };
      if (current.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
      const stored = await tx.regulatedCategoryControl.update({
        where: { id: current.id },
        data: {
          status: 'DISABLED',
          enabledAt: null,
          disabledAt: new Date(),
          version: { increment: 1 },
        },
      });
      const value = toRecord(stored);
      await this.appendHistory(tx, command, value, 'DISABLE');
      await this.appendAudit(tx, command, value, 'REGULATED_CATEGORY_DISABLED', toRecord(current));
      return { kind: 'OK', replayed: false, value };
    });
  }

  private async mutate(
    scope: string,
    command: { readonly idempotencyKey: string; readonly requestHash: string },
    operation: (tx: Prisma.TransactionClient) => Promise<RegulatedCategoryMutationResult>,
  ): Promise<RegulatedCategoryMutationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await tx.regulatedCategoryControlCommand.findUnique({
          where: { scope_idempotencyKey: { scope, idempotencyKey: command.idempotencyKey } },
        });
        if (replay) {
          return replay.requestHash === command.requestHash
            ? {
                kind: 'OK',
                replayed: true,
                value: replay.responseSnapshot as unknown as RegulatedCategoryControlRecord,
              }
            : { kind: 'IDEMPOTENCY_CONFLICT' };
        }
        const result = await operation(tx);
        if (result.kind !== 'OK') return result;
        await tx.regulatedCategoryControlCommand.create({
          data: {
            scope,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            responseSnapshot: json(result.value),
          },
        });
        return result;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.regulatedCategoryControlCommand.findUnique({
          where: { scope_idempotencyKey: { scope, idempotencyKey: command.idempotencyKey } },
        });
        if (replay) {
          return replay.requestHash === command.requestHash
            ? {
                kind: 'OK',
                replayed: true,
                value: replay.responseSnapshot as unknown as RegulatedCategoryControlRecord,
              }
            : { kind: 'IDEMPOTENCY_CONFLICT' };
        }
        return { kind: 'VERSION_CONFLICT' };
      }
      if (error instanceof Error && error.message.includes('REGULATED_CATEGORY_TARGET_INVALID')) {
        return { kind: 'CATEGORY_TEMPLATE_INVALID' };
      }
      return { kind: 'AUDIT_REQUIRED' };
    }
  }

  private appendHistory(
    tx: Prisma.TransactionClient,
    command: EnableRegulatedCategoryCommand | DisableRegulatedCategoryCommand,
    value: RegulatedCategoryControlRecord,
    event: 'DISABLE' | 'ENABLE',
  ) {
    return tx.regulatedCategoryControlHistory.create({
      data: {
        id: randomUUID(),
        controlId: value.id,
        companyId: value.companyId,
        categoryId: value.categoryId,
        event,
        version: value.version,
        snapshot: json({
          categoryId: value.categoryId,
          status: value.status,
          companyQualificationReferenceCount: value.companyQualificationSnapshot.references.length,
          qualificationValidUntil: value.qualificationValidUntil,
          version: value.version,
        }),
        actorIdentityId: command.actorIdentityId,
        functionalAccountId: command.functionalAccountId,
        requestId: command.requestId,
      },
    });
  }

  private appendAudit(
    tx: Prisma.TransactionClient,
    command: EnableRegulatedCategoryCommand | DisableRegulatedCategoryCommand,
    value: RegulatedCategoryControlRecord,
    action: string,
    before: RegulatedCategoryControlRecord | null,
  ) {
    return tx.auditLog.create({
      data: {
        actorType: 'COMPANY_USER',
        actorId: command.actorIdentityId,
        functionalAccountId: command.functionalAccountId,
        action,
        objectType: 'REGULATED_CATEGORY_CONTROL',
        objectId: value.id,
        beforeSnapshot: json(before),
        afterSnapshot: json({
          categoryId: value.categoryId,
          status: value.status,
          companyQualificationReferenceCount: value.companyQualificationSnapshot.references.length,
          qualificationValidUntil: value.qualificationValidUntil,
          version: value.version,
        }),
        requestId: command.requestId,
        ip: command.ip,
      },
    });
  }
}
