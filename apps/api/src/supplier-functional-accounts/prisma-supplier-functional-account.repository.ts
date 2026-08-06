import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import { assertAuditRequestId, sanitizeAuditSnapshot } from '../audit/audit-log.policy.js';
import { resolveSupplierAccountType } from './supplier-functional-account.policy.js';
import type {
  CreateSupplierFunctionalAccountCommand,
  FunctionalAccountCreateResult,
  FunctionalAccountListQuery,
  SupplierFunctionalAccountRecord,
  SupplierFunctionalAccountRepository,
} from './supplier-functional-account.repository.js';

type TransactionClient = Prisma.TransactionClient;

const asInputJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const parseStoredResult = (
  value: Prisma.JsonValue,
): SupplierFunctionalAccountRecord =>
  structuredClone(value) as unknown as SupplierFunctionalAccountRecord;

const toRecord = (
  account: {
  readonly accountType: { readonly code: string };
  readonly displayName: string;
  readonly expiresAt: Date | null;
  readonly id: string;
  readonly identityId: string;
  readonly status: SupplierFunctionalAccountRecord['status'];
    readonly supplierId: string | null;
    readonly version: number;
  },
  supplierUser: {
    readonly email: string | null;
    readonly lastLoginAt: Date | null;
    readonly mobile: string;
  },
): SupplierFunctionalAccountRecord => {
  if (!account.supplierId) throw new Error('SUPPLIER_FUNCTIONAL_ACCOUNT_OWNER_INVALID');
  const accountType = resolveSupplierAccountType(account.accountType.code);
  return {
    id: account.id,
    identityId: account.identityId,
    supplierId: account.supplierId,
    accountTypeCode: accountType.code,
    displayName: account.displayName,
    mobile: supplierUser.mobile,
    email: supplierUser.email,
    status: account.status,
    expiresAt: account.expiresAt?.toISOString() ?? null,
    lastLoginAt: supplierUser.lastLoginAt?.toISOString() ?? null,
    version: account.version,
  };
};

const accountInclude = {
  accountType: { select: { code: true } },
} satisfies Prisma.FunctionalAccountInclude;

@Injectable()
export class PrismaSupplierFunctionalAccountRepository
  implements SupplierFunctionalAccountRepository
{
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async replay(
    database: TransactionClient,
    scope: string,
    command: CreateSupplierFunctionalAccountCommand,
  ): Promise<FunctionalAccountCreateResult | null> {
    const stored = await database.functionalAccountCommand.findUnique({
      where: {
        scope_idempotencyKey: {
          scope,
          idempotencyKey: command.idempotencyKey,
        },
      },
      select: { requestHash: true, responseSnapshot: true },
    });
    if (!stored) return null;
    if (stored.requestHash !== command.requestHash) {
      return { kind: 'IDEMPOTENCY_CONFLICT' };
    }
    return {
      kind: 'OK',
      replayed: true,
      value: parseStoredResult(stored.responseSnapshot),
    };
  }

  async createAccount(
    command: CreateSupplierFunctionalAccountCommand,
  ): Promise<FunctionalAccountCreateResult> {
    const scope = `CREATE:SUPPLIER:${command.supplierId}:${command.actorIdentityId}`;
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay(database, scope, command);
      if (replay) return replay;
      const accountType = await database.functionalAccountType.findUnique({
        where: {
          ownerType_code: {
            ownerType: 'SUPPLIER',
            code: command.accountTypeCode,
          },
        },
      });
      if (!accountType || accountType.status !== 'ACTIVE') {
        return { kind: 'DUPLICATE' } as const;
      }
      const existingUser = await database.supplierUser.findUnique({
        where: {
          supplierId_mobile: {
            supplierId: command.supplierId,
            mobile: command.mobile,
          },
        },
      });
      const user =
        existingUser ??
        (await database.supplierUser.create({
          data: {
            id: command.identityId,
            supplierId: command.supplierId,
            name: command.displayName,
            mobile: command.mobile,
            email: command.email,
          },
        }));
      const duplicate = await database.functionalAccount.findUnique({
        where: {
          supplierId_identityId_accountTypeId: {
            supplierId: command.supplierId,
            identityId: user.id,
            accountTypeId: accountType.id,
          },
        },
      });
      if (duplicate) {
        return { kind: 'DUPLICATE' } as const;
      }
      const created = await database.functionalAccount.create({
        data: {
          identityType: 'SUPPLIER_USER',
          identityId: user.id,
          ownerType: 'SUPPLIER',
          supplierId: command.supplierId,
          accountTypeId: accountType.id,
          displayName: command.displayName,
          expiresAt: command.expiresAt ? new Date(command.expiresAt) : null,
        },
        include: accountInclude,
      });
      const result = toRecord(created, user);
      await database.functionalAccountStatusHistory.create({
        data: {
          functionalAccountId: created.id,
          fromStatus: null,
          toStatus: 'PENDING_ACTIVATION',
          event: 'INVITE',
          actorIdentityId: command.actorIdentityId,
          version: 0,
        },
      });
      await database.functionalAccountCommand.create({
        data: {
          scope,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          responseSnapshot: asInputJson(result),
        },
      });
      try {
        await database.auditLog.create({
          data: {
            actorType: 'SUPPLIER_USER',
            actorId: command.actorIdentityId,
            action: 'functional_account.invited',
            objectType: 'functional_account',
            objectId: result.id,
            beforeSnapshot: asInputJson({ status: null }),
            afterSnapshot: asInputJson(
              sanitizeAuditSnapshot({
                accountTypeCode: result.accountTypeCode,
                displayName: result.displayName,
                status: result.status,
              }),
            ),
            requestId: assertAuditRequestId(command.requestId),
            ip: command.ip,
          },
        });
      } catch {
        throw new Error('AUDIT_APPEND_REQUIRED');
      }
      return { kind: 'OK', replayed: false, value: result } as const;
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === 'AUDIT_APPEND_REQUIRED') {
        return { kind: 'AUDIT_REQUIRED' } as const;
      }
      throw error;
    });
  }

  async findAccount(
    supplierId: string,
    functionalAccountId: string,
  ): Promise<SupplierFunctionalAccountRecord | null> {
    const account = await this.prisma.functionalAccount.findFirst({
      where: { id: functionalAccountId, ownerType: 'SUPPLIER', supplierId },
      include: accountInclude,
    });
    if (!account) return null;
    const user = await this.prisma.supplierUser.findUnique({
      where: { id: account.identityId },
      select: { email: true, lastLoginAt: true, mobile: true },
    });
    return user ? toRecord(account, user) : null;
  }

  async findAccountByMobile(
    supplierId: string,
    mobile: string,
  ): Promise<SupplierFunctionalAccountRecord | null> {
    const user = await this.prisma.supplierUser.findUnique({
      where: {
        supplierId_mobile: { supplierId, mobile },
      },
      select: { email: true, id: true, lastLoginAt: true, mobile: true },
    });
    if (!user) return null;
    const account = await this.prisma.functionalAccount.findFirst({
      where: { identityId: user.id, ownerType: 'SUPPLIER', supplierId },
      orderBy: { createdAt: 'asc' },
      include: accountInclude,
    });
    return account ? toRecord(account, user) : null;
  }

  async isSupplierActive(supplierId: string): Promise<boolean> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { status: true },
    });
    return supplier?.status === 'ACTIVE';
  }

  async listAccounts(query: FunctionalAccountListQuery): Promise<{
    readonly items: readonly SupplierFunctionalAccountRecord[];
    readonly total: number;
  }> {
    const where = {
      ownerType: 'SUPPLIER',
      supplierId: query.supplierId,
      ...(query.accountTypeCode
        ? { accountType: { code: query.accountTypeCode, ownerType: 'SUPPLIER' } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? { displayName: { contains: query.keyword } }
        : {}),
    } satisfies Prisma.FunctionalAccountWhereInput;
    const [accounts, total] = await this.prisma.$transaction([
      this.prisma.functionalAccount.findMany({
        where,
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: accountInclude,
      }),
      this.prisma.functionalAccount.count({ where }),
    ]);
    const users = await this.prisma.supplierUser.findMany({
      where: { id: { in: accounts.map(({ identityId }) => identityId) } },
      select: { email: true, id: true, lastLoginAt: true, mobile: true },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    return {
      items: accounts.map((account) => {
        const user = usersById.get(account.identityId);
        if (!user) throw new Error('SUPPLIER_FUNCTIONAL_ACCOUNT_IDENTITY_MISSING');
        return toRecord(account, user);
      }),
      total,
    };
  }
}
