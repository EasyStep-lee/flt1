import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';
import type { SupplierFulfillmentActor } from './supplier-fulfillment.actor.js';
import {
  fulfillmentRequestHash,
  normalizeFulfillmentNode,
  requireFulfillmentId,
  requireFulfillmentIdempotencyKey,
} from './supplier-fulfillment.policy.js';
import {
  SUPPLIER_FULFILLMENT_REPOSITORY,
  type FulfillmentMutationResult,
  type SupplierFulfillmentRecord,
  type SupplierFulfillmentRepository,
} from './supplier-fulfillment.repository.js';

const requireRole = (actor: SupplierFulfillmentActor): void => {
  if (actor.role !== 'SUPPLIER_FULFILLMENT') throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权访问供应商履约页面');
};

const responseDto = (record: SupplierFulfillmentRecord) => ({
  id: record.id,
  orderNo: record.orderNo,
  subOrderNo: record.subOrderNo,
  channelType: record.channelType,
  preparationStatus: record.preparationStatus,
  handoverStatus: record.handoverStatus,
  pickupPoint: { address: record.pickupPoint.address },
  items: record.items.map((item) => ({ ...item })),
  nodes: record.nodes.map((node) => ({ ...node })),
  version: record.version,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const failure = (result: Exclude<FulfillmentMutationResult, { kind: 'OK' }>): never => {
  const definitions: Record<typeof result.kind, readonly [number, ApiErrorCode, string]> = {
    NOT_FOUND: [403, 'SUPPLIER_SCOPE_FORBIDDEN', 'Fulfillment suborder is outside the current supplier scope'],
    VERSION_CONFLICT: [409, 'VERSION_CONFLICT', 'Fulfillment suborder version changed'],
    IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts with the original request'],
    STATE_INVALID: [409, 'STATE_TRANSITION_INVALID', 'Fulfillment node is invalid for the current state'],
    HANDOVER_PARTY_INVALID: [422, 'FULFILLMENT_HANDOVER_PARTY_INVALID', 'Handover party does not match the order channel'],
    SHORTAGE_INVALID: [422, 'VALIDATION_FAILED', 'Shortage items must belong to this suborder and not exceed ordered quantities'],
    PICKUP_POINT_INVALID: [409, 'STATE_TRANSITION_INVALID', 'The approved pickup point snapshot is incomplete'],
    ACTIVATION_INVALID: [409, 'STATE_TRANSITION_INVALID', 'The main order is not paid or the suborder is inactive'],
  };
  const [status, code, message] = definitions[result.kind];
  throw new SafeApiError(status, code, message);
};

@Injectable()
export class SupplierFulfillmentService {
  constructor(@Inject(SUPPLIER_FULFILLMENT_REPOSITORY) private readonly repository: SupplierFulfillmentRepository) {}

  async list(actor: SupplierFulfillmentActor, query: Record<string, unknown>) {
    requireRole(actor);
    if (Object.keys(query).some((field) => field !== 'page' && field !== 'pageSize' && field !== 'channelType' && field !== 'preparationStatus')) {
      throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Unknown or owner query fields are forbidden');
    }
    const page = query.page === undefined ? 1 : Number(query.page);
    const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Fulfillment pagination is invalid');
    }
    const channelType = query.channelType;
    if (channelType !== undefined && channelType !== 'CONSUMER' && channelType !== 'ENTERPRISE') throw new SafeApiError(422, 'VALIDATION_FAILED', 'channelType is invalid');
    const preparationStatus = query.preparationStatus;
    const statuses = new Set(['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_HANDOVER', 'HANDED_OVER', 'COMPLETED', 'CANCELLED']);
    if (preparationStatus !== undefined && (typeof preparationStatus !== 'string' || !statuses.has(preparationStatus))) throw new SafeApiError(422, 'VALIDATION_FAILED', 'preparationStatus is invalid');
    const all = (await this.repository.list(actor.supplierId))
      .filter((record) => channelType === undefined || record.channelType === channelType)
      .filter((record) => preparationStatus === undefined || record.preparationStatus === preparationStatus)
      .map(responseDto);
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total: all.length, page, pageSize };
  }

  async appendNode(
    actor: SupplierFulfillmentActor,
    subOrderIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
    ip: string | null,
  ) {
    requireRole(actor);
    const subOrderId = requireFulfillmentId(subOrderIdValue);
    const input = normalizeFulfillmentNode(bodyValue);
    const idempotencyKey = requireFulfillmentIdempotencyKey(idempotencyKeyValue);
    const result = await this.repository.appendNode({
      supplierId: actor.supplierId,
      subOrderId,
      ...input,
      actorIdentityId: actor.identityId,
      functionalAccountId: actor.functionalAccountId,
      idempotencyKey,
      requestHash: fulfillmentRequestHash(subOrderId, input),
      requestId,
      ip,
    });
    if (result.kind !== 'OK') return failure(result);
    return { body: responseDto(result.value), replayed: result.replayed };
  }
}
