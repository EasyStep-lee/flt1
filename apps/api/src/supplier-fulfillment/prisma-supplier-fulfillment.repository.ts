import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@fulishe/db';

import { PrismaService } from '../infrastructure/prisma.service.js';
import type {
  AppendFulfillmentNodeCommand,
  FulfillmentMutationResult,
  FulfillmentPreparationStatus,
  SupplierFulfillmentRecord,
  SupplierFulfillmentRepository,
} from './supplier-fulfillment.repository.js';

const include = Prisma.validator<Prisma.SupplierFulfillmentOrderInclude>()({
  buyerOrder: { select: { orderNo: true, paymentStatus: true } },
  items: { include: { sku: { select: { code: true } } }, orderBy: { lineNo: 'asc' } },
  nodeLogs: { orderBy: [{ resultingVersion: 'asc' }, { occurredAt: 'asc' }] },
});
type Stored = Prisma.SupplierFulfillmentOrderGetPayload<{ include: typeof include }>;

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const toRecord = (stored: Stored): SupplierFulfillmentRecord => {
  const pickup = object(stored.pickupPointSnapshot);
  return {
    id: stored.id,
    orderId: stored.buyerOrderId,
    enterpriseProcurementOrderId: stored.enterpriseProcurementOrderId,
    supplierId: stored.supplierId,
    orderNo: stored.buyerOrder.orderNo,
    subOrderNo: stored.subOrderNo,
    channelType: stored.channelType,
    activationStatus: stored.activationStatus,
    preparationStatus: stored.preparationStatus,
    handoverStatus: stored.handoverStatus,
    settlementStatus: stored.settlementStatus,
    goodsAmount: stored.goodsAmount,
    supplyAmount: stored.supplyAmount,
    pickupPoint: {
      address: typeof pickup.address === 'string' ? pickup.address : '',
      ...(typeof pickup.lat === 'string' ? { lat: pickup.lat } : {}),
      ...(typeof pickup.lng === 'string' ? { lng: pickup.lng } : {}),
    },
    items: stored.items.map((item) => {
      const snapshot = object(item.productSnapshot);
      return {
        orderItemId: item.id,
        productName: typeof snapshot.name === 'string' ? snapshot.name : '商品',
        skuLabel: item.sku.code,
        quantity: item.quantity,
      };
    }),
    nodes: stored.nodeLogs.map((node) => {
      const detail = object(node.detailSnapshot);
      return {
        id: node.id,
        node: node.node,
        reason: typeof detail.reason === 'string' ? detail.reason : null,
        resultingVersion: node.resultingVersion,
        occurredAt: node.occurredAt.toISOString(),
      };
    }),
    version: stored.version,
    createdAt: stored.createdAt.toISOString(),
    updatedAt: stored.updatedAt.toISOString(),
  };
};

const transitions: Readonly<Record<string, readonly [FulfillmentPreparationStatus, 'NOT_READY' | 'READY' | 'HANDED_OVER']>> = Object.freeze({
  'PENDING:ACCEPT': ['ACCEPTED', 'NOT_READY'],
  'ACCEPTED:START_PREPARING': ['PREPARING', 'NOT_READY'],
  'PREPARING:MARK_READY': ['READY_FOR_HANDOVER', 'READY'],
  'READY_FOR_HANDOVER:HANDOVER': ['HANDED_OVER', 'HANDED_OVER'],
});

@Injectable()
export class PrismaSupplierFulfillmentRepository implements SupplierFulfillmentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(supplierId: string): Promise<readonly SupplierFulfillmentRecord[]> {
    const records = await this.prisma.supplierFulfillmentOrder.findMany({
      where: { supplierId, activationStatus: 'ACTIVE', buyerOrder: { paymentStatus: 'PAID' } },
      include,
      orderBy: [{ createdAt: 'desc' }, { subOrderNo: 'asc' }],
    });
    return records.map(toRecord);
  }

  async appendNode(command: AppendFulfillmentNodeCommand): Promise<FulfillmentMutationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.supplierFulfillmentNodeLog.findUnique({
          where: { subOrderId_idempotencyKey: { subOrderId: command.subOrderId, idempotencyKey: command.idempotencyKey } },
          include: { subOrder: { select: { supplierId: true } } },
        });
        if (existing) {
          if (existing.subOrder.supplierId !== command.supplierId) return { kind: 'NOT_FOUND' };
          return existing.requestHash === command.requestHash
            ? { kind: 'OK', value: structuredClone(existing.responseSnapshot) as unknown as SupplierFulfillmentRecord, replayed: true }
            : { kind: 'IDEMPOTENCY_CONFLICT' };
        }

        const before = await tx.supplierFulfillmentOrder.findFirst({
          where: { id: command.subOrderId, supplierId: command.supplierId },
          include,
        });
        if (!before) return { kind: 'NOT_FOUND' };
        if (before.activationStatus !== 'ACTIVE' || before.buyerOrder.paymentStatus !== 'PAID') return { kind: 'ACTIVATION_INVALID' };
        if (before.version !== command.expectedVersion) return { kind: 'VERSION_CONFLICT' };

        const state = `${before.preparationStatus}:${command.node}`;
        const next = transitions[state];
        const shortageAllowed = command.node === 'REPORT_SHORTAGE' && ['PENDING', 'ACCEPTED', 'PREPARING'].includes(before.preparationStatus);
        if (!next && !shortageAllowed) return { kind: 'STATE_INVALID' };
        if (command.node === 'REPORT_SHORTAGE') {
          const quantities = new Map(before.items.map((item) => [item.id, item.quantity]));
          if (command.shortages.some((item) => !quantities.has(item.orderItemId) || item.quantity > quantities.get(item.orderItemId)!)) return { kind: 'SHORTAGE_INVALID' };
        }
        if (command.node === 'MARK_READY') {
          const pickup = object(before.pickupPointSnapshot);
          if (!pickup.address || !pickup.lat || !pickup.lng) return { kind: 'PICKUP_POINT_INVALID' };
        }
        if (command.node === 'HANDOVER') {
          const expectedParty = before.channelType === 'CONSUMER' ? 'RUNNER' : 'COMPANY_LOGISTICS';
          if (command.handoverParty !== expectedParty) return { kind: 'HANDOVER_PARTY_INVALID' };
        }

        const toPreparationStatus = next?.[0] ?? before.preparationStatus;
        const toHandoverStatus = next?.[1] ?? before.handoverStatus;
        const changed = await tx.supplierFulfillmentOrder.updateMany({
          where: { id: before.id, supplierId: command.supplierId, version: command.expectedVersion, preparationStatus: before.preparationStatus },
          data: { preparationStatus: toPreparationStatus, handoverStatus: toHandoverStatus, version: { increment: 1 } },
        });
        if (changed.count !== 1) return { kind: 'VERSION_CONFLICT' };
        const nodeId = randomUUID();
        await tx.supplierFulfillmentNodeLog.create({
          data: {
            id: nodeId,
            subOrderId: before.id,
            node: command.node,
            fromPreparationStatus: before.preparationStatus,
            toPreparationStatus,
            handoverParty: command.handoverParty,
            detailSnapshot: json({
              reason: command.reason,
              shortages: command.shortages,
              handoverReference: command.handoverReference,
            }),
            actorIdentityId: command.actorIdentityId,
            functionalAccountId: command.functionalAccountId,
            idempotencyKey: command.idempotencyKey,
            requestHash: command.requestHash,
            responseSnapshot: json({ pending: true }),
            requestId: command.requestId,
            ip: command.ip,
            resultingVersion: before.version + 1,
          },
        });
        if (command.node === 'MARK_READY') {
          await tx.supplierFulfillmentReadinessOutbox.create({
            data: {
              subOrderId: before.id,
              eventType: 'SUPPLIER_FULFILLMENT_READY_V1',
              channelType: before.channelType,
              aggregateVersion: before.version + 1,
              payload: json({
                schemaVersion: 1,
                subOrderId: before.id,
                orderId: before.buyerOrderId,
                channelType: before.channelType,
                pickupPointSnapshot: before.pickupPointSnapshot,
              }),
            },
          });
        }
        const stored = await tx.supplierFulfillmentOrder.findUniqueOrThrow({ where: { id: before.id }, include });
        const value = toRecord(stored);
        await tx.supplierFulfillmentNodeLog.update({ where: { id: nodeId }, data: { responseSnapshot: json(value) } });
        return { kind: 'OK', value, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return { kind: 'VERSION_CONFLICT' };
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.supplierFulfillmentNodeLog.findUnique({
          where: { subOrderId_idempotencyKey: { subOrderId: command.subOrderId, idempotencyKey: command.idempotencyKey } },
          include: { subOrder: { select: { supplierId: true } } },
        });
        if (!existing || existing.subOrder.supplierId !== command.supplierId) return { kind: 'NOT_FOUND' };
        return existing.requestHash === command.requestHash
          ? { kind: 'OK', value: structuredClone(existing.responseSnapshot) as unknown as SupplierFulfillmentRecord, replayed: true }
          : { kind: 'IDEMPOTENCY_CONFLICT' };
      }
      throw error;
    }
  }
}
