import { randomUUID } from 'node:crypto';

import type {
  CategoryAssignmentResult,
  CategoryMutationResult,
  CategoryRecord,
  CategoryRepository,
  CreateCategoryCommand,
  DeleteCategoryCommand,
  DeletedCategoryRecord,
  InMemoryCategoryRepositoryOptions,
  PatchCategoryCommand,
} from './category.repository.js';

type CategoryHistoryEvent = 'CREATE' | 'UPDATE' | 'MOVE' | 'ENABLE' | 'DISABLE' | 'DELETE';

const ROOT_SCOPE = '00000000-0000-0000-0000-000000000000';
const clone = <T>(value: T): T => structuredClone(value);

interface StoredCommand<T> {
  readonly requestHash: string;
  readonly value: T;
}

interface StoredHistory {
  readonly categoryId: string;
  readonly companyId: string;
  readonly event: CategoryHistoryEvent;
  readonly version: number;
  readonly snapshot: CategoryRecord;
}

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly categories = new Map<string, CategoryRecord>();
  private readonly commands = new Map<string, StoredCommand<unknown>>();
  private readonly histories: StoredHistory[] = [];
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(private readonly options: InMemoryCategoryRepositoryOptions) {}

  list(companyId: string, status?: CategoryRecord['status']): Promise<readonly CategoryRecord[]> {
    return Promise.resolve(
      [...this.categories.values()]
        .filter((category) => category.companyId === companyId)
        .filter((category) => status === undefined || category.status === status)
        .map(clone),
    );
  }

  findForCompany(companyId: string, categoryId: string): Promise<CategoryRecord | null> {
    const value = this.categories.get(categoryId);
    return Promise.resolve(value?.companyId === companyId ? clone(value) : null);
  }

  hasChildren(companyId: string, categoryId: string): Promise<boolean> {
    return Promise.resolve(
      [...this.categories.values()].some(
        (category) => category.companyId === companyId && category.parentId === categoryId,
      ),
    );
  }

  create(command: CreateCategoryCommand): Promise<CategoryMutationResult<CategoryRecord>> {
    return this.serialize(() => this.createOnce(command));
  }

  patch(command: PatchCategoryCommand): Promise<CategoryMutationResult<CategoryRecord>> {
    return this.serialize(() => this.patchOnce(command));
  }

  delete(
    command: DeleteCategoryCommand,
  ): Promise<CategoryMutationResult<DeletedCategoryRecord>> {
    return this.serialize(() => this.deleteOnce(command));
  }

  validateSupplierAssignment(
    supplierId: string,
    categoryId: string,
  ): Promise<CategoryAssignmentResult> {
    const supplier = this.options.suppliers.find(({ id }) => id === supplierId);
    const category = this.categories.get(categoryId);
    if (!supplier || !category || category.companyId !== supplier.companyId) {
      return Promise.resolve({ kind: 'CATEGORY_NOT_FOUND' });
    }
    if (category.status !== 'ENABLED') {
      return Promise.resolve({ kind: 'CATEGORY_DISABLED' });
    }
    if (
      category.level !== 3 ||
      [...this.categories.values()].some(({ parentId }) => parentId === category.id)
    ) {
      return Promise.resolve({ kind: 'CATEGORY_NOT_LEAF' });
    }
    return Promise.resolve({ kind: 'OK', value: clone(category) });
  }

  async seedForTest(input: {
    readonly id?: string;
    readonly companyId: string;
    readonly parentId: string | null;
    readonly name: string;
    readonly level: 1 | 2 | 3;
    readonly sortWeight: number;
    readonly status?: CategoryRecord['status'];
  }): Promise<CategoryRecord> {
    const value: CategoryRecord = {
      id: input.id ?? randomUUID(),
      companyId: input.companyId,
      parentId: input.parentId,
      name: input.name.trim(),
      level: input.level,
      sortWeight: input.sortWeight,
      status: input.status ?? 'ENABLED',
      version: 0,
    };
    this.categories.set(value.id, value);
    return clone(value);
  }

  count(): Promise<number> {
    return Promise.resolve(this.categories.size);
  }

  historyCount(): Promise<number> {
    return Promise.resolve(this.histories.length);
  }

  findById(companyId: string, categoryId: string): Promise<CategoryRecord | null> {
    return this.findForCompany(companyId, categoryId);
  }

  private async createOnce(
    command: CreateCategoryCommand,
  ): Promise<CategoryMutationResult<CategoryRecord>> {
    const scope = `CREATE:${command.companyId}`;
    const replay = this.replay<CategoryRecord>(scope, command);
    if (replay) return replay;
    if (!this.options.companies.some(({ id, status }) => id === command.companyId && status === 'ACTIVE')) {
      return { kind: 'COMPANY_INACTIVE' };
    }
    if (!this.parentIsValid(command.companyId, command.parentId, command.level)) {
      return { kind: 'CATEGORY_PARENT_INVALID' };
    }
    if (this.isDuplicate(command.companyId, command.parentId, command.name)) {
      return { kind: 'CATEGORY_DUPLICATE' };
    }
    const value: CategoryRecord = {
      id: randomUUID(),
      companyId: command.companyId,
      parentId: command.parentId,
      name: command.name,
      level: command.level,
      sortWeight: command.sortWeight,
      status: 'ENABLED',
      version: 0,
    };
    if (!(await this.appendAudit(command, value.id, 'CATEGORY_CREATED', null, value))) {
      return { kind: 'AUDIT_REQUIRED' };
    }
    this.categories.set(value.id, value);
    this.histories.push({
      categoryId: value.id,
      companyId: value.companyId,
      event: 'CREATE',
      version: value.version,
      snapshot: clone(value),
    });
    this.remember(scope, command, value);
    return { kind: 'OK', replayed: false, value: clone(value) };
  }

  private async patchOnce(
    command: PatchCategoryCommand,
  ): Promise<CategoryMutationResult<CategoryRecord>> {
    const scope = `PATCH:${command.companyId}:${command.categoryId}`;
    const replay = this.replay<CategoryRecord>(scope, command);
    if (replay) return replay;
    const existing = this.categories.get(command.categoryId);
    if (!existing || existing.companyId !== command.companyId) {
      return { kind: 'CATEGORY_NOT_FOUND' };
    }
    if (existing.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
    const nextParentId = Object.prototype.hasOwnProperty.call(command.patch, 'parentId')
      ? command.patch.parentId!
      : existing.parentId;
    if (!this.parentIsValid(existing.companyId, nextParentId, existing.level, existing.id)) {
      return { kind: 'CATEGORY_PARENT_INVALID' };
    }
    const nextName = command.patch.name ?? existing.name;
    if (this.isDuplicate(existing.companyId, nextParentId, nextName, existing.id)) {
      return { kind: 'CATEGORY_DUPLICATE' };
    }
    const unchanged =
      nextParentId === existing.parentId &&
      nextName === existing.name &&
      (command.patch.sortWeight ?? existing.sortWeight) === existing.sortWeight &&
      (command.patch.status ?? existing.status) === existing.status;
    if (unchanged) {
      this.remember(scope, command, existing);
      return { kind: 'OK', replayed: false, value: clone(existing) };
    }
    const value: CategoryRecord = {
      ...existing,
      parentId: nextParentId,
      name: nextName,
      sortWeight: command.patch.sortWeight ?? existing.sortWeight,
      status: command.patch.status ?? existing.status,
      version: existing.version + 1,
    };
    const event: CategoryHistoryEvent =
      value.parentId !== existing.parentId
        ? 'MOVE'
        : value.status !== existing.status
          ? value.status === 'ENABLED'
            ? 'ENABLE'
            : 'DISABLE'
          : 'UPDATE';
    if (!(await this.appendAudit(command, value.id, `CATEGORY_${event}D`, existing, value))) {
      return { kind: 'AUDIT_REQUIRED' };
    }
    this.categories.set(value.id, value);
    this.histories.push({
      categoryId: value.id,
      companyId: value.companyId,
      event,
      version: value.version,
      snapshot: clone(value),
    });
    this.remember(scope, command, value);
    return { kind: 'OK', replayed: false, value: clone(value) };
  }

  private async deleteOnce(
    command: DeleteCategoryCommand,
  ): Promise<CategoryMutationResult<DeletedCategoryRecord>> {
    const scope = `DELETE:${command.companyId}:${command.categoryId}`;
    const replay = this.replay<DeletedCategoryRecord>(scope, command);
    if (replay) return replay;
    const existing = this.categories.get(command.categoryId);
    if (!existing || existing.companyId !== command.companyId) {
      return { kind: 'CATEGORY_NOT_FOUND' };
    }
    if (existing.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
    if (
      command.externallyReferenced ||
      [...this.categories.values()].some(({ parentId }) => parentId === existing.id)
    ) {
      return { kind: 'CATEGORY_REFERENCED' };
    }
    const value: DeletedCategoryRecord = {
      id: existing.id,
      deleted: true,
      version: existing.version + 1,
    };
    if (!(await this.appendAudit(command, existing.id, 'CATEGORY_DELETED', existing, value))) {
      return { kind: 'AUDIT_REQUIRED' };
    }
    this.categories.delete(existing.id);
    this.histories.push({
      categoryId: existing.id,
      companyId: existing.companyId,
      event: 'DELETE',
      version: value.version,
      snapshot: clone(existing),
    });
    this.remember(scope, command, value);
    return { kind: 'OK', replayed: false, value };
  }

  private parentIsValid(
    companyId: string,
    parentId: string | null,
    level: 1 | 2 | 3,
    categoryId?: string,
  ): boolean {
    if (level === 1) return parentId === null;
    if (!parentId || parentId === categoryId) return false;
    const parent = this.categories.get(parentId);
    return parent?.companyId === companyId && parent.level === level - 1;
  }

  private isDuplicate(
    companyId: string,
    parentId: string | null,
    name: string,
    excludeId?: string,
  ): boolean {
    const scope = parentId ?? ROOT_SCOPE;
    return [...this.categories.values()].some(
      (category) =>
        category.id !== excludeId &&
        category.companyId === companyId &&
        (category.parentId ?? ROOT_SCOPE) === scope &&
        category.name === name,
    );
  }

  private replay<T>(
    scope: string,
    command: { readonly idempotencyKey: string; readonly requestHash: string },
  ): CategoryMutationResult<T> | null {
    const stored = this.commands.get(`${scope}:${command.idempotencyKey}`);
    if (!stored) return null;
    if (stored.requestHash !== command.requestHash) return { kind: 'IDEMPOTENCY_CONFLICT' };
    return { kind: 'OK', replayed: true, value: clone(stored.value as T) };
  }

  private remember<T>(
    scope: string,
    command: { readonly idempotencyKey: string; readonly requestHash: string },
    value: T,
  ): void {
    this.commands.set(`${scope}:${command.idempotencyKey}`, {
      requestHash: command.requestHash,
      value: clone(value),
    });
  }

  private async appendAudit(
    command: CreateCategoryCommand | PatchCategoryCommand | DeleteCategoryCommand,
    objectId: string,
    action: string,
    beforeSnapshot: unknown,
    afterSnapshot: unknown,
  ): Promise<boolean> {
    try {
      await this.options.auditLogRepository.append({
        actorType: 'COMPANY_USER',
        actorId: command.actorIdentityId,
        functionalAccountId: command.functionalAccountId,
        action,
        objectType: 'CATEGORY',
        objectId,
        beforeSnapshot,
        afterSnapshot,
        requestId: command.requestId,
        ip: command.ip,
      });
      return true;
    } catch {
      return false;
    }
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
