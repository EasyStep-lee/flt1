import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import { assertAuditRequestId, sanitizeAuditSnapshot } from './audit-log.policy.js';
import type {
  AppendAuditLogCommand,
  AuditLogQuery,
  AuditLogRecord,
  AuditLogRepository,
} from './audit-log.repository.js';

const asInputJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const toRecord = (event: {
  readonly id: string;
  readonly actorType: AuditLogRecord['actorType'];
  readonly actorId: string;
  readonly supplierId: string | null;
  readonly functionalAccountId: string | null;
  readonly action: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly beforeSnapshot: Prisma.JsonValue;
  readonly afterSnapshot: Prisma.JsonValue;
  readonly requestId: string;
  readonly ip: string | null;
  readonly occurredAt: Date;
}): AuditLogRecord => ({
  ...event,
  beforeSnapshot: sanitizeAuditSnapshot(event.beforeSnapshot),
  afterSnapshot: sanitizeAuditSnapshot(event.afterSnapshot),
  occurredAt: event.occurredAt.toISOString(),
});

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async append(command: AppendAuditLogCommand): Promise<AuditLogRecord> {
    const event = await this.prisma.auditLog.create({
      data: {
        ...command,
        requestId: assertAuditRequestId(command.requestId),
        beforeSnapshot: asInputJson(sanitizeAuditSnapshot(command.beforeSnapshot)),
        afterSnapshot: asInputJson(sanitizeAuditSnapshot(command.afterSnapshot)),
      },
    });
    return toRecord(event);
  }

  async list(query: AuditLogQuery) {
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.objectType ? { objectType: query.objectType } : {}),
      ...(query.objectId ? { objectId: query.objectId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    } satisfies Prisma.AuditLogWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }
}
