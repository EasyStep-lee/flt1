import { expect, test } from '@playwright/test';

import type {
  ReviewEnterpriseRemittanceCommand,
  SubmitEnterpriseRemittanceCommand,
} from '../../../apps/api/src/enterprise-remittances/enterprise-remittance.repository.js';

const companyId = '10000000-0000-4000-8000-000000000001';
const enterpriseCustomerId = '20000000-0000-4000-8000-000000000001';
const orderId = '70000000-0000-4000-8000-000000000025';

class P0CompanyCheckoutRepository {
  submission: {
    status: 'PENDING_REVIEW' | 'CONFIRMED';
    version: number;
    submitKey: string;
    submitHash: string;
  } | null = null;
  reviewRecord: { key: string; hash: string } | null = null;
  readonly effects = {
    companyReceivableConfirmed: 0,
    supplierDirectCollection: 0,
    inventoryConfirmed: 0,
    fulfillmentActivated: 0,
    paidOutbox: 0,
    deliveryObjects: 0,
  };

  private record() {
    return {
      remittanceId: '75000000-0000-4000-8000-000000000025',
      orderId,
      orderNo: 'FS2026081400000025',
      sellerName: '江苏福礼团供应链科技有限公司' as const,
      checkoutMode: 'COMPANY_UNIFIED' as const,
      paymentMethod: 'BANK_TRANSFER' as const,
      totalAmount: 5800,
      paymentStatus: this.submission?.status === 'CONFIRMED' ? 'PAID' as const : 'PENDING' as const,
      orderStatus: this.submission?.status === 'CONFIRMED' ? 'PAID' as const : 'PENDING_PAYMENT' as const,
      remittanceStatus: this.submission?.status ?? 'PENDING_REVIEW',
      version: this.submission?.version ?? 0,
      submittedAt: '2026-08-14T09:00:00.000Z',
      reviewedAt: this.submission?.status === 'CONFIRMED' ? '2026-08-14T09:05:00.000Z' : null,
    };
  }

  async submit(command: SubmitEnterpriseRemittanceCommand) {
    if (command.actor.enterpriseCustomerId !== enterpriseCustomerId) return { kind: 'ACCESS_DENIED' as const };
    if (command.amount !== 5800) return { kind: 'AMOUNT_MISMATCH' as const };
    if (this.submission) {
      return this.submission.submitKey === command.idempotencyKey && this.submission.submitHash === command.requestHash
        ? { kind: 'REPLAY' as const, remittance: this.record() }
        : { kind: 'ALREADY_SUBMITTED' as const };
    }
    this.submission = {
      status: 'PENDING_REVIEW',
      version: 0,
      submitKey: command.idempotencyKey,
      submitHash: command.requestHash,
    };
    return { kind: 'SUBMITTED' as const, remittance: this.record() };
  }

  async review(command: ReviewEnterpriseRemittanceCommand) {
    if (!this.submission) return { kind: 'NOT_FOUND' as const };
    if (command.actor.companyId !== companyId) return { kind: 'ACCESS_DENIED' as const };
    if (this.reviewRecord) {
      return this.reviewRecord.key === command.idempotencyKey && this.reviewRecord.hash === command.requestHash
        ? { kind: 'REPLAY' as const, remittance: this.record() }
        : { kind: 'STATE_CONFLICT' as const };
    }
    if (command.expectedVersion !== this.submission.version) return { kind: 'VERSION_CONFLICT' as const };
    if (command.amount !== 5800) return { kind: 'AMOUNT_MISMATCH' as const };
    this.reviewRecord = { key: command.idempotencyKey, hash: command.requestHash };
    this.submission = { ...this.submission, status: 'CONFIRMED', version: 1 };
    this.effects.companyReceivableConfirmed += 1;
    this.effects.inventoryConfirmed += 3;
    this.effects.fulfillmentActivated += 3;
    this.effects.paidOutbox += 1;
    return { kind: 'CONFIRMED' as const, remittance: this.record() };
  }
}

test('P0-025 enterprise transfer is confirmed once by company finance and never becomes supplier collection or delivery', async () => {
  const { EnterpriseRemittanceService } = await import(
    new URL('../../../apps/api/dist/enterprise-remittances/enterprise-remittance.service.js', import.meta.url).href
  );
  const repository = new P0CompanyCheckoutRepository();
  const service = new EnterpriseRemittanceService(repository);
  const enterpriseActor = {
    kind: 'ENTERPRISE' as const,
    companyId,
    enterpriseCustomerId,
    enterpriseUserId: '21000000-0000-4000-8000-000000000001',
    status: 'ACTIVE' as const,
    permissions: ['PURCHASE'] as const,
  };
  const financeActor = {
    accountTypeCode: 'COMPANY_FINANCE' as const,
    companyId,
    functionalAccountId: '30000000-0000-4000-8000-000000000025',
    identityId: '31000000-0000-4000-8000-000000000025',
    workspaceRoute: '/company-admin/workspaces/finance' as const,
  };

  const submission = await service.submit(
    enterpriseActor,
    orderId,
    { amount: 5800, proofObjectKey: 'enterprise-remittance/2026/08/p0-025.pdf' },
    'p0-025-remittance-submit-0001',
    'p0-025-submit',
  );
  expect(submission.body).toMatchObject({
    sellerName: '江苏福礼团供应链科技有限公司',
    checkoutMode: 'COMPANY_UNIFIED',
    paymentMethod: 'BANK_TRANSFER',
    remittanceStatus: 'PENDING_REVIEW',
  });

  const reviewBody = { decision: 'CONFIRM' as const, amount: 5800, version: 0, reason: '银行流水与公司应收一致' };
  const [first, replay] = await Promise.all([
    service.review(financeActor, orderId, reviewBody, 'p0-025-remittance-review-0001', 'p0-025-review'),
    service.review(financeActor, orderId, reviewBody, 'p0-025-remittance-review-0001', 'p0-025-review-retry'),
  ]);
  expect(first.body).toEqual(replay.body);
  expect(first.body).toMatchObject({ paymentStatus: 'PAID', remittanceStatus: 'CONFIRMED' });
  expect(repository.effects).toEqual({
    companyReceivableConfirmed: 1,
    supplierDirectCollection: 0,
    inventoryConfirmed: 3,
    fulfillmentActivated: 3,
    paidOutbox: 1,
    deliveryObjects: 0,
  });
});
