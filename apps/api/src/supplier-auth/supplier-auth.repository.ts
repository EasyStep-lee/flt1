export type SupplierUserStatus =
  | 'ACTIVE'
  | 'INVITED'
  | 'LOCKED'
  | 'REVOKED'
  | 'SUSPENDED';

export type SupplierStatus =
  | 'ACTIVE'
  | 'CORRECTION_REQUIRED'
  | 'DRAFT'
  | 'EXITED'
  | 'EXITING'
  | 'PENDING_REVIEW'
  | 'SUSPENDED';

export type SupplierFunctionalAccountStatus =
  | 'ACTIVE'
  | 'PENDING_ACTIVATION'
  | 'REVOKED'
  | 'SUSPENDED';

export interface SupplierUserRecord {
  readonly email: string | null;
  readonly id: string;
  readonly lastLoginAt: string | null;
  readonly mobile: string;
  readonly name: string;
  readonly status: SupplierUserStatus;
  readonly supplierId: string;
  readonly supplierStatus: SupplierStatus;
  readonly version: number;
}

export interface SupplierFunctionalAccountRecord {
  readonly accountTypeCode: string;
  readonly accountTypeName: string;
  readonly accountTypeStatus: 'ACTIVE' | 'DISABLED';
  readonly displayName: string;
  readonly expiresAt: string | null;
  readonly id: string;
  readonly identityId: string;
  readonly lastUsedAt: string | null;
  readonly ownerDisplayName: string;
  readonly ownerType: 'SUPPLIER';
  readonly status: SupplierFunctionalAccountStatus;
  readonly supplierId: string;
  readonly workspaceRoute: string;
}

export type SupplierLoginAuditResult =
  | 'ACCOUNT_SUSPENDED'
  | 'AUTH_INVALID'
  | 'RATE_LIMITED'
  | 'SECOND_VERIFICATION_REQUIRED'
  | 'SUCCESS';

export interface SupplierLoginAuditRecord {
  readonly deviceInfo: Readonly<Record<string, unknown>>;
  readonly functionalAccountId: string | null;
  readonly id?: string;
  readonly ip: string;
  readonly loginAccountHash: string;
  readonly occurredAt: string;
  readonly result: SupplierLoginAuditResult;
  readonly riskReason: string;
  readonly userId: string | null;
  readonly userType: 'SUPPLIER_USER' | 'UNKNOWN';
}

export interface SupplierSelectionGrantRecord {
  readonly expiresAt: string;
  readonly nonceHash: string;
  readonly requestId: string;
  readonly secondVerificationClaimedAt: string | null;
  readonly secondVerificationClaimId: string | null;
  readonly secondVerificationRequired: boolean;
  readonly secondVerifiedAt: string | null;
  readonly selectedAccountId: string | null;
  readonly selectedSessionId: string | null;
  readonly usedAt: string | null;
  readonly userId: string;
}

export interface SupplierAuthSessionRecord {
  readonly accountTypeCode: string;
  readonly expiresAt: string;
  readonly functionalAccountId: string;
  readonly id: string;
  readonly ownerType: 'SUPPLIER';
  readonly revokedAt: string | null;
  readonly supplierId: string;
  readonly userId: string;
  readonly workspaceRoute: string;
}

export type ResolveSupplierSessionResult =
  | { readonly kind: 'MISSING' }
  | { readonly kind: 'REVOKED' }
  | { readonly kind: 'INVALID' }
  | { readonly kind: 'ACTIVE'; readonly session: SupplierAuthSessionRecord };

export interface IssueSupplierSessionCommand {
  readonly account: SupplierFunctionalAccountRecord;
  readonly deviceInfo: Readonly<Record<string, unknown>>;
  readonly expiresAt: string;
  readonly ip: string;
  readonly nonceHash: string | null;
  readonly sessionId: string;
  readonly sessionHash: string;
  readonly userId: string;
}

export type IssueSupplierSessionResult =
  | { readonly kind: 'CONFLICT' }
  | { readonly kind: 'GRANT_INVALID' }
  | { readonly kind: 'SECOND_VERIFICATION_REQUIRED' }
  | {
      readonly kind: 'OK';
      readonly replayed: boolean;
      readonly sessionHash: string;
      readonly session: SupplierAuthSessionRecord;
    };

export interface ClaimSupplierSecondVerificationCommand {
  readonly accountId: string;
  readonly claimId: string;
  readonly claimedAt: string;
  readonly claimStaleBefore: string;
  readonly nonceHash: string;
  readonly userId: string;
}

export type ClaimSupplierSecondVerificationResult =
  | { readonly kind: 'CLAIMED' }
  | { readonly kind: 'IN_PROGRESS' }
  | { readonly kind: 'VERIFIED' }
  | { readonly kind: 'CONFLICT' }
  | { readonly kind: 'GRANT_INVALID' };

export interface CompleteSupplierSecondVerificationCommand {
  readonly claimId: string;
  readonly nonceHash: string;
  readonly userId: string;
  readonly verifiedAt: string;
}

export interface ReleaseSupplierSecondVerificationCommand {
  readonly claimId: string;
  readonly nonceHash: string;
  readonly userId: string;
}

export interface SupplierAuthRepository {
  claimSecondVerification(
    command: ClaimSupplierSecondVerificationCommand,
  ): Promise<ClaimSupplierSecondVerificationResult>;
  completeSecondVerification(
    command: CompleteSupplierSecondVerificationCommand,
  ): Promise<boolean>;
  countRecentLoginFailures(loginAccountHash: string, since: string): Promise<number>;
  createSelectionGrant(record: SupplierSelectionGrantRecord): Promise<void>;
  findSupplierUser(loginAccount: string): Promise<SupplierUserRecord | null>;
  issueSession(command: IssueSupplierSessionCommand): Promise<IssueSupplierSessionResult>;
  listSupplierAccounts(userId: string): Promise<readonly SupplierFunctionalAccountRecord[]>;
  markLoginSucceeded(userId: string, occurredAt: string): Promise<void>;
  recordLoginAudit(record: SupplierLoginAuditRecord): Promise<void>;
  releaseSecondVerificationClaim(
    command: ReleaseSupplierSecondVerificationCommand,
  ): Promise<void>;
  resolveSelectionGrant(nonceHash: string): Promise<SupplierSelectionGrantRecord | null>;
  resolveSession(sessionHash: string, now: string): Promise<ResolveSupplierSessionResult>;
}

export const SUPPLIER_AUTH_REPOSITORY = Symbol('SUPPLIER_AUTH_REPOSITORY');
