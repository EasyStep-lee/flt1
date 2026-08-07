import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import {
  COMPANY_LEGAL_NAME,
  PLATFORM_NAME,
} from '../merchant/single-merchant.service.js';
import {
  resolveSupplierTransition,
  type SupplierQualificationSnapshot,
} from './supplier-onboarding.policy.js';
import type {
  ApprovalTaskRecord,
  PatchSupplierCommand,
  RegisterSupplierCommand,
  ReviewSupplierCommand,
  SubmitSupplierCommand,
  SupplierListQuery,
  SupplierMutationResult,
  SupplierOnboardingRecord,
  SupplierOnboardingRepository,
} from './supplier-onboarding.repository.js';

type TransactionClient = Prisma.TransactionClient;

const asInputJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const qualificationSnapshot = (
  value: Prisma.JsonValue,
): SupplierQualificationSnapshot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('SUPPLIER_QUALIFICATION_SNAPSHOT_INVALID');
  }
  const record = value as Record<string, Prisma.JsonValue>;
  const rawFiles = record.files;
  if (record.schemaVersion !== '1.0' || !Array.isArray(rawFiles)) {
    throw new Error('SUPPLIER_QUALIFICATION_SNAPSHOT_INVALID');
  }
  const files = rawFiles.map((file) => {
    if (typeof file !== 'string') {
      throw new Error('SUPPLIER_QUALIFICATION_SNAPSHOT_INVALID');
    }
    return file;
  });
  const rawApplicant = record.applicant;
  if (!rawApplicant) return { schemaVersion: '1.0', files };
  if (typeof rawApplicant !== 'object' || Array.isArray(rawApplicant)) {
    throw new Error('SUPPLIER_QUALIFICATION_SNAPSHOT_INVALID');
  }
  const applicant = rawApplicant as Record<string, Prisma.JsonValue>;
  if (
    typeof applicant.agreementVersion !== 'string' ||
    typeof applicant.contactName !== 'string' ||
    typeof applicant.mobile !== 'string' ||
    (applicant.email !== undefined && typeof applicant.email !== 'string')
  ) {
    throw new Error('SUPPLIER_QUALIFICATION_SNAPSHOT_INVALID');
  }
  return {
    schemaVersion: '1.0',
    files,
    applicant: {
      agreementVersion: applicant.agreementVersion,
      contactName: applicant.contactName,
      ...(typeof applicant.email === 'string' ? { email: applicant.email } : {}),
      mobile: applicant.mobile,
    },
  };
};

const toSupplierRecord = (supplier: {
  readonly id: string;
  readonly companyId: string;
  readonly legalName: string;
  readonly creditCode: string;
  readonly status: SupplierOnboardingRecord['status'];
  readonly pickupAddress: string | null;
  readonly pickupLat: Prisma.Decimal | null;
  readonly pickupLng: Prisma.Decimal | null;
  readonly settlementAccountMasked: string | null;
  readonly qualificationSnapshot: Prisma.JsonValue;
  readonly version: number;
  readonly submittedAt: Date | null;
}): SupplierOnboardingRecord => ({
  id: supplier.id,
  companyId: supplier.companyId,
  legalName: supplier.legalName,
  creditCode: supplier.creditCode,
  status: supplier.status,
  pickupAddress: supplier.pickupAddress,
  pickupLat: supplier.pickupLat?.toNumber() ?? null,
  pickupLng: supplier.pickupLng?.toNumber() ?? null,
  settlementAccountMasked: supplier.settlementAccountMasked,
  qualificationSnapshot: qualificationSnapshot(supplier.qualificationSnapshot),
  version: supplier.version,
  submittedAt: supplier.submittedAt?.toISOString() ?? null,
});

const toApprovalTaskRecord = (task: {
  readonly id: string;
  readonly approvalType: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly applicantType: string;
  readonly applicantId: string;
  readonly status: ApprovalTaskRecord['status'];
  readonly assignedAccountTypeCode: string;
  readonly reviewedBy: string | null;
  readonly reviewOpinion: string | null;
  readonly version: number;
}): ApprovalTaskRecord => {
  if (
    task.approvalType !== 'SUPPLIER_ONBOARDING' ||
    task.objectType !== 'SUPPLIER' ||
    task.applicantType !== 'SUPPLIER_USER' ||
    task.assignedAccountTypeCode !== 'COMPANY_SUPPLIER_OPS'
  ) {
    throw new Error('SUPPLIER_ONBOARDING_APPROVAL_TASK_INVALID');
  }
  return {
    ...task,
    approvalType: task.approvalType,
    objectType: task.objectType,
    applicantType: task.applicantType,
    assignedAccountTypeCode: task.assignedAccountTypeCode,
  };
};

const parseStoredResult = <T>(value: Prisma.JsonValue): T =>
  structuredClone(value) as T;

@Injectable()
export class PrismaSupplierOnboardingRepository
  implements SupplierOnboardingRepository
{
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async replay<T>(
    database: TransactionClient,
    scope: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<SupplierMutationResult<T> | null> {
    const command = await database.supplierOnboardingCommand.findUnique({
      where: { scope_idempotencyKey: { scope, idempotencyKey } },
      select: { requestHash: true, responseSnapshot: true },
    });
    if (!command) return null;
    if (command.requestHash !== requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return {
      kind: 'OK',
      replayed: true,
      value: parseStoredResult<T>(command.responseSnapshot),
    };
  }

  private async remember(
    database: TransactionClient,
    scope: string,
    idempotencyKey: string,
    requestHash: string,
    result: unknown,
  ): Promise<void> {
    await database.supplierOnboardingCommand.create({
      data: {
        scope,
        idempotencyKey,
        requestHash,
        responseSnapshot: asInputJson(result),
      },
    });
  }

  async register(
    command: RegisterSupplierCommand,
  ): Promise<SupplierMutationResult<SupplierOnboardingRecord>> {
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay<SupplierOnboardingRecord>(
        database,
        'REGISTER',
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      const companies = await database.company.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { id: 'asc' },
        take: 2,
      });
      if (
        companies.length !== 1 ||
        companies[0]?.legalName !== COMPANY_LEGAL_NAME ||
        companies[0]?.platformName !== PLATFORM_NAME
      ) {
        return { kind: 'COMPANY_INVARIANT' } as const;
      }
      const duplicate = await database.supplier.findUnique({
        where: { creditCode: command.creditCode },
        select: { id: true },
      });
      if (duplicate) return { kind: 'DUPLICATE' } as const;
      const created = await database.supplier.create({
        data: {
          companyId: companies[0].id,
          legalName: command.legalName,
          creditCode: command.creditCode,
          pickupAddress: command.pickupAddress,
          pickupLat: command.pickupLat,
          pickupLng: command.pickupLng,
          qualificationSnapshot: asInputJson(command.qualificationSnapshot),
        },
      });
      const supplier = toSupplierRecord(created);
      await database.supplierStatusHistory.create({
        data: {
          supplierId: supplier.id,
          fromStatus: null,
          toStatus: 'DRAFT',
          event: 'REGISTER',
          actorIdentityId: null,
          version: 0,
        },
      });
      await this.remember(
        database,
        'REGISTER',
        command.idempotencyKey,
        command.requestHash,
        supplier,
      );
      return { kind: 'OK', replayed: false, value: supplier } as const;
    });
  }

  async findSupplier(supplierId: string): Promise<SupplierOnboardingRecord | null> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    return supplier ? toSupplierRecord(supplier) : null;
  }

  async patchSupplier(
    command: PatchSupplierCommand,
  ): Promise<SupplierMutationResult<SupplierOnboardingRecord>> {
    const scope = `PATCH:${command.supplierId}`;
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay<SupplierOnboardingRecord>(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      const current = await database.supplier.findUnique({
        where: { id: command.supplierId },
      });
      if (!current) return { kind: 'NOT_FOUND' } as const;
      if (current.version !== command.expectedVersion) {
        return { kind: 'VERSION_CONFLICT' } as const;
      }
      if (current.status !== 'DRAFT' && current.status !== 'CORRECTION_REQUIRED') {
        return { kind: 'STATE_INVALID' } as const;
      }
      const update = await database.supplier.updateMany({
        where: {
          id: command.supplierId,
          version: command.expectedVersion,
          status: current.status,
        },
        data: {
          ...(command.pickupAddress !== undefined
            ? { pickupAddress: command.pickupAddress }
            : {}),
          ...(command.pickupLat !== undefined ? { pickupLat: command.pickupLat } : {}),
          ...(command.pickupLng !== undefined ? { pickupLng: command.pickupLng } : {}),
          ...(command.qualificationSnapshot
            ? {
                qualificationSnapshot: asInputJson(command.qualificationSnapshot),
              }
            : {}),
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) return { kind: 'VERSION_CONFLICT' } as const;
      const updated = await database.supplier.findUniqueOrThrow({
        where: { id: command.supplierId },
      });
      const supplier = toSupplierRecord(updated);
      await this.remember(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
        supplier,
      );
      return { kind: 'OK', replayed: false, value: supplier } as const;
    });
  }

  async submitSupplier(
    command: SubmitSupplierCommand,
  ): Promise<
    SupplierMutationResult<{
      readonly supplier: SupplierOnboardingRecord;
      readonly approvalTask: ApprovalTaskRecord;
    }>
  > {
    const scope = `SUBMIT:${command.supplierId}`;
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay<{
        readonly supplier: SupplierOnboardingRecord;
        readonly approvalTask: ApprovalTaskRecord;
      }>(database, scope, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      const current = await database.supplier.findUnique({
        where: { id: command.supplierId },
      });
      if (!current) return { kind: 'NOT_FOUND' } as const;
      if (current.version !== command.expectedVersion) {
        return { kind: 'VERSION_CONFLICT' } as const;
      }
      let nextStatus: SupplierOnboardingRecord['status'];
      try {
        nextStatus = resolveSupplierTransition(current.status, command.event);
      } catch {
        return { kind: 'STATE_INVALID' } as const;
      }
      const nextVersion = current.version + 1;
      const submittedAt = new Date();
      const update = await database.supplier.updateMany({
        where: {
          id: command.supplierId,
          version: command.expectedVersion,
          status: current.status,
        },
        data: {
          status: nextStatus,
          submittedAt,
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) return { kind: 'VERSION_CONFLICT' } as const;
      const createdTask = await database.approvalTask.create({
        data: {
          approvalType: 'SUPPLIER_ONBOARDING',
          objectType: 'SUPPLIER',
          objectId: command.supplierId,
          applicantType: 'SUPPLIER_USER',
          applicantId: command.applicantIdentityId,
          assignedAccountTypeCode: 'COMPANY_SUPPLIER_OPS',
          version: nextVersion,
        },
      });
      await database.supplierStatusHistory.create({
        data: {
          supplierId: command.supplierId,
          fromStatus: current.status,
          toStatus: nextStatus,
          event: command.event,
          actorIdentityId: command.applicantIdentityId,
          version: nextVersion,
        },
      });
      const updated = await database.supplier.findUniqueOrThrow({
        where: { id: command.supplierId },
      });
      const result = {
        supplier: toSupplierRecord(updated),
        approvalTask: toApprovalTaskRecord(createdTask),
      };
      await this.remember(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
        result,
      );
      return { kind: 'OK', replayed: false, value: result } as const;
    });
  }

  async listSuppliers(query: SupplierListQuery): Promise<{
    readonly items: readonly SupplierOnboardingRecord[];
    readonly total: number;
  }> {
    const where = {
      companyId: query.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? {
            OR: [
              { legalName: { contains: query.keyword } },
              { creditCode: { contains: query.keyword } },
            ],
          }
        : {}),
    } satisfies Prisma.SupplierWhereInput;
    const [suppliers, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: [{ legalName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items: suppliers.map(toSupplierRecord), total };
  }

  async reviewSupplier(
    command: ReviewSupplierCommand,
  ): Promise<SupplierMutationResult<SupplierOnboardingRecord>> {
    const scope = `REVIEW:${command.supplierId}`;
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay<SupplierOnboardingRecord>(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      const current = await database.supplier.findUnique({
        where: { id: command.supplierId },
      });
      if (!current || current.companyId !== command.companyId) {
        return { kind: 'NOT_FOUND' } as const;
      }
      if (current.status !== 'PENDING_REVIEW') {
        return { kind: 'STATE_INVALID' } as const;
      }
      const task = await database.approvalTask.findFirst({
        where: {
          approvalType: 'SUPPLIER_ONBOARDING',
          objectType: 'SUPPLIER',
          objectId: command.supplierId,
          status: 'PENDING',
          version: command.expectedVersion,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!task || current.version !== command.expectedVersion) {
        return { kind: 'APPROVAL_VERSION_CONFLICT' } as const;
      }
      if (task.applicantId === command.reviewerIdentityId) {
        return { kind: 'SAME_NATURAL_PERSON' } as const;
      }
      const applicant = qualificationSnapshot(current.qualificationSnapshot).applicant;
      if (command.decision === 'APPROVE' && !applicant) {
        return { kind: 'STATE_INVALID' } as const;
      }
      let nextStatus: SupplierOnboardingRecord['status'];
      try {
        nextStatus = resolveSupplierTransition(current.status, command.decision);
      } catch {
        return { kind: 'STATE_INVALID' } as const;
      }
      const nextVersion = current.version + 1;
      const supplierUpdate = await database.supplier.updateMany({
        where: {
          id: command.supplierId,
          status: 'PENDING_REVIEW',
          version: command.expectedVersion,
        },
        data: { status: nextStatus, version: { increment: 1 } },
      });
      const taskUpdate = await database.approvalTask.updateMany({
        where: {
          id: task.id,
          status: 'PENDING',
          version: command.expectedVersion,
        },
        data: {
          status: command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewedBy: command.reviewerIdentityId,
          reviewOpinion: command.opinion,
          version: nextVersion,
        },
      });
      if (supplierUpdate.count !== 1 || taskUpdate.count !== 1) {
        return { kind: 'APPROVAL_VERSION_CONFLICT' } as const;
      }
      await database.supplierStatusHistory.create({
        data: {
          supplierId: command.supplierId,
          fromStatus: current.status,
          toStatus: nextStatus,
          event: command.decision,
          actorIdentityId: command.reviewerIdentityId,
          version: nextVersion,
        },
      });
      if (command.decision === 'APPROVE') {
        const accountType = await database.functionalAccountType.findUnique({
          where: {
            ownerType_code: {
              code: 'SUPPLIER_ACCOUNT_ADMIN',
              ownerType: 'SUPPLIER',
            },
          },
        });
        if (!accountType || accountType.status !== 'ACTIVE') {
          throw new Error('SUPPLIER_ACCOUNT_ADMIN_TYPE_UNAVAILABLE');
        }
        const supplierUser = await database.supplierUser.upsert({
          where: {
            supplierId_mobile: {
              mobile: applicant!.mobile,
              supplierId: current.id,
            },
          },
          create: {
            email: applicant!.email ?? null,
            mobile: applicant!.mobile,
            name: applicant!.contactName,
            status: 'ACTIVE',
            supplierId: current.id,
          },
          update: {
            email: applicant!.email ?? null,
            name: applicant!.contactName,
            status: 'ACTIVE',
            version: { increment: 1 },
          },
        });
        const existingAccount = await database.functionalAccount.findUnique({
          where: {
            supplierId_identityId_accountTypeId: {
              accountTypeId: accountType.id,
              identityId: supplierUser.id,
              supplierId: current.id,
            },
          },
        });
        if (!existingAccount) {
          const createdAccount = await database.functionalAccount.create({
            data: {
              accountTypeId: accountType.id,
              displayName: applicant!.contactName,
              identityId: supplierUser.id,
              identityType: 'SUPPLIER_USER',
              ownerType: 'SUPPLIER',
              status: 'ACTIVE',
              supplierId: current.id,
            },
          });
          await database.functionalAccountStatusHistory.create({
            data: {
              actorIdentityId: command.reviewerIdentityId,
              event: 'ACTIVATE',
              functionalAccountId: createdAccount.id,
              fromStatus: null,
              toStatus: 'ACTIVE',
              version: 0,
            },
          });
        } else if (existingAccount.status !== 'ACTIVE') {
          const activatedAccount = await database.functionalAccount.update({
            where: { id: existingAccount.id },
            data: {
              displayName: applicant!.contactName,
              status: 'ACTIVE',
              version: { increment: 1 },
            },
          });
          await database.functionalAccountStatusHistory.create({
            data: {
              actorIdentityId: command.reviewerIdentityId,
              event: 'ACTIVATE',
              functionalAccountId: activatedAccount.id,
              fromStatus: existingAccount.status,
              toStatus: 'ACTIVE',
              version: activatedAccount.version,
            },
          });
        }
      }
      const updated = await database.supplier.findUniqueOrThrow({
        where: { id: command.supplierId },
      });
      const supplier = toSupplierRecord(updated);
      await this.remember(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
        supplier,
      );
      return { kind: 'OK', replayed: false, value: supplier } as const;
    });
  }
}
