import { expect, test } from '@playwright/test';

import type { RefundActor } from '../../../apps/api/src/refunds/refund.actor.js';
import type {
  WelfareRefundCommand,
  WechatRefundCommand,
} from '../../../apps/api/src/refunds/refund.adapter.js';
import type {
  BeginRefundCommand,
  RefundRecord,
} from '../../../apps/api/src/refunds/refund.repository.js';

const afterSaleId = '86000000-0000-4000-8000-000000000026';
const originalWelfareCardAccountId = '89000000-0000-4000-8000-000000000026';
const originalPaymentTransactionId = '8a000000-0000-4000-8000-000000000026';
const originalWechatTotalAmount = 4000;

class P0RefundRepository {
  refund: RefundRecord | null = null;
  readonly impacts = new Set<string>();

  async begin(command: BeginRefundCommand) {
    if (command.afterSaleId !== afterSaleId) return { kind: 'NOT_FOUND' as const };
    if (this.refund) {
      if (this.refund.idempotencyKey !== command.idempotencyKey || this.refund.requestHash !== command.requestHash) {
        return { kind: 'IDEMPOTENCY_CONFLICT' as const };
      }
      return {
        kind: this.refund.status === 'SUCCEEDED' ? 'REPLAY' as const : 'CONTINUE' as const,
        refund: this.refund,
      };
    }
    this.refund = {
      refundId: '8e000000-0000-4000-8000-000000000026',
      afterSaleId,
      orderId: '87000000-0000-4000-8000-000000000026',
      orderItemId: '88000000-0000-4000-8000-000000000026',
      refundNo: 'RF202608140000000000000026',
      status: 'PROCESSING', authorizationVersion: 2,
      welfareCardRefundAmount: 900, cashRefundAmount: 2000,
      welfareChannelStatus: 'PENDING', wechatChannelStatus: 'PENDING',
      originalWelfareCardAccountId, originalPaymentTransactionId,
      originalWechatOutTradeNo: 'WP2026081400000000000000000026',
      originalWechatTransactionId: 'wechat-transaction-original-0026',
      originalWechatTotalAmount,
      idempotencyKey: command.idempotencyKey, requestHash: command.requestHash,
    };
    this.impacts.add('FINANCIAL');
    this.impacts.add('INVENTORY:PENDING_AFTERSALE_DECISION');
    this.impacts.add('RECONCILIATION');
    return { kind: 'CREATED' as const, refund: this.refund };
  }

  async claimChannel(_refundId: string, channel: 'WELFARE' | 'WECHAT') {
    if (!this.refund) throw new Error('REFUND_NOT_INITIALIZED');
    const field = channel === 'WELFARE' ? 'welfareChannelStatus' : 'wechatChannelStatus';
    if (this.refund[field] === 'PROCESSING') return { kind: 'BUSY' as const, refund: this.refund };
    if (this.refund[field] !== 'PENDING') return { kind: 'DONE' as const, refund: this.refund };
    this.refund = { ...this.refund, [field]: 'PROCESSING' };
    return { kind: 'CLAIMED' as const, refund: this.refund };
  }

  async recordWelfareResult() {
    if (!this.refund) throw new Error('REFUND_NOT_INITIALIZED');
    this.refund = { ...this.refund, welfareChannelStatus: 'SUCCEEDED', status: 'PARTIAL_CHANNEL_DONE' };
    return this.refund;
  }

  async recordWechatResult() {
    if (!this.refund) throw new Error('REFUND_NOT_INITIALIZED');
    this.refund = { ...this.refund, wechatChannelStatus: 'SUCCEEDED', status: 'SUCCEEDED' };
    return this.refund;
  }
}

test('P0-026 company refund returns each channel to its immutable original target once', async () => {
  const { RefundService } = await import(
    new URL('../../../apps/api/dist/refunds/refund.service.js', import.meta.url).href
  );
  const repository = new P0RefundRepository();
  const welfareCalls: WelfareRefundCommand[] = [];
  const wechatCalls: WechatRefundCommand[] = [];
  const service = new RefundService(
    repository,
    { refund: async (command: WelfareRefundCommand) => { welfareCalls.push(command); return { kind: 'SUCCEEDED' as const }; } },
    { refund: async (command: WechatRefundCommand) => { wechatCalls.push(command); return { kind: 'SUCCEEDED' as const }; } },
  );
  const actor: RefundActor = {
    accountTypeCode: 'COMPANY_ORDER_SERVICE' as const,
    companyId: '10000000-0000-4000-8000-000000000001',
    functionalAccountId: '8b000000-0000-4000-8000-000000000026',
    identityType: 'COMPANY_USER' as const,
    identityId: '8c000000-0000-4000-8000-000000000026',
    workspaceRoute: '/company-admin/workspaces/order-service' as const,
  };
  const body = { authorizationVersion: 2, reason: '已批准退款，按原支付结构执行' };
  const [first, concurrent] = await Promise.all([
    service.create(actor, afterSaleId, body, 'p0-026-refund-idempotent-0001', 'p0-026-first'),
    service.create(actor, afterSaleId, body, 'p0-026-refund-idempotent-0001', 'p0-026-concurrent'),
  ]);
  expect([first.body.status, concurrent.body.status]).toContain('SUCCEEDED');
  const replay = await service.create(
    actor,
    afterSaleId,
    body,
    'p0-026-refund-idempotent-0001',
    'p0-026-replay',
  );
  expect(replay.body).toMatchObject({
    status: 'SUCCEEDED', welfareCardRefundAmount: 900, cashRefundAmount: 2000,
  });
  expect(welfareCalls).toEqual([expect.objectContaining({
    refundAmount: 900, originalWelfareCardAccountId,
  })]);
  expect(wechatCalls).toEqual([expect.objectContaining({
    refundAmount: 2000, originalPaymentTransactionId,
    originalWechatTransactionId: 'wechat-transaction-original-0026',
    originalWechatTotalAmount,
  })]);
  expect([...repository.impacts].sort()).toEqual([
    'FINANCIAL', 'INVENTORY:PENDING_AFTERSALE_DECISION', 'RECONCILIATION',
  ]);
  expect(JSON.stringify(replay.body)).not.toMatch(
    /originalWelfareCardAccountId|originalPaymentTransactionId|originalWechatTotalAmount|wechatTransactionId|supplyPrice/iu,
  );
});
