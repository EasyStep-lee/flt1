import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type { CompanyEnterpriseReviewerActor } from './enterprise-onboarding.actor.js';
import {
  ENTERPRISE_CORRECTION_FIELDS,
  ENTERPRISE_CUSTOMER_STATUSES,
  ENTERPRISE_REVIEW_DECISIONS,
  isValidCreditCode,
  maskBankAccount,
  maskCreditCode,
  maskMobile,
  maskTaxNumber,
  normalizeCreditCode,
  resolveEnterpriseNextAction,
  type EnterpriseCorrectionField,
  type EnterpriseCustomerStatus,
  type EnterpriseReviewDecision,
} from './enterprise-onboarding.policy.js';
import {
  ENTERPRISE_ONBOARDING_REPOSITORY,
  type EnterpriseAddressRecord,
  type EnterpriseInvoiceProfileRecord,
  type EnterpriseMutationFailureKind,
  type EnterpriseMutationResult,
  type EnterpriseOnboardingRecord,
  type EnterpriseOnboardingRepository,
  type EnterpriseProfilePatch,
} from './enterprise-onboarding.repository.js';
import {
  ENTERPRISE_REGISTRATION_VERIFIER,
  type EnterpriseRegistrationVerifier,
} from './enterprise-registration.verifier.js';
import { EnterpriseRegistrationTokenService } from './enterprise-registration-token.service.js';

const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const mobilePattern = /^\+?\d{8,15}$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const licenseReferencePattern =
  /^object:\/\/enterprise-certification\/[A-Za-z0-9][A-Za-z0-9._/-]{0,218}$/u;

const ownershipKeys = new Set([
  'actorId',
  'applicantIdentityId',
  'companyId',
  'enterpriseCustomerId',
  'identityId',
  'reviewedBy',
  'status',
]);
const registrationKeys = new Set([
  'addresses',
  'administratorEmail',
  'administratorMobile',
  'administratorName',
  'administratorTitle',
  'agreementVersion',
  'creditCode',
  'enterpriseType',
  'invoiceProfile',
  'legalName',
  'licenseObjectKey',
  'licenseValidUntil',
  'registeredAddress',
  'verificationCode',
]);
const patchKeys = new Set([
  'addresses',
  'administratorEmail',
  'administratorName',
  'administratorTitle',
  'creditCode',
  'enterpriseType',
  'invoiceProfile',
  'legalName',
  'licenseObjectKey',
  'licenseValidUntil',
  'registeredAddress',
  'version',
]);

const assertObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request body must be an object');
  }
  return value as Record<string, unknown>;
};

const assertAllowedKeys = (input: Record<string, unknown>, allowed: Set<string>): void => {
  const key = Object.keys(input).find((item) => ownershipKeys.has(item) || !allowed.has(item));
  if (key) {
    throw new SafeApiError(
      403,
      'FIELD_FORBIDDEN',
      `Client-controlled field is forbidden: ${key}`,
    );
  }
};

const requiredString = (
  input: Record<string, unknown>,
  key: string,
  maxLength: number,
): string => {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${key} is invalid`);
  }
  return value.trim();
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | undefined => {
  const value = input[key];
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(input, key, maxLength);
};

const requiredVersion = (input: Record<string, unknown>): number => {
  if (!Number.isInteger(input.version) || Number(input.version) < 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'version is invalid');
  }
  return Number(input.version);
};

const requireIdempotencyKey = (value: string | undefined): string => {
  if (!value || !idempotencyKeyPattern.test(value)) {
    throw new SafeApiError(
      428,
      'IDEMPOTENCY_KEY_REQUIRED',
      'A valid Idempotency-Key is required',
    );
  }
  return value;
};

const hashRequest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const normalizeDate = (value: unknown, key: string): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${key} is invalid`);
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${key} is invalid`);
  }
  return new Date(timestamp).toISOString();
};

const parseAddresses = (value: unknown): readonly Omit<EnterpriseAddressRecord, 'id'>[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 20) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'addresses is invalid');
  }
  const addresses = value.map((raw) => {
    const item = assertObject(raw);
    const allowed = new Set([
      'consignee',
      'deliveryNote',
      'fullAddress',
      'isDefault',
      'mobile',
      'region',
    ]);
    const unknown = Object.keys(item).find((key) => !allowed.has(key));
    if (unknown) {
      throw new SafeApiError(403, 'FIELD_FORBIDDEN', `Address field is forbidden: ${unknown}`);
    }
    const mobile = requiredString(item, 'mobile', 16);
    if (!mobilePattern.test(mobile)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'address mobile is invalid');
    }
    if (typeof item.isDefault !== 'boolean') {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'address isDefault is invalid');
    }
    const deliveryNote = optionalString(item, 'deliveryNote', 500);
    return {
      consignee: requiredString(item, 'consignee', 128),
      mobile,
      region: requiredString(item, 'region', 64),
      fullAddress: requiredString(item, 'fullAddress', 500),
      ...(deliveryNote ? { deliveryNote } : {}),
      isDefault: item.isDefault,
    };
  });
  if (addresses.filter((item) => item.isDefault).length > 1) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Only one default address is allowed');
  }
  return addresses;
};

const parseInvoice = (
  value: unknown,
): Omit<EnterpriseInvoiceProfileRecord, 'id'> | undefined => {
  if (value === undefined) return undefined;
  const item = assertObject(value);
  const allowed = new Set([
    'bankAccount',
    'bankName',
    'registeredAddress',
    'registeredPhone',
    'taxNumber',
    'title',
  ]);
  const unknown = Object.keys(item).find((key) => !allowed.has(key));
  if (unknown) {
    throw new SafeApiError(403, 'FIELD_FORBIDDEN', `Invoice field is forbidden: ${unknown}`);
  }
  const bankAccount = optionalString(item, 'bankAccount', 64);
  if (bankAccount && !/^\d{8,32}$/u.test(bankAccount.replace(/\s+/gu, ''))) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'bankAccount is invalid');
  }
  const registeredPhone = optionalString(item, 'registeredPhone', 32);
  if (registeredPhone && !/^[+\d\s()-]{6,32}$/u.test(registeredPhone)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'registeredPhone is invalid');
  }
  const registeredAddress = optionalString(item, 'registeredAddress', 500);
  const bankName = optionalString(item, 'bankName', 191);
  return {
    title: requiredString(item, 'title', 191),
    taxNumber: requiredString(item, 'taxNumber', 32).toUpperCase(),
    ...(registeredAddress ? { registeredAddress } : {}),
    ...(registeredPhone ? { registeredPhone } : {}),
    ...(bankName ? { bankName } : {}),
    ...(bankAccount ? { bankAccountMasked: maskBankAccount(bankAccount) } : {}),
  };
};

const parseProfile = (input: Record<string, unknown>): EnterpriseProfilePatch => {
  const legalName = optionalString(input, 'legalName', 191);
  const registeredAddress = optionalString(input, 'registeredAddress', 500);
  const enterpriseType = optionalString(input, 'enterpriseType', 64);
  const administratorName = optionalString(input, 'administratorName', 128);
  const administratorTitle = optionalString(input, 'administratorTitle', 128);
  const creditCodeValue = optionalString(input, 'creditCode', 18);
  const creditCode = creditCodeValue ? normalizeCreditCode(creditCodeValue) : undefined;
  if (creditCode && !isValidCreditCode(creditCode)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'creditCode is invalid');
  }
  const licenseObjectKey = optionalString(input, 'licenseObjectKey', 255);
  if (licenseObjectKey && !licenseReferencePattern.test(licenseObjectKey)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'licenseObjectKey is invalid');
  }
  const administratorEmail = optionalString(input, 'administratorEmail', 254);
  if (administratorEmail && !emailPattern.test(administratorEmail)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'administratorEmail is invalid');
  }
  return {
    ...(legalName ? { legalName } : {}),
    ...(creditCode ? { creditCode } : {}),
    ...(registeredAddress ? { registeredAddress } : {}),
    ...(enterpriseType ? { enterpriseType } : {}),
    ...(licenseObjectKey ? { licenseObjectKey } : {}),
    ...(input.licenseValidUntil !== undefined
      ? {
          licenseValidUntil: normalizeDate(
            input.licenseValidUntil,
            'licenseValidUntil',
          )!,
        }
      : {}),
    ...(administratorName ? { administratorName } : {}),
    ...(administratorEmail ? { administratorEmail } : {}),
    ...(administratorTitle ? { administratorTitle } : {}),
    ...(input.addresses !== undefined ? { addresses: parseAddresses(input.addresses) ?? [] } : {}),
    ...(input.invoiceProfile !== undefined
      ? { invoiceProfile: parseInvoice(input.invoiceProfile)! }
      : {}),
  };
};

const maskEmail = (value: string): string => {
  const [local, domain] = value.split('@');
  if (!local || !domain) return '****';
  return `${local.slice(0, 1)}***@${domain}`;
};

const toResponse = (record: EnterpriseOnboardingRecord) => ({
  id: record.id,
  legalName: record.legalName,
  creditCodeMasked: maskCreditCode(record.creditCode),
  status: record.status,
  version: record.version,
  administratorName: record.administratorName,
  administratorMobileMasked: maskMobile(record.administratorMobile),
  ...(record.administratorEmail
    ? { administratorEmailMasked: maskEmail(record.administratorEmail) }
    : {}),
  ...(record.registeredAddress ? { registeredAddress: record.registeredAddress } : {}),
  ...(record.enterpriseType ? { enterpriseType: record.enterpriseType } : {}),
  businessLicenseProvided: Boolean(record.licenseObjectKey),
  ...(record.licenseObjectKey
    ? { businessLicenseReference: record.licenseObjectKey }
    : {}),
  ...(record.licenseValidUntil
    ? { licenseValidUntil: record.licenseValidUntil.slice(0, 10) }
    : {}),
  addresses: record.addresses.map((address) => ({
    id: address.id,
    consignee: address.consignee,
    mobileMasked: maskMobile(address.mobile),
    region: address.region,
    fullAddress: address.fullAddress,
    ...(address.deliveryNote ? { deliveryNote: address.deliveryNote } : {}),
    isDefault: address.isDefault,
  })),
  ...(record.invoiceProfile
    ? {
        invoiceProfile: {
          id: record.invoiceProfile.id,
          title: record.invoiceProfile.title,
          taxNumberMasked: maskTaxNumber(record.invoiceProfile.taxNumber),
          ...(record.invoiceProfile.registeredAddress
            ? { registeredAddress: record.invoiceProfile.registeredAddress }
            : {}),
          ...(record.invoiceProfile.registeredPhone
            ? { registeredPhoneMasked: maskMobile(record.invoiceProfile.registeredPhone) }
            : {}),
          ...(record.invoiceProfile.bankName
            ? { bankName: record.invoiceProfile.bankName }
            : {}),
          ...(record.invoiceProfile.bankAccountMasked
            ? { bankAccountMasked: record.invoiceProfile.bankAccountMasked }
            : {}),
        },
      }
    : {}),
  correctionFields: [...record.correctionFields],
  ...(record.reviewOpinion ? { reviewOpinion: record.reviewOpinion } : {}),
  nextAction: resolveEnterpriseNextAction(record.status),
});

const throwFailure = (kind: EnterpriseMutationFailureKind): never => {
  if (kind === 'COMPANY_INVARIANT') {
    throw new SafeApiError(409, 'SINGLE_MERCHANT_VIOLATION', 'Single merchant invariant failed');
  }
  if (kind === 'DUPLICATE') {
    throw new SafeApiError(409, 'CREDIT_CODE_DUPLICATE', 'Enterprise already registered');
  }
  if (kind === 'IDEMPOTENCY_CONFLICT') {
    throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key payload conflicts');
  }
  if (kind === 'NOT_FOUND') {
    throw new SafeApiError(404, 'ENTERPRISE_NOT_FOUND', 'Enterprise registration was not found');
  }
  if (kind === 'SELF_APPROVAL') {
    throw new SafeApiError(403, 'SELF_APPROVAL_FORBIDDEN', 'The applicant cannot review the same registration');
  }
  if (kind === 'VERSION_CONFLICT') {
    throw new SafeApiError(409, 'APPROVAL_VERSION_CONFLICT', 'Enterprise version conflicts');
  }
  throw new SafeApiError(409, 'STATE_TRANSITION_INVALID', 'Enterprise state transition is invalid');
};

const unwrap = (result: EnterpriseMutationResult) => {
  if (result.kind !== 'OK') return throwFailure(result.kind);
  return result;
};

const assertComplete = (record: EnterpriseOnboardingRecord): void => {
  const missing: string[] = [];
  if (!record.registeredAddress) missing.push('registeredAddress');
  if (!record.enterpriseType) missing.push('enterpriseType');
  if (!record.licenseObjectKey) missing.push('licenseObjectKey');
  if (!record.administratorEmail) missing.push('administratorEmail');
  if (!record.administratorTitle) missing.push('administratorTitle');
  if (record.addresses.length === 0) missing.push('addresses');
  if (!record.addresses.some((address) => address.isDefault)) missing.push('defaultAddress');
  if (!record.invoiceProfile) missing.push('invoiceProfile');
  if (record.licenseValidUntil && Date.parse(record.licenseValidUntil) < Date.now()) {
    missing.push('licenseValidUntil');
  }
  if (missing.length > 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `Incomplete fields: ${missing.join(',')}`);
  }
};

@Injectable()
export class EnterpriseOnboardingService {
  constructor(
    @Inject(ENTERPRISE_ONBOARDING_REPOSITORY)
    private readonly repository: EnterpriseOnboardingRepository,
    @Inject(ENTERPRISE_REGISTRATION_VERIFIER)
    private readonly verifier: EnterpriseRegistrationVerifier,
    @Inject(EnterpriseRegistrationTokenService)
    private readonly tokenService: EnterpriseRegistrationTokenService,
  ) {}

  async register(body: unknown, idempotencyHeader: string | undefined) {
    const input = assertObject(body);
    assertAllowedKeys(input, registrationKeys);
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const legalName = requiredString(input, 'legalName', 191);
    const creditCode = normalizeCreditCode(requiredString(input, 'creditCode', 18));
    if (!isValidCreditCode(creditCode)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'creditCode is invalid');
    }
    const administratorName = requiredString(input, 'administratorName', 128);
    const administratorMobile = requiredString(input, 'administratorMobile', 16);
    if (!mobilePattern.test(administratorMobile)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'administratorMobile is invalid');
    }
    const verificationCode = requiredString(input, 'verificationCode', 8);
    if (!/^\d{4,8}$/u.test(verificationCode)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'verificationCode is invalid');
    }
    const agreementVersion = requiredString(input, 'agreementVersion', 64);
    const profile = parseProfile(input);
    const verification = await this.verifier.verify({
      idempotencyKey,
      mobile: administratorMobile,
      verificationCode,
    });
    if (!uuidPattern.test(verification.identityId)) {
      throw new SafeApiError(503, 'SERVICE_UNAVAILABLE', 'Verified identity is unavailable');
    }
    const canonical = {
      ...input,
      creditCode,
      verificationCode,
    };
    const result = unwrap(
      await this.repository.register({
        idempotencyKey,
        requestHash: hashRequest(canonical),
        applicantIdentityId: verification.identityId,
        legalName,
        creditCode,
        administratorName,
        administratorMobile,
        ...(profile.administratorEmail
          ? { administratorEmail: profile.administratorEmail }
          : {}),
        ...(profile.administratorTitle
          ? { administratorTitle: profile.administratorTitle }
          : {}),
        agreementVersion,
        profile,
      }),
    );
    const credential = this.tokenService.issue({
      enterpriseId: result.value.id,
      identityId: result.value.applicantIdentityId,
      createdAt: result.value.createdAt,
    });
    return {
      replayed: result.replayed,
      body: {
        registrationId: result.value.id,
        status: result.value.status,
        version: result.value.version,
        registrationAccessToken: credential.token,
        registrationAccessExpiresAt: credential.expiresAt,
        nextAction: 'COMPLETE_PROFILE' as const,
      },
    };
  }

  async getOwn(authorization: string | undefined) {
    const credential = this.tokenService.verify(authorization);
    const record = await this.repository.findById(credential.enterpriseId);
    if (!record || record.applicantIdentityId !== credential.identityId) {
      throw new SafeApiError(404, 'ENTERPRISE_NOT_FOUND', 'Enterprise registration was not found');
    }
    return toResponse(record);
  }

  async patchOwn(
    authorization: string | undefined,
    body: unknown,
    idempotencyHeader: string | undefined,
  ) {
    const credential = this.tokenService.verify(authorization);
    const input = assertObject(body);
    assertAllowedKeys(input, patchKeys);
    const expectedVersion = requiredVersion(input);
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const patch = parseProfile(input);
    const result = unwrap(
      await this.repository.patch({
        enterpriseId: credential.enterpriseId,
        applicantIdentityId: credential.identityId,
        expectedVersion,
        idempotencyKey,
        requestHash: hashRequest({ patch, expectedVersion }),
        patch,
      }),
    );
    return { replayed: result.replayed, body: toResponse(result.value) };
  }

  async submitOwn(
    authorization: string | undefined,
    body: unknown,
    idempotencyHeader: string | undefined,
  ) {
    const credential = this.tokenService.verify(authorization);
    const input = assertObject(body);
    assertAllowedKeys(input, new Set(['version']));
    const expectedVersion = requiredVersion(input);
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const current = await this.repository.findById(credential.enterpriseId);
    if (!current || current.applicantIdentityId !== credential.identityId) {
      throw new SafeApiError(404, 'ENTERPRISE_NOT_FOUND', 'Enterprise registration was not found');
    }
    assertComplete(current);
    const result = unwrap(
      await this.repository.submit({
        enterpriseId: credential.enterpriseId,
        applicantIdentityId: credential.identityId,
        expectedVersion,
        idempotencyKey,
        requestHash: hashRequest({ expectedVersion }),
      }),
    );
    return { replayed: result.replayed, body: toResponse(result.value) };
  }

  async listForCompany(
    actor: CompanyEnterpriseReviewerActor,
    queryValue: unknown,
  ) {
    const query = assertObject(queryValue ?? {});
    const allowed = new Set(['keyword', 'page', 'pageSize', 'status']);
    const unknown = Object.keys(query).find((key) => !allowed.has(key));
    if (unknown) throw new SafeApiError(422, 'VALIDATION_FAILED', 'Query is invalid');
    const statusValue = query.status;
    const status =
      statusValue === undefined || statusValue === ''
        ? undefined
        : String(statusValue) as EnterpriseCustomerStatus;
    if (status && !ENTERPRISE_CUSTOMER_STATUSES.includes(status)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'status is invalid');
    }
    const page = query.page === undefined ? 1 : Number(query.page);
    const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'pagination is invalid');
    }
    const keyword = query.keyword === undefined ? undefined : String(query.keyword).trim();
    const result = await this.repository.list({
      companyId: actor.companyId,
      ...(status ? { status } : {}),
      ...(keyword ? { keyword } : {}),
      page,
      pageSize,
    });
    return {
      items: result.items.map(toResponse),
      page,
      pageSize,
      total: result.total,
    };
  }

  async reviewForCompany(
    actor: CompanyEnterpriseReviewerActor,
    enterpriseId: string,
    body: unknown,
    idempotencyHeader: string | undefined,
  ) {
    if (!uuidPattern.test(enterpriseId)) {
      throw new SafeApiError(404, 'ENTERPRISE_NOT_FOUND', 'Enterprise registration was not found');
    }
    const input = assertObject(body);
    assertAllowedKeys(input, new Set(['correctionFields', 'decision', 'opinion', 'version']));
    const decision = requiredString(input, 'decision', 32) as EnterpriseReviewDecision;
    if (!ENTERPRISE_REVIEW_DECISIONS.includes(decision)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'decision is invalid');
    }
    const expectedVersion = requiredVersion(input);
    const opinion = requiredString(input, 'opinion', 1000);
    const correctionFieldsRaw = input.correctionFields ?? [];
    if (!Array.isArray(correctionFieldsRaw)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'correctionFields is invalid');
    }
    const correctionFields = [...new Set(correctionFieldsRaw.map(String))] as EnterpriseCorrectionField[];
    if (
      correctionFields.some((field) => !ENTERPRISE_CORRECTION_FIELDS.includes(field)) ||
      (decision === 'REQUEST_CORRECTION' && correctionFields.length === 0) ||
      (decision !== 'REQUEST_CORRECTION' && correctionFields.length > 0)
    ) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'correctionFields is invalid');
    }
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const request = { correctionFields, decision, expectedVersion, opinion };
    const result = unwrap(
      await this.repository.review({
        enterpriseId,
        companyId: actor.companyId,
        reviewerIdentityId: actor.identityId,
        expectedVersion,
        decision,
        opinion,
        correctionFields,
        idempotencyKey,
        requestHash: hashRequest(request),
      }),
    );
    return { replayed: result.replayed, body: toResponse(result.value) };
  }

  async suspendForCompany(
    actor: CompanyEnterpriseReviewerActor,
    enterpriseId: string,
    body: unknown,
    idempotencyHeader: string | undefined,
  ) {
    if (!uuidPattern.test(enterpriseId)) {
      throw new SafeApiError(404, 'ENTERPRISE_NOT_FOUND', 'Enterprise registration was not found');
    }
    const input = assertObject(body);
    assertAllowedKeys(input, new Set(['reason', 'version']));
    const expectedVersion = requiredVersion(input);
    const reason = requiredString(input, 'reason', 1000);
    const idempotencyKey = requireIdempotencyKey(idempotencyHeader);
    const result = unwrap(
      await this.repository.suspend({
        enterpriseId,
        companyId: actor.companyId,
        reviewerIdentityId: actor.identityId,
        expectedVersion,
        reason,
        idempotencyKey,
        requestHash: hashRequest({ expectedVersion, reason }),
      }),
    );
    return { replayed: result.replayed, body: toResponse(result.value) };
  }
}
