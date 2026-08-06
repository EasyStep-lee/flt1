export type CompanyUserStatus =
  | 'ACTIVE'
  | 'INVITED'
  | 'LOCKED'
  | 'REVOKED'
  | 'SUSPENDED';

export type CompanyFunctionalAccountStatus =
  | 'ACTIVE'
  | 'PENDING_ACTIVATION'
  | 'REVOKED'
  | 'SUSPENDED';

export interface CompanyUserRecord {
  readonly companyId: string;
  readonly email: string;
  readonly id: string;
  readonly lastLoginAt: string | null;
  readonly mobile: string;
  readonly name: string;
  readonly status: CompanyUserStatus;
  readonly version: number;
}

export interface CompanyFunctionalAccountRecord {
  readonly accountTypeCode: string;
  readonly accountTypeName: string;
  readonly companyId: string;
  readonly displayName: string;
  readonly expiresAt: string | null;
  readonly id: string;
  readonly identityId: string;
  readonly lastUsedAt: string | null;
  readonly ownerDisplayName: string;
  readonly ownerType: 'COMPANY';
  readonly status: CompanyFunctionalAccountStatus;
  readonly workspaceRoute: string;
}

export type LoginAuditResult =
  | 'ACCOUNT_SUSPENDED'
  | 'AUTH_INVALID'
  | 'RATE_LIMITED'
  | 'SECOND_VERIFICATION_REQUIRED'
  | 'SUCCESS';

export interface CompanyLoginAuditRecord {
  readonly deviceInfo: Readonly<Record<string, unknown>>;
  readonly functionalAccountId: string | null;
  readonly id?: string;
  readonly ip: string;
  readonly loginAccountHash: string;
  readonly occurredAt: string;
  readonly result: LoginAuditResult;
  readonly riskReason: string;
  readonly userId: string | null;
  readonly userType: 'COMPANY_USER' | 'UNKNOWN';
}

export interface CompanySelectionGrantRecord {
  readonly expiresAt: string;
  readonly nonceHash: string;
  readonly requestId: string;
  readonly secondVerificationRequired: boolean;
  readonly selectedAccountId: string | null;
  readonly selectedSessionId: string | null;
  readonly usedAt: string | null;
  readonly userId: string;
}

export interface CompanyAuthSessionRecord {
  readonly accountTypeCode: string;
  readonly companyId: string;
  readonly expiresAt: string;
  readonly functionalAccountId: string;
  readonly id: string;
  readonly ownerType: 'COMPANY';
  readonly revokedAt: string | null;
  readonly userId: string;
  readonly workspaceRoute: string;
}

export interface IssueCompanySessionCommand {
  readonly account: CompanyFunctionalAccountRecord;
  readonly deviceInfo: Readonly<Record<string, unknown>>;
  readonly expiresAt: string;
  readonly ip: string;
  readonly nonceHash: string | null;
  readonly sessionHash: string;
  readonly userId: string;
}

export type IssueCompanySessionResult =
  | { readonly kind: 'CONFLICT' }
  | { readonly kind: 'GRANT_INVALID' }
  | {
      readonly kind: 'OK';
      readonly replayed: boolean;
      readonly session: CompanyAuthSessionRecord;
    };

export interface CompanyAuthRepository {
  countRecentLoginFailures(loginAccountHash: string, since: string): Promise<number>;
  createSelectionGrant(record: CompanySelectionGrantRecord): Promise<void>;
  findCompanyUser(loginAccount: string): Promise<CompanyUserRecord | null>;
  issueSession(command: IssueCompanySessionCommand): Promise<IssueCompanySessionResult>;
  listCompanyAccounts(userId: string): Promise<readonly CompanyFunctionalAccountRecord[]>;
  markLoginSucceeded(userId: string, occurredAt: string): Promise<void>;
  recordLoginAudit(record: CompanyLoginAuditRecord): Promise<void>;
  resolveSelectionGrant(nonceHash: string): Promise<CompanySelectionGrantRecord | null>;
}

export const COMPANY_AUTH_REPOSITORY = Symbol('COMPANY_AUTH_REPOSITORY');
