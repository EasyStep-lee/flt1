import { randomUUID } from 'node:crypto';

import type { BusinessInquiryResponseDto } from './business-inquiry.dto.js';
import type {
  BusinessInquiryMutationResult,
  BusinessInquiryRepository,
  SubmitBusinessInquiryCommand,
} from './business-inquiry.repository.js';

interface CompanySeed {
  readonly id: string;
  readonly legalName: string;
  readonly status: string;
}

interface StoredInquiry {
  readonly companyId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly response: BusinessInquiryResponseDto;
}

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

const response = (date: Date): BusinessInquiryResponseDto => ({
  leadNumber: `FLX${datePart(date)}${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
  status: 'SUBMITTED',
  submittedAt: date.toISOString(),
  useNotice: '资料仅用于本次企业福利咨询与后续联系，不会直接创建福利卡资金账户。',
  contactExpectation: '公司将在完成内部受理后联系；具体时间以实际沟通为准。',
  modificationOrWithdrawalChannel: '189****9999',
});

export class InMemoryBusinessInquiryRepository implements BusinessInquiryRepository {
  private readonly inquiries: StoredInquiry[] = [];
  private auditEvents = 0;

  constructor(private readonly companies: readonly CompanySeed[]) {}

  async submit(command: SubmitBusinessInquiryCommand): Promise<BusinessInquiryMutationResult> {
    const active = this.companies.filter(
      (company) =>
        company.status === 'ACTIVE' &&
        company.legalName === '江苏福礼团供应链科技有限公司',
    );
    if (active.length !== 1) return { kind: 'SINGLE_MERCHANT_VIOLATION' };
    const existing = this.inquiries.find(
      (item) =>
        item.companyId === active[0]!.id && item.idempotencyKey === command.idempotencyKey,
    );
    if (existing) {
      return existing.requestHash === command.requestHash
        ? { kind: 'OK', replayed: true, value: structuredClone(existing.response) }
        : { kind: 'IDEMPOTENCY_CONFLICT' };
    }
    const value = response(new Date());
    this.inquiries.push({
      companyId: active[0]!.id,
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      response: value,
    });
    this.auditEvents += 1;
    return { kind: 'OK', replayed: false, value: structuredClone(value) };
  }

  countInquiries(): number {
    return this.inquiries.length;
  }

  countAuditEvents(): number {
    return this.auditEvents;
  }

  countWelfareAccountsCreated(): number {
    return 0;
  }
}
