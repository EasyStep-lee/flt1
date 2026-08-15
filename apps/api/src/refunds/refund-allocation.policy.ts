export interface RefundAllocationInput {
  readonly originalWelfareAmount: number;
  readonly originalCashAmount: number;
  readonly previousWelfareRefundAmount: number;
  readonly previousCashRefundAmount: number;
  readonly approvedRefundAmount: number;
}

export type RefundAllocationResult =
  | {
      readonly kind: 'ALLOCATED';
      readonly welfareRefundAmount: number;
      readonly cashRefundAmount: number;
      readonly cumulativeRefundAmount: number;
    }
  | { readonly kind: 'INVALID' }
  | { readonly kind: 'OVERPAID' };

const nonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

export const allocateOriginalPaymentRefund = (
  input: RefundAllocationInput,
): RefundAllocationResult => {
  if (
    !nonNegativeSafeInteger(input.originalWelfareAmount) ||
    !nonNegativeSafeInteger(input.originalCashAmount) ||
    !nonNegativeSafeInteger(input.previousWelfareRefundAmount) ||
    !nonNegativeSafeInteger(input.previousCashRefundAmount) ||
    !Number.isSafeInteger(input.approvedRefundAmount) ||
    input.approvedRefundAmount <= 0
  ) {
    return { kind: 'INVALID' };
  }
  const originalTotal = input.originalWelfareAmount + input.originalCashAmount;
  const previousTotal = input.previousWelfareRefundAmount + input.previousCashRefundAmount;
  if (
    !Number.isSafeInteger(originalTotal) ||
    originalTotal <= 0 ||
    previousTotal < 0 ||
    previousTotal > originalTotal ||
    input.previousWelfareRefundAmount > input.originalWelfareAmount ||
    input.previousCashRefundAmount > input.originalCashAmount
  ) {
    return { kind: 'INVALID' };
  }
  const cumulativeTotal = previousTotal + input.approvedRefundAmount;
  if (!Number.isSafeInteger(cumulativeTotal) || cumulativeTotal > originalTotal) {
    return { kind: 'OVERPAID' };
  }
  const cumulativeWelfare = cumulativeTotal === originalTotal
    ? input.originalWelfareAmount
    : Number(
        (BigInt(cumulativeTotal) * BigInt(input.originalWelfareAmount)) /
          BigInt(originalTotal),
      );
  const welfareRefundAmount = cumulativeWelfare - input.previousWelfareRefundAmount;
  const cashRefundAmount = input.approvedRefundAmount - welfareRefundAmount;
  if (
    welfareRefundAmount < 0 ||
    cashRefundAmount < 0 ||
    input.previousWelfareRefundAmount + welfareRefundAmount > input.originalWelfareAmount ||
    input.previousCashRefundAmount + cashRefundAmount > input.originalCashAmount
  ) {
    return { kind: 'INVALID' };
  }
  return {
    kind: 'ALLOCATED',
    welfareRefundAmount,
    cashRefundAmount,
    cumulativeRefundAmount: cumulativeTotal,
  };
};
