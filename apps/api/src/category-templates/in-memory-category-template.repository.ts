import { randomUUID } from 'node:crypto';

import { assertApparelTemplateDefinition } from './apparel-template.policy.js';
import { assertDigitalTemplateDefinition } from './digital-template.policy.js';
import type { CategoryTemplateDefinition } from './category-template.policy.js';
import { assertFoodTemplateDefinition } from './food-template.policy.js';
import { assertFreshTemplateDefinition } from './fresh-template.policy.js';
import { assertGiftBoxTemplateDefinition } from './gift-box-template.policy.js';
import type {
  CategoryTemplateListResult,
  CategoryTemplateMutationResult,
  CategoryTemplateRecord,
  CategoryTemplateRepository,
  CreateCategoryTemplateCommand,
  InMemoryCategoryTemplateRepositoryOptions,
  PatchCategoryTemplateCommand,
  PublishCategoryTemplateCommand,
} from './category-template.repository.js';

type TemplateHistoryEvent = 'CREATE' | 'PUBLISH' | 'RETIRE' | 'UPDATE';
const clone = <T>(value: T): T => structuredClone(value);

interface StoredCommand<T> {
  readonly requestHash: string;
  readonly value: T;
}

interface StoredHistory {
  readonly templateId: string;
  readonly categoryId: string;
  readonly companyId: string;
  readonly event: TemplateHistoryEvent;
  readonly revision: number;
  readonly snapshot: CategoryTemplateRecord;
}

export class InMemoryCategoryTemplateRepository implements CategoryTemplateRepository {
  private readonly templates = new Map<string, CategoryTemplateRecord>();
  private readonly commands = new Map<string, StoredCommand<unknown>>();
  private readonly histories: StoredHistory[] = [];
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(private readonly options: InMemoryCategoryTemplateRepositoryOptions) {}

  async list(companyId: string, categoryId: string): Promise<CategoryTemplateListResult> {
    const category = await this.options.categoryRepository.findForCompany(companyId, categoryId);
    if (!category) return { kind: 'CATEGORY_NOT_FOUND' };
    const items = [...this.templates.values()]
      .filter((template) => template.companyId === companyId && template.categoryId === categoryId)
      .sort((left, right) => right.version - left.version)
      .map(clone);
    return {
      kind: 'OK',
      activeVersion: items.find(({ status }) => status === 'PUBLISHED')?.version ?? null,
      items,
    };
  }

  createDraft(
    command: CreateCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    return this.serialize(() => this.createDraftOnce(command));
  }

  patchDraft(
    command: PatchCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    return this.serialize(() => this.patchDraftOnce(command));
  }

  publish(
    command: PublishCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    return this.serialize(() => this.publishOnce(command));
  }

  validateCurrent(
    companyId: string,
    categoryId: string,
    version: number,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    const value = [...this.templates.values()].find(
      (template) =>
        template.companyId === companyId &&
        template.categoryId === categoryId &&
        template.version === version &&
        template.status === 'PUBLISHED',
    );
    return Promise.resolve(
      value
        ? { kind: 'OK', replayed: false, value: clone(value) }
        : { kind: 'TEMPLATE_VERSION_INACTIVE' },
    );
  }

  categoryIsReferenced(categoryId: string): Promise<boolean> {
    return Promise.resolve(
      [...this.templates.values()].some((template) => template.categoryId === categoryId),
    );
  }

  count(): Promise<number> {
    return Promise.resolve(this.templates.size);
  }

  historyCount(): Promise<number> {
    return Promise.resolve(this.histories.length);
  }

  publishedCount(categoryId: string): Promise<number> {
    return Promise.resolve(
      [...this.templates.values()].filter(
        (template) => template.categoryId === categoryId && template.status === 'PUBLISHED',
      ).length,
    );
  }

  async seedPublishedForTest(input: {
    readonly companyId: string;
    readonly categoryId: string;
    readonly version?: number;
    readonly definition?: CategoryTemplateDefinition;
  }): Promise<CategoryTemplateRecord> {
    const definition = input.definition ?? defaultTemplateDefinition();
    const now = new Date().toISOString();
    const value: CategoryTemplateRecord = {
      id: randomUUID(),
      companyId: input.companyId,
      categoryId: input.categoryId,
      version: input.version ?? 1,
      revision: 1,
      status: 'PUBLISHED',
      ...clone(definition),
      createdAt: now,
      publishedAt: now,
      retiredAt: null,
    };
    this.templates.set(value.id, value);
    return clone(value);
  }

  private async createDraftOnce(
    command: CreateCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    const scope = `CREATE:${command.companyId}:${command.categoryId}`;
    const replay = this.replay<CategoryTemplateRecord>(scope, command);
    if (replay) return replay;
    const target = await this.validateTarget(command.companyId, command.categoryId);
    if (target) return { kind: target };
    if (
      [...this.templates.values()].some(
        (template) =>
          template.companyId === command.companyId &&
          template.categoryId === command.categoryId &&
          template.status === 'DRAFT',
      )
    ) {
      return { kind: 'TEMPLATE_DRAFT_EXISTS' };
    }
    const version =
      Math.max(
        0,
        ...[...this.templates.values()]
          .filter(
            (template) =>
              template.companyId === command.companyId &&
              template.categoryId === command.categoryId,
          )
          .map((template) => template.version),
      ) + 1;
    const value: CategoryTemplateRecord = {
      id: randomUUID(),
      companyId: command.companyId,
      categoryId: command.categoryId,
      version,
      revision: 0,
      status: 'DRAFT',
      regulatoryMode: command.regulatoryMode,
      profile: command.profile,
      fieldSchema: clone(command.fieldSchema),
      skuDimensions: clone(command.skuDimensions),
      qualificationRules: clone(command.qualificationRules),
      detailModules: clone(command.detailModules),
      afterSaleRules: clone(command.afterSaleRules),
      createdAt: new Date().toISOString(),
      publishedAt: null,
      retiredAt: null,
    };
    if (!(await this.appendAudit(command, value.id, 'CATEGORY_TEMPLATE_CREATED', null, value))) {
      return { kind: 'AUDIT_REQUIRED' };
    }
    this.templates.set(value.id, value);
    this.histories.push(this.history(value, 'CREATE'));
    this.remember(scope, command, value);
    return { kind: 'OK', replayed: false, value: clone(value) };
  }

  private async patchDraftOnce(
    command: PatchCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    const scope = `PATCH:${command.companyId}:${command.templateId}`;
    const replay = this.replay<CategoryTemplateRecord>(scope, command);
    if (replay) return replay;
    const existing = this.templates.get(command.templateId);
    if (!existing || existing.companyId !== command.companyId) {
      return { kind: 'TEMPLATE_NOT_FOUND' };
    }
    if (existing.revision !== command.expectedRevision) return { kind: 'VERSION_CONFLICT' };
    if (existing.status !== 'DRAFT') {
      return {
        kind:
          existing.profile === 'FRESH'
            ? 'FRESH_HISTORY_REWRITE'
            : existing.profile === 'APPAREL'
              ? 'APPAREL_HISTORY_REWRITE'
              : existing.profile === 'DIGITAL'
                ? 'DIGITAL_HISTORY_REWRITE'
                : existing.profile === 'GIFT_BOX'
                  ? 'TEMPLATE_VERSION_IMMUTABLE'
                : 'TEMPLATE_IMMUTABLE',
      };
    }
    const value: CategoryTemplateRecord = {
      ...existing,
      ...clone(command.definition),
      revision: existing.revision + 1,
    };
    if (!(await this.appendAudit(command, value.id, 'CATEGORY_TEMPLATE_UPDATED', existing, value))) {
      return { kind: 'AUDIT_REQUIRED' };
    }
    this.templates.set(value.id, value);
    this.histories.push(this.history(value, 'UPDATE'));
    this.remember(scope, command, value);
    return { kind: 'OK', replayed: false, value: clone(value) };
  }

  private async publishOnce(
    command: PublishCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    const scope = `PUBLISH:${command.companyId}:${command.templateId}`;
    const replay = this.replay<CategoryTemplateRecord>(scope, command);
    if (replay) return replay;
    const existing = this.templates.get(command.templateId);
    if (!existing || existing.companyId !== command.companyId) {
      return { kind: 'TEMPLATE_NOT_FOUND' };
    }
    if (existing.revision !== command.expectedRevision) return { kind: 'VERSION_CONFLICT' };
    if (existing.status !== 'DRAFT') {
      return {
        kind:
          existing.profile === 'FRESH'
            ? 'FRESH_HISTORY_REWRITE'
            : existing.profile === 'APPAREL'
              ? 'APPAREL_HISTORY_REWRITE'
              : existing.profile === 'DIGITAL'
                ? 'DIGITAL_HISTORY_REWRITE'
                : existing.profile === 'GIFT_BOX'
                  ? 'TEMPLATE_VERSION_IMMUTABLE'
                : 'TEMPLATE_IMMUTABLE',
      };
    }
    const target = await this.validateTarget(command.companyId, existing.categoryId);
    if (target) return { kind: target };
    assertFoodTemplateDefinition(existing);
    assertFreshTemplateDefinition(existing);
    assertApparelTemplateDefinition(existing);
    assertDigitalTemplateDefinition(existing);
    assertGiftBoxTemplateDefinition(existing);
    const current = [...this.templates.values()].find(
      (template) =>
        template.companyId === command.companyId &&
        template.categoryId === existing.categoryId &&
        template.status === 'PUBLISHED',
    );
    const now = new Date().toISOString();
    const value: CategoryTemplateRecord = {
      ...existing,
      revision: existing.revision + 1,
      status: 'PUBLISHED',
      publishedAt: now,
      retiredAt: null,
    };
    if (
      !(await this.appendAudit(command, value.id, 'CATEGORY_TEMPLATE_PUBLISHED', {
        draft: existing,
        previousActive: current ?? null,
      }, value))
    ) {
      return { kind: 'AUDIT_REQUIRED' };
    }
    if (current) {
      const retired: CategoryTemplateRecord = {
        ...current,
        revision: current.revision + 1,
        status: 'RETIRED',
        retiredAt: now,
      };
      this.templates.set(retired.id, retired);
      this.histories.push(this.history(retired, 'RETIRE'));
    }
    this.templates.set(value.id, value);
    this.histories.push(this.history(value, 'PUBLISH'));
    this.remember(scope, command, value);
    return { kind: 'OK', replayed: false, value: clone(value) };
  }

  private async validateTarget(
    companyId: string,
    categoryId: string,
  ): Promise<'CATEGORY_DISABLED' | 'CATEGORY_NOT_FOUND' | 'CATEGORY_NOT_LEAF' | null> {
    const category = await this.options.categoryRepository.findForCompany(companyId, categoryId);
    if (!category) return 'CATEGORY_NOT_FOUND';
    if (category.status !== 'ENABLED') return 'CATEGORY_DISABLED';
    if (
      category.level !== 3 ||
      (await this.options.categoryRepository.hasChildren(companyId, categoryId))
    ) {
      return 'CATEGORY_NOT_LEAF';
    }
    return null;
  }

  private history(value: CategoryTemplateRecord, event: TemplateHistoryEvent): StoredHistory {
    return {
      templateId: value.id,
      categoryId: value.categoryId,
      companyId: value.companyId,
      event,
      revision: value.revision,
      snapshot: clone(value),
    };
  }

  private replay<T>(
    scope: string,
    command: { readonly idempotencyKey: string; readonly requestHash: string },
  ): CategoryTemplateMutationResult<T> | null {
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
    command: CreateCategoryTemplateCommand | PatchCategoryTemplateCommand | PublishCategoryTemplateCommand,
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
        objectType: 'CATEGORY_TEMPLATE',
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

export const defaultTemplateDefinition = (): CategoryTemplateDefinition => ({
  regulatoryMode: 'STANDARD',
  profile: 'GENERIC',
  fieldSchema: {
    schemaVersion: '1.0',
    fields: [
      {
        key: 'description',
        label: '商品说明',
        type: 'TEXT',
        required: true,
        unit: null,
        enumValues: [],
        validation: {
          min: null,
          max: null,
          minLength: 1,
          maxLength: 500,
          pattern: null,
        },
        searchable: false,
        specification: false,
        detailModuleKey: 'base',
      },
    ],
  },
  skuDimensions: { dimensions: [] },
  qualificationRules: { rules: [] },
  detailModules: {
    modules: [{ key: 'base', title: '基础信息', kind: 'FIELDS', sortWeight: 10 }],
  },
  afterSaleRules: {
    returnPolicy: 'COMPANY_STANDARD',
    notice: '由江苏福礼团供应链科技有限公司统一受理售后。',
    evidenceRequirements: [],
  },
});
