import { describe, expect, it, vi } from 'vitest';

import { PrismaSupplierAuthRepository } from '../../dist/supplier-auth/prisma-supplier-auth.repository.js';

const supplierId = '10000000-0000-4000-8000-000000000069';
const userId = '20000000-0000-4000-8000-000000000069';
const accountId = '30000000-0000-4000-8000-000000000069';

const selection = (overrides = {}) => ({
  expiresAt: '2026-08-07T05:30:00.000Z',
  nonceHash: 'a'.repeat(64),
  requestId: '40000000-0000-4000-8000-000000000069',
  secondVerificationClaimedAt: null,
  secondVerificationClaimId: null,
  secondVerificationRequired: false,
  secondVerifiedAt: null,
  selectedAccountId: null,
  selectedSessionId: null,
  usedAt: null,
  userId,
  ...overrides,
});

const command = {
  account: {
    accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
    accountTypeName: '主体管理',
    accountTypeStatus: 'ACTIVE',
    displayName: '供应商联系人',
    expiresAt: null,
    id: accountId,
    identityId: userId,
    lastUsedAt: null,
    ownerDisplayName: '测试供应商有限公司',
    ownerType: 'SUPPLIER',
    status: 'ACTIVE',
    supplierId,
    workspaceRoute: '/supplier/workspaces/account-admin',
  },
  deviceInfo: {},
  expiresAt: '2099-08-07T06:00:00.000Z',
  ip: '127.0.0.1',
  nonceHash: null,
  sessionId: '50000000-0000-4000-8000-000000000070',
  sessionHash: 'b'.repeat(64),
  userId,
};

describe('Prisma supplier auth repository security boundaries', () => {
  it('serializes second-verification claims with a persistent row lock', async () => {
    let stored = {
      ...selection({ secondVerificationRequired: true }),
      expiresAt: new Date('2099-08-07T05:30:00.000Z'),
      id: '60000000-0000-4000-8000-000000000069',
    };
    const updateMany = vi.fn(async ({ where, data }) => {
      if (
        (where.secondVerificationClaimId !== undefined &&
          where.secondVerificationClaimId !== stored.secondVerificationClaimId) ||
        (where.secondVerifiedAt === null && stored.secondVerifiedAt !== null) ||
        (where.usedAt === null && stored.usedAt !== null)
      ) {
        return { count: 0 };
      }
      stored = { ...stored, ...data };
      return { count: 1 };
    });
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: stored.id }]),
      supplierAuthSelection: {
        findUnique: vi.fn(async () => stored),
        updateMany,
      },
    };
    const repository = new PrismaSupplierAuthRepository({
      $transaction: async (callback) => callback(database),
      supplierAuthSelection: { updateMany },
    });
    const claim = {
      accountId,
      claimId: '70000000-0000-4000-8000-000000000069',
      claimedAt: '2026-08-07T05:00:00.000Z',
      claimStaleBefore: '2026-08-07T04:59:30.000Z',
      nonceHash: 'a'.repeat(64),
      userId,
    };

    await expect(repository.claimSecondVerification(claim)).resolves.toEqual({
      kind: 'CLAIMED',
    });
    await expect(
      repository.claimSecondVerification({
        ...claim,
        claimId: '70000000-0000-4000-8000-000000000070',
        claimedAt: '2026-08-07T05:00:01.000Z',
        claimStaleBefore: '2026-08-07T04:59:31.000Z',
      }),
    ).resolves.toEqual({ kind: 'IN_PROGRESS' });
    await expect(
      repository.completeSecondVerification({
        claimId: claim.claimId,
        nonceHash: claim.nonceHash,
        userId,
        verifiedAt: '2026-08-07T05:00:02.000Z',
      }),
    ).resolves.toBe(true);
    await expect(
      repository.claimSecondVerification({
        ...claim,
        claimId: '70000000-0000-4000-8000-000000000071',
        claimedAt: '2026-08-07T05:00:03.000Z',
        claimStaleBefore: '2026-08-07T04:59:33.000Z',
      }),
    ).resolves.toEqual({ kind: 'VERIFIED' });
    expect(database.$queryRaw).toHaveBeenCalledTimes(3);
    expect(stored).toMatchObject({
      secondVerificationClaimedAt: null,
      secondVerificationClaimId: null,
      secondVerifiedAt: new Date('2026-08-07T05:00:02.000Z'),
      selectedAccountId: accountId,
    });
  });

  it('does not reset a completed selection when login reuses its requestId', async () => {
    let stored = null;
    const prisma = {
      supplierAuthSelection: {
        upsert: async ({ create, update }) => {
          stored = stored ? { ...stored, ...update } : { ...create };
          return stored;
        },
      },
    };
    const repository = new PrismaSupplierAuthRepository(prisma);
    await repository.createSelectionGrant(selection());
    stored = {
      ...stored,
      selectedAccountId: accountId,
      selectedSessionId: '50000000-0000-4000-8000-000000000069',
      usedAt: new Date('2026-08-07T05:00:00.000Z'),
    };

    await repository.createSelectionGrant(
      selection({ nonceHash: 'c'.repeat(64), expiresAt: '2026-08-07T05:45:00.000Z' }),
    );

    expect(stored).toMatchObject({
      nonceHash: 'a'.repeat(64),
      selectedAccountId: accountId,
      selectedSessionId: '50000000-0000-4000-8000-000000000069',
      usedAt: new Date('2026-08-07T05:00:00.000Z'),
    });
  });

  it('rechecks supplier and account state while holding row locks', async () => {
    const createSession = vi.fn();
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: accountId }]),
      authSession: { create: createSession, updateMany: vi.fn() },
      supplierAuthSelection: { findUnique: vi.fn(), updateMany: vi.fn() },
      supplierUser: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'ACTIVE',
          supplierId,
          supplier: { status: 'SUSPENDED' },
        }),
      },
      functionalAccount: {
        findUnique: vi.fn().mockResolvedValue({
          accountType: {
            code: 'SUPPLIER_ACCOUNT_ADMIN',
            name: '主体管理',
            ownerType: 'SUPPLIER',
            status: 'ACTIVE',
            workspaceRoute: '/supplier/workspaces/account-admin',
          },
          authSessions: [],
          displayName: '供应商联系人',
          expiresAt: null,
          id: accountId,
          identityId: userId,
          identityType: 'SUPPLIER_USER',
          ownerType: 'SUPPLIER',
          status: 'ACTIVE',
          supplier: { legalName: '测试供应商有限公司' },
          supplierId,
        }),
      },
    };
    const repository = new PrismaSupplierAuthRepository({
      $transaction: async (callback) => callback(database),
    });

    await expect(repository.issueSession(command)).resolves.toEqual({
      kind: 'GRANT_INVALID',
    });
    expect(database.$queryRaw).toHaveBeenCalledTimes(2);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('keeps the original session hash when the same selection recovers a lost response', async () => {
    const sessionId = '50000000-0000-4000-8000-000000000069';
    const storedSession = {
      expiresAt: new Date('2099-08-07T06:00:00.000Z'),
      functionalAccount: {
        accountType: { code: 'SUPPLIER_ACCOUNT_ADMIN' },
        supplierId,
      },
      functionalAccountId: accountId,
      id: sessionId,
      revokedAt: null,
      sessionHash: 'b'.repeat(64),
      userId,
      userType: 'SUPPLIER_USER',
      workspaceRoute: '/supplier/workspaces/account-admin',
    };
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: accountId }]),
      authSession: {
        findUnique: vi.fn().mockResolvedValue(storedSession),
      },
      supplierAuthSelection: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date('2099-08-07T05:30:00.000Z'),
          selectedAccountId: accountId,
          selectedSessionId: sessionId,
          usedAt: new Date('2026-08-07T05:00:00.000Z'),
          userId,
        }),
      },
      supplierUser: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'ACTIVE',
          supplierId,
          supplier: { status: 'ACTIVE' },
        }),
      },
      functionalAccount: {
        findUnique: vi.fn().mockResolvedValue({
          accountType: {
            code: 'SUPPLIER_ACCOUNT_ADMIN',
            name: '主体管理',
            ownerType: 'SUPPLIER',
            status: 'ACTIVE',
            workspaceRoute: '/supplier/workspaces/account-admin',
          },
          authSessions: [],
          displayName: '供应商联系人',
          expiresAt: null,
          id: accountId,
          identityId: userId,
          identityType: 'SUPPLIER_USER',
          ownerType: 'SUPPLIER',
          status: 'ACTIVE',
          supplier: { legalName: '测试供应商有限公司' },
          supplierId,
        }),
      },
    };
    const repository = new PrismaSupplierAuthRepository({
      $transaction: async (callback) => callback(database),
    });

    await expect(
      repository.issueSession({
        ...command,
        nonceHash: 'a'.repeat(64),
        sessionHash: 'c'.repeat(64),
      }),
    ).resolves.toMatchObject({
      kind: 'OK',
      replayed: true,
      sessionHash: 'b'.repeat(64),
      session: { id: sessionId },
    });
  });

  it('resolves only an active supplier-owned session and rejects route drift', async () => {
    const storedSession = {
      expiresAt: new Date('2099-08-07T06:00:00.000Z'),
      functionalAccountId: accountId,
      id: '50000000-0000-4000-8000-000000000069',
      revokedAt: null,
      userId,
      userType: 'SUPPLIER_USER',
      workspaceRoute: '/supplier/workspaces/account-admin',
      functionalAccount: {
        accountType: {
          code: 'SUPPLIER_ACCOUNT_ADMIN',
          ownerType: 'SUPPLIER',
          status: 'ACTIVE',
          workspaceRoute: '/supplier/workspaces/account-admin',
        },
        expiresAt: null,
        identityId: userId,
        identityType: 'SUPPLIER_USER',
        ownerType: 'SUPPLIER',
        status: 'ACTIVE',
        supplier: { status: 'ACTIVE' },
        supplierId,
      },
    };
    const prisma = {
      authSession: { findUnique: vi.fn().mockResolvedValue(storedSession) },
      supplierUser: {
        findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', supplierId }),
      },
    };
    const repository = new PrismaSupplierAuthRepository(prisma);

    await expect(
      repository.resolveSession('d'.repeat(64), '2026-08-07T05:00:00.000Z'),
    ).resolves.toMatchObject({
      kind: 'ACTIVE',
      session: {
        accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
        functionalAccountId: accountId,
        supplierId,
        workspaceRoute: '/supplier/workspaces/account-admin',
      },
    });

    storedSession.functionalAccount.accountType.workspaceRoute =
      '/supplier/workspaces/finance';
    await expect(
      repository.resolveSession('d'.repeat(64), '2026-08-07T05:00:00.000Z'),
    ).resolves.toEqual({ kind: 'INVALID' });
  });
});
