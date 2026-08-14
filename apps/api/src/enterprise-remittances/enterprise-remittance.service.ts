import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type { EnterpriseOrderActor } from '../orders/order.actor.js';
import type { CompanyFinanceActor } from './enterprise-remittance.actor.js';
import {
  ENTERPRISE_REMITTANCE_REPOSITORY,
  type EnterpriseRemittanceRepository,
} from './enterprise-remittance.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const OBJECT_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;

const requireOrderId = (value: unknown): string => {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'orderId must be a UUID');
  }
  return value;
};

const requireIdempotencyKey = (value: unknown): string => {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY.test(value)) {
    throw new SafeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required');
  }
  return value;
};

const requireAmount = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'amount must be positive integer cents');
  }
  return Number(value);
};

const normalizeSubmit = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Remittance proof body must be an object');
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== 'amount' && key !== 'proofObjectKey')) {
    throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Payment channel and ownership are server-owned');
  }
  const amount = requireAmount(body.amount);
  if (
    typeof body.proofObjectKey !== 'string' ||
    !OBJECT_KEY.test(body.proofObjectKey) ||
    body.proofObjectKey.includes('..') ||
    !body.proofObjectKey.startsWith('enterprise-remittance/')
  ) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'proofObjectKey must be a controlled remittance object key');
  }
  return { amount, proofObjectKey: body.proofObjectKey };
};

const normalizeReview = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Remittance review body must be an object');
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(['decision', 'amount', 'version', 'reason']);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Review scope and ownership are server-owned');
  }
  if (body.decision !== 'CONFIRM' && body.decision !== 'REJECT') {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'decision must be CONFIRM or REJECT');
  }
  const amount = requireAmount(body.amount);
  if (!Number.isSafeInteger(body.version) || Number(body.version) < 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'version must be a non-negative integer');
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length < 2 || body.reason.trim().length > 500) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'reason must contain 2 to 500 characters');
  }
  return {
    decision: body.decision,
    amount,
    expectedVersion: Number(body.version),
    reason: body.reason.trim(),
  } as const;
};

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class EnterpriseRemittanceService {
  constructor(
    @Inject(ENTERPRISE_REMITTANCE_REPOSITORY)
    private readonly repository: EnterpriseRemittanceRepository,
  ) {}

  async submit(
    actor: EnterpriseOrderActor,
    orderIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
  ) {
    if (actor.status !== 'ACTIVE' || !actor.permissions.includes('PURCHASE')) {
      throw new SafeApiError(403, 'ACCESS_DENIED', 'Enterprise member cannot submit remittance proof');
    }
    const orderId = requireOrderId(orderIdValue);
    const body = normalizeSubmit(bodyValue);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const result = await this.repository.submit({
      orderId,
      actor,
      ...body,
      idempotencyKey,
      requestHash: hash({ orderId, enterpriseCustomerId: actor.enterpriseCustomerId, ...body }),
      requestId,
    });
    if (result.kind === 'NOT_FOUND') throw new SafeApiError(404, 'ORDER_NOT_FOUND', 'Order was not found');
    if (result.kind === 'ACCESS_DENIED') throw new SafeApiError(403, 'ACCESS_DENIED', 'Order does not belong to this enterprise');
    if (result.kind === 'AMOUNT_MISMATCH') throw new SafeApiError(409, 'AMOUNT_MISMATCH', 'Remittance amount does not match the order');
    if (result.kind === 'PAYMENT_METHOD_INVALID') throw new SafeApiError(409, 'PAYMENT_METHOD_INVALID', 'Order cannot use bank transfer');
    if (result.kind === 'ALREADY_SUBMITTED') throw new SafeApiError(409, 'REMITTANCE_ALREADY_SUBMITTED', 'A remittance proof is already pending or confirmed');
    if (result.kind === 'STATE_CONFLICT') throw new SafeApiError(409, 'PAYMENT_STATE_INVALID', 'Order cannot accept remittance proof in its current state');
    if (result.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts with the original proof');
    if (result.kind === 'CONCURRENT_CONFLICT') throw new SafeApiError(409, 'APPROVAL_VERSION_CONFLICT', 'Remittance changed concurrently; retry safely');
    return { body: result.remittance, replayed: result.kind === 'REPLAY' };
  }

  async review(
    actor: CompanyFinanceActor,
    orderIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
  ) {
    const orderId = requireOrderId(orderIdValue);
    const body = normalizeReview(bodyValue);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const result = await this.repository.review({
      orderId,
      actor,
      ...body,
      idempotencyKey,
      requestHash: hash({ orderId, companyId: actor.companyId, functionalAccountId: actor.functionalAccountId, ...body }),
      requestId,
    });
    if (result.kind === 'NOT_FOUND') throw new SafeApiError(404, 'ORDER_NOT_FOUND', 'Order or remittance proof was not found');
    if (result.kind === 'ACCESS_DENIED') throw new SafeApiError(403, 'ACCESS_DENIED', 'Order is outside the company finance scope');
    if (result.kind === 'AMOUNT_MISMATCH') throw new SafeApiError(409, 'AMOUNT_MISMATCH', 'Reviewed amount does not match company receivable');
    if (result.kind === 'VERSION_CONFLICT' || result.kind === 'CONCURRENT_CONFLICT') {
      throw new SafeApiError(409, 'APPROVAL_VERSION_CONFLICT', 'Remittance review version conflicts with current state');
    }
    if (result.kind === 'STATE_CONFLICT') throw new SafeApiError(409, 'PAYMENT_STATE_INVALID', 'Remittance cannot be reviewed in its current state');
    if (result.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts with the original review');
    return { body: result.remittance, replayed: result.kind === 'REPLAY' };
  }
}
