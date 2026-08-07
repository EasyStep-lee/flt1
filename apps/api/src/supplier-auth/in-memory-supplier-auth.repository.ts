import { randomUUID } from 'node:crypto';

import type {
  ClaimSupplierSecondVerificationCommand,
  ClaimSupplierSecondVerificationResult,
  CompleteSupplierSecondVerificationCommand,
  IssueSupplierSessionCommand,
  IssueSupplierSessionResult,
  ReleaseSupplierSecondVerificationCommand,
  ResolveSupplierSessionResult,
  SupplierAuthRepository,
  SupplierAuthSessionRecord,
  SupplierFunctionalAccountRecord,
  SupplierLoginAuditRecord,
  SupplierSelectionGrantRecord,
  SupplierUserRecord,
} from './supplier-auth.repository.js';

interface InMemorySupplierAuthSeed {
  readonly accounts?: readonly SupplierFunctionalAccountRecord[];
  readonly users?: readonly SupplierUserRecord[];
}

const normalizeLoginAccount = (value: string): string => value.trim().toLowerCase();

export class InMemorySupplierAuthRepository implements SupplierAuthRepository {
  private readonly accounts = new Map<string, SupplierFunctionalAccountRecord>();
  private readonly audits: SupplierLoginAuditRecord[] = [];
  private readonly grants = new Map<string, SupplierSelectionGrantRecord>();
  private readonly sessions = new Map<string, SupplierAuthSessionRecord>();
  private readonly sessionIdsByHash = new Map<string, string>();
  private readonly users = new Map<string, SupplierUserRecord>();

  constructor(seed: InMemorySupplierAuthSeed = {}) {
    for (const user of seed.users ?? []) this.users.set(user.id, structuredClone(user));
    for (const account of seed.accounts ?? []) {
      this.accounts.set(account.id, structuredClone(account));
    }
  }

  countRecentLoginFailures(loginAccountHash: string, since: string): Promise<number> {
    return Promise.resolve(
      this.audits.filter(
        (audit) =>
          audit.loginAccountHash === loginAccountHash &&
          audit.occurredAt >= since &&
          audit.result === 'AUTH_INVALID',
      ).length,
    );
  }

  claimSecondVerification(
    command: ClaimSupplierSecondVerificationCommand,
  ): Promise<ClaimSupplierSecondVerificationResult> {
    const grant = this.grants.get(command.nonceHash);
    if (
      !grant ||
      grant.userId !== command.userId ||
      grant.expiresAt <= command.claimedAt ||
      !grant.secondVerificationRequired
    ) {
      return Promise.resolve({ kind: 'GRANT_INVALID' });
    }
    if (grant.usedAt !== null) {
      return Promise.resolve(
        grant.selectedAccountId === command.accountId && grant.selectedSessionId !== null
          ? { kind: 'VERIFIED' }
          : { kind: 'CONFLICT' },
      );
    }
    if (grant.secondVerifiedAt !== null) {
      return Promise.resolve(
        grant.selectedAccountId === command.accountId
          ? { kind: 'VERIFIED' }
          : { kind: 'CONFLICT' },
      );
    }
    const activeClaim =
      grant.secondVerificationClaimId !== null &&
      grant.secondVerificationClaimedAt !== null &&
      grant.secondVerificationClaimedAt > command.claimStaleBefore;
    if (activeClaim) {
      return Promise.resolve(
        grant.selectedAccountId === command.accountId
          ? { kind: 'IN_PROGRESS' }
          : { kind: 'CONFLICT' },
      );
    }
    this.grants.set(command.nonceHash, {
      ...grant,
      secondVerificationClaimedAt: command.claimedAt,
      secondVerificationClaimId: command.claimId,
      secondVerifiedAt: null,
      selectedAccountId: command.accountId,
    });
    return Promise.resolve({ kind: 'CLAIMED' });
  }

  completeSecondVerification(
    command: CompleteSupplierSecondVerificationCommand,
  ): Promise<boolean> {
    const grant = this.grants.get(command.nonceHash);
    if (
      !grant ||
      grant.userId !== command.userId ||
      grant.usedAt !== null ||
      grant.secondVerificationClaimId !== command.claimId ||
      grant.secondVerifiedAt !== null
    ) {
      return Promise.resolve(false);
    }
    this.grants.set(command.nonceHash, {
      ...grant,
      secondVerificationClaimedAt: null,
      secondVerificationClaimId: null,
      secondVerifiedAt: command.verifiedAt,
    });
    return Promise.resolve(true);
  }

  createSelectionGrant(record: SupplierSelectionGrantRecord): Promise<void> {
    for (const grant of this.grants.values()) {
      if (grant.userId === record.userId && grant.requestId === record.requestId) {
        return Promise.resolve();
      }
    }
    this.grants.set(record.nonceHash, {
      ...structuredClone(record),
      secondVerificationClaimedAt: record.secondVerificationClaimedAt ?? null,
      secondVerificationClaimId: record.secondVerificationClaimId ?? null,
      secondVerifiedAt: record.secondVerifiedAt ?? null,
    });
    return Promise.resolve();
  }

  findSupplierUser(loginAccount: string): Promise<SupplierUserRecord | null> {
    const normalized = normalizeLoginAccount(loginAccount);
    const matches = [...this.users.values()].filter(
      (candidate) =>
        normalizeLoginAccount(candidate.mobile) === normalized ||
        (candidate.email !== null && normalizeLoginAccount(candidate.email) === normalized),
    );
    return Promise.resolve(matches.length === 1 ? structuredClone(matches[0]!) : null);
  }

  issueSession(command: IssueSupplierSessionCommand): Promise<IssueSupplierSessionResult> {
    const now = new Date().toISOString();
    const account = this.accounts.get(command.account.id);
    const user = this.users.get(command.userId);
    if (
      !account ||
      !user ||
      user.status !== 'ACTIVE' ||
      user.supplierStatus !== 'ACTIVE' ||
      account.identityId !== command.userId ||
      account.supplierId !== user.supplierId ||
      account.ownerType !== 'SUPPLIER' ||
      account.status !== 'ACTIVE' ||
      account.accountTypeStatus !== 'ACTIVE' ||
      (account.expiresAt !== null && account.expiresAt <= now)
    ) {
      return Promise.resolve({ kind: 'GRANT_INVALID' });
    }
    if (command.nonceHash) {
      const grant = this.grants.get(command.nonceHash);
      if (!grant || grant.userId !== command.userId || grant.expiresAt <= now) {
        return Promise.resolve({ kind: 'GRANT_INVALID' });
      }
      if (grant.usedAt) {
        if (grant.selectedAccountId !== command.account.id || !grant.selectedSessionId) {
          return Promise.resolve({ kind: 'CONFLICT' });
        }
        const session = this.sessions.get(grant.selectedSessionId);
        if (
          !session ||
          session.userId !== command.userId ||
          session.functionalAccountId !== account.id ||
          session.revokedAt ||
          session.expiresAt <= now
        ) {
          return Promise.resolve({ kind: 'GRANT_INVALID' });
        }
        const existingSessionHash = [...this.sessionIdsByHash].find(
          ([, sessionId]) => sessionId === session.id,
        )?.[0];
        if (!existingSessionHash) {
          return Promise.resolve({ kind: 'GRANT_INVALID' });
        }
        return Promise.resolve({
          kind: 'OK',
          replayed: true,
          session,
          sessionHash: existingSessionHash,
        });
      }
      if (
        grant.secondVerificationRequired &&
        (grant.secondVerifiedAt === null || grant.selectedAccountId !== account.id)
      ) {
        return Promise.resolve({ kind: 'SECOND_VERIFICATION_REQUIRED' });
      }
    }

    for (const [id, session] of this.sessions) {
      if (session.userId === command.userId && !session.revokedAt) {
        this.sessions.set(id, { ...session, revokedAt: now });
      }
    }
    const session: SupplierAuthSessionRecord = {
      accountTypeCode: account.accountTypeCode,
      expiresAt: command.expiresAt,
      functionalAccountId: account.id,
      id: command.sessionId,
      ownerType: 'SUPPLIER',
      revokedAt: null,
      supplierId: account.supplierId,
      userId: command.userId,
      workspaceRoute: account.workspaceRoute,
    };
    this.sessions.set(session.id, session);
    this.sessionIdsByHash.set(command.sessionHash, session.id);
    this.accounts.set(account.id, { ...account, lastUsedAt: now });
    if (command.nonceHash) {
      const grant = this.grants.get(command.nonceHash);
      if (!grant) return Promise.resolve({ kind: 'GRANT_INVALID' });
      this.grants.set(command.nonceHash, {
        ...grant,
        selectedAccountId: account.id,
        selectedSessionId: session.id,
        usedAt: now,
      });
    }
    return Promise.resolve({
      kind: 'OK',
      replayed: false,
      session,
      sessionHash: command.sessionHash,
    });
  }

  listSupplierAccounts(
    userId: string,
  ): Promise<readonly SupplierFunctionalAccountRecord[]> {
    return Promise.resolve(
      [...this.accounts.values()]
        .filter((account) => account.identityId === userId)
        .sort((left, right) => left.accountTypeCode.localeCompare(right.accountTypeCode))
        .map((account) => structuredClone(account)),
    );
  }

  markLoginSucceeded(userId: string, occurredAt: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) this.users.set(userId, { ...user, lastLoginAt: occurredAt });
    return Promise.resolve();
  }

  recordLoginAudit(record: SupplierLoginAuditRecord): Promise<void> {
    this.audits.push({ ...structuredClone(record), id: randomUUID() });
    return Promise.resolve();
  }

  releaseSecondVerificationClaim(
    command: ReleaseSupplierSecondVerificationCommand,
  ): Promise<void> {
    const grant = this.grants.get(command.nonceHash);
    if (
      !grant ||
      grant.userId !== command.userId ||
      grant.usedAt !== null ||
      grant.secondVerifiedAt !== null ||
      grant.secondVerificationClaimId !== command.claimId
    ) {
      return Promise.resolve();
    }
    this.grants.set(command.nonceHash, {
      ...grant,
      secondVerificationClaimedAt: null,
      secondVerificationClaimId: null,
      selectedAccountId: null,
    });
    return Promise.resolve();
  }

  resolveSelectionGrant(
    nonceHash: string,
  ): Promise<SupplierSelectionGrantRecord | null> {
    const grant = this.grants.get(nonceHash);
    return Promise.resolve(grant ? structuredClone(grant) : null);
  }

  resolveSession(
    sessionHash: string,
    now: string,
  ): Promise<ResolveSupplierSessionResult> {
    const sessionId = this.sessionIdsByHash.get(sessionHash);
    if (!sessionId) return Promise.resolve({ kind: 'MISSING' });
    const session = this.sessions.get(sessionId);
    if (!session) return Promise.resolve({ kind: 'MISSING' });
    if (session.revokedAt) return Promise.resolve({ kind: 'REVOKED' });
    const account = this.accounts.get(session.functionalAccountId);
    const user = this.users.get(session.userId);
    if (
      session.expiresAt <= now ||
      !account ||
      !user ||
      user.status !== 'ACTIVE' ||
      user.supplierStatus !== 'ACTIVE' ||
      account.status !== 'ACTIVE' ||
      account.accountTypeStatus !== 'ACTIVE' ||
      (account.expiresAt !== null && account.expiresAt <= now) ||
      account.identityId !== session.userId ||
      account.supplierId !== session.supplierId ||
      account.accountTypeCode !== session.accountTypeCode ||
      account.workspaceRoute !== session.workspaceRoute
    ) {
      return Promise.resolve({ kind: 'INVALID' });
    }
    return Promise.resolve({ kind: 'ACTIVE', session: structuredClone(session) });
  }

  countActiveSessions(userId: string): Promise<number> {
    const now = new Date().toISOString();
    return Promise.resolve(
      [...this.sessions.values()].filter(
        (session) =>
          session.userId === userId && !session.revokedAt && session.expiresAt > now,
      ).length,
    );
  }

  countSelectionGrants(userId: string): Promise<number> {
    return Promise.resolve(
      [...this.grants.values()].filter((grant) => grant.userId === userId).length,
    );
  }

  readLoginAudits(): readonly SupplierLoginAuditRecord[] {
    return structuredClone(this.audits);
  }

  readStoredSessionHashes(): readonly string[] {
    return [...this.sessionIdsByHash.keys()];
  }

  setAccountStatusForTest(
    accountId: string,
    status: SupplierFunctionalAccountRecord['status'],
  ): void {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error(`Unknown functional account: ${accountId}`);
    this.accounts.set(accountId, { ...account, status });
  }

  setSupplierStatusForTest(
    userId: string,
    status: SupplierUserRecord['supplierStatus'],
  ): void {
    const user = this.users.get(userId);
    if (!user) throw new Error(`Unknown supplier user: ${userId}`);
    this.users.set(userId, { ...user, supplierStatus: status });
  }
}
