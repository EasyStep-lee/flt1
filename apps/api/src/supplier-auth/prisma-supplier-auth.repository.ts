import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  IssueSupplierSessionCommand,
  IssueSupplierSessionResult,
  ResolveSupplierSessionResult,
  SupplierAuthRepository,
  SupplierAuthSessionRecord,
  SupplierFunctionalAccountRecord,
  SupplierLoginAuditRecord,
  SupplierSelectionGrantRecord,
  SupplierUserRecord,
} from './supplier-auth.repository.js';

type TransactionClient = Prisma.TransactionClient;

const asInputJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const toUser = (user: {
  readonly email: string | null;
  readonly id: string;
  readonly lastLoginAt: Date | null;
  readonly mobile: string;
  readonly name: string;
  readonly status: SupplierUserRecord['status'];
  readonly supplier: { readonly status: SupplierUserRecord['supplierStatus'] };
  readonly supplierId: string;
  readonly version: number;
}): SupplierUserRecord => ({
  email: user.email,
  id: user.id,
  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  mobile: user.mobile,
  name: user.name,
  status: user.status,
  supplierId: user.supplierId,
  supplierStatus: user.supplier.status,
  version: user.version,
});

const toAccount = (account: {
  readonly accountType: {
    readonly code: string;
    readonly name: string;
    readonly status: SupplierFunctionalAccountRecord['accountTypeStatus'];
    readonly workspaceRoute: string;
  };
  readonly authSessions: readonly { readonly createdAt: Date }[];
  readonly displayName: string;
  readonly expiresAt: Date | null;
  readonly id: string;
  readonly identityId: string;
  readonly status: SupplierFunctionalAccountRecord['status'];
  readonly supplier: { readonly legalName: string } | null;
  readonly supplierId: string | null;
}): SupplierFunctionalAccountRecord => {
  if (!account.supplierId || !account.supplier) {
    throw new Error('SUPPLIER_FUNCTIONAL_ACCOUNT_OWNER_INVALID');
  }
  return {
    accountTypeCode: account.accountType.code,
    accountTypeName: account.accountType.name,
    accountTypeStatus: account.accountType.status,
    displayName: account.displayName,
    expiresAt: account.expiresAt?.toISOString() ?? null,
    id: account.id,
    identityId: account.identityId,
    lastUsedAt: account.authSessions[0]?.createdAt.toISOString() ?? null,
    ownerDisplayName: account.supplier.legalName,
    ownerType: 'SUPPLIER',
    status: account.status,
    supplierId: account.supplierId,
    workspaceRoute: account.accountType.workspaceRoute,
  };
};

const accountInclude = {
  accountType: {
    select: {
      code: true,
      name: true,
      ownerType: true,
      status: true,
      workspaceRoute: true,
    },
  },
  authSessions: {
    orderBy: { createdAt: 'desc' as const },
    select: { createdAt: true },
    take: 1,
  },
  supplier: { select: { legalName: true } },
} satisfies Prisma.FunctionalAccountInclude;

const toSession = (session: {
  readonly expiresAt: Date;
  readonly functionalAccount: {
    readonly accountType: { readonly code: string };
    readonly supplierId: string | null;
  };
  readonly functionalAccountId: string;
  readonly id: string;
  readonly revokedAt: Date | null;
  readonly userId: string;
  readonly workspaceRoute: string;
}): SupplierAuthSessionRecord => {
  if (!session.functionalAccount.supplierId) {
    throw new Error('SUPPLIER_AUTH_SESSION_OWNER_INVALID');
  }
  return {
    accountTypeCode: session.functionalAccount.accountType.code,
    expiresAt: session.expiresAt.toISOString(),
    functionalAccountId: session.functionalAccountId,
    id: session.id,
    ownerType: 'SUPPLIER',
    revokedAt: session.revokedAt?.toISOString() ?? null,
    supplierId: session.functionalAccount.supplierId,
    userId: session.userId,
    workspaceRoute: session.workspaceRoute,
  };
};

const sessionInclude = {
  functionalAccount: {
    select: {
      accountType: { select: { code: true } },
      supplierId: true,
    },
  },
} satisfies Prisma.AuthSessionInclude;

const activeSessionInclude = {
  functionalAccount: {
    include: {
      accountType: {
        select: { code: true, ownerType: true, status: true, workspaceRoute: true },
      },
      supplier: { select: { status: true } },
    },
  },
} satisfies Prisma.AuthSessionInclude;

@Injectable()
export class PrismaSupplierAuthRepository implements SupplierAuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  countRecentLoginFailures(loginAccountHash: string, since: string): Promise<number> {
    return this.prisma.loginAudit.count({
      where: {
        loginAccountHash,
        occurredAt: { gte: new Date(since) },
        result: 'AUTH_INVALID',
      },
    });
  }

  async createSelectionGrant(record: SupplierSelectionGrantRecord): Promise<void> {
    const data = {
      expiresAt: new Date(record.expiresAt),
      nonceHash: record.nonceHash,
      requestId: record.requestId,
      secondVerificationRequired: record.secondVerificationRequired,
      selectedAccountId: record.selectedAccountId,
      selectedSessionId: record.selectedSessionId,
      usedAt: record.usedAt ? new Date(record.usedAt) : null,
      userId: record.userId,
    };
    await this.prisma.supplierAuthSelection.upsert({
      where: {
        userId_requestId: { requestId: record.requestId, userId: record.userId },
      },
      create: data,
      update: {},
    });
  }

  async findSupplierUser(loginAccount: string): Promise<SupplierUserRecord | null> {
    const users = await this.prisma.supplierUser.findMany({
      where: { OR: [{ email: loginAccount }, { mobile: loginAccount }] },
      orderBy: { id: 'asc' },
      take: 2,
      include: { supplier: { select: { status: true } } },
    });
    return users.length === 1 ? toUser(users[0]!) : null;
  }

  async issueSession(
    command: IssueSupplierSessionCommand,
  ): Promise<IssueSupplierSessionResult> {
    return this.prisma.$transaction(async (database: TransactionClient) => {
      const now = new Date();
      await database.$queryRaw(
        Prisma.sql`SELECT id FROM supplier_user WHERE id = ${command.userId} FOR UPDATE`,
      );
      const user = await database.supplierUser.findUnique({
        where: { id: command.userId },
        include: { supplier: { select: { status: true } } },
      });
      await database.$queryRaw(
        Prisma.sql`SELECT id FROM functional_account WHERE id = ${command.account.id} FOR UPDATE`,
      );
      const storedAccount = await database.functionalAccount.findUnique({
        where: { id: command.account.id },
        include: accountInclude,
      });
      if (
        !user ||
        user.status !== 'ACTIVE' ||
        user.supplier.status !== 'ACTIVE' ||
        !storedAccount ||
        storedAccount.identityType !== 'SUPPLIER_USER' ||
        storedAccount.identityId !== command.userId ||
        storedAccount.ownerType !== 'SUPPLIER' ||
        storedAccount.supplierId !== user.supplierId ||
        storedAccount.status !== 'ACTIVE' ||
        storedAccount.accountType.ownerType !== 'SUPPLIER' ||
        storedAccount.accountType.status !== 'ACTIVE' ||
        (storedAccount.expiresAt !== null && storedAccount.expiresAt <= now)
      ) {
        return { kind: 'GRANT_INVALID' } as const;
      }
      const account = toAccount(storedAccount);
      if (command.nonceHash) {
        const grant = await database.supplierAuthSelection.findUnique({
          where: { nonceHash: command.nonceHash },
        });
        if (!grant || grant.userId !== command.userId || grant.expiresAt <= now) {
          return { kind: 'GRANT_INVALID' } as const;
        }
        if (grant.usedAt) {
          if (grant.selectedAccountId !== command.account.id || !grant.selectedSessionId) {
            return { kind: 'CONFLICT' } as const;
          }
          const session = await database.authSession.findUnique({
            where: { id: grant.selectedSessionId },
            include: sessionInclude,
          });
          return session &&
            session.userId === command.userId &&
            session.userType === 'SUPPLIER_USER' &&
            session.functionalAccountId === account.id &&
            !session.revokedAt &&
            session.expiresAt > now
            ? ({ kind: 'OK', replayed: true, session: toSession(session) } as const)
            : ({ kind: 'GRANT_INVALID' } as const);
        }
      }

      const sessionId = randomUUID();
      if (command.nonceHash) {
        const claimed = await database.supplierAuthSelection.updateMany({
          where: {
            nonceHash: command.nonceHash,
            usedAt: null,
            userId: command.userId,
          },
          data: {
            selectedAccountId: account.id,
            selectedSessionId: sessionId,
            usedAt: now,
          },
        });
        if (claimed.count !== 1) return { kind: 'CONFLICT' } as const;
      }
      await database.authSession.updateMany({
        where: {
          expiresAt: { gt: now },
          revokedAt: null,
          userId: command.userId,
          userType: 'SUPPLIER_USER',
        },
        data: { revokedAt: now },
      });
      const created = await database.authSession.create({
        data: {
          deviceInfo: asInputJson(command.deviceInfo),
          expiresAt: new Date(command.expiresAt),
          functionalAccountId: account.id,
          id: sessionId,
          ip: command.ip.slice(0, 45),
          sessionHash: command.sessionHash,
          userId: command.userId,
          userType: 'SUPPLIER_USER',
          workspaceRoute: account.workspaceRoute,
        },
        include: sessionInclude,
      });
      return { kind: 'OK', replayed: false, session: toSession(created) } as const;
    });
  }

  async listSupplierAccounts(
    userId: string,
  ): Promise<readonly SupplierFunctionalAccountRecord[]> {
    const accounts = await this.prisma.functionalAccount.findMany({
      where: {
        identityId: userId,
        identityType: 'SUPPLIER_USER',
        ownerType: 'SUPPLIER',
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      include: accountInclude,
    });
    return accounts.map(toAccount);
  }

  async markLoginSucceeded(userId: string, occurredAt: string): Promise<void> {
    await this.prisma.supplierUser.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(occurredAt) },
    });
  }

  async recordLoginAudit(record: SupplierLoginAuditRecord): Promise<void> {
    await this.prisma.loginAudit.create({
      data: {
        deviceInfo: asInputJson(record.deviceInfo),
        functionalAccountId: record.functionalAccountId,
        ip: record.ip.slice(0, 45),
        loginAccountHash: record.loginAccountHash,
        occurredAt: new Date(record.occurredAt),
        result: record.result,
        riskReason: record.riskReason,
        userId: record.userId,
        userType: record.userType,
      },
    });
  }

  async resolveSelectionGrant(
    nonceHash: string,
  ): Promise<SupplierSelectionGrantRecord | null> {
    const grant = await this.prisma.supplierAuthSelection.findUnique({
      where: { nonceHash },
    });
    return grant
      ? {
          expiresAt: grant.expiresAt.toISOString(),
          nonceHash: grant.nonceHash,
          requestId: grant.requestId,
          secondVerificationRequired: grant.secondVerificationRequired,
          selectedAccountId: grant.selectedAccountId,
          selectedSessionId: grant.selectedSessionId,
          usedAt: grant.usedAt?.toISOString() ?? null,
          userId: grant.userId,
        }
      : null;
  }

  async resolveSession(
    sessionHash: string,
    nowValue: string,
  ): Promise<ResolveSupplierSessionResult> {
    const session = await this.prisma.authSession.findUnique({
      where: { sessionHash },
      include: activeSessionInclude,
    });
    if (!session) return { kind: 'MISSING' };
    if (session.revokedAt) return { kind: 'REVOKED' };

    const now = new Date(nowValue);
    const account = session.functionalAccount;
    const user = await this.prisma.supplierUser.findUnique({
      where: { id: session.userId },
      select: { status: true, supplierId: true },
    });
    if (
      session.userType !== 'SUPPLIER_USER' ||
      session.expiresAt <= now ||
      !user ||
      user.status !== 'ACTIVE' ||
      account.identityType !== 'SUPPLIER_USER' ||
      account.identityId !== session.userId ||
      account.ownerType !== 'SUPPLIER' ||
      !account.supplierId ||
      account.supplierId !== user.supplierId ||
      account.supplier?.status !== 'ACTIVE' ||
      account.status !== 'ACTIVE' ||
      (account.expiresAt !== null && account.expiresAt <= now) ||
      account.accountType.ownerType !== 'SUPPLIER' ||
      account.accountType.status !== 'ACTIVE' ||
      account.accountType.workspaceRoute !== session.workspaceRoute
    ) {
      return { kind: 'INVALID' };
    }
    return { kind: 'ACTIVE', session: toSession(session) };
  }
}
