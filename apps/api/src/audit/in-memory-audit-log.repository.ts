import type {
  AppendAuditLogCommand,
  AuditLogQuery,
  AuditLogRecord,
  AuditLogRepository,
} from './audit-log.repository.js';
import { assertAuditRequestId, sanitizeAuditSnapshot } from './audit-log.policy.js';

interface InMemoryAuditLogOptions {
  readonly failAppend?: boolean;
  readonly failOnAppendNumber?: number;
}

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly events: AuditLogRecord[] = [];
  private readonly failAppend: boolean;
  private readonly failOnAppendNumber: number | undefined;
  private appendAttempts = 0;

  constructor(options: InMemoryAuditLogOptions = {}) {
    this.failAppend = options.failAppend ?? false;
    this.failOnAppendNumber = options.failOnAppendNumber;
  }

  async append(command: AppendAuditLogCommand): Promise<AuditLogRecord> {
    this.appendAttempts += 1;
    if (
      this.failAppend ||
      this.appendAttempts === this.failOnAppendNumber
    ) {
      throw new Error('AUDIT_APPEND_FAILED');
    }
    const event: AuditLogRecord = {
      ...clone(command),
      supplierId: command.supplierId ?? null,
      functionalAccountId: command.functionalAccountId ?? null,
      beforeSnapshot: sanitizeAuditSnapshot(command.beforeSnapshot),
      afterSnapshot: sanitizeAuditSnapshot(command.afterSnapshot),
      id: crypto.randomUUID(),
      requestId: assertAuditRequestId(command.requestId),
      occurredAt: new Date().toISOString(),
    };
    this.events.push(event);
    return clone(event);
  }

  async list(query: AuditLogQuery) {
    const filtered = [...this.events]
      .filter((event) => query.action === undefined || event.action === query.action)
      .filter(
        (event) =>
          query.objectType === undefined || event.objectType === query.objectType,
      )
      .filter(
        (event) => query.objectId === undefined || event.objectId === query.objectId,
      )
      .filter(
        (event) => query.supplierId === undefined || event.supplierId === query.supplierId,
      )
      .reverse();
    const start = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(start, start + query.pageSize).map(clone),
      total: filtered.length,
    };
  }

  count(): Promise<number> {
    return Promise.resolve(this.events.length);
  }
}
