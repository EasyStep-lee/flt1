import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type { SupplierFunctionalAccountActor } from './supplier-functional-account.actor.js';
import type {
  CreateFunctionalAccountRequestDto,
  FunctionalAccountPageResponseDto,
  FunctionalAccountQueryDto,
  FunctionalAccountResponseDto,
} from './supplier-functional-account.dto.js';
import {
  FunctionalAccountPolicyError,
  assertAccountAssignment,
  assertAccountWorkspace,
  assertSecondVerification,
  resolveSupplierAccountType,
  type FunctionalAccountStatus,
  type SupplierFunctionalAccountTypeCode,
} from './supplier-functional-account.policy.js';
import {
  FUNCTIONAL_ACCOUNT_REPOSITORY,
  type SupplierFunctionalAccountRecord,
  type SupplierFunctionalAccountRepository,
} from './supplier-functional-account.repository.js';
import {
  FUNCTIONAL_ACCOUNT_AUDIT_SINK,
  FUNCTIONAL_ACCOUNT_SECOND_VERIFIER,
  type FunctionalAccountAuditSink,
  type FunctionalAccountSecondVerifier,
} from './supplier-functional-account.security.js';

const CREATE_FIELDS = new Set([
  'accountTypeCode',
  'expiresAt',
  'inviteeEmail',
  'inviteeMobile',
  'inviteeName',
  'secondVerificationCode',
]);
const OWNERSHIP_FIELDS = new Set([
  'companyId',
  'functionalAccountId',
  'identityId',
  'ownerType',
  'supplierId',
  'workspaceRoute',
]);
const ACCOUNT_STATUSES = new Set<FunctionalAccountStatus>([
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
]);

const throwPolicyError = (error: unknown): never => {
  if (error instanceof FunctionalAccountPolicyError) {
    throw new SafeApiError(error.statusCode, error.code, error.message);
  }
  throw error;
};

const safeAccountType = (code: string) => {
  try {
    return resolveSupplierAccountType(code);
  } catch (error) {
    return throwPolicyError(error);
  }
};

const requiredText = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} is invalid`);
  }
  return value.trim();
};

const optionalText = (
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined => {
  if (value === undefined) return undefined;
  return requiredText(value, field, maxLength);
};

const pageNumber = (value: unknown, fallback: number, maximum?: number): number => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Pagination is invalid');
  }
  return parsed;
};

const assertOwnerPath = (ownerType: string): void => {
  if (ownerType !== 'supplier') {
    throw new SafeApiError(
      403,
      'DATA_SCOPE_FORBIDDEN',
      'Owner type is outside the authenticated data scope',
    );
  }
};

const assertCreateFields = (body: Record<string, unknown>): void => {
  for (const field of Object.keys(body)) {
    if (OWNERSHIP_FIELDS.has(field)) {
      throw new SafeApiError(
        403,
        'DATA_SCOPE_FORBIDDEN',
        'Account ownership is derived from the fixed functional session',
      );
    }
    if (!CREATE_FIELDS.has(field)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request contains an unknown field');
    }
  }
};

const normalizeMobile = (value: unknown): string => {
  const mobile = requiredText(value, 'inviteeMobile', 16).replace(/[\s-]/gu, '');
  if (!/^\+?\d{8,15}$/u.test(mobile)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'inviteeMobile is invalid');
  }
  return mobile;
};

const normalizeEmail = (value: unknown): string | null => {
  const email = optionalText(value, 'inviteeEmail', 254);
  if (email === undefined) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'inviteeEmail is invalid');
  }
  return email.toLocaleLowerCase('en-US');
};

const normalizeExpiry = (value: unknown): string | null => {
  if (value === undefined) return null;
  const expiresAt = requiredText(value, 'expiresAt', 64);
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'expiresAt is invalid');
  }
  return new Date(timestamp).toISOString();
};

const requestHash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const toResponse = (
  account: SupplierFunctionalAccountRecord,
): FunctionalAccountResponseDto => {
  const accountType = resolveSupplierAccountType(account.accountTypeCode);
  return {
    id: account.id,
    displayName: account.displayName,
    accountTypeCode: account.accountTypeCode,
    accountTypeName: accountType.name,
    workspaceRoute: accountType.workspaceRoute,
    status: account.status,
    ...(account.expiresAt ? { expiresAt: account.expiresAt } : {}),
    ...(account.lastLoginAt ? { lastLoginAt: account.lastLoginAt } : {}),
  };
};

@Injectable()
export class SupplierFunctionalAccountService {
  constructor(
    @Inject(FUNCTIONAL_ACCOUNT_REPOSITORY)
    private readonly repository: SupplierFunctionalAccountRepository,
    @Inject(FUNCTIONAL_ACCOUNT_SECOND_VERIFIER)
    private readonly secondVerifier: FunctionalAccountSecondVerifier,
    @Inject(FUNCTIONAL_ACCOUNT_AUDIT_SINK)
    private readonly auditSink: FunctionalAccountAuditSink,
  ) {}

  private async assertActor(actor: SupplierFunctionalAccountActor) {
    try {
      assertAccountWorkspace(actor.accountTypeCode, actor.workspaceRoute);
    } catch (error) {
      throwPolicyError(error);
    }
    const account = await this.repository.findAccount(
      actor.supplierId,
      actor.functionalAccountId,
    );
    if (
      !account ||
      account.identityId !== actor.identityId ||
      account.accountTypeCode !== actor.accountTypeCode ||
      account.status !== 'ACTIVE'
    ) {
      throw new SafeApiError(
        403,
        'WORKSPACE_FORBIDDEN',
        'The fixed functional session is not active',
      );
    }
    return account;
  }

  async list(
    actor: SupplierFunctionalAccountActor,
    ownerType: string,
    query: FunctionalAccountQueryDto & Record<string, unknown>,
  ): Promise<FunctionalAccountPageResponseDto> {
    assertOwnerPath(ownerType);
    await this.assertActor(actor);
    const accountTypeCode = optionalText(query.accountTypeCode, 'accountTypeCode', 64);
    let resolvedAccountTypeCode: SupplierFunctionalAccountTypeCode | undefined;
    if (accountTypeCode) {
      try {
        resolvedAccountTypeCode = resolveSupplierAccountType(accountTypeCode).code;
      } catch (error) {
        throwPolicyError(error);
      }
    }
    const status = optionalText(query.status, 'status', 32);
    if (status && !ACCOUNT_STATUSES.has(status as FunctionalAccountStatus)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'status is invalid');
    }
    const keyword = optionalText(query.keyword, 'keyword', 128);
    const page = pageNumber(query.page, 1);
    const pageSize = pageNumber(query.pageSize, 20, 100);
    const result = await this.repository.listAccounts({
      supplierId: actor.supplierId,
      page,
      pageSize,
      ...(resolvedAccountTypeCode
        ? { accountTypeCode: resolvedAccountTypeCode }
        : {}),
      ...(status ? { status: status as FunctionalAccountStatus } : {}),
      ...(keyword ? { keyword } : {}),
    });
    return { items: result.items.map(toResponse), page, pageSize, total: result.total };
  }

  async create(
    actor: SupplierFunctionalAccountActor,
    ownerType: string,
    body: CreateFunctionalAccountRequestDto & Record<string, unknown>,
    idempotencyKey: string | undefined,
  ): Promise<{ readonly body: FunctionalAccountResponseDto; readonly replayed: boolean }> {
    assertOwnerPath(ownerType);
    await this.assertActor(actor);
    assertCreateFields(body);
    const key = requiredText(idempotencyKey, 'Idempotency-Key', 128);
    if (key.length < 8) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Idempotency-Key is invalid');
    }
    const accountType = safeAccountType(
      requiredText(body.accountTypeCode, 'accountTypeCode', 64),
    );
    const displayName = requiredText(body.inviteeName, 'inviteeName', 128);
    const mobile = normalizeMobile(body.inviteeMobile);
    const email = normalizeEmail(body.inviteeEmail);
    const expiresAt = normalizeExpiry(body.expiresAt);
    const existingIdentity = await this.repository.findAccountByMobile(
      actor.supplierId,
      mobile,
    );
    const targetIdentityId = existingIdentity?.identityId ?? randomUUID();
    try {
      assertAccountAssignment({
        actorAccountTypeCode: actor.accountTypeCode,
        actorIdentityId: actor.identityId,
        targetAccountTypeCode: accountType.code,
        targetIdentityId,
      });
    } catch (error) {
      if (
        error instanceof FunctionalAccountPolicyError &&
        error.code === 'ACCOUNT_TYPE_INVALID'
      ) {
        await this.auditSink.record({
          actorIdentityId: actor.identityId,
          event: 'SELF_PRIVILEGE_ESCALATION_REJECTED',
          supplierId: actor.supplierId,
          targetAccountTypeCode: accountType.code,
        });
      }
      throwPolicyError(error);
    }
    const code = optionalText(body.secondVerificationCode, 'secondVerificationCode', 8);
    const verified =
      code !== undefined &&
      code.length >= 4 &&
      (await this.secondVerifier.verify({
        code,
        identityId: actor.identityId,
        purpose: 'CREATE_FUNCTIONAL_ACCOUNT',
        supplierId: actor.supplierId,
      }));
    try {
      assertSecondVerification(verified);
    } catch (error) {
      throwPolicyError(error);
    }
    if (!(await this.repository.isSupplierActive(actor.supplierId))) {
      throw new SafeApiError(
        409,
        'STATE_TRANSITION_INVALID',
        'Only an active supplier can invite functional accounts',
      );
    }
    const canonical = {
      accountTypeCode: accountType.code,
      displayName,
      email,
      expiresAt,
      mobile,
      supplierId: actor.supplierId,
    };
    const result = await this.repository.createAccount({
      ...canonical,
      actorIdentityId: actor.identityId,
      identityId: targetIdentityId,
      idempotencyKey: key,
      requestHash: requestHash(canonical),
    });
    if (result.kind === 'IDEMPOTENCY_CONFLICT') {
      throw new SafeApiError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Idempotency-Key conflicts with an earlier request',
      );
    }
    if (result.kind === 'DUPLICATE') {
      throw new SafeApiError(
        422,
        'ACCOUNT_TYPE_INVALID',
        'The invited identity already has this functional account type',
      );
    }
    if (!result.replayed) {
      await this.auditSink.record({
        actorIdentityId: actor.identityId,
        event: 'FUNCTIONAL_ACCOUNT_INVITED',
        supplierId: actor.supplierId,
        targetAccountTypeCode: accountType.code,
      });
    }
    return { body: toResponse(result.value), replayed: result.replayed };
  }
}
