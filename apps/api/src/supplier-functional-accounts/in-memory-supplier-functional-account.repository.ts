import { InMemoryAuditLogRepository } from '../audit/in-memory-audit-log.repository.js';
import type { AuditLogRepository } from '../audit/audit-log.repository.js';
import type {
  CreateSupplierFunctionalAccountCommand,
  FunctionalAccountCreateResult,
  FunctionalAccountListQuery,
  SupplierFunctionalAccountRecord,
  SupplierFunctionalAccountRepository,
} from './supplier-functional-account.repository.js';

type SupplierStatus = 'ACTIVE' | 'SUSPENDED';

interface InMemoryRepositoryOptions {
  readonly accounts?: readonly SupplierFunctionalAccountRecord[];
  readonly suppliers?: readonly { readonly id: string; readonly status: SupplierStatus }[];
}

const clone = <T>(value: T): T => structuredClone(value);

export class InMemorySupplierFunctionalAccountRepository
  implements SupplierFunctionalAccountRepository
{
  private readonly accounts = new Map<string, SupplierFunctionalAccountRecord>();
  private readonly commands = new Map<
    string,
    { readonly requestHash: string; readonly value: SupplierFunctionalAccountRecord }
  >();
  private readonly suppliers = new Map<string, SupplierStatus>();

  constructor(
    options: InMemoryRepositoryOptions = {},
    private readonly auditRepository: AuditLogRepository =
      new InMemoryAuditLogRepository(),
  ) {
    for (const supplier of options.suppliers ?? []) {
      this.suppliers.set(supplier.id, supplier.status);
    }
    for (const account of options.accounts ?? []) {
      this.accounts.set(account.id, clone(account));
    }
  }

  async createAccount(
    command: CreateSupplierFunctionalAccountCommand,
  ): Promise<FunctionalAccountCreateResult> {
    const commandKey = `${command.supplierId}:${command.actorIdentityId}:${command.idempotencyKey}`;
    const replay = this.commands.get(commandKey);
    if (replay) {
      if (replay.requestHash !== command.requestHash) {
        return { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      return { kind: 'OK', replayed: true, value: clone(replay.value) };
    }
    const duplicate = [...this.accounts.values()].find(
      (account) =>
        account.supplierId === command.supplierId &&
        account.mobile === command.mobile &&
        account.accountTypeCode === command.accountTypeCode &&
        account.status !== 'REVOKED',
    );
    if (duplicate) return { kind: 'DUPLICATE' };
    const value: SupplierFunctionalAccountRecord = {
      id: crypto.randomUUID(),
      identityId: command.identityId,
      supplierId: command.supplierId,
      accountTypeCode: command.accountTypeCode,
      displayName: command.displayName,
      mobile: command.mobile,
      email: command.email,
      status: 'PENDING_ACTIVATION',
      expiresAt: command.expiresAt,
      lastLoginAt: null,
      version: 0,
    };
    try {
      await this.auditRepository.append({
        actorType: 'SUPPLIER_USER',
        actorId: command.actorIdentityId,
        supplierId: command.supplierId,
        functionalAccountId: command.actorFunctionalAccountId,
        action: 'functional_account.invited',
        objectType: 'functional_account',
        objectId: value.id,
        beforeSnapshot: { status: null },
        afterSnapshot: {
          accountTypeCode: value.accountTypeCode,
          displayName: value.displayName,
          status: value.status,
        },
        requestId: command.requestId,
        ip: command.ip,
      });
    } catch {
      return { kind: 'AUDIT_REQUIRED' };
    }
    this.accounts.set(value.id, value);
    this.commands.set(commandKey, { requestHash: command.requestHash, value });
    return { kind: 'OK', replayed: false, value: clone(value) };
  }

  findAccount(
    supplierId: string,
    functionalAccountId: string,
  ): Promise<SupplierFunctionalAccountRecord | null> {
    const account = this.accounts.get(functionalAccountId);
    return Promise.resolve(
      account?.supplierId === supplierId ? clone(account) : null,
    );
  }

  findAccountByMobile(
    supplierId: string,
    mobile: string,
  ): Promise<SupplierFunctionalAccountRecord | null> {
    const account = [...this.accounts.values()].find(
      (candidate) =>
        candidate.supplierId === supplierId && candidate.mobile === mobile,
    );
    return Promise.resolve(account ? clone(account) : null);
  }

  isSupplierActive(supplierId: string): Promise<boolean> {
    return Promise.resolve(this.suppliers.get(supplierId) === 'ACTIVE');
  }

  async listAccounts(query: FunctionalAccountListQuery): Promise<{
    readonly items: readonly SupplierFunctionalAccountRecord[];
    readonly total: number;
  }> {
    const keyword = query.keyword?.toLocaleLowerCase('zh-CN');
    const filtered = [...this.accounts.values()]
      .filter((account) => account.supplierId === query.supplierId)
      .filter(
        (account) =>
          query.accountTypeCode === undefined ||
          account.accountTypeCode === query.accountTypeCode,
      )
      .filter(
        (account) => query.status === undefined || account.status === query.status,
      )
      .filter(
        (account) =>
          keyword === undefined ||
          account.displayName.toLocaleLowerCase('zh-CN').includes(keyword),
      )
      .sort((left, right) =>
        left.displayName.localeCompare(right.displayName, 'zh-CN'),
      );
    const start = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(start, start + query.pageSize).map(clone),
      total: filtered.length,
    };
  }

  countAccounts(supplierId: string): Promise<number> {
    return Promise.resolve(
      [...this.accounts.values()].filter(
        (account) => account.supplierId === supplierId,
      ).length,
    );
  }

  setSupplierStatus(supplierId: string, status: SupplierStatus): void {
    this.suppliers.set(supplierId, status);
  }
}
