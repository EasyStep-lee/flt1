import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';
import type { ConsumerOrderActor } from '../orders/order.actor.js';
import {
  WELFARE_CARD_PAYMENT_REPOSITORY,
  type WelfareCardPaymentRepository,
} from './welfare-card-payment.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

const requireUuid = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${name} must be a UUID`);
  }
  return value;
};
const normalizeBody = (value: unknown): { readonly accountId: string } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', 'Payment body must be an object');
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((field) => field !== 'accountId')) {
    throw new SafeApiError(422, 'FIELD_FORBIDDEN', 'Only accountId may be selected by the consumer');
  }
  return { accountId: requireUuid(body.accountId, 'accountId') };
};
const requireIdempotencyKey = (value: unknown): string => {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY.test(value)) {
    throw new SafeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required');
  }
  return value;
};

@Injectable()
export class WelfareCardPaymentService {
  constructor(
    @Inject(WELFARE_CARD_PAYMENT_REPOSITORY)
    private readonly repository: WelfareCardPaymentRepository,
  ) {}

  async payFull(
    actor: ConsumerOrderActor,
    orderIdValue: unknown,
    bodyValue: unknown,
    idempotencyKeyValue: unknown,
    requestId: string,
  ) {
    if (actor.status !== 'ACTIVE') {
      throw new SafeApiError(403, 'ACCOUNT_SUSPENDED', 'Current consumer account cannot make payments');
    }
    const orderId = requireUuid(orderIdValue, 'orderId');
    const body = normalizeBody(bodyValue);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyValue);
    const requestHash = createHash('sha256').update(JSON.stringify({ orderId, accountId: body.accountId })).digest('hex');
    const result = await this.repository.payFull({
      companyId: actor.companyId,
      consumerUserId: actor.consumerUserId,
      orderId,
      accountId: body.accountId,
      idempotencyKey,
      requestHash,
      requestId,
    });
    if (result.kind === 'NOT_FOUND') throw new SafeApiError(404, 'ORDER_NOT_FOUND', 'Order was not found');
    if (result.kind === 'ACCESS_DENIED') throw new SafeApiError(403, 'ACCESS_DENIED', 'Order or welfare account does not belong to this consumer');
    if (result.kind === 'ACCOUNT_NOT_ELIGIBLE') throw new SafeApiError(409, 'WELFARE_CARD_NOT_ELIGIBLE', 'Selected welfare-card account cannot fully pay this order');
    if (result.kind === 'INSUFFICIENT_BALANCE') throw new SafeApiError(409, 'WELFARE_CARD_INSUFFICIENT_BALANCE', 'Selected welfare-card account has insufficient available balance');
    if (result.kind === 'STATE_CONFLICT') throw new SafeApiError(409, 'PAYMENT_STATE_INVALID', 'Order cannot be paid in its current state');
    if (result.kind === 'IDEMPOTENCY_CONFLICT') throw new SafeApiError(409, 'PAYMENT_IDEMPOTENCY_CONFLICT', 'Idempotency-Key conflicts with the original welfare-card payment');
    if (result.kind === 'CONCURRENT_CONFLICT') throw new SafeApiError(409, 'PAYMENT_CONCURRENT_CONFLICT', 'Payment changed concurrently; retry safely');
    return { body: result.value, replayed: result.replayed };
  }
}
