import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type {
  CompanyLoginRequestDto,
  CompanyWorkspaceResponseDto,
  SelectWorkspaceRequestDto,
  SessionResponseDto,
  WorkspaceChoiceDto,
  WorkspaceChoiceResponseDto,
} from './company-auth.dto.js';
import {
  COMPANY_AUTH_REPOSITORY,
  type CompanyAuthRepository,
  type CompanyFunctionalAccountRecord,
  type CompanyLoginAuditRecord,
  type CompanyAuthSessionRecord,
  type CompanyUserRecord,
} from './company-auth.repository.js';
import { resolveCompanyWorkspace } from './company-workspace.policy.js';
import {
  COMPANY_CREDENTIAL_VERIFIER,
  COMPANY_SECOND_VERIFIER,
  type CompanyCredentialVerifier,
  type CompanySecondVerifier,
} from './company-auth.security.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{32,256}$/u;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SELECTION_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_FAILURES = 5;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const FORBIDDEN_LOGIN_FIELDS = new Set([
  'companyId',
  'functionalAccountId',
  'workspaceRoute',
]);
const LOGIN_FIELDS = new Set([
  'loginAccount',
  'password',
  'requestId',
  'verificationCode',
]);
const FORBIDDEN_SELECTION_FIELDS = new Set([
  'companyId',
  'functionalAccountId',
  'ownerType',
  'userId',
  'workspaceRoute',
]);
const SELECTION_FIELDS = new Set(['secondVerificationCode', 'selectionNonce']);

export interface CompanyAuthRequestContext {
  readonly deviceInfo: Readonly<Record<string, unknown>>;
  readonly ip: string;
}

export interface CompanyLoginResult {
  readonly body: WorkspaceChoiceResponseDto;
  readonly sessionToken?: string;
}

export interface CompanyWorkspaceSelectionResult {
  readonly body: SessionResponseDto;
  readonly replayed: boolean;
  readonly sessionToken?: string;
}

const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const selectionNonceFor = (userId: string, requestId: string): string =>
  createHash('sha256')
    .update('fulishe-company-auth-selection-v1\0')
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
    if (name !== '__Host-fulishe-company-admin') continue;
    const value = part.slice(separator + 1).trim();
    return SESSION_TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
};

const isEligibleAccount = (
  account: CompanyFunctionalAccountRecord,
  now: string,
): boolean =>
  account.status === 'ACTIVE' && (!account.expiresAt || account.expiresAt > now);

const toChoice = (account: CompanyFunctionalAccountRecord): WorkspaceChoiceDto => ({
  accountId: account.id,
  accountTypeCode: account.accountTypeCode,
  accountTypeName: account.accountTypeName,
  lastUsedAt: account.lastUsedAt,
  ownerDisplayName: account.ownerDisplayName,
  ownerType: 'COMPANY',
  status: account.status,
  workspaceRoute: account.workspaceRoute,
});

const toSession = (session: {
  readonly accountTypeCode: string;
  readonly companyId: string;
  readonly expiresAt: string;
  readonly functionalAccountId: string;
  readonly workspaceRoute: string;
}): SessionResponseDto => ({
  accountTypeCode: session.accountTypeCode,
  companyId: session.companyId,
  expiresAt: session.expiresAt,
  functionalAccountId: session.functionalAccountId,
  ownerType: 'COMPANY',
  workspaceRoute: session.workspaceRoute,
});

const assertLoginBody = (
  body: CompanyLoginRequestDto & Record<string, unknown>,
): void => {
  if (Object.keys(body).some((key) => FORBIDDEN_LOGIN_FIELDS.has(key))) {
    throw new SafeApiError(403, 'DATA_SCOPE_FORBIDDEN', 'Ownership is server-bound');
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
export class CompanyAuthService {
  constructor(
    @Inject(COMPANY_AUTH_REPOSITORY)
    private readonly repository: CompanyAuthRepository,
    @Inject(COMPANY_CREDENTIAL_VERIFIER)
    private readonly credentialVerifier: CompanyCredentialVerifier,
    @Inject(COMPANY_SECOND_VERIFIER)
    private readonly secondVerifier: CompanySecondVerifier,
  ) {}

  private async audit(
    loginAccount: string,
    context: CompanyAuthRequestContext,
    result: CompanyLoginAuditRecord['result'],
    riskReason: string,
    user: CompanyUserRecord | null,
    functionalAccountId: string | null = null,
  ): Promise<void> {
    await this.repository.recordLoginAudit({
      deviceInfo: context.deviceInfo,
      functionalAccountId,
      ip: context.ip,
      loginAccountHash: hash(normalizeLoginAccount(loginAccount)),
      occurredAt: new Date().toISOString(),
      result,
      riskReason,
      userId: user?.id ?? null,
      userType: user ? 'COMPANY_USER' : 'UNKNOWN',
    });
  }

  private async issue(
    userId: string,
    account: CompanyFunctionalAccountRecord,
    context: CompanyAuthRequestContext,
    nonceHash: string | null,
  ): Promise<CompanyWorkspaceSelectionResult> {
    const token = randomBytes(32).toString('base64url');
    const result = await this.repository.issueSession({
      account,
      deviceInfo: context.deviceInfo,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      ip: context.ip,
      nonceHash,
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
    return {
      body: toSession(result.session),
      replayed: result.replayed,
      ...(result.replayed ? {} : { sessionToken: token }),
    };
  }

  async resolveActiveSession(cookieHeader?: string): Promise<CompanyAuthSessionRecord> {
    const token = sessionTokenFromCookie(cookieHeader);
    if (!token) {
      throw new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        '公司职能会话缺失或格式无效',
      );
    }
    const result = await this.repository.resolveSession(
      hash(token),
      new Date().toISOString(),
    );
    if (result.kind === 'MISSING') {
      throw new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        '公司职能会话不存在',
      );
    }
    if (result.kind === 'REVOKED') {
      throw new SafeApiError(401, 'AUTH_SESSION_REVOKED', '原职能会话已撤销');
    }
    if (result.kind === 'INVALID') {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '公司职能会话已失效');
    }
    return result.session;
  }

  async currentWorkspace(
    cookieHeader: string | undefined,
    route: unknown,
  ): Promise<CompanyWorkspaceResponseDto> {
    if (
      typeof route !== 'string' ||
      route.length > 255 ||
      !route.startsWith('/company-admin/workspaces/')
    ) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', '工作区路由格式不正确');
    }
    const session = await this.resolveActiveSession(cookieHeader);
    const workspace = resolveCompanyWorkspace(session.accountTypeCode);
    if (
      !workspace ||
      session.workspaceRoute !== workspace.workspaceRoute ||
      route !== workspace.workspaceRoute
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '无权访问该职能页面');
    }
    return {
      accountTypeCode: workspace.accountTypeCode,
      accountTypeName: workspace.accountTypeName,
      menuItems: [
        {
          key: 'workspace',
          label: workspace.menuLabel,
          route: workspace.workspaceRoute,
        },
      ],
      pageId: workspace.pageId,
      workspaceRoute: workspace.workspaceRoute,
    };
  }

  async login(
    body: CompanyLoginRequestDto & Record<string, unknown>,
    context: CompanyAuthRequestContext,
  ): Promise<CompanyLoginResult> {
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
    const user = await this.repository.findCompanyUser(loginAccount);
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
      await this.audit(loginAccount, context, 'ACCOUNT_SUSPENDED', user.status, user);
      throw new SafeApiError(403, 'ACCOUNT_SUSPENDED', '账号当前不可用');
    }

    const now = new Date().toISOString();
    const accounts = await this.repository.listCompanyAccounts(user.id);
    const soleAccount = accounts.length === 1 ? accounts[0] : undefined;
    await this.repository.markLoginSucceeded(user.id, now);
    if (
      soleAccount &&
      isEligibleAccount(soleAccount, now) &&
      !verification.secondVerificationRequired
    ) {
      const issued = await this.issue(user.id, soleAccount, context, null);
      await this.audit(loginAccount, context, 'SUCCESS', 'DIRECT_WORKSPACE', user, soleAccount.id);
      return {
        body: {
          accounts: accounts.map(toChoice),
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
        accounts: accounts.map(toChoice),
        selectionNonce: nonce,
        selectionRequired: true,
      },
    };
  }

  async selectWorkspace(
    accountId: string,
    body: SelectWorkspaceRequestDto & Record<string, unknown>,
    context: CompanyAuthRequestContext,
  ): Promise<CompanyWorkspaceSelectionResult> {
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
    const accounts = await this.repository.listCompanyAccounts(grant.userId);
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
      throw new SafeApiError(428, 'SECOND_VERIFICATION_REQUIRED', '需要二次验证');
    }
    return this.issue(grant.userId, account, context, nonceHash);
  }
}
