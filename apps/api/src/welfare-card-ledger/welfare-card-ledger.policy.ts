import { createHash } from 'node:crypto';

import { SafeApiError } from '../http/api-error.js';

export type WelfareLedgerBusinessType =
  | 'CLAIM'
  | 'GRANT'
  | 'GIFT'
  | 'FREEZE'
  | 'RELEASE'
  | 'CAPTURE'
  | 'REFUND'
  | 'REVERSAL'
  | 'ADJUSTMENT';
export type WelfareLedgerDirection = 'CREDIT' | 'DEBIT';

export interface WelfareLedgerChainEntry {
  readonly sequence: number;
  readonly businessType: WelfareLedgerBusinessType;
  readonly direction: WelfareLedgerDirection;
  readonly amount: number;
  readonly beforeBalance: number;
  readonly afterBalance: number;
  readonly beforeFrozen: number;
  readonly afterFrozen: number;
  readonly occurredAt: string;
}

export interface NormalizedWelfareAdjustmentRequest {
  readonly businessType: 'ADJUSTMENT' | 'REVERSAL';
  readonly direction: WelfareLedgerDirection | null;
  readonly amount: number | null;
  readonly reversalOfLedgerId: string | null;
  readonly reason: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ownerFields = new Set([
  'companyId', 'consumerUserId', 'functionalAccountId', 'applicantIdentityId',
  'reviewerIdentityId', 'afterBalance', 'afterFrozen', 'fundingType',
]);

const inconsistent = (): never => {
  throw new SafeApiError(503, 'WELFARE_LEDGER_INCONSISTENT', '福利卡账本与账户余额不一致');
};
const money = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', '调整金额必须为正整数分');
  }
  return Number(value);
};

const reason = (value: unknown): string => {
  if (typeof value !== 'string') throw new SafeApiError(422, 'VALIDATION_FAILED', '调整原因无效');
  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > 500) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', '调整原因长度无效');
  }
  return normalized;
};

export const fundingLedgerBusinessType = (fundingType: unknown): 'CLAIM' | 'GRANT' | 'GIFT' => {
  if (fundingType === 'ENTERPRISE_GRANT') return 'GRANT';
  if (fundingType === 'COMPANY_GIFT') return 'GIFT';
  if (fundingType === 'PHYSICAL_CARD_OR_CODE') return 'CLAIM';
  if (fundingType === 'PERSONAL_RECHARGE') {
    throw new SafeApiError(422, 'PERSONAL_RECHARGE_FORBIDDEN', '永久不提供个人现金充值');
  }
  throw new SafeApiError(422, 'WELFARE_FUNDING_SOURCE_INVALID', '福利卡资金来源不在固定白名单');
};

export const normalizeWelfareAdjustmentRequest = (value: unknown): NormalizedWelfareAdjustmentRequest => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', '调整请求无效');
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(['businessType', 'direction', 'amount', 'reversalOfLedgerId', 'reason']);
  for (const key of Object.keys(body)) {
    if (ownerFields.has(key)) throw new SafeApiError(403, 'FIELD_FORBIDDEN', '归属与最终余额由服务端派生');
    if (!allowed.has(key)) throw new SafeApiError(422, 'VALIDATION_FAILED', '调整请求包含未允许字段');
  }
  if (body.businessType === 'PERSONAL_RECHARGE') {
    throw new SafeApiError(422, 'PERSONAL_RECHARGE_FORBIDDEN', '永久不提供个人现金充值');
  }
  if (body.businessType === 'ADJUSTMENT') {
    if (body.direction !== 'CREDIT' && body.direction !== 'DEBIT') {
      throw new SafeApiError(422, 'VALIDATION_FAILED', '调整方向无效');
    }
    if (body.reversalOfLedgerId !== undefined) {
      throw new SafeApiError(422, 'WELFARE_REVERSAL_INVALID', '普通调整不能指定冲正流水');
    }
    return {
      businessType: 'ADJUSTMENT',
      direction: body.direction,
      amount: money(body.amount),
      reversalOfLedgerId: null,
      reason: reason(body.reason),
    };
  }
  if (body.businessType === 'REVERSAL') {
    if (body.direction !== undefined || body.amount !== undefined) {
      throw new SafeApiError(422, 'WELFARE_REVERSAL_INVALID', '冲正方向和金额必须由原流水派生');
    }
    if (typeof body.reversalOfLedgerId !== 'string' || !uuid.test(body.reversalOfLedgerId)) {
      throw new SafeApiError(422, 'WELFARE_REVERSAL_INVALID', '冲正流水编号无效');
    }
    return {
      businessType: 'REVERSAL',
      direction: null,
      amount: null,
      reversalOfLedgerId: body.reversalOfLedgerId,
      reason: reason(body.reason),
    };
  }
  throw new SafeApiError(422, 'VALIDATION_FAILED', '只允许调整或冲正');
};

export const welfareLedgerRequestHash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const assertWelfareLedgerChain = (
  account: { readonly balanceAmount: number; readonly frozenAmount: number },
  entries: readonly WelfareLedgerChainEntry[],
): void => {
  if (
    entries.length < 1
    || !Number.isSafeInteger(account.balanceAmount)
    || !Number.isSafeInteger(account.frozenAmount)
    || account.balanceAmount < 0
    || account.frozenAmount < 0
    || account.frozenAmount > account.balanceAmount
  ) inconsistent();
  let previousBalance = 0;
  let previousFrozen = 0;
  for (const [index, item] of entries.entries()) {
    if (
      item.sequence !== index + 1
      || !Number.isSafeInteger(item.amount)
      || item.amount <= 0
      || ![item.beforeBalance, item.afterBalance, item.beforeFrozen, item.afterFrozen]
        .every((part) => Number.isSafeInteger(part) && part >= 0)
      || item.beforeFrozen > item.beforeBalance
      || item.afterFrozen > item.afterBalance
      || item.beforeBalance !== previousBalance
      || item.beforeFrozen !== previousFrozen
    ) inconsistent();

    const opening = item.businessType === 'CLAIM' || item.businessType === 'GRANT' || item.businessType === 'GIFT';
    const valid = opening
      ? index === 0 && item.direction === 'CREDIT' && item.beforeBalance === 0
        && item.afterBalance === item.amount && item.beforeFrozen === 0 && item.afterFrozen === 0
      : item.businessType === 'FREEZE'
        ? item.direction === 'DEBIT' && item.afterBalance === item.beforeBalance
          && item.afterFrozen === item.beforeFrozen + item.amount
        : item.businessType === 'RELEASE'
          ? item.direction === 'CREDIT' && item.afterBalance === item.beforeBalance
            && item.afterFrozen === item.beforeFrozen - item.amount
          : item.businessType === 'CAPTURE'
            ? item.direction === 'DEBIT' && item.afterBalance === item.beforeBalance - item.amount
              && item.afterFrozen === item.beforeFrozen - item.amount
            : item.businessType === 'REFUND'
              ? item.direction === 'CREDIT' && item.afterBalance === item.beforeBalance + item.amount
                && item.afterFrozen === item.beforeFrozen
              : item.businessType === 'ADJUSTMENT' || item.businessType === 'REVERSAL'
                ? item.afterBalance === item.beforeBalance + (item.direction === 'CREDIT' ? item.amount : -item.amount)
                  && item.afterFrozen === item.beforeFrozen
                : false;
    if (!valid) inconsistent();
    previousBalance = item.afterBalance;
    previousFrozen = item.afterFrozen;
  }
  if (previousBalance !== account.balanceAmount || previousFrozen !== account.frozenAmount) inconsistent();
};
