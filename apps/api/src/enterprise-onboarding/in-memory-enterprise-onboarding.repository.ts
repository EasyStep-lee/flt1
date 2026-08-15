import { randomUUID } from 'node:crypto';

import {
  canEnterpriseApplicantEdit,
  canEnterpriseApplicantSubmit,
  resolveEnterpriseReviewStatus,
} from './enterprise-onboarding.policy.js';
import type {
  EnterpriseListQuery,
  EnterpriseListResult,
  EnterpriseMutationResult,
  EnterpriseOnboardingRecord,
  EnterpriseOnboardingRepository,
  EnterpriseProfilePatch,
  PatchEnterpriseCommand,
  RegisterEnterpriseCommand,
  ReviewEnterpriseCommand,
  SubmitEnterpriseCommand,
  SuspendEnterpriseCommand,
} from './enterprise-onboarding.repository.js';

interface CompanySeed {
  readonly id: string;
  readonly legalName: string;
  readonly platformName: string;
  readonly status: 'ACTIVE' | 'SUSPENDED';
}

interface StoredCommand {
  readonly requestHash: string;
  readonly response: EnterpriseOnboardingRecord;
}

const clone = <T>(value: T): T => structuredClone(value);

const applyPatch = (
  record: EnterpriseOnboardingRecord,
  patch: EnterpriseProfilePatch,
): EnterpriseOnboardingRecord => {
  const updated: EnterpriseOnboardingRecord = {
    ...record,
  ...(patch.legalName !== undefined ? { legalName: patch.legalName } : {}),
  ...(patch.creditCode !== undefined ? { creditCode: patch.creditCode } : {}),
  ...(patch.registeredAddress !== undefined
    ? { registeredAddress: patch.registeredAddress }
    : {}),
  ...(patch.enterpriseType !== undefined ? { enterpriseType: patch.enterpriseType } : {}),
  ...(patch.licenseObjectKey !== undefined
    ? { licenseObjectKey: patch.licenseObjectKey }
    : {}),
  ...(patch.licenseValidUntil !== undefined && patch.licenseValidUntil !== null
    ? { licenseValidUntil: patch.licenseValidUntil }
    : {}),
  ...(patch.administratorName !== undefined
    ? { administratorName: patch.administratorName }
    : {}),
  ...(patch.administratorEmail !== undefined
    ? { administratorEmail: patch.administratorEmail }
    : {}),
  ...(patch.administratorTitle !== undefined
    ? { administratorTitle: patch.administratorTitle }
    : {}),
  ...(patch.addresses !== undefined
    ? {
        addresses: patch.addresses.map((address) => ({ ...address, id: randomUUID() })),
      }
    : {}),
  ...(patch.invoiceProfile !== undefined
    ? { invoiceProfile: { ...patch.invoiceProfile, id: randomUUID() } }
    : {}),
  };
  if (patch.licenseValidUntil === null) {
    const withoutLicenseExpiry = { ...updated };
    Reflect.deleteProperty(withoutLicenseExpiry, 'licenseValidUntil');
    return withoutLicenseExpiry;
  }
  return updated;
};

export class InMemoryEnterpriseOnboardingRepository
  implements EnterpriseOnboardingRepository
{
  private readonly records = new Map<string, EnterpriseOnboardingRecord>();
  private readonly commands = new Map<string, StoredCommand>();
  private readonly statusHistory = new Map<string, number>();
  private readonly snapshots = new Map<string, number>();

  constructor(private readonly companies: readonly CompanySeed[]) {}

  private commandKey(scope: string, key: string): string {
    return `${scope}:${key}`;
  }

  private replay(scope: string, key: string, requestHash: string): EnterpriseMutationResult | null {
    const stored = this.commands.get(this.commandKey(scope, key));
    if (!stored) return null;
    if (stored.requestHash !== requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', replayed: true, value: clone(stored.response) };
  }

  private remember(
    scope: string,
    key: string,
    requestHash: string,
    response: EnterpriseOnboardingRecord,
  ): EnterpriseMutationResult {
    this.commands.set(this.commandKey(scope, key), {
      requestHash,
      response: clone(response),
    });
    return { kind: 'OK', replayed: false, value: clone(response) };
  }

  private appendEvidence(enterpriseId: string, statusChanged: boolean): void {
    this.snapshots.set(enterpriseId, (this.snapshots.get(enterpriseId) ?? 0) + 1);
    if (statusChanged) {
      this.statusHistory.set(
        enterpriseId,
        (this.statusHistory.get(enterpriseId) ?? 0) + 1,
      );
    }
  }

  register(command: RegisterEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = 'enterprise-registration:create';
    const replay = this.replay(scope, command.idempotencyKey, command.requestHash);
    if (replay) return Promise.resolve(replay);
    const companies = this.companies.filter(
      (company) =>
        company.status === 'ACTIVE' &&
        company.legalName === '江苏福礼团供应链科技有限公司' &&
        company.platformName === '福礼社',
    );
    if (companies.length !== 1) return Promise.resolve({ kind: 'COMPANY_INVARIANT' });
    if ([...this.records.values()].some((item) => item.creditCode === command.creditCode)) {
      return Promise.resolve({ kind: 'DUPLICATE' });
    }
    const createdAt = new Date().toISOString();
    const record = applyPatch(
      {
        id: randomUUID(),
        companyId: companies[0]!.id,
        applicantIdentityId: command.applicantIdentityId,
        legalName: command.legalName,
        creditCode: command.creditCode,
        administratorName: command.administratorName,
        administratorMobile: command.administratorMobile,
        ...(command.administratorEmail
          ? { administratorEmail: command.administratorEmail }
          : {}),
        ...(command.administratorTitle
          ? { administratorTitle: command.administratorTitle }
          : {}),
        agreementVersion: command.agreementVersion,
        agreementStatus: 'NOT_SIGNED',
        status: 'DRAFT',
        version: 0,
        correctionFields: [],
        addresses: [],
        createdAt,
      },
      command.profile,
    );
    this.records.set(record.id, clone(record));
    this.appendEvidence(record.id, true);
    return Promise.resolve(
      this.remember(scope, command.idempotencyKey, command.requestHash, record),
    );
  }

  findById(id: string): Promise<EnterpriseOnboardingRecord | null> {
    const record = this.records.get(id);
    return Promise.resolve(record ? clone(record) : null);
  }

  patch(command: PatchEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = `enterprise-registration:${command.enterpriseId}:patch`;
    const replay = this.replay(scope, command.idempotencyKey, command.requestHash);
    if (replay) return Promise.resolve(replay);
    const current = this.records.get(command.enterpriseId);
    if (!current || current.applicantIdentityId !== command.applicantIdentityId) {
      return Promise.resolve({ kind: 'NOT_FOUND' });
    }
    if (current.version !== command.expectedVersion) {
      return Promise.resolve({ kind: 'VERSION_CONFLICT' });
    }
    if (!canEnterpriseApplicantEdit(current.status)) {
      return Promise.resolve({ kind: 'STATE_CONFLICT' });
    }
    if (
      command.patch.creditCode &&
      [...this.records.values()].some(
        (item) => item.id !== current.id && item.creditCode === command.patch.creditCode,
      )
    ) {
      return Promise.resolve({ kind: 'DUPLICATE' });
    }
    const updated = { ...applyPatch(current, command.patch), version: current.version + 1 };
    this.records.set(updated.id, clone(updated));
    this.appendEvidence(updated.id, false);
    return Promise.resolve(
      this.remember(scope, command.idempotencyKey, command.requestHash, updated),
    );
  }

  submit(command: SubmitEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = `enterprise-registration:${command.enterpriseId}:submit`;
    const replay = this.replay(scope, command.idempotencyKey, command.requestHash);
    if (replay) return Promise.resolve(replay);
    const current = this.records.get(command.enterpriseId);
    if (!current || current.applicantIdentityId !== command.applicantIdentityId) {
      return Promise.resolve({ kind: 'NOT_FOUND' });
    }
    if (current.version !== command.expectedVersion) {
      return Promise.resolve({ kind: 'VERSION_CONFLICT' });
    }
    if (!canEnterpriseApplicantSubmit(current.status)) {
      return Promise.resolve({ kind: 'STATE_CONFLICT' });
    }
    const updated: EnterpriseOnboardingRecord = {
      ...current,
      status: 'PENDING_REVIEW',
      version: current.version + 1,
      correctionFields: [],
      submittedAt: new Date().toISOString(),
    };
    this.records.set(updated.id, clone(updated));
    this.appendEvidence(updated.id, true);
    return Promise.resolve(
      this.remember(scope, command.idempotencyKey, command.requestHash, updated),
    );
  }

  review(command: ReviewEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = `enterprise-registration:${command.enterpriseId}:review`;
    const replay = this.replay(scope, command.idempotencyKey, command.requestHash);
    if (replay) return Promise.resolve(replay);
    const current = this.records.get(command.enterpriseId);
    if (!current || current.companyId !== command.companyId) {
      return Promise.resolve({ kind: 'NOT_FOUND' });
    }
    if (current.applicantIdentityId === command.reviewerIdentityId) {
      return Promise.resolve({ kind: 'SELF_APPROVAL' });
    }
    if (current.version !== command.expectedVersion) {
      return Promise.resolve({ kind: 'VERSION_CONFLICT' });
    }
    const next = resolveEnterpriseReviewStatus(current.status, command.decision);
    if (!next) return Promise.resolve({ kind: 'STATE_CONFLICT' });
    const updated: EnterpriseOnboardingRecord = {
      ...current,
      status: next,
      agreementStatus: next === 'ACTIVE' ? 'ACTIVE' : current.agreementStatus,
      version: current.version + 1,
      reviewOpinion: command.opinion,
      correctionFields:
        command.decision === 'REQUEST_CORRECTION' ? [...command.correctionFields] : [],
    };
    this.records.set(updated.id, clone(updated));
    this.appendEvidence(updated.id, true);
    return Promise.resolve(
      this.remember(scope, command.idempotencyKey, command.requestHash, updated),
    );
  }

  suspend(command: SuspendEnterpriseCommand): Promise<EnterpriseMutationResult> {
    const scope = `enterprise-registration:${command.enterpriseId}:suspend`;
    const replay = this.replay(scope, command.idempotencyKey, command.requestHash);
    if (replay) return Promise.resolve(replay);
    const current = this.records.get(command.enterpriseId);
    if (!current || current.companyId !== command.companyId) {
      return Promise.resolve({ kind: 'NOT_FOUND' });
    }
    if (current.applicantIdentityId === command.reviewerIdentityId) {
      return Promise.resolve({ kind: 'SELF_APPROVAL' });
    }
    if (current.version !== command.expectedVersion) {
      return Promise.resolve({ kind: 'VERSION_CONFLICT' });
    }
    if (current.status !== 'ACTIVE') return Promise.resolve({ kind: 'STATE_CONFLICT' });
    const updated: EnterpriseOnboardingRecord = {
      ...current,
      status: 'SUSPENDED',
      agreementStatus: 'TERMINATED',
      version: current.version + 1,
      reviewOpinion: command.reason,
    };
    this.records.set(updated.id, clone(updated));
    this.appendEvidence(updated.id, true);
    return Promise.resolve(
      this.remember(scope, command.idempotencyKey, command.requestHash, updated),
    );
  }

  list(query: EnterpriseListQuery): Promise<EnterpriseListResult> {
    const keyword = query.keyword?.toLowerCase();
    const matches = [...this.records.values()].filter(
      (record) =>
        record.companyId === query.companyId &&
        (!query.status || record.status === query.status) &&
        (!keyword ||
          record.legalName.toLowerCase().includes(keyword) ||
          record.creditCode.toLowerCase().includes(keyword)),
    );
    const start = (query.page - 1) * query.pageSize;
    return Promise.resolve({
      items: matches.slice(start, start + query.pageSize).map(clone),
      total: matches.length,
    });
  }

  countEnterprises(): number {
    return this.records.size;
  }

  countStatusHistory(enterpriseId: string): number {
    return this.statusHistory.get(enterpriseId) ?? 0;
  }

  countSnapshots(enterpriseId: string): number {
    return this.snapshots.get(enterpriseId) ?? 0;
  }
}
