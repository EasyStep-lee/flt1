import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
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
  PatchCategoryTemplateCommand,
  PublishCategoryTemplateCommand,
} from './category-template.repository.js';

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

type StoredTemplate = {
  readonly id: string;
  readonly companyId: string;
  readonly categoryId: string;
  readonly version: number;
  readonly revision: number;
  readonly status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  readonly regulatoryMode: 'HIGH_RISK' | 'STANDARD';
  readonly profile: string;
  readonly fieldSchema: unknown;
  readonly skuDimensions: unknown;
  readonly qualificationRules: unknown;
  readonly detailModules: unknown;
  readonly afterSaleRules: unknown;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
  readonly retiredAt: Date | null;
};

const toRecord = (value: StoredTemplate): CategoryTemplateRecord => ({
  id: value.id,
  companyId: value.companyId,
  categoryId: value.categoryId,
  version: value.version,
  revision: value.revision,
  status: value.status,
  regulatoryMode: value.regulatoryMode,
  profile:
    value.profile === 'FOOD' ||
    value.profile === 'FRESH' ||
    value.profile === 'APPAREL' ||
    value.profile === 'DIGITAL' ||
    value.profile === 'GIFT_BOX'
      ? value.profile
      : 'GENERIC',
  fieldSchema: structuredClone(value.fieldSchema) as CategoryTemplateDefinition['fieldSchema'],
  skuDimensions: structuredClone(value.skuDimensions) as CategoryTemplateDefinition['skuDimensions'],
  qualificationRules: structuredClone(
    value.qualificationRules,
  ) as CategoryTemplateDefinition['qualificationRules'],
  detailModules: structuredClone(value.detailModules) as CategoryTemplateDefinition['detailModules'],
  afterSaleRules: structuredClone(
    value.afterSaleRules,
  ) as CategoryTemplateDefinition['afterSaleRules'],
  createdAt: value.createdAt.toISOString(),
  publishedAt: value.publishedAt?.toISOString() ?? null,
  retiredAt: value.retiredAt?.toISOString() ?? null,
});

@Injectable()
export class PrismaCategoryTemplateRepository implements CategoryTemplateRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(companyId: string, categoryId: string): Promise<CategoryTemplateListResult> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, companyId },
      select: { id: true },
    });
    if (!category) return { kind: 'CATEGORY_NOT_FOUND' };
    const values = await this.prisma.categoryTemplate.findMany({
      where: { companyId, categoryId },
      orderBy: { version: 'desc' },
    });
    const items = values.map(toRecord);
    return {
      kind: 'OK',
      activeVersion: items.find(({ status }) => status === 'PUBLISHED')?.version ?? null,
      items,
    };
  }

  createDraft(
    command: CreateCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    const scope = `CREATE:${command.companyId}:${command.categoryId}`;
    return this.mutate(scope, command, async (tx) => {
      const invalidTarget = await this.invalidTarget(tx, command.companyId, command.categoryId);
      if (invalidTarget) return { kind: invalidTarget };
      const draft = await tx.categoryTemplate.findFirst({
        where: { companyId: command.companyId, categoryId: command.categoryId, status: 'DRAFT' },
        select: { id: true },
      });
      if (draft) return { kind: 'TEMPLATE_DRAFT_EXISTS' };
      const latest = await tx.categoryTemplate.aggregate({
        where: { categoryId: command.categoryId },
        _max: { version: true },
      });
      const created = await tx.categoryTemplate.create({
        data: {
          id: randomUUID(),
          companyId: command.companyId,
          categoryId: command.categoryId,
          version: (latest._max.version ?? 0) + 1,
          revision: 0,
          status: 'DRAFT',
          regulatoryMode: command.regulatoryMode,
          draftSlot: 1,
          activeSlot: null,
          profile: command.profile,
          fieldSchema: json(command.fieldSchema),
          skuDimensions: json(command.skuDimensions),
          qualificationRules: json(command.qualificationRules),
          detailModules: json(command.detailModules),
          afterSaleRules: json(command.afterSaleRules),
        },
      });
      const value = toRecord(created);
      await this.appendHistory(tx, command, value, 'CREATE');
      await this.appendAudit(tx, command, value.id, 'CATEGORY_TEMPLATE_CREATED', null, value);
      return { kind: 'OK', replayed: false, value };
    });
  }

  patchDraft(
    command: PatchCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    const scope = `PATCH:${command.companyId}:${command.templateId}`;
    return this.mutate(scope, command, async (tx) => {
      const stored = await tx.categoryTemplate.findFirst({
        where: { id: command.templateId, companyId: command.companyId },
      });
      if (!stored) return { kind: 'TEMPLATE_NOT_FOUND' };
      if (stored.revision !== command.expectedRevision) return { kind: 'VERSION_CONFLICT' };
      if (stored.status !== 'DRAFT') {
        return {
          kind:
            stored.profile === 'FRESH'
              ? 'FRESH_HISTORY_REWRITE'
              : stored.profile === 'APPAREL'
                ? 'APPAREL_HISTORY_REWRITE'
                : stored.profile === 'DIGITAL'
                  ? 'DIGITAL_HISTORY_REWRITE'
                  : stored.profile === 'GIFT_BOX'
                    ? 'TEMPLATE_VERSION_IMMUTABLE'
                  : 'TEMPLATE_IMMUTABLE',
        };
      }
      const before = toRecord(stored);
      const updated = await tx.categoryTemplate.update({
        where: { id: stored.id },
        data: {
          revision: { increment: 1 },
          regulatoryMode: command.definition.regulatoryMode,
          profile: command.definition.profile,
          fieldSchema: json(command.definition.fieldSchema),
          skuDimensions: json(command.definition.skuDimensions),
          qualificationRules: json(command.definition.qualificationRules),
          detailModules: json(command.definition.detailModules),
          afterSaleRules: json(command.definition.afterSaleRules),
        },
      });
      const value = toRecord(updated);
      await this.appendHistory(tx, command, value, 'UPDATE');
      await this.appendAudit(tx, command, value.id, 'CATEGORY_TEMPLATE_UPDATED', before, value);
      return { kind: 'OK', replayed: false, value };
    });
  }

  publish(
    command: PublishCategoryTemplateCommand,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    const scope = `PUBLISH:${command.companyId}:${command.templateId}`;
    return this.mutate(scope, command, async (tx) => {
      const stored = await tx.categoryTemplate.findFirst({
        where: { id: command.templateId, companyId: command.companyId },
      });
      if (!stored) return { kind: 'TEMPLATE_NOT_FOUND' };
      await tx.$queryRaw`SELECT id FROM category WHERE id = ${stored.categoryId} FOR UPDATE`;
      if (stored.revision !== command.expectedRevision) return { kind: 'VERSION_CONFLICT' };
      if (stored.status !== 'DRAFT') {
        return {
          kind:
            stored.profile === 'FRESH'
              ? 'FRESH_HISTORY_REWRITE'
              : stored.profile === 'APPAREL'
                ? 'APPAREL_HISTORY_REWRITE'
                : stored.profile === 'DIGITAL'
                  ? 'DIGITAL_HISTORY_REWRITE'
                  : stored.profile === 'GIFT_BOX'
                    ? 'TEMPLATE_VERSION_IMMUTABLE'
                  : 'TEMPLATE_IMMUTABLE',
        };
      }
      assertFoodTemplateDefinition(toRecord(stored));
      assertFreshTemplateDefinition(toRecord(stored));
      assertApparelTemplateDefinition(toRecord(stored));
      assertDigitalTemplateDefinition(toRecord(stored));
      assertGiftBoxTemplateDefinition(toRecord(stored));
      const invalidTarget = await this.invalidTarget(tx, command.companyId, stored.categoryId);
      if (invalidTarget) return { kind: invalidTarget };
      const current = await tx.categoryTemplate.findFirst({
        where: {
          companyId: command.companyId,
          categoryId: stored.categoryId,
          status: 'PUBLISHED',
        },
      });
      const now = new Date();
      if (current) {
        const retired = await tx.categoryTemplate.update({
          where: { id: current.id },
          data: {
            status: 'RETIRED',
            activeSlot: null,
            retiredAt: now,
            revision: { increment: 1 },
          },
        });
        await this.appendHistory(tx, command, toRecord(retired), 'RETIRE');
      }
      const published = await tx.categoryTemplate.update({
        where: { id: stored.id },
        data: {
          status: 'PUBLISHED',
          draftSlot: null,
          activeSlot: 1,
          publishedAt: now,
          revision: { increment: 1 },
        },
      });
      const value = toRecord(published);
      await this.appendHistory(tx, command, value, 'PUBLISH');
      await this.appendAudit(
        tx,
        command,
        value.id,
        'CATEGORY_TEMPLATE_PUBLISHED',
        { draft: toRecord(stored), previousActive: current ? toRecord(current) : null },
        value,
      );
      return { kind: 'OK', replayed: false, value };
    });
  }

  async validateCurrent(
    companyId: string,
    categoryId: string,
    version: number,
  ): Promise<CategoryTemplateMutationResult<CategoryTemplateRecord>> {
    const value = await this.prisma.categoryTemplate.findFirst({
      where: { companyId, categoryId, version, status: 'PUBLISHED' },
    });
    return value
      ? { kind: 'OK', replayed: false, value: toRecord(value) }
      : { kind: 'TEMPLATE_VERSION_INACTIVE' };
  }

  async categoryIsReferenced(categoryId: string): Promise<boolean> {
    return Boolean(
      await this.prisma.categoryTemplate.findFirst({
        where: { categoryId },
        select: { id: true },
      }),
    );
  }

  private async invalidTarget(
    tx: Prisma.TransactionClient,
    companyId: string,
    categoryId: string,
  ): Promise<'CATEGORY_DISABLED' | 'CATEGORY_NOT_FOUND' | 'CATEGORY_NOT_LEAF' | null> {
    const category = await tx.category.findFirst({ where: { id: categoryId, companyId } });
    if (!category) return 'CATEGORY_NOT_FOUND';
    if (category.status !== 'ENABLED') return 'CATEGORY_DISABLED';
    const child = await tx.category.findFirst({
      where: { parentId: categoryId },
      select: { id: true },
    });
    return category.level === 3 && !child ? null : 'CATEGORY_NOT_LEAF';
  }

  private async mutate<T>(
    scope: string,
    command: { readonly idempotencyKey: string; readonly requestHash: string },
    operation: (
      tx: Prisma.TransactionClient,
    ) => Promise<CategoryTemplateMutationResult<T>>,
  ): Promise<CategoryTemplateMutationResult<T>> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const replay = await tx.categoryTemplateCommand.findUnique({
            where: { scope_idempotencyKey: { scope, idempotencyKey: command.idempotencyKey } },
          });
          if (replay) {
            return replay.requestHash === command.requestHash
              ? { kind: 'OK', replayed: true, value: replay.responseSnapshot as T }
              : { kind: 'IDEMPOTENCY_CONFLICT' };
          }
          const result = await operation(tx);
          if (result.kind !== 'OK') return result;
          await tx.categoryTemplateCommand.create({
            data: {
              scope,
              idempotencyKey: command.idempotencyKey,
              requestHash: command.requestHash,
              responseSnapshot: json(result.value),
            },
          });
          return result;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.categoryTemplateCommand.findUnique({
          where: { scope_idempotencyKey: { scope, idempotencyKey: command.idempotencyKey } },
        });
        if (replay) {
          return replay.requestHash === command.requestHash
            ? { kind: 'OK', replayed: true, value: replay.responseSnapshot as T }
            : { kind: 'IDEMPOTENCY_CONFLICT' };
        }
        return { kind: 'TEMPLATE_DRAFT_EXISTS' };
      }
      if (error instanceof Error && error.message.includes('CATEGORY_TEMPLATE_IMMUTABLE')) {
        return { kind: 'TEMPLATE_IMMUTABLE' };
      }
      return { kind: 'AUDIT_REQUIRED' };
    }
  }

  private appendHistory(
    tx: Prisma.TransactionClient,
    command: CreateCategoryTemplateCommand | PatchCategoryTemplateCommand | PublishCategoryTemplateCommand,
    value: CategoryTemplateRecord,
    event: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'RETIRE',
  ) {
    return tx.categoryTemplateHistory.create({
      data: {
        id: randomUUID(),
        templateId: value.id,
        categoryId: value.categoryId,
        companyId: value.companyId,
        event,
        revision: value.revision,
        snapshot: json(value),
        actorIdentityId: command.actorIdentityId,
        functionalAccountId: command.functionalAccountId,
        requestId: command.requestId,
      },
    });
  }

  private appendAudit(
    tx: Prisma.TransactionClient,
    command: CreateCategoryTemplateCommand | PatchCategoryTemplateCommand | PublishCategoryTemplateCommand,
    objectId: string,
    action: string,
    beforeSnapshot: unknown,
    afterSnapshot: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        actorType: 'COMPANY_USER',
        actorId: command.actorIdentityId,
        functionalAccountId: command.functionalAccountId,
        action,
        objectType: 'CATEGORY_TEMPLATE',
        objectId,
        beforeSnapshot: json(beforeSnapshot),
        afterSnapshot: json(afterSnapshot),
        requestId: command.requestId,
        ip: command.ip,
      },
    });
  }
}
