import { Injectable } from '@nestjs/common';

export const WELFARE_REFUND_ADAPTER = Symbol('WELFARE_REFUND_ADAPTER');
export const WECHAT_REFUND_ADAPTER = Symbol('WECHAT_REFUND_ADAPTER');

export interface WelfareRefundCommand {
  readonly refundId: string;
  readonly refundNo: string;
  readonly refundAmount: number;
  readonly originalWelfareCardAccountId: string;
  readonly requestId: string;
}

export interface WechatRefundCommand {
  readonly refundId: string;
  readonly refundNo: string;
  readonly refundAmount: number;
  readonly originalPaymentTransactionId: string;
  readonly originalWechatOutTradeNo: string;
  readonly originalWechatTransactionId: string;
  readonly originalWechatTotalAmount: number;
}

export type RefundAdapterResult =
  | { readonly kind: 'SUCCEEDED'; readonly externalRefundNo?: string }
  | { readonly kind: 'UNKNOWN'; readonly externalRefundNo?: string };

export interface WelfareRefundAdapter {
  refund(command: WelfareRefundCommand): Promise<RefundAdapterResult>;
}

export interface WechatRefundAdapter {
  refund(command: WechatRefundCommand): Promise<RefundAdapterResult>;
}

export class RefundAdapterError extends Error {
  constructor(
    readonly code: 'EXTERNAL_SERVICE_UNAVAILABLE' | 'REFUND_CHANNEL_REJECTED',
    message: string,
  ) {
    super(message);
    this.name = 'RefundAdapterError';
  }
}

@Injectable()
export class UnavailableWelfareRefundAdapter implements WelfareRefundAdapter {
  async refund(): Promise<never> {
    throw new RefundAdapterError(
      'EXTERNAL_SERVICE_UNAVAILABLE',
      'Welfare-card refund ledger adapter is not configured',
    );
  }
}

@Injectable()
export class UnavailableWechatRefundAdapter implements WechatRefundAdapter {
  async refund(): Promise<never> {
    throw new RefundAdapterError(
      'EXTERNAL_SERVICE_UNAVAILABLE',
      'WeChat refund adapter is not configured',
    );
  }
}
