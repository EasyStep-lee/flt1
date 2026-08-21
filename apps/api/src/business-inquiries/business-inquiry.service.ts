import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type {
  BusinessInquiryPayload,
  BusinessInquiryRepository,
} from './business-inquiry.repository.js';
import { BUSINESS_INQUIRY_REPOSITORY } from './business-inquiry.repository.js';
import {
  BUSINESS_INQUIRY_DATA_PROTECTOR,
  BusinessInquirySecurityService,
  type BusinessInquiryDataProtector,
} from './business-inquiry.security.js';

const allowedFields = [
  'contactName',
  'enterpriseName',
  'mobile',
  'demandSummary',
  'consentToUse',
] as const;
const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const mobilePattern = /^\+?\d{8,15}$/u;

const text = (
  body: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): string => {
  const value = typeof body[key] === 'string' ? body[key].trim() : '';
  if (value.length < minimum || value.length > maximum) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${key} is invalid`);
  }
  return value;
};

const normalize = (body: Record<string, unknown>): BusinessInquiryPayload => {
  const unknown = Object.keys(body).find(
    (key) => !allowedFields.some((allowed) => allowed === key),
  );
  if (unknown) {
    throw new SafeApiError(403, 'FIELD_FORBIDDEN', `Field is forbidden: ${unknown}`);
  }
  const mobile = text(body, 'mobile', 8, 16).replaceAll(/\s|-/gu, '');
  if (!mobilePattern.test(mobile)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'mobile is invalid');
  }
  if (body.consentToUse !== true) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'consentToUse must be true');
  }
  return {
    contactName: text(body, 'contactName', 2, 64),
    enterpriseName: text(body, 'enterpriseName', 2, 191),
    mobile,
    demandSummary: text(body, 'demandSummary', 10, 500),
    consentToUse: true,
  };
};

@Injectable()
export class BusinessInquiryService {
  constructor(
    @Inject(BUSINESS_INQUIRY_REPOSITORY)
    private readonly repository: BusinessInquiryRepository,
    @Inject(BusinessInquirySecurityService)
    private readonly security: BusinessInquirySecurityService,
    @Inject(BUSINESS_INQUIRY_DATA_PROTECTOR)
    private readonly dataProtector: BusinessInquiryDataProtector,
  ) {}

  async submit(
    body: Record<string, unknown>,
    idempotencyKeyValue: string | undefined,
    context: {
      readonly captchaToken: string | undefined;
      readonly origin: string | undefined;
      readonly requestId: string;
      readonly secFetchSite: string | undefined;
      readonly sourceIp: string;
    },
  ) {
    const payload = normalize(body);
    const idempotencyKey = idempotencyKeyValue?.trim();
    if (!idempotencyKey || !idempotencyKeyPattern.test(idempotencyKey)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'A valid Idempotency-Key is required');
    }
    const sourceFingerprint = await this.security.verify({ ...context, rateSubject: payload.mobile });
    const contactMobileEncrypted = await this.dataProtector.protectMobile(payload.mobile);
    const result = await this.repository.submit({
      payload,
      contactMobileEncrypted,
      idempotencyKey,
      requestHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      requestId: context.requestId,
      sourceFingerprint,
    });
    if (result.kind === 'IDEMPOTENCY_CONFLICT') {
      throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key payload conflicts');
    }
    if (result.kind === 'SINGLE_MERCHANT_VIOLATION') {
      throw new SafeApiError(409, 'SINGLE_MERCHANT_VIOLATION', 'Single merchant invariant failed');
    }
    if (result.kind === 'AUDIT_REQUIRED') {
      throw new SafeApiError(503, 'AUDIT_REQUIRED', 'Business inquiry audit append failed');
    }
    return { body: result.value, replayed: result.replayed };
  }
}
