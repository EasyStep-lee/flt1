import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type {
  SupplierLoginRequestDto,
  SupplierSelectWorkspaceRequestDto,
  SupplierSessionResponseDto,
  SupplierWorkspaceChoiceDto,
  SupplierWorkspaceChoiceResponseDto,
} from './supplier-auth.dto.js';
import {
  SUPPLIER_AUTH_REPOSITORY,
  type SupplierAuthRepository,
  type SupplierAuthSessionRecord,
  type SupplierFunctionalAccountRecord,
  type SupplierLoginAuditRecord,
  type SupplierUserRecord,
} from './supplier-auth.repository.js';
import {
  SUPPLIER_CREDENTIAL_VERIFIER,
  SUPPLIER_SECOND_VERIFIER,
  type SupplierCredentialVerifier,
  type SupplierSecondVerifier,
} from './supplier-auth.security.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{32,256}$/u;
const SESSION_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SELECTION_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_FAILURES = 5;
const ACCOUNT_SELECT_ROUTE = '/supplier/account-select' as const;

export const SUPPLIER_AUTH_SESSION_CREDENTIAL = Symbol(
  'SUPPLIER_AUTH_SESSION_CREDENTIAL',
);

const LOGIN_FIELDS = new Set([
  'loginAccount',
  'password',
  'requestId',
  'verificationCode',
]);
const FORBIDDEN_LOGIN_FIELDS = new Set([
  'companyId',
  'functionalAccountId',
  'identityId',
  'ownerType',
  'supplierId',
  'userId',
  'workspaceRoute',
]);
const SELECTION_FIELDS = new Set(['secondVerificationCode', 'selectionNonce']);
const FORBIDDEN_SELECTION_FIELDS = new Set([
  'companyId',
  'functionalAccountId',
  'identityId',
  'ownerType',
  'supplierId',
  'userId',
  'workspaceRoute',
]);

export interface SupplierAuthRequestContext {
  readonly deviceInfo: Readonly<Record<string, unknown>>;
  readonly ip: string;
}

export interface SupplierLoginResult {
  readonly body: SupplierWorkspaceChoiceResponseDto;
  readonly sessionToken?: string;
}

export interface SupplierWorkspaceSelectionResult {
  readonly body: SupplierSessionResponseDto;
  readonly replayed: boolean;
  readonly sessionToken?: string;
}

const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const sessionTokenFor = (sessionId: string, key: string): string =>
  createHmac('sha256', key)
    .update('fulishe-supplier-auth-session-v1\0')
    .update(sessionId)
    .digest('base64url');

const sameSessionToken = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
};

const selectionNonceFor = (userId: string, requestId: string): string =>
  createHash('sha256')
    .update('fulishe-supplier-auth-selection-v1\0')
    .update(userId)
    .update('\0')
    .update(requestId)
    .digest('base64url');

const normalizeLoginAccount = (value: string): string => value.trim().toLowerCase();

const sessionTokenFromCookie = (cookieHeader?: string): string | null => {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== '__Host-fulishe-supplier-portal') continue;
    const value = part.slice(separator + 1).trim();
    return SESSION_VALUE_PATTERN.test(value) ? value : null;
  }
  return null;
};

const isEligibleAccount = (
  account: SupplierFunctionalAccountRecord,
  now: string,
): boolean =>
  account.status === 'ACTIVE' &&
  account.accountTypeStatus === 'ACTIVE' &&
  (!account.expiresAt || account.expiresAt > now);

const toChoice = (
  account: SupplierFunctionalAccountRecord,
  now: string,
): SupplierWorkspaceChoiceDto => ({
  accountId: account.id,
  accountTypeCode: account.accountTypeCode,
  accountTypeName: account.accountTypeName,
  lastUsedAt: account.lastUsedAt,
  ownerDisplayName: account.ownerDisplayName,
  ownerType: 'SUPPLIER',
  status:
    account.accountTypeStatus !== 'ACTIVE' ||
    (account.expiresAt !== null && account.expiresAt <= now)
      ? 'SUSPENDED'
      : account.status,
  workspaceRoute: account.workspaceRoute,
});

const toSession = (session: SupplierAuthSessionRecord): SupplierSessionResponseDto => ({
  accountTypeCode: session.accountTypeCode,
  expiresAt: session.expiresAt,
  functionalAccountId: session.functionalAccountId,
  ownerType: 'SUPPLIER',
  workspaceRoute: session.workspaceRoute,
});

const assertLoginBody = (
  body: SupplierLoginRequestDto & Record<string, unknown>,
): void => {
  if (Object.keys(body).some((key) => FORBIDDEN_LOGIN_FIELDS.has(key))) {
    throw new SafeApiError(403, 'DATA_SCOPE_FORBIDDEN', '供应商归属只能由服务端绑定');
  }
  if (Object.keys(body).some((key) => !LOGIN_FIELDS.has(key))) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', '登录信息包含未知字段');
  }
  if (
    typeof body.loginAccount !== 'string' ||
    body.loginAccount.trim().length < 3 ||
    body.loginAccount.length > 254 ||
    typeof body.password !== 'string' ||
    body.password.length < 1 ||
    body.password.length > 256 ||
    typeof body.requestId !== 'string' ||
    !UUID_PATTERN.test(body.requestId)
  ) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', '登录信息格式不正确');
  }
};

@Injectable()
export class SupplierAuthService {
  constructor(
    @Inject(SUPPLIER_AUTH_REPOSITORY)
    private readonly repository: SupplierAuthRepository,
    @Inject(SUPPLIER_CREDENTIAL_VERIFIER)
    private readonly credentialVerifier: SupplierCredentialVerifier,
    @Inject(SUPPLIER_SECOND_VERIFIER)
    private readonly secondVerifier: SupplierSecondVerifier,
    @Inject(SUPPLIER_AUTH_SESSION_CREDENTIAL)
    private readonly sessionTokenKey: string,
  ) {}

  private async audit(
    loginAccount: string,
    context: SupplierAuthRequestContext,
    result: SupplierLoginAuditRecord['result'],
    riskReason: string,
    user: SupplierUserRecord | null,
    functionalAccountId: string | null = null,
    knownUserId: string | null = null,
  ): Promise<void> {
    await this.repository.recordLoginAudit({
      deviceInfo: context.deviceInfo,
      functionalAccountId,
      ip: context.ip,
      loginAccountHash: hash(normalizeLoginAccount(loginAccount)),
      occurredAt: new Date().toISOString(),
      result,
      riskReason,
      userId: user?.id ?? knownUserId,
      userType: user || knownUserId ? 'SUPPLIER_USER' : 'UNKNOWN',
    });
  }

  private async issue(
    userId: string,
    account: SupplierFunctionalAccountRecord,
    context: SupplierAuthRequestContext,
    nonceHash: string | null,
  ): Promise<SupplierWorkspaceSelectionResult> {
    const sessionId = randomUUID();
    const token = sessionTokenFor(sessionId, this.sessionTokenKey);
    const result = await this.repository.issueSession({
      account,
      deviceInfo: context.deviceInfo,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      ip: context.ip,
      nonceHash,
      sessionId,
      sessionHash: hash(token),
      userId,
    });
    if (result.kind === 'CONFLICT') {
      throw new SafeApiError(
        409,
        'WORKSPACE_SESSION_CONFLICT',
        '该选择上下文已绑定其他职能账号',
      );
    }
    if (result.kind === 'GRANT_INVALID') {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '职能账号选择已失效');
    }
    const recoveredToken = sessionTokenFor(
      result.session.id,
      this.sessionTokenKey,
    );
    if (hash(recoveredToken) !== result.sessionHash) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '职能账号会话已失效');
    }
    return {
      body: toSession(result.session),
      replayed: result.replayed,
      sessionToken: recoveredToken,
    };
  }

  async login(
    body: SupplierLoginRequestDto & Record<string, unknown>,
    context: SupplierAuthRequestContext,
  ): Promise<SupplierLoginResult> {
    assertLoginBody(body);
    const loginAccount = normalizeLoginAccount(body.loginAccount);
    const loginAccountHash = hash(loginAccount);
    const failureCount = await this.repository.countRecentLoginFailures(
      loginAccountHash,
      new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString(),
    );
    if (failureCount >= RATE_LIMIT_FAILURES) {
      await this.audit(loginAccount, context, 'RATE_LIMITED', 'TOO_MANY_FAILURES', null);
      throw new SafeApiError(429, 'RATE_LIMITED', '登录尝试过于频繁，请稍后再试');
    }

    const user = await this.repository.findSupplierUser(loginAccount);
    const verification = await this.credentialVerifier.verify({
      loginAccount,
      password: body.password,
      userId: user?.id ?? null,
      ...(body.verificationCode ? { verificationCode: body.verificationCode } : {}),
    });
    if (!user || !verification.valid) {
      await this.audit(loginAccount, context, 'AUTH_INVALID', 'CREDENTIAL_INVALID', user);
      throw new SafeApiError(401, 'AUTH_INVALID', '账号或凭证不正确');
    }
    if (user.status !== 'ACTIVE') {
      await this.audit(
        loginAccount,
        context,
        'ACCOUNT_SUSPENDED',
        user.status,
        user,
      );
      throw new SafeApiError(403, 'ACCOUNT_SUSPENDED', '账号当前不可用');
    }
    if (user.supplierStatus !== 'ACTIVE') {
      await this.audit(
        loginAccount,
        context,
        'ACCOUNT_SUSPENDED',
        `SUPPLIER_${user.supplierStatus}`,
        user,
      );
      throw new SafeApiError(403, 'SUPPLIER_NOT_ACTIVE', '供应商主体当前不可用');
    }

    const now = new Date().toISOString();
    const accounts = await this.repository.listSupplierAccounts(user.id);
    const eligibleAccounts = accounts.filter((account) => isEligibleAccount(account, now));
    await this.repository.markLoginSucceeded(user.id, now);
    if (
      accounts.length === 1 &&
      eligibleAccounts.length === 1 &&
      !verification.secondVerificationRequired
    ) {
      const issued = await this.issue(user.id, eligibleAccounts[0]!, context, null);
      await this.audit(
        loginAccount,
        context,
        'SUCCESS',
        'DIRECT_WORKSPACE',
        user,
        eligibleAccounts[0]!.id,
      );
      return {
        body: {
          accountSelectRoute: ACCOUNT_SELECT_ROUTE,
          accounts: accounts.map((account) => toChoice(account, now)),
          selectionNonce: '',
          selectionRequired: false,
        },
        ...(issued.sessionToken ? { sessionToken: issued.sessionToken } : {}),
      };
    }

    const nonce = selectionNonceFor(user.id, body.requestId);
    await this.repository.createSelectionGrant({
      expiresAt: new Date(Date.now() + SELECTION_TTL_MS).toISOString(),
      nonceHash: hash(nonce),
      requestId: body.requestId,
      secondVerificationRequired: verification.secondVerificationRequired,
      selectedAccountId: null,
      selectedSessionId: null,
      usedAt: null,
      userId: user.id,
    });
    await this.audit(loginAccount, context, 'SUCCESS', 'WORKSPACE_SELECTION_REQUIRED', user);
    return {
      body: {
        accountSelectRoute: ACCOUNT_SELECT_ROUTE,
        accounts: accounts.map((account) => toChoice(account, now)),
        selectionNonce: nonce,
        selectionRequired: true,
      },
    };
  }

  async selectWorkspace(
    accountId: string,
    body: SupplierSelectWorkspaceRequestDto & Record<string, unknown>,
    context: SupplierAuthRequestContext,
  ): Promise<SupplierWorkspaceSelectionResult> {
    if (Object.keys(body).some((key) => FORBIDDEN_SELECTION_FIELDS.has(key))) {
      throw new SafeApiError(403, 'DATA_SCOPE_FORBIDDEN', '职能账号归属由服务端绑定');
    }
    if (
      !UUID_PATTERN.test(accountId) ||
      typeof body.selectionNonce !== 'string' ||
      !NONCE_PATTERN.test(body.selectionNonce) ||
      Object.keys(body).some((key) => !SELECTION_FIELDS.has(key))
    ) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', '职能账号选择参数不正确');
    }

    const nonceHash = hash(body.selectionNonce);
    const grant = await this.repository.resolveSelectionGrant(nonceHash);
    const now = new Date().toISOString();
    if (!grant || grant.expiresAt <= now) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '职能账号选择已失效');
    }
    const accounts = await this.repository.listSupplierAccounts(grant.userId);
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account || !isEligibleAccount(account, now)) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '职能账号不可用');
    }
    if (
      grant.secondVerificationRequired &&
      !(await this.secondVerifier.verify({
        userId: grant.userId,
        ...(body.secondVerificationCode ? { code: body.secondVerificationCode } : {}),
      }))
    ) {
      await this.audit(
        'selection-context',
        context,
        'SECOND_VERIFICATION_REQUIRED',
        'SECOND_VERIFICATION_REQUIRED',
        null,
        account.id,
        grant.userId,
      );
      throw new SafeApiError(428, 'SECOND_VERIFICATION_REQUIRED', '需要二次验证');
    }
    const issued = await this.issue(grant.userId, account, context, nonceHash);
    await this.audit(
      'selection-context',
      context,
      'SUCCESS',
      issued.replayed ? 'WORKSPACE_SELECTION_REPLAY' : 'WORKSPACE_SELECTED',
      null,
      account.id,
      grant.userId,
    );
    return issued;
  }

  async resolveActiveSession(cookieHeader?: string): Promise<SupplierAuthSessionRecord> {
    const token = sessionTokenFromCookie(cookieHeader);
    if (!token) {
      throw new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        '供应商职能会话缺失或格式无效',
      );
    }
    const result = await this.repository.resolveSession(
      hash(token),
      new Date().toISOString(),
    );
    if (result.kind === 'MISSING') {
      throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', '供应商职能会话不存在');
    }
    if (result.kind === 'REVOKED') {
      throw new SafeApiError(401, 'AUTH_SESSION_REVOKED', '原职能会话已撤销');
    }
    if (result.kind === 'INVALID') {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '供应商职能会话已失效');
    }
    if (
      !sameSessionToken(
        token,
        sessionTokenFor(result.session.id, this.sessionTokenKey),
      )
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '供应商职能会话已失效');
    }
    return result.session;
  }
}
