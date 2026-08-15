import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import {
  canEnterpriseApplicantEdit,
  canEnterpriseApplicantSubmit,
  resolveEnterpriseReviewStatus,
  type EnterpriseCorrectionField,
} from './enterprise-onboarding.policy.js';
import type {
  EnterpriseListQuery,
  EnterpriseListResult,
  EnterpriseMutationResult,
  EnterpriseOnboardingRecord,
  EnterpriseOnboardingRepository,
  PatchEnterpriseCommand,
  RegisterEnterpriseCommand,
  ReviewEnterpriseCommand,
  SubmitEnterpriseCommand,
  SuspendEnterpriseCommand,
} from './enterprise-onboarding.repository.js';

const includeProfile = {
  addresses: { orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'asc' as const }] },
  invoiceProfiles: { orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'asc' as const }] },
  users: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.EnterpriseCustomerInclude;

type EnterpriseProfileRow = Prisma.EnterpriseCustomerGetPayload<{
  include: typeof includeProfile;
}>;

const correctionFields = (value: Prisma.JsonValue): EnterpriseCorrectionField[] =>
  Array.isArray(value)
    ? value.filter((item): item is EnterpriseCorrectionField => typeof item === 'string')
    : [];

const toRecord = (row: EnterpriseProfileRow): EnterpriseOnboardingRecord => {
  const administrator = row.users.find((user) => user.role === 'ENTERPRISE_ADMIN');
  if (!administrator) throw new Error('ENTERPRISE_ADMIN_MISSING');
  const invoice = row.invoiceProfiles[0];
  return {
    id: row.id,
    companyId: row.companyId,
    applicantIdentityId: administrator.identityId,
    legalName: row.legalName,
    creditCode: row.creditCode,
    ...(row.registeredAddress ? { registeredAddress: row.registeredAddress } : {}),
    ...(row.enterpriseType ? { enterpriseType: row.enterpriseType } : {}),
    ...(row.licenseObjectKey ? { licenseObjectKey: row.licenseObjectKey } : {}),
    ...(row.licenseValidUntil
      ? { licenseValidUntil: row.licenseValidUntil.toISOString() }
      : {}),
    administratorName: administrator.name,
    administratorMobile: administrator.mobile,
    ...(administrator.email ? { administratorEmail: administrator.email } : {}),
    ...(administrator.title ? { administratorTitle: administrator.title } : {}),
    agreementVersion: row.agreementVersion,
    agreementStatus: row.agreementStatus,
    status: row.status,
    version: row.version,
    correctionFields: correctionFields(row.correctionFields),
    ...(row.reviewOpinion ? { reviewOpinion: row.reviewOpinion } : {}),
    addresses: row.addresses.map((address) => ({
      id: address.id,
      consignee: address.consignee,
      mobile: address.mobile,
      region: address.region,
      fullAddress: address.fullAddress,
      ...(address.deliveryNote ? { deliveryNote: address.deliveryNote } : {}),
      isDefault: address.isDefault,
    })),
    ...(invoice
      ? {
          invoiceProfile: {
            id: invoice.id,
            title: invoice.title,
            taxNumber: invoice.taxNumber,
            ...(invoice.registeredAddress
              ? { registeredAddress: invoice.registeredAddress }
              : {}),
            ...(invoice.registeredPhone
              ? { registeredPhone: invoice.registeredPhone }
              : {}),
            ...(invoice.bankName ? { bankName: invoice.bankName } : {}),
            ...(invoice.bankAccountMasked
              ? { bankAccountMasked: invoice.bankAccountMasked }
              : {}),
          },
        }
      : {}),
    createdAt: row.createdAt.toISOString(),
    ...(row.submittedAt ? { submittedAt: row.submittedAt.toISOString() } : {}),
  };
};

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

class EnterpriseReviewConcurrencyConflict extends Error {}

@Injectable()
export class PrismaEnterpriseOnboardingRepository
  implements EnterpriseOnboardingRepository
{
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async replay(
    database: Prisma.TransactionClient,
    scope: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<EnterpriseMutationResult | null> {
    const command = await database.enterpriseOnboardingCommand.findUnique({
      where: { scope_idempotencyKey: { scope, idempotencyKey } },
    });
    if (!command) return null;
    if (command.requestHash !== requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return {
      kind: 'OK',
      replayed: true,
      value: command.responseSnapshot as unknown as EnterpriseOnboardingRecord,
    };
  }

  private async remember(
    database: Prisma.TransactionClient,
    scope: string,
    idempotencyKey: string,
    requestHash: string,
    response: EnterpriseOnboardingRecord,
  ): Promise<void> {
    await database.enterpriseOnboardingCommand.create({
      data: { scope, idempotencyKey, requestHash, responseSnapshot: json(response) },
    });
  }

  private async snapshot(
    database: Prisma.TransactionClient,
    record: EnterpriseOnboardingRecord,
    event: string,
    actorIdentityId: string,
  ): Promise<void> {
    await database.enterpriseCertificationSnapshot.create({
      data: {
        enterpriseId: record.id,
        event,
        actorIdentityId,
        payload: json(record),
        version: record.version,
      },
    });
  }

  async register(command: RegisterEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = 'enterprise-registration:create';
    try {
      return await this.prisma.$transaction(async (database) => {
        const replay = await this.replay(
          database,
          scope,
          command.idempotencyKey,
          command.requestHash,
        );
        if (replay) return replay;
        const companies = await database.company.findMany({
          where: {
            legalName: '江苏福礼团供应链科技有限公司',
            platformName: '福礼社',
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (companies.length !== 1) return { kind: 'COMPANY_INVARIANT' } as const;
        const duplicate = await database.enterpriseCustomer.findUnique({
          where: { creditCode: command.creditCode },
          select: { id: true },
        });
        if (duplicate) return { kind: 'DUPLICATE' } as const;
        const profile = command.profile;
        const created = await database.enterpriseCustomer.create({
          data: {
            companyId: companies[0]!.id,
            legalName: command.legalName,
            creditCode: command.creditCode,
            registeredAddress: profile.registeredAddress ?? null,
            enterpriseType: profile.enterpriseType ?? null,
            licenseObjectKey: profile.licenseObjectKey ?? null,
            licenseValidUntil: profile.licenseValidUntil
              ? new Date(profile.licenseValidUntil)
              : null,
            contactName: command.administratorName,
            contactMobile: command.administratorMobile,
            contactEmail: command.administratorEmail ?? null,
            contactTitle: command.administratorTitle ?? null,
            agreementVersion: command.agreementVersion,
            correctionFields: [],
            users: {
              create: {
                identityId: command.applicantIdentityId,
                role: 'ENTERPRISE_ADMIN',
                name: command.administratorName,
                mobile: command.administratorMobile,
                email: command.administratorEmail ?? null,
                title: command.administratorTitle ?? null,
              },
            },
            ...(profile.addresses
              ? {
                  addresses: {
                    create: profile.addresses.map((address) => ({ ...address })),
                  },
                }
              : {}),
            ...(profile.invoiceProfile
              ? {
                  invoiceProfiles: {
                    create: { ...profile.invoiceProfile, isDefault: true },
                  },
                }
              : {}),
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: 'DRAFT',
                event: 'CREATE',
                actorIdentityId: command.applicantIdentityId,
                version: 0,
              },
            },
          },
          include: includeProfile,
        });
        const record = toRecord(created);
        await this.snapshot(database, record, 'CREATE', command.applicantIdentityId);
        await this.remember(
          database,
          scope,
          command.idempotencyKey,
          command.requestHash,
          record,
        );
        return { kind: 'OK', replayed: false, value: record } as const;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return { kind: 'DUPLICATE' };
      }
      throw error;
    }
  }

  async findById(id: string): Promise<EnterpriseOnboardingRecord | null> {
    const record = await this.prisma.enterpriseCustomer.findUnique({
      where: { id },
      include: includeProfile,
    });
    return record ? toRecord(record) : null;
  }

  async patch(command: PatchEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = `enterprise-registration:${command.enterpriseId}:patch`;
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      const currentRow = await database.enterpriseCustomer.findUnique({
        where: { id: command.enterpriseId },
        include: includeProfile,
      });
      if (!currentRow) return { kind: 'NOT_FOUND' } as const;
      const current = toRecord(currentRow);
      if (current.applicantIdentityId !== command.applicantIdentityId) {
        return { kind: 'NOT_FOUND' } as const;
      }
      if (current.version !== command.expectedVersion) {
        return { kind: 'VERSION_CONFLICT' } as const;
      }
      if (!canEnterpriseApplicantEdit(current.status)) {
        return { kind: 'STATE_CONFLICT' } as const;
      }
      if (command.patch.creditCode && command.patch.creditCode !== current.creditCode) {
        const duplicate = await database.enterpriseCustomer.findUnique({
          where: { creditCode: command.patch.creditCode },
          select: { id: true },
        });
        if (duplicate) return { kind: 'DUPLICATE' } as const;
      }
      const update = await database.enterpriseCustomer.updateMany({
        where: {
          id: command.enterpriseId,
          version: command.expectedVersion,
          status: current.status,
        },
        data: {
          ...(command.patch.legalName ? { legalName: command.patch.legalName } : {}),
          ...(command.patch.creditCode ? { creditCode: command.patch.creditCode } : {}),
          ...(command.patch.registeredAddress
            ? { registeredAddress: command.patch.registeredAddress }
            : {}),
          ...(command.patch.enterpriseType
            ? { enterpriseType: command.patch.enterpriseType }
            : {}),
          ...(command.patch.licenseObjectKey
            ? { licenseObjectKey: command.patch.licenseObjectKey }
            : {}),
          ...(command.patch.licenseValidUntil !== undefined
            ? {
                licenseValidUntil: command.patch.licenseValidUntil
                  ? new Date(command.patch.licenseValidUntil)
                  : null,
              }
            : {}),
          ...(command.patch.administratorName
            ? { contactName: command.patch.administratorName }
            : {}),
          ...(command.patch.administratorEmail
            ? { contactEmail: command.patch.administratorEmail }
            : {}),
          ...(command.patch.administratorTitle
            ? { contactTitle: command.patch.administratorTitle }
            : {}),
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) return { kind: 'VERSION_CONFLICT' } as const;
      await database.enterpriseUser.updateMany({
        where: {
          enterpriseCustomerId: command.enterpriseId,
          identityId: command.applicantIdentityId,
          role: 'ENTERPRISE_ADMIN',
        },
        data: {
          ...(command.patch.administratorName
            ? { name: command.patch.administratorName }
            : {}),
          ...(command.patch.administratorEmail
            ? { email: command.patch.administratorEmail }
            : {}),
          ...(command.patch.administratorTitle
            ? { title: command.patch.administratorTitle }
            : {}),
        },
      });
      if (command.patch.addresses) {
        await database.enterpriseAddress.deleteMany({
          where: { enterpriseCustomerId: command.enterpriseId },
        });
        if (command.patch.addresses.length > 0) {
          await database.enterpriseAddress.createMany({
            data: command.patch.addresses.map((address) => ({
              enterpriseCustomerId: command.enterpriseId,
              ...address,
            })),
          });
        }
      }
      if (command.patch.invoiceProfile) {
        await database.enterpriseInvoiceProfile.deleteMany({
          where: { enterpriseCustomerId: command.enterpriseId },
        });
        await database.enterpriseInvoiceProfile.create({
          data: {
            enterpriseCustomerId: command.enterpriseId,
            ...command.patch.invoiceProfile,
            isDefault: true,
          },
        });
      }
      const updatedRow = await database.enterpriseCustomer.findUniqueOrThrow({
        where: { id: command.enterpriseId },
        include: includeProfile,
      });
      const record = toRecord(updatedRow);
      await this.snapshot(database, record, 'PATCH_PROFILE', command.applicantIdentityId);
      await this.remember(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
        record,
      );
      return { kind: 'OK', replayed: false, value: record } as const;
    }, { isolationLevel: 'Serializable' });
  }

  async submit(command: SubmitEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = `enterprise-registration:${command.enterpriseId}:submit`;
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      const currentRow = await database.enterpriseCustomer.findUnique({
        where: { id: command.enterpriseId },
        include: includeProfile,
      });
      if (!currentRow) return { kind: 'NOT_FOUND' } as const;
      const current = toRecord(currentRow);
      if (current.applicantIdentityId !== command.applicantIdentityId) {
        return { kind: 'NOT_FOUND' } as const;
      }
      if (current.version !== command.expectedVersion) {
        return { kind: 'VERSION_CONFLICT' } as const;
      }
      if (!canEnterpriseApplicantSubmit(current.status)) {
        return { kind: 'STATE_CONFLICT' } as const;
      }
      const nextVersion = current.version + 1;
      const submittedAt = new Date();
      const update = await database.enterpriseCustomer.updateMany({
        where: { id: current.id, version: current.version, status: current.status },
        data: {
          status: 'PENDING_REVIEW',
          correctionFields: [],
          submittedAt,
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) return { kind: 'VERSION_CONFLICT' } as const;
      await database.approvalTask.create({
        data: {
          approvalType: 'ENTERPRISE_CERTIFICATION',
          objectType: 'ENTERPRISE_CUSTOMER',
          objectId: current.id,
          applicantType: 'ENTERPRISE_USER',
          applicantId: command.applicantIdentityId,
          assignedAccountTypeCode: 'COMPANY_SUPPLIER_OPS',
          requestSnapshot: json(current),
          version: nextVersion,
        },
      });
      await database.enterpriseCustomerStatusHistory.create({
        data: {
          enterpriseId: current.id,
          fromStatus: current.status,
          toStatus: 'PENDING_REVIEW',
          event: current.status === 'DRAFT' ? 'SUBMIT_CERTIFICATION' : 'RESUBMIT',
          actorIdentityId: command.applicantIdentityId,
          version: nextVersion,
        },
      });
      const updatedRow = await database.enterpriseCustomer.findUniqueOrThrow({
        where: { id: current.id },
        include: includeProfile,
      });
      const record = toRecord(updatedRow);
      await this.snapshot(database, record, 'SUBMIT_REVIEW', command.applicantIdentityId);
      await this.remember(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
        record,
      );
      return { kind: 'OK', replayed: false, value: record } as const;
    }, { isolationLevel: 'Serializable' });
  }

  async review(command: ReviewEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = `enterprise-registration:${command.enterpriseId}:review`;
    try {
      return await this.prisma.$transaction(async (database) => {
      const replay = await this.replay(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      const currentRow = await database.enterpriseCustomer.findUnique({
        where: { id: command.enterpriseId },
        include: includeProfile,
      });
      if (!currentRow || currentRow.companyId !== command.companyId) {
        return { kind: 'NOT_FOUND' } as const;
      }
      const current = toRecord(currentRow);
      if (current.applicantIdentityId === command.reviewerIdentityId) {
        return { kind: 'SELF_APPROVAL' } as const;
      }
      if (current.version !== command.expectedVersion) {
        return { kind: 'VERSION_CONFLICT' } as const;
      }
      const next = resolveEnterpriseReviewStatus(current.status, command.decision);
      if (!next) return { kind: 'STATE_CONFLICT' } as const;
      const task = await database.approvalTask.findFirst({
        where: {
          approvalType: 'ENTERPRISE_CERTIFICATION',
          objectType: 'ENTERPRISE_CUSTOMER',
          objectId: current.id,
          status: 'PENDING',
          version: current.version,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!task) return { kind: 'VERSION_CONFLICT' } as const;
      const nextVersion = current.version + 1;
      const enterpriseUpdate = await database.enterpriseCustomer.updateMany({
        where: {
          id: current.id,
          companyId: command.companyId,
          status: 'PENDING_REVIEW',
          version: current.version,
        },
        data: {
          status: next,
          agreementStatus: next === 'ACTIVE' ? 'ACTIVE' : current.agreementStatus,
          correctionFields:
            command.decision === 'REQUEST_CORRECTION'
              ? json(command.correctionFields)
              : [],
          reviewOpinion: command.opinion,
          version: { increment: 1 },
        },
      });
      const taskUpdate = await database.approvalTask.updateMany({
        where: { id: task.id, status: 'PENDING', version: current.version },
        data: {
          status: command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewedByType: 'COMPANY_USER',
          reviewedBy: command.reviewerIdentityId,
          reviewOpinion: command.opinion,
          version: nextVersion,
        },
      });
      if (enterpriseUpdate.count !== 1 || taskUpdate.count !== 1) {
        throw new EnterpriseReviewConcurrencyConflict();
      }
      await database.enterpriseCustomerStatusHistory.create({
        data: {
          enterpriseId: current.id,
          fromStatus: current.status,
          toStatus: next,
          event: command.decision,
          actorIdentityId: command.reviewerIdentityId,
          version: nextVersion,
        },
      });
      if (next === 'ACTIVE') {
        await database.enterpriseUser.updateMany({
          where: { enterpriseCustomerId: current.id, role: 'ENTERPRISE_ADMIN' },
          data: { status: 'ACTIVE' },
        });
        const invoice = currentRow.invoiceProfiles.find((item) => item.isDefault);
        const address = currentRow.addresses.find((item) => item.isDefault);
        await database.enterpriseProcurementProfile.upsert({
          where: { enterpriseCustomerId: current.id },
          create: {
            enterpriseCustomerId: current.id,
            defaultInvoiceProfileId: invoice?.id ?? null,
            defaultAddressId: address?.id ?? null,
            status: 'ACTIVE',
          },
          update: {
            defaultInvoiceProfileId: invoice?.id ?? null,
            defaultAddressId: address?.id ?? null,
            status: 'ACTIVE',
            version: { increment: 1 },
          },
        });
      }
      const updatedRow = await database.enterpriseCustomer.findUniqueOrThrow({
        where: { id: current.id },
        include: includeProfile,
      });
      const record = toRecord(updatedRow);
      await this.snapshot(database, record, command.decision, command.reviewerIdentityId);
      await this.remember(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
        record,
      );
      return { kind: 'OK', replayed: false, value: record } as const;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error instanceof EnterpriseReviewConcurrencyConflict) {
        return { kind: 'VERSION_CONFLICT' };
      }
      throw error;
    }
  }

  async suspend(command: SuspendEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = `enterprise-registration:${command.enterpriseId}:suspend`;
    return this.prisma.$transaction(async (database) => {
      const replay = await this.replay(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
      );
      if (replay) return replay;
      const currentRow = await database.enterpriseCustomer.findUnique({
        where: { id: command.enterpriseId },
        include: includeProfile,
      });
      if (!currentRow || currentRow.companyId !== command.companyId) {
        return { kind: 'NOT_FOUND' } as const;
      }
      const current = toRecord(currentRow);
      if (current.applicantIdentityId === command.reviewerIdentityId) {
        return { kind: 'SELF_APPROVAL' } as const;
      }
      if (current.version !== command.expectedVersion) {
        return { kind: 'VERSION_CONFLICT' } as const;
      }
      if (current.status !== 'ACTIVE') return { kind: 'STATE_CONFLICT' } as const;
      const nextVersion = current.version + 1;
      const update = await database.enterpriseCustomer.updateMany({
        where: { id: current.id, companyId: command.companyId, status: 'ACTIVE', version: current.version },
        data: {
          status: 'SUSPENDED',
          agreementStatus: 'TERMINATED',
          reviewOpinion: command.reason,
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) return { kind: 'VERSION_CONFLICT' } as const;
      await database.enterpriseUser.updateMany({
        where: { enterpriseCustomerId: current.id },
        data: { status: 'SUSPENDED' },
      });
      await database.enterpriseProcurementProfile.updateMany({
        where: { enterpriseCustomerId: current.id },
        data: { status: 'SUSPENDED', version: { increment: 1 } },
      });
      await database.enterpriseCustomerStatusHistory.create({
        data: {
          enterpriseId: current.id,
          fromStatus: 'ACTIVE',
          toStatus: 'SUSPENDED',
          event: 'SUSPEND',
          actorIdentityId: command.reviewerIdentityId,
          version: nextVersion,
        },
      });
      const updatedRow = await database.enterpriseCustomer.findUniqueOrThrow({
        where: { id: current.id },
        include: includeProfile,
      });
      const record = toRecord(updatedRow);
      await this.snapshot(database, record, 'SUSPEND', command.reviewerIdentityId);
      await this.remember(
        database,
        scope,
        command.idempotencyKey,
        command.requestHash,
        record,
      );
      return { kind: 'OK', replayed: false, value: record } as const;
    }, { isolationLevel: 'Serializable' });
  }

  async list(query: EnterpriseListQuery): Promise<EnterpriseListResult> {
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
    } satisfies Prisma.EnterpriseCustomerWhereInput;
    const [records, total] = await this.prisma.$transaction([
      this.prisma.enterpriseCustomer.findMany({
        where,
        include: includeProfile,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.enterpriseCustomer.count({ where }),
    ]);
    return { items: records.map(toRecord), total };
  }
}
