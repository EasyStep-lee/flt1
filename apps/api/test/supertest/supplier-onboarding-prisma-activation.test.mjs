import { describe, expect, it, vi } from 'vitest';

import { PrismaSupplierOnboardingRepository } from '../../dist/supplier-onboarding/prisma-supplier-onboarding.repository.js';

const companyId = '00000000-0000-4000-8000-000000000001';
const supplierId = '10000000-0000-4000-8000-000000000069';
const supplierUserId = '20000000-0000-4000-8000-000000000069';
const accountTypeId = '30000000-0000-4000-8000-000000000069';
const accountId = '40000000-0000-4000-8000-000000000069';

const supplier = (overrides = {}) => ({
  companyId,
  creditCode: '91320000TESTP06901',
  id: supplierId,
  legalName: '供应商登录激活测试有限公司',
  pickupAddress: null,
  pickupLat: null,
  pickupLng: null,
  qualificationSnapshot: {
    schemaVersion: '1.0',
    files: ['qualification/test-only.pdf'],
    applicant: {
      agreementVersion: 'V1.1',
      contactName: '供应商联系人',
      email: 'supplier@example.test',
      mobile: '13800138000',
    },
  },
  settlementAccountMasked: null,
  status: 'PENDING_REVIEW',
  submittedAt: new Date('2026-08-07T04:00:00.000Z'),
  version: 3,
  ...overrides,
});

describe('Prisma supplier approval login activation', () => {
  it('activates the applicant user and unique account-admin in the approval transaction', async () => {
    const supplierUserUpsert = vi.fn().mockResolvedValue({ id: supplierUserId });
    const functionalAccountCreate = vi.fn().mockResolvedValue({ id: accountId });
    const accountHistoryCreate = vi.fn().mockResolvedValue({});
    const commandRemember = vi.fn().mockResolvedValue({});
    const database = {
      approvalTask: {
        findFirst: vi.fn().mockResolvedValue({
          applicantId: 'natural-person-applicant',
          id: 'approval-task-p069',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      functionalAccount: {
        create: functionalAccountCreate,
        findUnique: vi.fn().mockResolvedValue(null),
      },
      functionalAccountStatusHistory: { create: accountHistoryCreate },
      functionalAccountType: {
        findUnique: vi.fn().mockResolvedValue({ id: accountTypeId, status: 'ACTIVE' }),
      },
      supplier: {
        findUnique: vi.fn().mockResolvedValue(supplier()),
        findUniqueOrThrow: vi.fn().mockResolvedValue(
          supplier({ status: 'ACTIVE', version: 4 }),
        ),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      supplierOnboardingCommand: {
        create: commandRemember,
        findUnique: vi.fn().mockResolvedValue(null),
      },
      supplierStatusHistory: { create: vi.fn().mockResolvedValue({}) },
      supplierUser: { upsert: supplierUserUpsert },
    };
    const prisma = { $transaction: vi.fn(async (callback) => callback(database)) };
    const repository = new PrismaSupplierOnboardingRepository(prisma);

    await expect(
      repository.reviewSupplier({
        companyId,
        decision: 'APPROVE',
        expectedVersion: 3,
        idempotencyKey: 'm1-p069-approval',
        opinion: '资料有效，同意准入',
        requestHash: 'a'.repeat(64),
        reviewerIdentityId: 'natural-person-reviewer',
        supplierId,
      }),
    ).resolves.toMatchObject({
      kind: 'OK',
      replayed: false,
      value: { id: supplierId, status: 'ACTIVE', version: 4 },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(supplierUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          mobile: '13800138000',
          status: 'ACTIVE',
          supplierId,
        }),
        update: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(functionalAccountCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountTypeId,
        identityId: supplierUserId,
        identityType: 'SUPPLIER_USER',
        ownerType: 'SUPPLIER',
        status: 'ACTIVE',
        supplierId,
      }),
    });
    expect(accountHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'ACTIVATE',
        functionalAccountId: accountId,
        toStatus: 'ACTIVE',
      }),
    });
    expect(commandRemember).toHaveBeenCalledTimes(1);
  });
});
