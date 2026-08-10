import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type { CategoryStatus } from './category.policy.js';
import type {
  CategoryAssignmentResult,
  CategoryMutationResult,
  CategoryRecord,
  CategoryRepository,
  CreateCategoryCommand,
  DeleteCategoryCommand,
  DeletedCategoryRecord,
  PatchCategoryCommand,
} from './category.repository.js';

const ROOT_SCOPE = '00000000-0000-0000-0000-000000000000';

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const toRecord = (value: {
  readonly id: string;
  readonly companyId: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly level: number;
  readonly sortWeight: number;
  readonly status: CategoryStatus;
  readonly version: number;
}): CategoryRecord => ({
  id: value.id,
  companyId: value.companyId,
  parentId: value.parentId,
  name: value.name,
  level: value.level as 1 | 2 | 3,
  sortWeight: value.sortWeight,
  status: value.status,
  version: value.version,
});

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(companyId: string, status?: CategoryStatus): Promise<readonly CategoryRecord[]> {
    const values = await this.prisma.category.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: [{ sortWeight: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
    return values.map(toRecord);
  }

  async findForCompany(companyId: string, categoryId: string): Promise<CategoryRecord | null> {
    const value = await this.prisma.category.findFirst({
      where: { id: categoryId, companyId },
    });
    return value ? toRecord(value) : null;
  }

  async hasChildren(companyId: string, categoryId: string): Promise<boolean> {
    const value = await this.prisma.category.findFirst({
      where: { companyId, parentId: categoryId },
      select: { id: true },
    });
    return Boolean(value);
  }

  create(command: CreateCategoryCommand): Promise<CategoryMutationResult<CategoryRecord>> {
    const scope = `CREATE:${command.companyId}`;
    return this.mutate(scope, command, async (tx) => {
      const company = await tx.company.findFirst({
        where: { id: command.companyId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!company) return { kind: 'COMPANY_INACTIVE' };
      if (!(await this.parentIsValid(tx, command.companyId, command.parentId, command.level))) {
        return { kind: 'CATEGORY_PARENT_INVALID' };
      }
      const duplicate = await tx.category.findFirst({
        where: {
          companyId: command.companyId,
          parentScopeKey: command.parentId ?? ROOT_SCOPE,
          name: command.name,
        },
        select: { id: true },
      });
      if (duplicate) return { kind: 'CATEGORY_DUPLICATE' };
      const created = await tx.category.create({
        data: {
          id: randomUUID(),
          companyId: command.companyId,
          parentId: command.parentId,
          parentScopeKey: command.parentId ?? ROOT_SCOPE,
          name: command.name,
          level: command.level,
          sortWeight: command.sortWeight,
          status: 'ENABLED',
          version: 0,
        },
      });
      const value = toRecord(created);
      await this.appendMutationEvidence(tx, command, value, 'CREATE', 'CATEGORY_CREATED', null);
      return { kind: 'OK', replayed: false, value };
    });
  }

  patch(command: PatchCategoryCommand): Promise<CategoryMutationResult<CategoryRecord>> {
    const scope = `PATCH:${command.companyId}:${command.categoryId}`;
    return this.mutate(scope, command, async (tx) => {
      const stored = await tx.category.findFirst({
        where: { id: command.categoryId, companyId: command.companyId },
      });
      if (!stored) return { kind: 'CATEGORY_NOT_FOUND' };
      if (stored.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
      const existing = toRecord(stored);
      const nextParentId = Object.prototype.hasOwnProperty.call(command.patch, 'parentId')
        ? command.patch.parentId!
        : existing.parentId;
      if (
        !(await this.parentIsValid(
          tx,
          existing.companyId,
          nextParentId,
          existing.level,
          existing.id,
        ))
      ) {
        return { kind: 'CATEGORY_PARENT_INVALID' };
      }
      const nextName = command.patch.name ?? existing.name;
      const duplicate = await tx.category.findFirst({
        where: {
          companyId: existing.companyId,
          parentScopeKey: nextParentId ?? ROOT_SCOPE,
          name: nextName,
          id: { not: existing.id },
        },
        select: { id: true },
      });
      if (duplicate) return { kind: 'CATEGORY_DUPLICATE' };
      const unchanged =
        nextParentId === existing.parentId &&
        nextName === existing.name &&
        (command.patch.sortWeight ?? existing.sortWeight) === existing.sortWeight &&
        (command.patch.status ?? existing.status) === existing.status;
      if (unchanged) return { kind: 'OK', replayed: false, value: existing };
      const event =
        nextParentId !== existing.parentId
          ? 'MOVE'
          : command.patch.status && command.patch.status !== existing.status
            ? command.patch.status === 'ENABLED'
              ? 'ENABLE'
              : 'DISABLE'
            : 'UPDATE';
      const updated = await tx.category.update({
        where: { id: existing.id },
        data: {
          parentId: nextParentId,
          parentScopeKey: nextParentId ?? ROOT_SCOPE,
          name: nextName,
          sortWeight: command.patch.sortWeight ?? existing.sortWeight,
          status: command.patch.status ?? existing.status,
          version: { increment: 1 },
        },
      });
      const value = toRecord(updated);
      await this.appendMutationEvidence(
        tx,
        command,
        value,
        event,
        `CATEGORY_${event}D`,
        existing,
      );
      return { kind: 'OK', replayed: false, value };
    });
  }

  delete(
    command: DeleteCategoryCommand,
  ): Promise<CategoryMutationResult<DeletedCategoryRecord>> {
    const scope = `DELETE:${command.companyId}:${command.categoryId}`;
    return this.mutate(scope, command, async (tx) => {
      const stored = await tx.category.findFirst({
        where: { id: command.categoryId, companyId: command.companyId },
      });
      if (!stored) return { kind: 'CATEGORY_NOT_FOUND' };
      if (stored.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };
      const existing = toRecord(stored);
      const child = await tx.category.findFirst({
        where: { parentId: existing.id },
        select: { id: true },
      });
      const supplierProduct = await tx.supplierProduct.findFirst({
        where: { categoryId: existing.id },
        select: { id: true },
      });
      const product = await tx.product.findFirst({
        where: { categoryId: existing.id },
        select: { id: true },
      });
      if (command.externallyReferenced || child || supplierProduct || product) {
        return { kind: 'CATEGORY_REFERENCED' };
      }
      const value: DeletedCategoryRecord = {
        id: existing.id,
        deleted: true,
        version: existing.version + 1,
      };
      await tx.categoryHistory.create({
        data: {
          categoryId: existing.id,
          companyId: existing.companyId,
          event: 'DELETE',
          version: value.version,
          snapshot: json(existing),
          actorIdentityId: command.actorIdentityId,
          functionalAccountId: command.functionalAccountId,
          requestId: command.requestId,
        },
      });
      await this.appendAudit(tx, command, existing.id, 'CATEGORY_DELETED', existing, value);
      await tx.category.delete({ where: { id: existing.id } });
      return { kind: 'OK', replayed: false, value };
    });
  }

  async validateSupplierAssignment(
    supplierId: string,
    categoryId: string,
  ): Promise<CategoryAssignmentResult> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { companyId: true },
    });
    if (!supplier) return { kind: 'CATEGORY_NOT_FOUND' };
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, companyId: supplier.companyId },
    });
    if (!category) return { kind: 'CATEGORY_NOT_FOUND' };
    if (category.status !== 'ENABLED') return { kind: 'CATEGORY_DISABLED' };
    const hasChild = await this.prisma.category.findFirst({
      where: { parentId: category.id },
      select: { id: true },
    });
    if (category.level !== 3 || hasChild) return { kind: 'CATEGORY_NOT_LEAF' };
    return { kind: 'OK', value: toRecord(category) };
  }

  private async mutate<T>(
    scope: string,
    command: {
      readonly idempotencyKey: string;
      readonly requestHash: string;
    },
    operation: (
      tx: Prisma.TransactionClient,
    ) => Promise<CategoryMutationResult<T>>,
  ): Promise<CategoryMutationResult<T>> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const replay = await tx.categoryCommand.findUnique({
            where: {
              scope_idempotencyKey: {
                scope,
                idempotencyKey: command.idempotencyKey,
              },
            },
          });
          if (replay) {
            if (replay.requestHash !== command.requestHash) {
              return { kind: 'IDEMPOTENCY_CONFLICT' };
            }
            return {
              kind: 'OK',
              replayed: true,
              value: replay.responseSnapshot as T,
            };
          }
          const result = await operation(tx);
          if (result.kind !== 'OK') return result;
          await tx.categoryCommand.create({
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
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.categoryCommand.findUnique({
          where: {
            scope_idempotencyKey: { scope, idempotencyKey: command.idempotencyKey },
          },
        });
        if (replay) {
          return replay.requestHash === command.requestHash
            ? { kind: 'OK', replayed: true, value: replay.responseSnapshot as T }
            : { kind: 'IDEMPOTENCY_CONFLICT' };
        }
        return { kind: 'CATEGORY_DUPLICATE' };
      }
      if (error instanceof Error && error.message.includes('CATEGORY_REFERENCED')) {
        return { kind: 'CATEGORY_REFERENCED' };
      }
      if (error instanceof Error && error.message.includes('CATEGORY_PARENT_INVALID')) {
        return { kind: 'CATEGORY_PARENT_INVALID' };
      }
      return { kind: 'AUDIT_REQUIRED' };
    }
  }

  private async parentIsValid(
    tx: Prisma.TransactionClient,
    companyId: string,
    parentId: string | null,
    level: 1 | 2 | 3,
    categoryId?: string,
  ): Promise<boolean> {
    if (level === 1) return parentId === null;
    if (!parentId || parentId === categoryId) return false;
    const parent = await tx.category.findFirst({
      where: { id: parentId, companyId, level: level - 1 },
      select: { id: true },
    });
    return Boolean(parent);
  }

  private async appendMutationEvidence(
    tx: Prisma.TransactionClient,
    command: CreateCategoryCommand | PatchCategoryCommand,
    value: CategoryRecord,
    event: 'CREATE' | 'UPDATE' | 'MOVE' | 'ENABLE' | 'DISABLE',
    action: string,
    beforeSnapshot: CategoryRecord | null,
  ): Promise<void> {
    await tx.categoryHistory.create({
      data: {
        categoryId: value.id,
        companyId: value.companyId,
        event,
        version: value.version,
        snapshot: json(value),
        actorIdentityId: command.actorIdentityId,
        functionalAccountId: command.functionalAccountId,
        requestId: command.requestId,
      },
    });
    await this.appendAudit(tx, command, value.id, action, beforeSnapshot, value);
  }

  private appendAudit(
    tx: Prisma.TransactionClient,
    command: CreateCategoryCommand | PatchCategoryCommand | DeleteCategoryCommand,
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
        objectType: 'CATEGORY',
        objectId,
        beforeSnapshot: json(beforeSnapshot),
        afterSnapshot: json(afterSnapshot),
        requestId: command.requestId,
        ip: command.ip,
      },
    });
  }
}
