export const PLATFORM_NAME = '福礼社' as const;
export const COMPANY_LEGAL_NAME = '江苏福礼团供应链科技有限公司' as const;
export const CUSTOMER_COUNTERPARTY_TYPE = 'COMPANY' as const;

export type CustomerCounterpartyType = typeof CUSTOMER_COUNTERPARTY_TYPE;

export interface PublicMerchantProfile {
  readonly platformName: typeof PLATFORM_NAME;
  readonly legalName: typeof COMPANY_LEGAL_NAME;
  readonly subjects: {
    readonly seller: typeof COMPANY_LEGAL_NAME;
    readonly paymentPayee: typeof COMPANY_LEGAL_NAME;
    readonly refundOperator: typeof COMPANY_LEGAL_NAME;
  };
}
