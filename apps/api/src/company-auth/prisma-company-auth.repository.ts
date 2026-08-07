import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  CompanyAuthRepository,
  CompanyAuthSessionRecord,
  CompanyFunctionalAccountRecord,
  CompanyLoginAuditRecord,
  CompanySelectionGrantRecord,
  CompanyUserRecord,
  IssueCompanySessionCommand,
  IssueCompanySessionResult,
  ResolveCompanySessionResult,
} from './company-auth.repository.js';

type TransactionClient = Prisma.TransactionClient;

const asInputJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const toUser = (user: {
  readonly companyId: string;
  readonly email: string;
  readonly id: string;
  readonly lastLoginAt: Date;
  readonly mobile: string;
  readonly name: string;
  readonly status: CompanyUserRecord['status'];
  readonly version: number;
}): CompanyUserRecord => ({
  ...user,
  lastLoginAt: user.lastLoginAt.toISOString(),
});

const toAccount = (account: {
  readonly accountType: { readonly code: string; readonly name: string; readonly workspaceRoute: string };
  readonly authSessions: readonly { readonly createdAt: Date }[];
  readonly company: { readonly legalName: string } | null;
  readonly companyId: string | null;
  readonly displayName: string;
  readonly expiresAt: Date | null;
  readonly id: string;
  readonly identityId: string;
  readonly status: CompanyFunctionalAccountRecord['status'];
}): CompanyFunctionalAccountRecord => {
  if (!account.companyId || !account.company) {
    throw new Error('COMPANY_FUNCTIONAL_ACCOUNT_OWNER_INVALID');
  }
  return {
    accountTypeCode: account.accountType.code,
    accountTypeName: account.accountType.name,
    companyId: account.companyId,
    displayName: account.displayName,
    expiresAt: account.expiresAt?.toISOString() ?? null,
    id: account.id,
    identityId: account.identityId,
    lastUsedAt: account.authSessions[0]?.createdAt.toISOString() ?? null,
    ownerDisplayName: account.company.legalName,
    ownerType: 'COMPANY',
    status: account.status,
    workspaceRoute: account.accountType.workspaceRoute,
  };
};

const accountInclude = {
  accountType: { select: { code: true, name: true, workspaceRoute: true } },
  authSessions: {
    orderBy: { createdAt: 'desc' as const },
    select: { createdAt: true },
    take: 1,
  },
  company: { select: { legalName: true } },
} satisfies Prisma.FunctionalAccountInclude;

const toSession = (session: {
  readonly expiresAt: Date;
  readonly functionalAccount: {
    readonly accountType: { readonly code: string };
    readonly companyId: string | null;
  };
  readonly functionalAccountId: string;
  readonly id: string;
  readonly revokedAt: Date | null;
  readonly userId: string;
  readonly workspaceRoute: string;
}): CompanyAuthSessionRecord => {
  if (!session.functionalAccount.companyId) {
    throw new Error('COMPANY_AUTH_SESSION_OWNER_INVALID');
  }
  return {
    accountTypeCode: session.functionalAccount.accountType.code,
    companyId: session.functionalAccount.companyId,
    expiresAt: session.expiresAt.toISOString(),
    functionalAccountId: session.functionalAccountId,
    id: session.id,
    ownerType: 'COMPANY',
    revokedAt: session.revokedAt?.toISOString() ?? null,
    userId: session.userId,
    workspaceRoute: session.workspaceRoute,
  };
};

const sessionInclude = {
  functionalAccount: {
    select: {
      accountType: { select: { code: true } },
      companyId: true,
    },
  },
} satisfies Prisma.AuthSessionInclude;

const activeSessionInclude = {
  functionalAccount: {
    include: {
      accountType: {
        select: { code: true, ownerType: true, status: true, workspaceRoute: true },
      },
    },
  },
} satisfies Prisma.AuthSessionInclude;

@Injectable()
export class PrismaCompanyAuthRepository implements CompanyAuthRepository {
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

  async createSelectionGrant(record: CompanySelectionGrantRecord): Promise<void> {
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
    await this.prisma.companyAuthSelection.upsert({
      where: {
        userId_requestId: { requestId: record.requestId, userId: record.userId },
      },
      create: data,
      update: {},
    });
  }

  async findCompanyUser(loginAccount: string): Promise<CompanyUserRecord | null> {
    const user = await this.prisma.companyUser.findFirst({
      where: { OR: [{ email: loginAccount }, { mobile: loginAccount }] },
      orderBy: { id: 'asc' },
    });
    return user ? toUser(user) : null;
  }

  async issueSession(
    command: IssueCompanySessionCommand,
  ): Promise<IssueCompanySessionResult> {
    return this.prisma.$transaction(async (database: TransactionClient) => {
      const now = new Date();
      await database.$queryRaw(
        Prisma.sql`SELECT id FROM company_user WHERE id = ${command.userId} FOR UPDATE`,
      );
      const user = await database.companyUser.findUnique({
        where: { id: command.userId },
        select: { companyId: true, status: true },
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
        !storedAccount ||
        storedAccount.identityType !== 'COMPANY_USER' ||
        storedAccount.identityId !== command.userId ||
        storedAccount.ownerType !== 'COMPANY' ||
        storedAccount.companyId !== user.companyId ||
        storedAccount.status !== 'ACTIVE' ||
        (storedAccount.expiresAt !== null && storedAccount.expiresAt <= now)
      ) {
        return { kind: 'GRANT_INVALID' } as const;
      }
      const account = toAccount(storedAccount);
      if (command.nonceHash) {
        const grant = await database.companyAuthSelection.findUnique({
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
            session.userType === 'COMPANY_USER' &&
            session.functionalAccountId === account.id &&
            !session.revokedAt &&
            session.expiresAt > now
            ? ({ kind: 'OK', replayed: true, session: toSession(session) } as const)
            : ({ kind: 'GRANT_INVALID' } as const);
        }
      }

      const sessionId = randomUUID();
      if (command.nonceHash) {
        const claimed = await database.companyAuthSelection.updateMany({
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
          userType: 'COMPANY_USER',
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
          userType: 'COMPANY_USER',
          workspaceRoute: account.workspaceRoute,
        },
        include: sessionInclude,
      });
      return { kind: 'OK', replayed: false, session: toSession(created) } as const;
    });
  }

  async listCompanyAccounts(
    userId: string,
  ): Promise<readonly CompanyFunctionalAccountRecord[]> {
    const accounts = await this.prisma.functionalAccount.findMany({
      where: { identityId: userId, identityType: 'COMPANY_USER', ownerType: 'COMPANY' },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      include: accountInclude,
    });
    return accounts.map(toAccount);
  }

  async markLoginSucceeded(userId: string, occurredAt: string): Promise<void> {
    await this.prisma.companyUser.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(occurredAt) },
    });
  }

  async recordLoginAudit(record: CompanyLoginAuditRecord): Promise<void> {
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

  async resolveSession(
    sessionHash: string,
    nowValue: string,
  ): Promise<ResolveCompanySessionResult> {
    const session = await this.prisma.authSession.findUnique({
      where: { sessionHash },
      include: activeSessionInclude,
    });
    if (!session) return { kind: 'MISSING' };
    if (session.revokedAt) return { kind: 'REVOKED' };

    const now = new Date(nowValue);
    const account = session.functionalAccount;
    const user = await this.prisma.companyUser.findUnique({
      where: { id: session.userId },
      select: { companyId: true, status: true },
    });
    if (
      session.userType !== 'COMPANY_USER' ||
      session.expiresAt <= now ||
      !user ||
      user.status !== 'ACTIVE' ||
      account.identityType !== 'COMPANY_USER' ||
      account.identityId !== session.userId ||
      account.ownerType !== 'COMPANY' ||
      !account.companyId ||
      account.companyId !== user.companyId ||
      account.status !== 'ACTIVE' ||
      (account.expiresAt !== null && account.expiresAt <= now) ||
      account.accountType.ownerType !== 'COMPANY' ||
      account.accountType.status !== 'ACTIVE' ||
      account.accountType.workspaceRoute !== session.workspaceRoute
    ) {
      return { kind: 'INVALID' };
    }
    return { kind: 'ACTIVE', session: toSession(session) };
  }

  async resolveSelectionGrant(
    nonceHash: string,
  ): Promise<CompanySelectionGrantRecord | null> {
    const grant = await this.prisma.companyAuthSelection.findUnique({
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
}
