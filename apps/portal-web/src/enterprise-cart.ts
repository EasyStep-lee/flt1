export const ENTERPRISE_CART_STORAGE_KEY = 'fulishe.enterprise.procurement.cart.v1';
export const ENTERPRISE_ORDER_KEY_STORAGE_KEY = 'fulishe.enterprise.procurement.order-key.v1';

export interface EnterpriseCartItem {
  readonly productId: string;
  readonly skuId: string;
  readonly supplierId: string;
  readonly productName: string;
  readonly enterpriseSalePrice: number;
  readonly quantity: number;
}

const isCartItem = (value: unknown): value is EnterpriseCartItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === 'string' &&
    typeof item.skuId === 'string' &&
    typeof item.supplierId === 'string' &&
    typeof item.productName === 'string' &&
    Number.isSafeInteger(item.enterpriseSalePrice) &&
    Number(item.enterpriseSalePrice) >= 0 &&
    Number.isSafeInteger(item.quantity) &&
    Number(item.quantity) >= 1 &&
    Number(item.quantity) <= 9999
  );
};

export const parseEnterpriseCart = (raw: string | null): readonly EnterpriseCartItem[] => {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > 100 || !value.every(isCartItem)) return [];
    return value;
  } catch {
    return [];
  }
};

export const addEnterpriseCartItem = (
  current: readonly EnterpriseCartItem[],
  next: EnterpriseCartItem,
): readonly EnterpriseCartItem[] => {
  const existing = current.find(({ skuId }) => skuId === next.skuId);
  if (existing) {
    return current.map((item) => item.skuId === next.skuId
      ? { ...item, quantity: Math.min(9999, item.quantity + 1) }
      : item);
  }
  return [...current, next].slice(0, 100);
};

export const enterpriseCartTotal = (items: readonly EnterpriseCartItem[]): number =>
  items.reduce((total, item) => total + item.enterpriseSalePrice * item.quantity, 0);
