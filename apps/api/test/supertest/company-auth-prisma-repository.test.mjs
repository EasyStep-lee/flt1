import { describe, expect, it, vi } from 'vitest';

import { PrismaCompanyAuthRepository } from '../../dist/company-auth/prisma-company-auth.repository.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000001';
const accountId = '30000000-0000-4000-8000-000000000001';

const selection = (overrides = {}) => ({
  expiresAt: '2026-08-06T05:30:00.000Z',
  nonceHash: 'a'.repeat(64),
  requestId: '40000000-0000-4000-8000-000000000001',
  secondVerificationRequired: false,
  selectedAccountId: null,
  selectedSessionId: null,
  usedAt: null,
  userId,
  ...overrides,
});

const command = {
  account: {
    accountTypeCode: 'COMPANY_SUPER_ADMIN',
    accountTypeName: '超级管理员',
    companyId,
    displayName: '平台管理员',
    expiresAt: null,
    id: accountId,
    identityId: userId,
    lastUsedAt: null,
    ownerDisplayName: '江苏福礼团供应链科技有限公司',
    ownerType: 'COMPANY',
    status: 'ACTIVE',
    workspaceRoute: '/company-admin/workspaces/system',
  },
  deviceInfo: {},
  expiresAt: '2099-08-06T06:00:00.000Z',
  ip: '127.0.0.1',
  nonceHash: null,
  sessionHash: 'b'.repeat(64),
  userId,
};

describe('Prisma company auth repository security boundaries', () => {
  it('does not reset a completed selection when login reuses its requestId', async () => {
    let stored = null;
    const prisma = {
      companyAuthSelection: {
        upsert: async ({ create, update }) => {
          stored = stored ? { ...stored, ...update } : { ...create };
          return stored;
        },
      },
    };
    const repository = new PrismaCompanyAuthRepository(prisma);
    await repository.createSelectionGrant(selection());
    stored = {
      ...stored,
      selectedAccountId: accountId,
      selectedSessionId: '50000000-0000-4000-8000-000000000001',
      usedAt: new Date('2026-08-06T05:00:00.000Z'),
    };

    await repository.createSelectionGrant(
      selection({ nonceHash: 'c'.repeat(64), expiresAt: '2026-08-06T05:45:00.000Z' }),
    );

    expect(stored).toMatchObject({
      nonceHash: 'a'.repeat(64),
      selectedAccountId: accountId,
      selectedSessionId: '50000000-0000-4000-8000-000000000001',
      usedAt: new Date('2026-08-06T05:00:00.000Z'),
    });
  });

  it('rechecks the locked account and fails closed when its stored status changed', async () => {
    const createSession = vi.fn();
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: accountId }]),
      authSession: {
        create: createSession,
        updateMany: vi.fn(),
      },
      companyAuthSelection: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      companyUser: {
        findUnique: vi.fn().mockResolvedValue({ companyId, status: 'ACTIVE' }),
      },
      functionalAccount: {
        findUnique: vi.fn().mockResolvedValue({
          accountType: {
            code: 'COMPANY_SUPER_ADMIN',
            name: '超级管理员',
            workspaceRoute: '/company-admin/workspaces/system',
          },
          authSessions: [],
          company: { legalName: '江苏福礼团供应链科技有限公司' },
          companyId,
          displayName: '平台管理员',
          expiresAt: null,
          id: accountId,
          identityId: userId,
          identityType: 'COMPANY_USER',
          ownerType: 'COMPANY',
          status: 'SUSPENDED',
        }),
      },
    };
    const repository = new PrismaCompanyAuthRepository({
      $transaction: async (callback) => callback(database),
    });

    await expect(repository.issueSession(command)).resolves.toEqual({
      kind: 'GRANT_INVALID',
    });
    expect(database.functionalAccount.findUnique).toHaveBeenCalledWith({
      where: { id: accountId },
      include: expect.any(Object),
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it('resolves only an active authoritative company session and rejects route drift', async () => {
    const storedSession = {
      expiresAt: new Date('2099-08-06T06:00:00.000Z'),
      functionalAccountId: accountId,
      id: '50000000-0000-4000-8000-000000000001',
      revokedAt: null,
      userId,
      userType: 'COMPANY_USER',
      workspaceRoute: '/company-admin/workspaces/system',
      functionalAccount: {
        accountType: {
          code: 'COMPANY_SUPER_ADMIN',
          ownerType: 'COMPANY',
          status: 'ACTIVE',
          workspaceRoute: '/company-admin/workspaces/system',
        },
        companyId,
        expiresAt: null,
        identityId: userId,
        identityType: 'COMPANY_USER',
        ownerType: 'COMPANY',
        status: 'ACTIVE',
      },
    };
    const prisma = {
      authSession: { findUnique: vi.fn().mockResolvedValue(storedSession) },
      companyUser: {
        findUnique: vi.fn().mockResolvedValue({ companyId, status: 'ACTIVE' }),
      },
    };
    const repository = new PrismaCompanyAuthRepository(prisma);

    await expect(
      repository.resolveSession('d'.repeat(64), '2026-08-06T05:00:00.000Z'),
    ).resolves.toMatchObject({
      kind: 'ACTIVE',
      session: {
        accountTypeCode: 'COMPANY_SUPER_ADMIN',
        functionalAccountId: accountId,
        workspaceRoute: '/company-admin/workspaces/system',
      },
    });

    storedSession.functionalAccount.accountType.workspaceRoute =
      '/company-admin/workspaces/finance';
    await expect(
      repository.resolveSession('d'.repeat(64), '2026-08-06T05:00:00.000Z'),
    ).resolves.toEqual({ kind: 'INVALID' });
  });
});
