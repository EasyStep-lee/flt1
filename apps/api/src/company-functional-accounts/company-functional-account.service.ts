import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { assertAuditRequestId, AuditPolicyError } from '../audit/audit-log.policy.js';
import {
  COMPANY_SECOND_VERIFIER,
  type CompanySecondVerifier,
} from '../company-auth/company-auth.security.js';
import {
  resolveCompanyWorkspace,
  type CompanyAccountTypeCode,
} from '../company-auth/company-workspace.policy.js';
import { SafeApiError } from '../http/api-error.js';
import type { CompanyFunctionalAccountActor } from '../supplier-functional-accounts/supplier-functional-account.actor.js';
import type {
  CreateFunctionalAccountRequestDto,
  FunctionalAccountPageResponseDto,
  FunctionalAccountQueryDto,
  FunctionalAccountResponseDto,
} from '../supplier-functional-accounts/supplier-functional-account.dto.js';
import type { FunctionalAccountStatus } from '../supplier-functional-accounts/supplier-functional-account.policy.js';
import {
  COMPANY_FUNCTIONAL_ACCOUNT_REPOSITORY,
  type CompanyFunctionalAccountRecord,
  type CompanyFunctionalAccountRepository,
} from './company-functional-account.repository.js';

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
const ACTOR_SPOOF_FIELDS = new Set(['actorId', 'applicantId']);
const ACCOUNT_STATUSES = new Set<FunctionalAccountStatus>([
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
]);

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
): string | undefined =>
  value === undefined ? undefined : requiredText(value, field, maxLength);

const pageNumber = (value: unknown, fallback: number, maximum?: number): number => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Pagination is invalid');
  }
  return parsed;
};

const assertCreateFields = (body: Record<string, unknown>): void => {
  for (const field of Object.keys(body)) {
    if (ACTOR_SPOOF_FIELDS.has(field)) {
      throw new SafeApiError(
        403,
        'ACTOR_SPOOFED',
        '审计操作者由当前公司职能会话派生',
      );
    }
    if (OWNERSHIP_FIELDS.has(field)) {
      throw new SafeApiError(
        403,
        'DATA_SCOPE_FORBIDDEN',
        '公司和账号归属由当前职能会话派生',
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

const normalizeEmail = (value: unknown): string => {
  const email = requiredText(value, 'inviteeEmail', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'inviteeEmail is invalid');
  }
  return email;
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

const resolveAccountType = (value: unknown) => {
  const code = requiredText(value, 'accountTypeCode', 64);
  const workspace = resolveCompanyWorkspace(code);
  if (!workspace) {
    throw new SafeApiError(422, 'ACCOUNT_TYPE_INVALID', '公司职能账号类型无效');
  }
  return workspace;
};

const requestHash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const toResponse = (
  account: CompanyFunctionalAccountRecord,
): FunctionalAccountResponseDto => {
  const workspace = resolveCompanyWorkspace(account.accountTypeCode);
  if (!workspace) throw new Error('COMPANY_WORKSPACE_POLICY_MISSING');
  return {
    accountTypeCode: workspace.accountTypeCode,
    accountTypeName: workspace.accountTypeName,
    displayName: account.displayName,
    ...(account.expiresAt ? { expiresAt: account.expiresAt } : {}),
    id: account.id,
    ...(account.lastLoginAt ? { lastLoginAt: account.lastLoginAt } : {}),
    status: account.status,
    workspaceRoute: workspace.workspaceRoute,
  };
};

const assertSuperAdmin = (actor: CompanyFunctionalAccountActor): void => {
  if (
    actor.accountTypeCode !== 'COMPANY_SUPER_ADMIN' ||
    actor.workspaceRoute !== '/company-admin/workspaces/system'
  ) {
    throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '只有超级管理员职能可管理公司账号');
  }
};

@Injectable()
export class CompanyFunctionalAccountService {
  constructor(
    @Inject(COMPANY_FUNCTIONAL_ACCOUNT_REPOSITORY)
    private readonly repository: CompanyFunctionalAccountRepository,
    @Inject(COMPANY_SECOND_VERIFIER)
    private readonly secondVerifier: CompanySecondVerifier,
  ) {}

  async list(
    actor: CompanyFunctionalAccountActor,
    query: FunctionalAccountQueryDto & Record<string, unknown>,
  ): Promise<FunctionalAccountPageResponseDto> {
    assertSuperAdmin(actor);
    const requestedCode = optionalText(query.accountTypeCode, 'accountTypeCode', 64);
    let accountTypeCode: CompanyAccountTypeCode | undefined;
    if (requestedCode) accountTypeCode = resolveAccountType(requestedCode).accountTypeCode;
    const status = optionalText(query.status, 'status', 32);
    if (status && !ACCOUNT_STATUSES.has(status as FunctionalAccountStatus)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'status is invalid');
    }
    const keyword = optionalText(query.keyword, 'keyword', 128);
    const page = pageNumber(query.page, 1);
    const pageSize = pageNumber(query.pageSize, 20, 100);
    const result = await this.repository.listCompanyAccounts({
      companyId: actor.companyId,
      page,
      pageSize,
      ...(accountTypeCode ? { accountTypeCode } : {}),
      ...(status ? { status: status as FunctionalAccountStatus } : {}),
      ...(keyword ? { keyword } : {}),
    });
    return {
      items: result.items.map(toResponse),
      page,
      pageSize,
      total: result.total,
    };
  }

  async create(
    actor: CompanyFunctionalAccountActor,
    body: CreateFunctionalAccountRequestDto & Record<string, unknown>,
    idempotencyKey: string | undefined,
    requestIdValue?: string,
    ip?: string,
  ): Promise<{ readonly body: FunctionalAccountResponseDto; readonly replayed: boolean }> {
    assertSuperAdmin(actor);
    assertCreateFields(body);
    let requestId: string;
    try {
      requestId = assertAuditRequestId(requestIdValue);
    } catch (error) {
      if (error instanceof AuditPolicyError) {
        throw new SafeApiError(422, error.code, error.message);
      }
      throw error;
    }
    const key = requiredText(idempotencyKey, 'Idempotency-Key', 128);
    if (key.length < 8) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Idempotency-Key is invalid');
    }
    const accountType = resolveAccountType(body.accountTypeCode);
    const displayName = requiredText(body.inviteeName, 'inviteeName', 128);
    const mobile = normalizeMobile(body.inviteeMobile);
    const email = normalizeEmail(body.inviteeEmail);
    const expiresAt = normalizeExpiry(body.expiresAt);
    const existingIdentity = await this.repository.findCompanyAccountByMobile(
      actor.companyId,
      mobile,
    );
    const targetIdentityId = existingIdentity?.identityId ?? randomUUID();
    if (
      targetIdentityId === actor.identityId &&
      accountType.accountTypeCode === 'COMPANY_SUPER_ADMIN'
    ) {
      throw new SafeApiError(422, 'ACCOUNT_TYPE_INVALID', '同一自然人不能自授超级管理员职能');
    }
    const verificationCode = optionalText(
      body.secondVerificationCode,
      'secondVerificationCode',
      8,
    );
    if (
      !verificationCode ||
      verificationCode.length < 4 ||
      !(await this.secondVerifier.verify({
        code: verificationCode,
        userId: actor.identityId,
      }))
    ) {
      throw new SafeApiError(428, 'SECOND_VERIFICATION_REQUIRED', '需要二次验证');
    }
    if (!(await this.repository.isCompanyActive(actor.companyId))) {
      throw new SafeApiError(409, 'STATE_TRANSITION_INVALID', '公司主体当前不可邀请职能账号');
    }
    const canonical = {
      accountTypeCode: accountType.accountTypeCode,
      companyId: actor.companyId,
      displayName,
      email,
      expiresAt,
      mobile,
    };
    const result = await this.repository.createCompanyAccount({
      ...canonical,
      actorIdentityId: actor.identityId,
      idempotencyKey: key,
      identityId: targetIdentityId,
      ip: ip ?? null,
      requestHash: requestHash(canonical),
      requestId,
    });
    if (result.kind === 'AUDIT_REQUIRED') {
      throw new SafeApiError(503, 'AUDIT_REQUIRED', '账号邀请因审计追加失败而回滚');
    }
    if (result.kind === 'IDEMPOTENCY_CONFLICT') {
      throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts');
    }
    if (result.kind === 'DUPLICATE') {
      throw new SafeApiError(422, 'ACCOUNT_TYPE_INVALID', '该自然人已持有此公司职能');
    }
    return { body: toResponse(result.value), replayed: result.replayed };
  }
}
