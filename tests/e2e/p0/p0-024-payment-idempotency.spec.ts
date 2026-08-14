import { createHash } from 'node:crypto';

import { expect, test } from '@playwright/test';

import type {
  BeginWechatPrepayCommand,
  CompleteWechatPrepayCommand,
  ConfirmWechatPaymentCommand,
} from '../../../apps/api/src/payments/payment.repository.js';

const orderId = '70000000-0000-4000-8000-000000000001';
const paymentTransactionId = '71000000-0000-4000-8000-000000000001';

class P0PaymentRepository {
  payment: {
    paymentTransactionId: string;
    orderId: string;
    amount: number;
    outTradeNo: string;
    merchantConfigRef: string;
    collectorName: '江苏福礼团供应链科技有限公司';
    status: 'CREATED' | 'PREPAY_CREATED' | 'PAID';
    idempotencyKey: string;
    requestHash: string;
    response?: {
      prepayId: string;
      clientPayment: { timeStamp: string; nonceStr: string; package: string; signType: 'RSA'; paySign: string };
    };
    wechatTransactionId?: string;
  } | null = null;
  readonly notifications = new Map<string, string>();
  readonly effects = { welfareCard: 0, wechatPaid: 0, inventoryConfirm: 0, outbox: 0, deliveryObjects: 0 };

  async beginWechatPrepay(command: BeginWechatPrepayCommand) {
    if (this.payment) {
      if (this.payment.idempotencyKey !== command.idempotencyKey || this.payment.requestHash !== command.requestHash) {
        return { kind: 'IDEMPOTENCY_CONFLICT' as const };
      }
      if (this.payment.status === 'PREPAY_CREATED' && this.payment.response) {
        return { kind: 'REPLAY' as const, payment: { ...this.payment, response: this.payment.response } };
      }
      return { kind: 'NEEDS_PREPAY' as const, payment: this.payment };
    }
    this.payment = {
      paymentTransactionId, orderId, amount: 5800, outTradeNo: 'WP2026081400000000000000000001',
      merchantConfigRef: 'secrets://wechat-pay/company-primary',
      collectorName: '江苏福礼团供应链科技有限公司',
      status: 'CREATED', idempotencyKey: command.idempotencyKey, requestHash: command.requestHash,
    };
    return { kind: 'NEEDS_PREPAY' as const, payment: this.payment };
  }

  async completeWechatPrepay(command: CompleteWechatPrepayCommand) {
    if (!this.payment) return { kind: 'STATE_CONFLICT' as const };
    this.payment = { ...this.payment, status: 'PREPAY_CREATED', response: command.response };
    return { kind: 'COMPLETED' as const, payment: { ...this.payment, response: command.response } };
  }

  async confirmWechatPayment(command: ConfirmWechatPaymentCommand) {
    const notification = command.notification;
    const previousHash = this.notifications.get(notification.notificationId);
    if (previousHash) return previousHash === notification.rawBodyHash
      ? { kind: 'REPLAY' as const, orderId, paymentTransactionId }
      : { kind: 'TRANSACTION_CONFLICT' as const };
    if (!this.payment || notification.amount !== this.payment.amount) return { kind: 'AMOUNT_MISMATCH' as const };
    if (this.payment.status === 'PAID') {
      if (this.payment.wechatTransactionId !== notification.wechatTransactionId) return { kind: 'TRANSACTION_CONFLICT' as const };
      this.notifications.set(notification.notificationId, notification.rawBodyHash);
      return { kind: 'REPLAY' as const, orderId, paymentTransactionId };
    }
    this.payment = { ...this.payment, status: 'PAID', wechatTransactionId: notification.wechatTransactionId };
    this.notifications.set(notification.notificationId, notification.rawBodyHash);
    this.effects.wechatPaid += 1;
    this.effects.inventoryConfirm += 3;
    this.effects.outbox += 1;
    return { kind: 'PAID' as const, orderId, paymentTransactionId };
  }
}

class P0WechatAdapter {
  prepayCalls = 0;
  async createPrepay() {
    this.prepayCalls += 1;
    return {
      prepayId: 'p0-prepay-id',
      clientPayment: { timeStamp: '1786666666', nonceStr: 'p0-nonce', package: 'prepay_id=p0-prepay-id', signType: 'RSA' as const, paySign: 'p0-signature' },
    };
  }
  async verifyNotification(_headers: Readonly<Record<string, string | string[] | undefined>>, body: unknown) {
    const value = body as { id: string; outTradeNo: string; transactionId: string; amount: number };
    return {
      notificationId: value.id, outTradeNo: value.outTradeNo,
      wechatTransactionId: value.transactionId, amount: value.amount, tradeState: 'SUCCESS' as const,
      verifiedAt: new Date('2026-08-14T05:00:00.000Z'),
      rawBodyHash: createHash('sha256').update(JSON.stringify(value)).digest('hex'),
    };
  }
}

test('P0-024 verified repeat and concurrent WeChat callbacks have exactly one payment, inventory and outbox effect', async () => {
  const { PaymentService } = await import(
    new URL('../../../apps/api/dist/payments/payment.service.js', import.meta.url).href
  );
  const repository = new P0PaymentRepository();
  const adapter = new P0WechatAdapter();
  const service = new PaymentService(repository, adapter);
  const actor = {
    kind: 'CONSUMER' as const,
    companyId: '10000000-0000-4000-8000-000000000001',
    consumerUserId: '10000000-0000-4000-8000-000000000002',
    status: 'ACTIVE' as const,
  };
  await service.createWechatPrepay(actor, orderId, {}, 'p0-024-prepay-idempotent-0001', 'p0-prepay');
  await service.createWechatPrepay(actor, orderId, {}, 'p0-024-prepay-idempotent-0001', 'p0-prepay-replay');
  expect(adapter.prepayCalls).toBe(1);

  const base = {
    outTradeNo: 'WP2026081400000000000000000001', transactionId: 'wechat-transaction-p0-0001', amount: 5800,
  };
  await Promise.all([
    service.confirmWechatNotification({}, { id: 'p0-notification-0001', ...base }, 'p0-notify-1'),
    service.confirmWechatNotification({}, { id: 'p0-notification-0001', ...base }, 'p0-notify-duplicate'),
    service.confirmWechatNotification({}, { id: 'p0-notification-0002', ...base }, 'p0-notify-retry'),
  ]);
  expect(repository.effects).toEqual({
    welfareCard: 0, wechatPaid: 1, inventoryConfirm: 3, outbox: 1, deliveryObjects: 0,
  });
  expect(repository.payment).toMatchObject({ status: 'PAID', amount: 5800 });
});
