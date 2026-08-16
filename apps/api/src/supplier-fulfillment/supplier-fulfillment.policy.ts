import { createHash } from 'node:crypto';

import { SafeApiError } from '../http/api-error.js';

export type FulfillmentNode = 'ACCEPT' | 'REPORT_SHORTAGE' | 'START_PREPARING' | 'MARK_READY' | 'HANDOVER';
export type FulfillmentHandoverParty = 'RUNNER' | 'COMPANY_LOGISTICS';

export interface FulfillmentNodeInput {
  readonly node: FulfillmentNode;
  readonly expectedVersion: number;
  readonly reason: string | null;
  readonly shortages: readonly { readonly orderItemId: string; readonly quantity: number }[];
  readonly handoverParty: FulfillmentHandoverParty | null;
  readonly handoverReference: string | null;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const allowedFields = new Set(['node', 'expectedVersion', 'reason', 'shortages', 'handoverParty', 'handoverReference']);
const nodes = new Set<FulfillmentNode>(['ACCEPT', 'REPORT_SHORTAGE', 'START_PREPARING', 'MARK_READY', 'HANDOVER']);
const handoverParties = new Set<FulfillmentHandoverParty>(['RUNNER', 'COMPANY_LOGISTICS']);

export const requireFulfillmentId = (value: unknown): string => {
  if (typeof value !== 'string' || !uuid.test(value)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'Fulfillment suborder id is invalid');
  return value;
};

export const requireFulfillmentIdempotencyKey = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 128) {
    throw new SafeApiError(428, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required');
  }
  return value;
};

export const normalizeFulfillmentNode = (value: unknown): FulfillmentNodeInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'Request body must be an object');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((field) => !allowedFields.has(field))) throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Unknown or owner fields are forbidden');
  if (typeof body.node !== 'string' || !nodes.has(body.node as FulfillmentNode)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'Fulfillment node is invalid');
  if (!Number.isSafeInteger(body.expectedVersion) || (body.expectedVersion as number) < 0) throw new SafeApiError(422, 'VALIDATION_FAILED', 'expectedVersion is invalid');
  const reason = body.reason === undefined || body.reason === null ? null : typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason !== null && (reason.length < 2 || reason.length > 1000)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'reason is invalid');
  const shortageValues = body.shortages === undefined ? [] : body.shortages;
  if (!Array.isArray(shortageValues)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'shortages must be an array');
  const shortages = shortageValues.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'shortage item is invalid');
    const item = entry as Record<string, unknown>;
    if (Object.keys(item).some((field) => field !== 'orderItemId' && field !== 'quantity')) throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Unknown shortage fields are forbidden');
    return { orderItemId: requireFulfillmentId(item.orderItemId), quantity: item.quantity as number };
  });
  if (shortages.some(({ quantity }) => !Number.isSafeInteger(quantity) || quantity <= 0)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'shortage quantity is invalid');
  const handoverParty = body.handoverParty === undefined || body.handoverParty === null ? null : body.handoverParty;
  if (handoverParty !== null && (typeof handoverParty !== 'string' || !handoverParties.has(handoverParty as FulfillmentHandoverParty))) throw new SafeApiError(422, 'VALIDATION_FAILED', 'handoverParty is invalid');
  const handoverReference = body.handoverReference === undefined || body.handoverReference === null ? null : typeof body.handoverReference === 'string' ? body.handoverReference.trim() : '';
  if (handoverReference !== null && (handoverReference.length < 2 || handoverReference.length > 191)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'handoverReference is invalid');
  if (body.node === 'REPORT_SHORTAGE' && (shortages.length === 0 || reason === null)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'Shortage items and reason are required');
  if (body.node !== 'REPORT_SHORTAGE' && shortages.length > 0) throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'shortages are only allowed for REPORT_SHORTAGE');
  if (body.node === 'HANDOVER' && (!handoverParty || !handoverReference)) throw new SafeApiError(422, 'VALIDATION_FAILED', 'Handover party and reference are required');
  if (body.node !== 'HANDOVER' && (handoverParty || handoverReference)) throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Handover fields are only allowed for HANDOVER');
  return { node: body.node as FulfillmentNode, expectedVersion: body.expectedVersion as number, reason, shortages, handoverParty: handoverParty as FulfillmentHandoverParty | null, handoverReference };
};

export const fulfillmentRequestHash = (subOrderId: string, input: FulfillmentNodeInput): string =>
  createHash('sha256').update(JSON.stringify({ subOrderId, ...input, shortages: [...input.shortages].sort((a, b) => a.orderItemId.localeCompare(b.orderItemId)) })).digest('hex');
