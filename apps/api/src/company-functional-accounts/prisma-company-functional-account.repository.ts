import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@fulishe/db';

import { assertAuditRequestId, sanitizeAuditSnapshot } from '../audit/audit-log.policy.js';
import { resolveCompanyWorkspace } from '../company-auth/company-workspace.policy.js';
import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  CompanyFunctionalAccountCreateResult,
  CompanyFunctionalAccountListQuery,
  CompanyFunctionalAccountRecord,
  CompanyFunctionalAccountRepository,
  CreateCompanyFunctionalAccountCommand,
} from './company-functional-account.repository.js';

type TransactionClient = Prisma.TransactionClient;

const asInputJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const parseStoredResult = (
  value: Prisma.JsonValue,
): CompanyFunctionalAccountRecord =>
  structuredClone(value) as unknown as CompanyFunctionalAccountRecord;

const accountInclude = {
  accountType: { select: { code: true } },
} satisfies Prisma.FunctionalAccountInclude;

const toRecord = (
  account: {
    readonly accountType: { readonly code: string };
    readonly companyId: string | null;
    readonly displayName: string;
    readonly expiresAt: Date | null;
    readonly id: string;
    readonly identityId: string;
    readonly status: CompanyFunctionalAccountRecord['status'];
    readonly version: number;
  },
  user: {
    readonly email: string;
    readonly lastLoginAt: Date;
    readonly mobile: string;
  },
): CompanyFunctionalAccountRecord => {
  const workspace = resolveCompanyWorkspace(account.accountType.code);
  if (!account.companyId || !workspace) {
    throw new Error('COMPANY_FUNCTIONAL_ACCOUNT_OWNER_INVALID');
  }
  return {
    accountTypeCode: workspace.accountTypeCode,
    companyId: account.companyId,
    displayName: account.displayName,
    email: user.email,
    expiresAt: account.expiresAt?.toISOString() ?? null,
    id: account.id,
    identityId: account.identityId,
    lastLoginAt: user.lastLoginAt.toISOString(),
    mobile: user.mobile,
    status: account.status,
    version: account.version,
  };
};

@Injectable()
export class PrismaCompanyFunctionalAccountRepository
  implements CompanyFunctionalAccountRepository
{
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async replay(
    database: TransactionClient,
    scope: string,
    command: CreateCompanyFunctionalAccountCommand,
  ): Promise<CompanyFunctionalAccountCreateResult | null> {
    const stored = await database.functionalAccountCommand.findUnique({
      where: {
        scope_idempotencyKey: {
          idempotencyKey: command.idempotencyKey,
          scope,
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

  async createCompanyAccount(
    command: CreateCompanyFunctionalAccountCommand,
  ): Promise<CompanyFunctionalAccountCreateResult> {
    const scope = `CREATE:COMPANY:${command.companyId}:${command.actorIdentityId}`;
    return this.prisma
      .$transaction(async (database) => {
        const replay = await this.replay(database, scope, command);
        if (replay) return replay;
        const accountType = await database.functionalAccountType.findUnique({
          where: {
            ownerType_code: {
              code: command.accountTypeCode,
              ownerType: 'COMPANY',
            },
          },
        });
        if (!accountType || accountType.status !== 'ACTIVE') {
          return { kind: 'DUPLICATE' } as const;
        }
        const existingUser = await database.companyUser.findFirst({
          where: {
            companyId: command.companyId,
            OR: [{ mobile: command.mobile }, { email: command.email }],
          },
          orderBy: { id: 'asc' },
        });
        const user =
          existingUser ??
          (await database.companyUser.create({
            data: {
              companyId: command.companyId,
              email: command.email,
              id: command.identityId,
              mobile: command.mobile,
              name: command.displayName,
            },
          }));
        const duplicate = await database.functionalAccount.findUnique({
          where: {
            companyId_identityId_accountTypeId: {
              accountTypeId: accountType.id,
              companyId: command.companyId,
              identityId: user.id,
            },
          },
        });
        if (duplicate) return { kind: 'DUPLICATE' } as const;
        const created = await database.functionalAccount.create({
          data: {
            accountTypeId: accountType.id,
            companyId: command.companyId,
            displayName: command.displayName,
            expiresAt: command.expiresAt ? new Date(command.expiresAt) : null,
            identityId: user.id,
            identityType: 'COMPANY_USER',
            ownerType: 'COMPANY',
          },
          include: accountInclude,
        });
        const result = toRecord(created, user);
        await database.functionalAccountStatusHistory.create({
          data: {
            actorIdentityId: command.actorIdentityId,
            event: 'INVITE',
            fromStatus: null,
            functionalAccountId: created.id,
            toStatus: 'PENDING_ACTIVATION',
            version: 0,
          },
        });
        await database.functionalAccountCommand.create({
          data: {
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            responseSnapshot: asInputJson(result),
            scope,
          },
        });
        try {
          await database.auditLog.create({
            data: {
              action: 'functional_account.invited',
              actorId: command.actorIdentityId,
              actorType: 'COMPANY_USER',
              functionalAccountId: command.actorFunctionalAccountId,
              afterSnapshot: asInputJson(
                sanitizeAuditSnapshot({
                  accountTypeCode: result.accountTypeCode,
                  displayName: result.displayName,
                  status: result.status,
                }),
              ),
              beforeSnapshot: asInputJson({ status: null }),
              ip: command.ip,
              objectId: result.id,
              objectType: 'functional_account',
              requestId: assertAuditRequestId(command.requestId),
            },
          });
        } catch {
          throw new Error('AUDIT_APPEND_REQUIRED');
        }
        return { kind: 'OK', replayed: false, value: result } as const;
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === 'AUDIT_APPEND_REQUIRED') {
          return { kind: 'AUDIT_REQUIRED' } as const;
        }
        throw error;
      });
  }

  async findCompanyAccountByMobile(
    companyId: string,
    mobile: string,
  ): Promise<CompanyFunctionalAccountRecord | null> {
    const user = await this.prisma.companyUser.findUnique({
      where: { companyId_mobile: { companyId, mobile } },
    });
    if (!user) return null;
    const account = await this.prisma.functionalAccount.findFirst({
      where: {
        companyId,
        identityId: user.id,
        identityType: 'COMPANY_USER',
        ownerType: 'COMPANY',
      },
      orderBy: { createdAt: 'asc' },
      include: accountInclude,
    });
    return account ? toRecord(account, user) : null;
  }

  async isCompanyActive(companyId: string): Promise<boolean> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { status: true },
    });
    return company?.status === 'ACTIVE';
  }

  async listCompanyAccounts(query: CompanyFunctionalAccountListQuery): Promise<{
    readonly items: readonly CompanyFunctionalAccountRecord[];
    readonly total: number;
  }> {
    const where = {
      companyId: query.companyId,
      identityType: 'COMPANY_USER',
      ownerType: 'COMPANY',
      ...(query.accountTypeCode
        ? { accountType: { code: query.accountTypeCode, ownerType: 'COMPANY' } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { displayName: { contains: query.keyword } } : {}),
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
    const users = await this.prisma.companyUser.findMany({
      where: { id: { in: accounts.map(({ identityId }) => identityId) } },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    return {
      items: accounts.map((account) => {
        const user = usersById.get(account.identityId);
        if (!user) throw new Error('COMPANY_FUNCTIONAL_ACCOUNT_IDENTITY_MISSING');
        return toRecord(account, user);
      }),
      total,
    };
  }
}
