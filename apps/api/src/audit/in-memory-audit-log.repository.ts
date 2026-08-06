import type {
  AppendAuditLogCommand,
  AuditLogQuery,
  AuditLogRecord,
  AuditLogRepository,
} from './audit-log.repository.js';
import { assertAuditRequestId, sanitizeAuditSnapshot } from './audit-log.policy.js';

interface InMemoryAuditLogOptions {
  readonly failAppend?: boolean;
}

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly events: AuditLogRecord[] = [];
  private readonly failAppend: boolean;

  constructor(options: InMemoryAuditLogOptions = {}) {
    this.failAppend = options.failAppend ?? false;
  }

  async append(command: AppendAuditLogCommand): Promise<AuditLogRecord> {
    if (this.failAppend) throw new Error('AUDIT_APPEND_FAILED');
    const event: AuditLogRecord = {
      ...clone(command),
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
