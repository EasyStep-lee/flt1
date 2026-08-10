export const NO_SUPPLIER_STOREFRONT_POLICY_ID =
  'NO_SUPPLIER_STOREFRONT_CAPABILITIES' as const;

export type NoSupplierStorefrontViolationCategory =
  | 'SUPPLIER_STOREFRONT'
  | 'SUPPLIER_DIRECT_PAYMENT'
  | 'SUPPLIER_STORE_CART';

export type NoSupplierStorefrontViolationCode = 'FORBIDDEN_CAPABILITY';

const FORBIDDEN_CAPABILITIES: Readonly<
  Record<string, NoSupplierStorefrontViolationCategory>
> = Object.freeze({
  SUPPLIER_STOREFRONT: 'SUPPLIER_STOREFRONT',
  SUPPLIER_STORE_DECORATION: 'SUPPLIER_STOREFRONT',
  SUPPLIER_DIRECT_PAYMENT: 'SUPPLIER_DIRECT_PAYMENT',
  SUPPLIER_PAYMENT_ACCOUNT: 'SUPPLIER_DIRECT_PAYMENT',
  SUPPLIER_DIRECT_SETTLEMENT: 'SUPPLIER_DIRECT_PAYMENT',
  SUPPLIER_STORE_CART: 'SUPPLIER_STORE_CART',
  SUPPLIER_STORE_COUPON: 'SUPPLIER_STORE_CART',
});

const FORBIDDEN_PAYLOAD_KEYS: Readonly<
  Record<string, NoSupplierStorefrontViolationCategory>
> = Object.freeze({
  storefrontid: 'SUPPLIER_STOREFRONT',
  supplierstorefrontid: 'SUPPLIER_STOREFRONT',
  supplierstoredecorationid: 'SUPPLIER_STOREFRONT',
  supplierpaymentaccountid: 'SUPPLIER_DIRECT_PAYMENT',
  supplierpayeeid: 'SUPPLIER_DIRECT_PAYMENT',
  supplierdirectsettlementid: 'SUPPLIER_DIRECT_PAYMENT',
  storecartid: 'SUPPLIER_STORE_CART',
  supplierstorecartid: 'SUPPLIER_STORE_CART',
  storecouponownerid: 'SUPPLIER_STORE_CART',
  supplierstorecouponid: 'SUPPLIER_STORE_CART',
});

const normalizeKey = (key: string): string =>
  key.replaceAll(/[^a-z0-9]/giu, '').toLowerCase();

export class NoSupplierStorefrontCapabilityError extends Error {
  readonly policyId = NO_SUPPLIER_STOREFRONT_POLICY_ID;
  readonly code: NoSupplierStorefrontViolationCode = 'FORBIDDEN_CAPABILITY';

  constructor(
    readonly category: NoSupplierStorefrontViolationCategory,
    readonly subject: string,
  ) {
    super(`FORBIDDEN_CAPABILITY:${category}`);
    this.name = 'NoSupplierStorefrontCapabilityError';
  }
}

export const assertCustomerCatalogCapabilityAllowed = (
  capability: string,
): void => {
  const normalized = capability.trim().toUpperCase();
  const category = FORBIDDEN_CAPABILITIES[normalized];
  if (category) {
    throw new NoSupplierStorefrontCapabilityError(category, normalized);
  }
};

export const assertCustomerCatalogPayloadAllowed = (payload: unknown): void => {
  if (Array.isArray(payload)) {
    for (const item of payload) assertCustomerCatalogPayloadAllowed(item);
    return;
  }
  if (!payload || typeof payload !== 'object') return;

  for (const [key, value] of Object.entries(payload)) {
    const category = FORBIDDEN_PAYLOAD_KEYS[normalizeKey(key)];
    if (category) {
      throw new NoSupplierStorefrontCapabilityError(category, key);
    }
    assertCustomerCatalogPayloadAllowed(value);
  }
};
