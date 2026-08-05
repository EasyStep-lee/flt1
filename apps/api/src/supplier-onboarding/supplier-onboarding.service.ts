import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import {
  COMPANY_LEGAL_NAME,
  PLATFORM_NAME,
} from '../merchant/single-merchant.service.js';
import type {
  CompanySupplierOpsActor,
  SupplierAccountAdminActor,
} from './supplier-onboarding.actor.js';
import {
  collectSupplierSubmissionIssues,
  isValidCreditCode,
  maskCreditCode,
  normalizeCreditCode,
  resolveSupplierTransition,
  SUPPLIER_STATUSES,
  type SupplierQualificationSnapshot,
  type SupplierStatus,
} from './supplier-onboarding.policy.js';
import {
  SUPPLIER_ONBOARDING_REPOSITORY,
  type ApprovalTaskRecord,
  type SupplierMutationFailureKind,
  type SupplierMutationResult,
  type SupplierOnboardingRecord,
  type SupplierOnboardingRepository,
} from './supplier-onboarding.repository.js';
import {
  SUPPLIER_REGISTRATION_VERIFIER,
  type SupplierRegistrationVerifier,
} from './supplier-registration.verifier.js';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const mobilePattern = /^\+?\d{8,15}$/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const qualificationReferencePattern =
  /^object:\/\/supplier-qualification\/[A-Za-z0-9][A-Za-z0-9._/-]{0,223}$/u;

const registrationAllowedKeys = new Set([
  'agreementVersion',
  'contactName',
  'creditCode',
  'email',
  'legalName',
  'mobile',
  'pickupAddress',
  'pickupLat',
  'pickupLng',
  'qualificationFiles',
  'verificationCode',
]);
const ownershipKeys = new Set([
  'actorId',
  'applicantId',
  'companyId',
  'reviewedBy',
  'status',
  'supplierId',
]);
const profileAllowedKeys = new Set([
  'pickupAddress',
  'pickupLat',
  'pickupLng',
  'qualificationSnapshot',
  'settlementAccountChangeRequest',
  'version',
]);
const profileServerControlledKeys = new Set([
  'companyId',
  'creditCode',
  'id',
  'settlementAccountMasked',
  'status',
  'supplierId',
]);

const hashRequest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const assertObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request body is invalid');
  }
  return value as Record<string, unknown>;
};

const assertAllowedKeys = (
  input: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
  forbidden: ReadonlySet<string>,
): void => {
  const keys = Object.keys(input);
  if (keys.some((key) => forbidden.has(key))) {
    throw new SafeApiError(403, 'FIELD_FORBIDDEN', 'A server-controlled field was supplied');
  }
  if (keys.some((key) => !allowed.has(key))) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request body contains an unknown field');
  }
};

const requiredString = (
  input: Readonly<Record<string, unknown>>,
  field: string,
  maximumLength: number,
): string => {
  const value = input[field];
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximumLength) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} is invalid`);
  }
  return value.trim();
};

const optionalCoordinate = (
  input: Readonly<Record<string, unknown>>,
  field: 'pickupLat' | 'pickupLng',
): number | null => {
  const value = input[field];
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} is invalid`);
  }
  return value;
};

const optionalPickupAddress = (
  input: Readonly<Record<string, unknown>>,
): string | null => {
  const value = input.pickupAddress;
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 500) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'pickupAddress is invalid');
  }
  return value.trim() || null;
};

const qualificationFiles = (value: unknown): readonly string[] => {
  if (!Array.isArray(value) || value.length > 50) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'qualificationFiles is invalid');
  }
  const files = value.map((candidate) => {
    if (
      typeof candidate !== 'string' ||
      !qualificationReferencePattern.test(candidate)
    ) {
      throw new SafeApiError(
        422,
        'VALIDATION_FAILED',
        'qualificationFiles contains an invalid reference',
      );
    }
    return candidate;
  });
  if (new Set(files).size !== files.length) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'qualificationFiles contains duplicates');
  }
  return files;
};

const assertVersion = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'version is invalid');
  }
  return Number(value);
};

const assertIdempotencyKey = (value: string | undefined): string => {
  if (!value || !idempotencyKeyPattern.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Idempotency-Key is required');
  }
  return value;
};

const throwRepositoryFailure = (kind: SupplierMutationFailureKind): never => {
  if (kind === 'DUPLICATE') {
    throw new SafeApiError(409, 'SUPPLIER_DUPLICATE', 'Supplier already exists');
  }
  if (kind === 'VERSION_CONFLICT') {
    throw new SafeApiError(409, 'VERSION_CONFLICT', 'Supplier version has changed');
  }
  if (kind === 'APPROVAL_VERSION_CONFLICT') {
    throw new SafeApiError(
      409,
      'APPROVAL_VERSION_CONFLICT',
      'Approval version has changed',
    );
  }
  if (kind === 'STATE_INVALID') {
    throw new SafeApiError(
      409,
      'STATE_TRANSITION_INVALID',
      'Supplier state transition is not allowed',
    );
  }
  if (kind === 'SAME_NATURAL_PERSON') {
    throw new SafeApiError(
      428,
      'SECOND_VERIFICATION_REQUIRED',
      'A different natural person must review this application',
    );
  }
  if (kind === 'NOT_FOUND') {
    throw new SafeApiError(404, 'RESOURCE_NOT_FOUND', 'Supplier was not found');
  }
  if (kind === 'COMPANY_INVARIANT') {
    throw new SafeApiError(
      409,
      'SINGLE_MERCHANT_VIOLATION',
      'Single merchant invariant is not satisfied',
    );
  }
  throw new SafeApiError(
    422,
    'VALIDATION_FAILED',
    'Idempotency-Key conflicts with an earlier request',
  );
};

const unwrap = <T>(result: SupplierMutationResult<T>): { value: T; replayed: boolean } => {
  if (result.kind === 'OK') {
    return { value: result.value, replayed: result.replayed };
  }
  return throwRepositoryFailure(result.kind);
};

export interface SupplierRegistrationResponseModel {
  readonly registrationId: string;
  readonly status: SupplierStatus;
  readonly nextAction:
    | 'COMPLETE_PROFILE'
    | 'CORRECT_AND_RESUBMIT'
    | 'LOGIN_AFTER_ACTIVATION'
    | 'REVIEW_IN_PROGRESS';
  readonly submittedAt?: string;
}

export interface SupplierQualificationSummaryModel {
  readonly fileCount: number;
  readonly complete: boolean;
}

export interface SupplierResponseModel {
  readonly id: string;
  readonly legalName: string;
  readonly creditCodeMasked: string;
  readonly status: SupplierStatus;
  readonly qualificationSummary: SupplierQualificationSummaryModel;
  readonly version: number;
}

export interface SupplierProfileResponseModel extends SupplierResponseModel {
  readonly pickupAddress: string | null;
  readonly pickupLat: number | null;
  readonly pickupLng: number | null;
  readonly settlementAccountMasked: string | null;
}

export interface ApprovalTaskResponseModel {
  readonly id: string;
  readonly approvalType: 'SUPPLIER_ONBOARDING';
  readonly objectType: 'SUPPLIER';
  readonly objectId: string;
  readonly status: ApprovalTaskRecord['status'];
  readonly assignedAccountTypeCode: 'COMPANY_SUPPLIER_OPS';
  readonly reviewOpinion?: string;
  readonly version: number;
}

const qualificationSummary = (
  supplier: SupplierOnboardingRecord,
): SupplierQualificationSummaryModel => ({
  fileCount: supplier.qualificationSnapshot.files.length,
  complete: collectSupplierSubmissionIssues(supplier).length === 0,
});

const toSupplierResponse = (
  supplier: SupplierOnboardingRecord,
): SupplierResponseModel => ({
  id: supplier.id,
  legalName: supplier.legalName,
  creditCodeMasked: maskCreditCode(supplier.creditCode),
  status: supplier.status,
  qualificationSummary: qualificationSummary(supplier),
  version: supplier.version,
});

const toProfileResponse = (
  supplier: SupplierOnboardingRecord,
): SupplierProfileResponseModel => ({
  ...toSupplierResponse(supplier),
  pickupAddress: supplier.pickupAddress,
  pickupLat: supplier.pickupLat,
  pickupLng: supplier.pickupLng,
  settlementAccountMasked: supplier.settlementAccountMasked,
});

const toApprovalResponse = (
  approval: ApprovalTaskRecord,
): ApprovalTaskResponseModel => ({
  id: approval.id,
  approvalType: approval.approvalType,
  objectType: approval.objectType,
  objectId: approval.objectId,
  status: approval.status,
  assignedAccountTypeCode: approval.assignedAccountTypeCode,
  ...(approval.reviewOpinion ? { reviewOpinion: approval.reviewOpinion } : {}),
  version: approval.version,
});

const nextAction = (
  status: SupplierStatus,
): SupplierRegistrationResponseModel['nextAction'] => {
  if (status === 'DRAFT') return 'COMPLETE_PROFILE';
  if (status === 'CORRECTION_REQUIRED') return 'CORRECT_AND_RESUBMIT';
  if (status === 'ACTIVE') return 'LOGIN_AFTER_ACTIVATION';
  return 'REVIEW_IN_PROGRESS';
};

@Injectable()
export class SupplierOnboardingService {
  constructor(
    @Inject(SUPPLIER_ONBOARDING_REPOSITORY)
    private readonly repository: SupplierOnboardingRepository,
    @Inject(SUPPLIER_REGISTRATION_VERIFIER)
    private readonly registrationVerifier: SupplierRegistrationVerifier,
  ) {}

  async register(
    body: unknown,
    idempotencyHeader: string | undefined,
  ): Promise<{ body: SupplierRegistrationResponseModel; replayed: boolean }> {
    const input = assertObject(body);
    assertAllowedKeys(input, registrationAllowedKeys, ownershipKeys);
    const idempotencyKey = assertIdempotencyKey(idempotencyHeader);
    const legalName = requiredString(input, 'legalName', 128);
    const creditCode = normalizeCreditCode(requiredString(input, 'creditCode', 64));
    if (!isValidCreditCode(creditCode)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'creditCode is invalid');
    }
    const contactName = requiredString(input, 'contactName', 128);
    const mobile = requiredString(input, 'mobile', 16);
    if (!mobilePattern.test(mobile)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'mobile is invalid');
    }
    const emailValue = input.email;
    const email =
      emailValue === undefined || emailValue === ''
        ? undefined
        : requiredString(input, 'email', 254);
    if (email && !emailPattern.test(email)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'email is invalid');
    }
    const verificationCode = requiredString(input, 'verificationCode', 12);
    if (!/^\d{4,8}$/u.test(verificationCode)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'verificationCode is invalid');
    }
    const agreementVersion = requiredString(input, 'agreementVersion', 64);
    const files = qualificationFiles(input.qualificationFiles);
    const pickupAddress = optionalPickupAddress(input);
    const pickupLat = optionalCoordinate(input, 'pickupLat');
    const pickupLng = optionalCoordinate(input, 'pickupLng');
    const qualificationSnapshot: SupplierQualificationSnapshot = {
      schemaVersion: '1.0',
      files,
      applicant: {
        agreementVersion,
        contactName,
        ...(email ? { email } : {}),
        mobile,
      },
    };
    const canonicalRequest = {
      agreementVersion,
      contactName,
      creditCode,
      ...(email ? { email } : {}),
      legalName,
      mobile,
      pickupAddress,
      pickupLat,
      pickupLng,
      qualificationFiles: files,
      verificationCode,
    };
    await this.registrationVerifier.verify({
      idempotencyKey,
      mobile,
      verificationCode,
    });
    const result = unwrap(
      await this.repository.register({
        idempotencyKey,
        requestHash: hashRequest(canonicalRequest),
        legalName,
        creditCode,
        pickupAddress,
        pickupLat,
        pickupLng,
        qualificationSnapshot,
      }),
    );
    const response: SupplierRegistrationResponseModel = {
      registrationId: result.value.id,
      status: result.value.status,
      nextAction: nextAction(result.value.status),
      ...(result.value.submittedAt
        ? { submittedAt: result.value.submittedAt }
        : {}),
    };
    return { body: response, replayed: result.replayed };
  }

  async patchOwnProfile(
    actor: SupplierAccountAdminActor,
    body: unknown,
    idempotencyHeader: string | undefined,
  ): Promise<{ body: SupplierProfileResponseModel; replayed: boolean }> {
    const input = assertObject(body);
    assertAllowedKeys(input, profileAllowedKeys, profileServerControlledKeys);
    if (input.settlementAccountChangeRequest !== undefined) {
      throw new SafeApiError(
        428,
        'SECOND_VERIFICATION_REQUIRED',
        'Settlement account changes require a separate verified workflow',
      );
    }
    const current = await this.repository.findSupplier(actor.supplierId);
    if (!current) return throwRepositoryFailure('NOT_FOUND');
    if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(current.status)) {
      throwRepositoryFailure('STATE_INVALID');
    }
    const version = assertVersion(input.version);
    const idempotencyKey = assertIdempotencyKey(idempotencyHeader);
    const command = {
      supplierId: actor.supplierId,
      expectedVersion: version,
      idempotencyKey,
      requestHash: '',
      ...(Object.hasOwn(input, 'pickupAddress')
        ? { pickupAddress: optionalPickupAddress(input) }
        : {}),
      ...(Object.hasOwn(input, 'pickupLat')
        ? { pickupLat: optionalCoordinate(input, 'pickupLat') }
        : {}),
      ...(Object.hasOwn(input, 'pickupLng')
        ? { pickupLng: optionalCoordinate(input, 'pickupLng') }
        : {}),
    };
    let snapshot: SupplierQualificationSnapshot | undefined;
    if (input.qualificationSnapshot !== undefined) {
      const rawSnapshot = assertObject(input.qualificationSnapshot);
      if (
        Object.keys(rawSnapshot).some(
          (key) => !['files', 'schemaVersion'].includes(key),
        ) ||
        rawSnapshot.schemaVersion !== '1.0'
      ) {
        throw new SafeApiError(
          422,
          'VALIDATION_FAILED',
          'qualificationSnapshot is invalid',
        );
      }
      snapshot = {
        schemaVersion: '1.0',
        files: qualificationFiles(rawSnapshot.files),
        ...(current.qualificationSnapshot.applicant
          ? { applicant: current.qualificationSnapshot.applicant }
          : {}),
      };
    }
    const canonical = { ...command, ...(snapshot ? { qualificationSnapshot: snapshot } : {}) };
    const result = unwrap(
      await this.repository.patchSupplier({
        ...command,
        ...(snapshot ? { qualificationSnapshot: snapshot } : {}),
        requestHash: hashRequest(canonical),
      }),
    );
    return { body: toProfileResponse(result.value), replayed: result.replayed };
  }

  async submitOwnProfile(
    actor: SupplierAccountAdminActor,
    body: unknown,
    idempotencyHeader: string | undefined,
  ): Promise<{ body: ApprovalTaskResponseModel; replayed: boolean }> {
    const input = assertObject(body);
    assertAllowedKeys(input, new Set(['requestId', 'version']), ownershipKeys);
    const version = assertVersion(input.version);
    const requestId = requiredString(input, 'requestId', 36).toLowerCase();
    if (!uuidPattern.test(requestId)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'requestId is invalid');
    }
    const idempotencyKey = assertIdempotencyKey(idempotencyHeader);
    const current = await this.repository.findSupplier(actor.supplierId);
    if (!current) return throwRepositoryFailure('NOT_FOUND');
    const event = current.status === 'CORRECTION_REQUIRED' ? 'RESUBMIT' : 'SUBMIT';
    resolveSupplierTransition(current.status, event);
    if (collectSupplierSubmissionIssues(current).length > 0) {
      throw new SafeApiError(
        422,
        'VALIDATION_FAILED',
        'Supplier qualification or pickup data is incomplete',
      );
    }
    const canonical = {
      applicantIdentityId: actor.identityId,
      event,
      requestId,
      supplierId: actor.supplierId,
      version,
    };
    const result = unwrap(
      await this.repository.submitSupplier({
        supplierId: actor.supplierId,
        applicantIdentityId: actor.identityId,
        expectedVersion: version,
        idempotencyKey,
        requestHash: hashRequest(canonical),
        event,
      }),
    );
    return {
      body: toApprovalResponse(result.value.approvalTask),
      replayed: result.replayed,
    };
  }

  async listForCompany(
    actor: CompanySupplierOpsActor,
    rawQuery: Readonly<Record<string, unknown>>,
  ): Promise<{
    readonly items: readonly SupplierResponseModel[];
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
  }> {
    const allowed = new Set(['keyword', 'page', 'pageSize', 'status']);
    if (Object.keys(rawQuery).some((key) => !allowed.has(key))) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Supplier query is invalid');
    }
    const statusValue = rawQuery.status;
    const status =
      statusValue === undefined || statusValue === ''
        ? undefined
        : String(statusValue);
    if (status && !SUPPLIER_STATUSES.includes(status as SupplierStatus)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Supplier status is invalid');
    }
    const keywordValue = rawQuery.keyword;
    const keyword =
      keywordValue === undefined || keywordValue === ''
        ? undefined
        : String(keywordValue).trim();
    if (keyword && keyword.length > 128) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Supplier keyword is invalid');
    }
    const page = rawQuery.page === undefined ? 1 : Number(rawQuery.page);
    const pageSize = rawQuery.pageSize === undefined ? 20 : Number(rawQuery.pageSize);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Supplier pagination is invalid');
    }
    const result = await this.repository.listSuppliers({
      companyId: actor.companyId,
      ...(status ? { status: status as SupplierStatus } : {}),
      ...(keyword ? { keyword } : {}),
      page,
      pageSize,
    });
    return {
      items: result.items.map(toSupplierResponse),
      page,
      pageSize,
      total: result.total,
    };
  }

  async reviewForCompany(
    actor: CompanySupplierOpsActor,
    supplierId: string,
    body: unknown,
    idempotencyHeader: string | undefined,
  ): Promise<{ body: SupplierResponseModel; replayed: boolean }> {
    if (!uuidPattern.test(supplierId)) {
      throw new SafeApiError(404, 'RESOURCE_NOT_FOUND', 'Supplier was not found');
    }
    const input = assertObject(body);
    assertAllowedKeys(
      input,
      new Set(['decision', 'opinion', 'secondVerificationCode', 'version']),
      ownershipKeys,
    );
    const decision = input.decision;
    if (decision !== 'REQUEST_CORRECTION' && decision !== 'APPROVE') {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Review decision is invalid');
    }
    const opinion = requiredString(input, 'opinion', 1000);
    const version = assertVersion(input.version);
    const idempotencyKey = assertIdempotencyKey(idempotencyHeader);
    const current = await this.repository.findSupplier(supplierId);
    if (!current || current.companyId !== actor.companyId) {
      return throwRepositoryFailure('NOT_FOUND');
    }
    resolveSupplierTransition(current.status, decision);
    const canonical = {
      decision,
      opinion,
      reviewerIdentityId: actor.identityId,
      supplierId,
      version,
    };
    const result = unwrap(
      await this.repository.reviewSupplier({
        companyId: actor.companyId,
        supplierId,
        reviewerIdentityId: actor.identityId,
        expectedVersion: version,
        idempotencyKey,
        requestHash: hashRequest(canonical),
        decision,
        opinion,
      }),
    );
    return { body: toSupplierResponse(result.value), replayed: result.replayed };
  }
}

export const SUPPLIER_ONBOARDING_COMPANY = Object.freeze({
  legalName: COMPANY_LEGAL_NAME,
  platformName: PLATFORM_NAME,
});
