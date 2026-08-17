import { Injectable } from '@nestjs/common';

export const WECHAT_PAYMENT_ADAPTER = Symbol('WECHAT_PAYMENT_ADAPTER');

export interface CreateWechatPrepayCommand {
  readonly outTradeNo: string;
  readonly amount: number;
  readonly description: string;
  readonly payerReference: string;
  readonly merchantConfigRef: string;
  readonly collectorLegalName: '江苏福礼团供应链科技有限公司';
}

export interface WechatPrepayResponse {
  readonly prepayId: string;
  readonly clientPayment: Readonly<{
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: 'RSA';
    paySign: string;
  }>;
}

export interface VerifiedWechatNotification {
  readonly notificationId: string;
  readonly outTradeNo: string;
  readonly wechatTransactionId: string;
  readonly amount: number;
  readonly tradeState: 'SUCCESS';
  readonly verifiedAt: Date;
  readonly rawBodyHash: string;
}

export interface WechatTransactionCommand {
  readonly outTradeNo: string;
  readonly merchantConfigRef: string;
  readonly collectorLegalName: '江苏福礼团供应链科技有限公司';
}

export type WechatTransactionQueryResult =
  | ({ readonly kind: 'PAID' } & Omit<VerifiedWechatNotification, 'notificationId' | 'tradeState'>)
  | { readonly kind: 'NOT_PAID'; readonly tradeState: 'NOTPAY' | 'CLOSED' | 'PAYERROR' }
  | { readonly kind: 'PENDING'; readonly tradeState: 'USERPAYING' }
  | { readonly kind: 'UNKNOWN' };

export type WechatTransactionCloseResult =
  | { readonly kind: 'CLOSED' }
  | ({ readonly kind: 'PAID' } & Omit<VerifiedWechatNotification, 'notificationId' | 'tradeState'>)
  | { readonly kind: 'UNKNOWN' };

export interface WechatPaymentAdapter {
  createPrepay(command: CreateWechatPrepayCommand): Promise<WechatPrepayResponse>;
  verifyNotification(
    headers: Readonly<Record<string, string | string[] | undefined>>,
    body: unknown,
  ): Promise<VerifiedWechatNotification>;
  queryTransaction(command: WechatTransactionCommand): Promise<WechatTransactionQueryResult>;
  closeTransaction(command: WechatTransactionCommand): Promise<WechatTransactionCloseResult>;
}

export class WechatPaymentAdapterError extends Error {
  constructor(
    readonly code:
      | 'EXTERNAL_SERVICE_UNAVAILABLE'
      | 'PAYMENT_NOTIFICATION_INVALID'
      | 'PAYMENT_IDENTITY_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'WechatPaymentAdapterError';
  }
}

@Injectable()
export class UnavailableWechatPaymentAdapter implements WechatPaymentAdapter {
  async createPrepay(): Promise<never> {
    throw new WechatPaymentAdapterError(
      'EXTERNAL_SERVICE_UNAVAILABLE',
      'WeChat Pay adapter is not configured',
    );
  }

  async verifyNotification(): Promise<never> {
    throw new WechatPaymentAdapterError(
      'EXTERNAL_SERVICE_UNAVAILABLE',
      'WeChat Pay adapter is not configured',
    );
  }

  async queryTransaction(): Promise<never> {
    throw new WechatPaymentAdapterError(
      'EXTERNAL_SERVICE_UNAVAILABLE',
      'WeChat Pay adapter is not configured',
    );
  }

  async closeTransaction(): Promise<never> {
    throw new WechatPaymentAdapterError(
      'EXTERNAL_SERVICE_UNAVAILABLE',
      'WeChat Pay adapter is not configured',
    );
  }
}
