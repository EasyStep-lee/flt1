export const ENTERPRISE_CART_STORAGE_KEY = 'fulishe.enterprise.procurement.cart.v1';
export const ENTERPRISE_ORDER_KEY_STORAGE_KEY = 'fulishe.enterprise.procurement.order-key.v1';

export interface EnterpriseOrderCommand {
  readonly key: string;
  readonly signature: string;
}

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

export const enterpriseOrderSignature = (
  items: readonly Pick<EnterpriseCartItem, 'quantity' | 'skuId'>[],
): string => JSON.stringify(
  items
    .map(({ skuId, quantity }) => ({ skuId, quantity }))
    .sort((left, right) => left.skuId.localeCompare(right.skuId)),
);

export const parseEnterpriseOrderCommand = (raw: string | null): EnterpriseOrderCommand | undefined => {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const command = value as Record<string, unknown>;
    if (
      typeof command.key !== 'string' ||
      !/^ent-[a-z0-9-]{16,}$/u.test(command.key) ||
      typeof command.signature !== 'string'
    ) return undefined;
    return { key: command.key, signature: command.signature };
  } catch {
    return undefined;
  }
};
