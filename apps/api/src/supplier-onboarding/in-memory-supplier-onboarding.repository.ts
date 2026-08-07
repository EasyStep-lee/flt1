import { randomUUID } from 'node:crypto';

import {
  COMPANY_LEGAL_NAME,
  PLATFORM_NAME,
} from '../merchant/single-merchant.service.js';
import { resolveSupplierTransition } from './supplier-onboarding.policy.js';
import type {
  ApprovalTaskRecord,
  OnboardingCompanyRecord,
  PatchSupplierCommand,
  RegisterSupplierCommand,
  ReviewSupplierCommand,
  SubmitSupplierCommand,
  SupplierListQuery,
  SupplierMutationResult,
  SupplierOnboardingRecord,
  SupplierOnboardingRepository,
  SupplierStatusHistoryRecord,
} from './supplier-onboarding.repository.js';

type StoredResult =
  | SupplierOnboardingRecord
  | {
      readonly supplier: SupplierOnboardingRecord;
      readonly approvalTask: ApprovalTaskRecord;
    };

interface StoredCommand {
  readonly requestHash: string;
  readonly result: StoredResult;
}

interface ActivatedSupplierLogin {
  readonly accountStatus: 'ACTIVE';
  readonly accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN';
  readonly email: string | null;
  readonly mobile: string;
  readonly name: string;
  readonly supplierId: string;
  readonly userStatus: 'ACTIVE';
  readonly workspaceRoute: '/supplier/workspaces/account-admin';
}

const clone = <T>(value: T): T => structuredClone(value);

export class InMemorySupplierOnboardingRepository
  implements SupplierOnboardingRepository
{
  private readonly suppliers = new Map<string, SupplierOnboardingRecord>();
  private readonly approvalTasks = new Map<string, ApprovalTaskRecord>();
  private readonly commands = new Map<string, StoredCommand>();
  private readonly history: SupplierStatusHistoryRecord[] = [];
  private readonly activatedLogins = new Map<string, ActivatedSupplierLogin>();

  constructor(private readonly companies: readonly OnboardingCompanyRecord[]) {}

  private replay<T extends StoredResult>(
    scope: string,
    key: string,
    requestHash: string,
  ): SupplierMutationResult<T> | null {
    const stored = this.commands.get(`${scope}:${key}`);
    if (!stored) return null;
    if (stored.requestHash !== requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', replayed: true, value: clone(stored.result) as T };
  }

  private remember(scope: string, key: string, requestHash: string, result: StoredResult) {
    this.commands.set(`${scope}:${key}`, {
      requestHash,
      result: clone(result),
    });
  }

  private addHistory(
    supplierId: string,
    fromStatus: SupplierStatusHistoryRecord['fromStatus'],
    toStatus: SupplierStatusHistoryRecord['toStatus'],
    event: SupplierStatusHistoryRecord['event'],
    actorIdentityId: string | null,
    version: number,
  ) {
    this.history.push({
      id: randomUUID(),
      supplierId,
      fromStatus,
      toStatus,
      event,
      actorIdentityId,
      version,
      occurredAt: new Date().toISOString(),
    });
  }

  async register(
    command: RegisterSupplierCommand,
  ): Promise<SupplierMutationResult<SupplierOnboardingRecord>> {
    const replay = this.replay<SupplierOnboardingRecord>(
      'REGISTER',
      command.idempotencyKey,
      command.requestHash,
    );
    if (replay) return replay;

    const companies = this.companies.filter((candidate) => candidate.status === 'ACTIVE');
    if (
      companies.length !== 1 ||
      companies[0]?.legalName !== COMPANY_LEGAL_NAME ||
      companies[0]?.platformName !== PLATFORM_NAME
    ) {
      return { kind: 'COMPANY_INVARIANT' };
    }
    if (
      [...this.suppliers.values()].some(
        (supplier) => supplier.creditCode === command.creditCode,
      )
    ) {
      return { kind: 'DUPLICATE' };
    }

    const supplier: SupplierOnboardingRecord = {
      id: randomUUID(),
      companyId: companies[0].id,
      legalName: command.legalName,
      creditCode: command.creditCode,
      status: 'DRAFT',
      pickupAddress: command.pickupAddress,
      pickupLat: command.pickupLat,
      pickupLng: command.pickupLng,
      settlementAccountMasked: null,
      qualificationSnapshot: clone(command.qualificationSnapshot),
      version: 0,
      submittedAt: null,
    };
    this.suppliers.set(supplier.id, supplier);
    this.addHistory(supplier.id, null, 'DRAFT', 'REGISTER', null, 0);
    this.remember('REGISTER', command.idempotencyKey, command.requestHash, supplier);
    return { kind: 'OK', replayed: false, value: clone(supplier) };
  }

  async findSupplier(supplierId: string): Promise<SupplierOnboardingRecord | null> {
    const supplier = this.suppliers.get(supplierId);
    return supplier ? clone(supplier) : null;
  }

  async patchSupplier(
    command: PatchSupplierCommand,
  ): Promise<SupplierMutationResult<SupplierOnboardingRecord>> {
    const scope = `PATCH:${command.supplierId}`;
    const replay = this.replay<SupplierOnboardingRecord>(
      scope,
      command.idempotencyKey,
      command.requestHash,
    );
    if (replay) return replay;
    const current = this.suppliers.get(command.supplierId);
    if (!current) return { kind: 'NOT_FOUND' };
    if (current.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
    if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(current.status)) {
      return { kind: 'STATE_INVALID' };
    }
    const updated: SupplierOnboardingRecord = {
      ...current,
      ...(command.pickupAddress !== undefined
        ? { pickupAddress: command.pickupAddress }
        : {}),
      ...(command.pickupLat !== undefined ? { pickupLat: command.pickupLat } : {}),
      ...(command.pickupLng !== undefined ? { pickupLng: command.pickupLng } : {}),
      ...(command.qualificationSnapshot
        ? { qualificationSnapshot: clone(command.qualificationSnapshot) }
        : {}),
      version: current.version + 1,
    };
    this.suppliers.set(updated.id, updated);
    this.remember(scope, command.idempotencyKey, command.requestHash, updated);
    return { kind: 'OK', replayed: false, value: clone(updated) };
  }

  async submitSupplier(
    command: SubmitSupplierCommand,
  ): Promise<
    SupplierMutationResult<{
      readonly supplier: SupplierOnboardingRecord;
      readonly approvalTask: ApprovalTaskRecord;
    }>
  > {
    const scope = `SUBMIT:${command.supplierId}`;
    const replay = this.replay<{
      readonly supplier: SupplierOnboardingRecord;
      readonly approvalTask: ApprovalTaskRecord;
    }>(scope, command.idempotencyKey, command.requestHash);
    if (replay) return replay;
    const current = this.suppliers.get(command.supplierId);
    if (!current) return { kind: 'NOT_FOUND' };
    if (current.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
    let nextStatus: SupplierOnboardingRecord['status'];
    try {
      nextStatus = resolveSupplierTransition(current.status, command.event);
    } catch {
      return { kind: 'STATE_INVALID' };
    }
    const version = current.version + 1;
    const supplier: SupplierOnboardingRecord = {
      ...current,
      status: nextStatus,
      submittedAt: new Date().toISOString(),
      version,
    };
    const approvalTask: ApprovalTaskRecord = {
      id: randomUUID(),
      approvalType: 'SUPPLIER_ONBOARDING',
      objectType: 'SUPPLIER',
      objectId: supplier.id,
      applicantType: 'SUPPLIER_USER',
      applicantId: command.applicantIdentityId,
      status: 'PENDING',
      assignedAccountTypeCode: 'COMPANY_SUPPLIER_OPS',
      reviewedBy: null,
      reviewOpinion: null,
      version,
    };
    this.suppliers.set(supplier.id, supplier);
    this.approvalTasks.set(approvalTask.id, approvalTask);
    this.addHistory(
      supplier.id,
      current.status,
      supplier.status,
      command.event,
      command.applicantIdentityId,
      version,
    );
    const result = { supplier, approvalTask };
    this.remember(scope, command.idempotencyKey, command.requestHash, result);
    return { kind: 'OK', replayed: false, value: clone(result) };
  }

  async listSuppliers(query: SupplierListQuery): Promise<{
    readonly items: readonly SupplierOnboardingRecord[];
    readonly total: number;
  }> {
    const keyword = query.keyword?.toLocaleLowerCase('zh-CN');
    const filtered = [...this.suppliers.values()]
      .filter((supplier) => supplier.companyId === query.companyId)
      .filter((supplier) => !query.status || supplier.status === query.status)
      .filter(
        (supplier) =>
          !keyword ||
          supplier.legalName.toLocaleLowerCase('zh-CN').includes(keyword) ||
          supplier.creditCode.toLocaleLowerCase('zh-CN').includes(keyword),
      )
      .sort((left, right) => left.legalName.localeCompare(right.legalName, 'zh-CN'));
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(offset, offset + query.pageSize).map(clone),
      total: filtered.length,
    };
  }

  async reviewSupplier(
    command: ReviewSupplierCommand,
  ): Promise<SupplierMutationResult<SupplierOnboardingRecord>> {
    const scope = `REVIEW:${command.supplierId}`;
    const replay = this.replay<SupplierOnboardingRecord>(
      scope,
      command.idempotencyKey,
      command.requestHash,
    );
    if (replay) return replay;
    const current = this.suppliers.get(command.supplierId);
    if (!current || current.companyId !== command.companyId) return { kind: 'NOT_FOUND' };
    if (current.status !== 'PENDING_REVIEW') return { kind: 'STATE_INVALID' };
    const approvalTask = [...this.approvalTasks.values()].find(
      (candidate) =>
        candidate.objectId === current.id &&
        candidate.status === 'PENDING' &&
        candidate.version === command.expectedVersion,
    );
    if (!approvalTask || current.version !== command.expectedVersion) {
      return { kind: 'APPROVAL_VERSION_CONFLICT' };
    }
    if (approvalTask.applicantId === command.reviewerIdentityId) {
      return { kind: 'SAME_NATURAL_PERSON' };
    }
    const applicant = current.qualificationSnapshot.applicant;
    if (command.decision === 'APPROVE' && !applicant) {
      return { kind: 'STATE_INVALID' };
    }
    let nextStatus: SupplierOnboardingRecord['status'];
    try {
      nextStatus = resolveSupplierTransition(current.status, command.decision);
    } catch {
      return { kind: 'STATE_INVALID' };
    }
    const version = current.version + 1;
    const supplier: SupplierOnboardingRecord = {
      ...current,
      status: nextStatus,
      version,
    };
    const reviewedTask: ApprovalTaskRecord = {
      ...approvalTask,
      status: command.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      reviewedBy: command.reviewerIdentityId,
      reviewOpinion: command.opinion,
      version,
    };
    this.suppliers.set(supplier.id, supplier);
    this.approvalTasks.set(reviewedTask.id, reviewedTask);
    this.addHistory(
      supplier.id,
      current.status,
      supplier.status,
      command.decision,
      command.reviewerIdentityId,
      version,
    );
    if (command.decision === 'APPROVE') {
      this.activatedLogins.set(current.id, {
        accountStatus: 'ACTIVE',
        accountTypeCode: 'SUPPLIER_ACCOUNT_ADMIN',
        email: applicant!.email ?? null,
        mobile: applicant!.mobile,
        name: applicant!.contactName,
        supplierId: current.id,
        userStatus: 'ACTIVE',
        workspaceRoute: '/supplier/workspaces/account-admin',
      });
    }
    this.remember(scope, command.idempotencyKey, command.requestHash, supplier);
    return { kind: 'OK', replayed: false, value: clone(supplier) };
  }

  async countSuppliers(): Promise<number> {
    return this.suppliers.size;
  }

  async getSupplier(supplierId: string): Promise<SupplierOnboardingRecord> {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) throw new Error('SUPPLIER_NOT_FOUND');
    return clone(supplier);
  }

  async countStatusHistory(supplierId: string): Promise<number> {
    return this.history.filter((event) => event.supplierId === supplierId).length;
  }

  async getActivatedLogin(supplierId: string): Promise<ActivatedSupplierLogin | null> {
    const login = this.activatedLogins.get(supplierId);
    return login ? clone(login) : null;
  }
}
