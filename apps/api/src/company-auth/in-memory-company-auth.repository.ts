import { createHash, randomUUID } from 'node:crypto';

import type {
  CompanyAuthRepository,
  CompanyAuthSessionRecord,
  CompanyFunctionalAccountRecord,
  CompanyLoginAuditRecord,
  CompanySelectionGrantRecord,
  CompanyUserRecord,
  IssueCompanySessionCommand,
  IssueCompanySessionResult,
} from './company-auth.repository.js';

interface InMemoryCompanyAuthSeed {
  readonly accounts?: readonly CompanyFunctionalAccountRecord[];
  readonly users?: readonly CompanyUserRecord[];
}

const normalizeLoginAccount = (value: string): string => value.trim().toLowerCase();

export class InMemoryCompanyAuthRepository implements CompanyAuthRepository {
  private readonly accounts = new Map<string, CompanyFunctionalAccountRecord>();
  private readonly audits: CompanyLoginAuditRecord[] = [];
  private readonly grants = new Map<string, CompanySelectionGrantRecord>();
  private readonly sessions = new Map<string, CompanyAuthSessionRecord>();
  private readonly users = new Map<string, CompanyUserRecord>();

  constructor(seed: InMemoryCompanyAuthSeed = {}) {
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

  createSelectionGrant(record: CompanySelectionGrantRecord): Promise<void> {
    for (const [nonceHash, grant] of this.grants) {
      if (grant.userId === record.userId && grant.requestId === record.requestId) {
        this.grants.delete(nonceHash);
      }
    }
    this.grants.set(record.nonceHash, structuredClone(record));
    return Promise.resolve();
  }

  findCompanyUser(loginAccount: string): Promise<CompanyUserRecord | null> {
    const normalized = normalizeLoginAccount(loginAccount);
    const user = [...this.users.values()].find(
      (candidate) =>
        normalizeLoginAccount(candidate.mobile) === normalized ||
        normalizeLoginAccount(candidate.email) === normalized,
    );
    return Promise.resolve(user ? structuredClone(user) : null);
  }

  issueSession(command: IssueCompanySessionCommand): Promise<IssueCompanySessionResult> {
    const now = new Date().toISOString();
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
        return Promise.resolve(
          session ? { kind: 'OK', replayed: true, session } : { kind: 'GRANT_INVALID' },
        );
      }
    }

    for (const [id, session] of this.sessions) {
      if (session.userId === command.userId && !session.revokedAt) {
        this.sessions.set(id, { ...session, revokedAt: now });
      }
    }
    const session: CompanyAuthSessionRecord = {
      accountTypeCode: command.account.accountTypeCode,
      companyId: command.account.companyId,
      expiresAt: command.expiresAt,
      functionalAccountId: command.account.id,
      id: randomUUID(),
      ownerType: 'COMPANY',
      revokedAt: null,
      userId: command.userId,
      workspaceRoute: command.account.workspaceRoute,
    };
    this.sessions.set(session.id, session);
    this.accounts.set(command.account.id, { ...command.account, lastUsedAt: now });
    if (command.nonceHash) {
      const grant = this.grants.get(command.nonceHash);
      if (!grant) return Promise.resolve({ kind: 'GRANT_INVALID' });
      this.grants.set(command.nonceHash, {
        ...grant,
        selectedAccountId: command.account.id,
        selectedSessionId: session.id,
        usedAt: now,
      });
    }
    return Promise.resolve({ kind: 'OK', replayed: false, session });
  }

  listCompanyAccounts(userId: string): Promise<readonly CompanyFunctionalAccountRecord[]> {
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

  recordLoginAudit(record: CompanyLoginAuditRecord): Promise<void> {
    this.audits.push({ ...structuredClone(record), id: randomUUID() });
    return Promise.resolve();
  }

  resolveSelectionGrant(nonceHash: string): Promise<CompanySelectionGrantRecord | null> {
    const grant = this.grants.get(nonceHash);
    return Promise.resolve(grant ? structuredClone(grant) : null);
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

  readLoginAudits(): readonly CompanyLoginAuditRecord[] {
    return structuredClone(this.audits);
  }

  readStoredSessionHashes(): readonly string[] {
    return [...this.sessions.keys()].map((id) =>
      createHash('sha256').update(id).digest('hex'),
    );
  }
}
