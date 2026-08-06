export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

export type AuditActorType = 'COMPANY_USER' | 'SUPPLIER_USER' | 'SYSTEM';

export interface AuditLogRecord {
  readonly id: string;
  readonly actorType: AuditActorType;
  readonly actorId: string;
  readonly action: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly beforeSnapshot: unknown;
  readonly afterSnapshot: unknown;
  readonly requestId: string;
  readonly ip: string | null;
  readonly occurredAt: string;
}

export type AppendAuditLogCommand = Omit<AuditLogRecord, 'id' | 'occurredAt'>;

export interface AuditLogQuery {
  readonly action?: string;
  readonly objectType?: string;
  readonly objectId?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface AuditLogRepository {
  append(command: AppendAuditLogCommand): Promise<AuditLogRecord>;
  list(query: AuditLogQuery): Promise<{
    readonly items: readonly AuditLogRecord[];
    readonly total: number;
  }>;
}
