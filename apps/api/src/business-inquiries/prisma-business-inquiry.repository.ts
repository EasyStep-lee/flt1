import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type { BusinessInquiryResponseDto } from './business-inquiry.dto.js';
import type {
  BusinessInquiryMutationResult,
  BusinessInquiryRepository,
  SubmitBusinessInquiryCommand,
} from './business-inquiry.repository.js';

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const datePart = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}${value('month')}${value('day')}`;
};

const responseFrom = (row: {
  readonly leadNumber: string;
  readonly status: string;
  readonly createdAt: Date;
}): BusinessInquiryResponseDto => ({
  leadNumber: row.leadNumber,
  status: 'SUBMITTED',
  submittedAt: row.createdAt.toISOString(),
  useNotice: '资料仅用于本次企业福利咨询与后续联系，不会直接创建福利卡资金账户。',
  contactExpectation: '公司将在完成内部受理后联系；具体时间以实际沟通为准。',
  modificationOrWithdrawalChannel: '189****9999',
});

@Injectable()
export class PrismaBusinessInquiryRepository implements BusinessInquiryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async submit(command: SubmitBusinessInquiryCommand): Promise<BusinessInquiryMutationResult> {
    const companies = await this.prisma.company.findMany({
      where: {
        legalName: '江苏福礼团供应链科技有限公司',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (companies.length !== 1) return { kind: 'SINGLE_MERCHANT_VIOLATION' };
    const companyId = companies[0]!.id;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.businessInquiry.findUnique({
            where: {
              companyId_idempotencyKey: { companyId, idempotencyKey: command.idempotencyKey },
            },
          });
          if (existing) {
            return existing.requestHash === command.requestHash
              ? { kind: 'OK', replayed: true, value: responseFrom(existing) }
              : { kind: 'IDEMPOTENCY_CONFLICT' };
          }
          const createdAt = new Date();
          const created = await tx.businessInquiry.create({
            data: {
              id: randomUUID(),
              companyId,
              leadNumber: `FLX${datePart(createdAt)}${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
              inquiryType: 'ENTERPRISE_WELFARE',
              contactName: command.payload.contactName,
              enterpriseName: command.payload.enterpriseName,
              contactMobileEncrypted: command.contactMobileEncrypted,
              demandSummary: command.payload.demandSummary,
              sourcePage: '/welfare-card-service',
              consentVersion: 1,
              consentedAt: createdAt,
              status: 'SUBMITTED',
              idempotencyKey: command.idempotencyKey,
              requestHash: command.requestHash,
              requestId: command.requestId,
              sourceFingerprint: command.sourceFingerprint,
              createdAt,
            },
          });
          const value = responseFrom(created);
          await tx.auditLog.create({
            data: {
              actorType: 'SYSTEM',
              actorId: command.sourceFingerprint,
              action: 'BUSINESS_INQUIRY_SUBMITTED',
              objectType: 'BUSINESS_INQUIRY',
              objectId: created.id,
              beforeSnapshot: json(null),
              afterSnapshot: json({
                leadNumber: created.leadNumber,
                status: created.status,
                inquiryType: created.inquiryType,
                consentedAt: created.consentedAt.toISOString(),
              }),
              requestId: command.requestId,
            },
          });
          return { kind: 'OK', replayed: false, value };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const existing = await this.prisma.businessInquiry.findUnique({
          where: {
            companyId_idempotencyKey: { companyId, idempotencyKey: command.idempotencyKey },
          },
        });
        if (existing) {
          return existing.requestHash === command.requestHash
            ? { kind: 'OK', replayed: true, value: responseFrom(existing) }
            : { kind: 'IDEMPOTENCY_CONFLICT' };
        }
      }
      return { kind: 'AUDIT_REQUIRED' };
    }
  }
}
