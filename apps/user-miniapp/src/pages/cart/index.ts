import { requestAdapter } from '../../request-adapter.js';

type CartState = 'empty' | 'error' | 'loading' | 'ready' | 'submitting' | 'success' | 'unknown';

interface StoredCartItem {
  readonly skuId: string;
  readonly supplierId: string;
  readonly supplierLabel: string;
  readonly productName: string;
  readonly quantity: number;
  readonly retailSalePrice: number;
}

interface CartGroup {
  readonly supplierId: string;
  readonly supplierLabel: string;
  readonly items: readonly (StoredCartItem & { readonly priceLabel: string; readonly lineAmountLabel: string })[];
}

interface CartPageData {
  readonly pageId: 'PAGE-055';
  readonly state: CartState;
  readonly groups: readonly CartGroup[];
  readonly totalAmountLabel: string;
  readonly message: string;
  readonly orderNo: string;
}

interface CartPageInstance {
  readonly data: CartPageData;
  setData(patch: Partial<CartPageData>): void;
  loadCart(): void;
  submitOrder(): Promise<void>;
}

interface UserMiniappApplication {
  readonly globalData: { readonly apiBaseUrl: string };
}

const CART_STORAGE_KEY = 'fulishe.pendingCartItems';
const COMMAND_STORAGE_KEY = 'fulishe.pendingOrderCommand';
const cents = (value: number): string => `¥${(value / 100).toFixed(2)}`;

const normalizeItems = (value: unknown): readonly StoredCartItem[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: StoredCartItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const item = raw as Partial<StoredCartItem>;
    if (
      typeof item.skuId !== 'string' ||
      typeof item.supplierId !== 'string' ||
      typeof item.productName !== 'string' ||
      typeof item.supplierLabel !== 'string' ||
      !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 ||
      !Number.isSafeInteger(item.retailSalePrice) || Number(item.retailSalePrice) < 0 ||
      seen.has(item.skuId)
    ) return [];
    seen.add(item.skuId);
    items.push(item as StoredCartItem);
  }
  return items;
};

const signature = (items: readonly StoredCartItem[]): string =>
  JSON.stringify(items.map(({ skuId, quantity }) => ({ skuId, quantity })).sort((a, b) => a.skuId.localeCompare(b.skuId)));

const idempotencyKey = (items: readonly StoredCartItem[]): string => {
  const current = wx.getStorageSync<unknown>(COMMAND_STORAGE_KEY);
  const currentSignature = signature(items);
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    const stored = current as { readonly key?: unknown; readonly signature?: unknown };
    if (stored.signature === currentSignature && typeof stored.key === 'string') return stored.key;
  }
  const key = `consumer-order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  wx.setStorageSync(COMMAND_STORAGE_KEY, { key, signature: currentSignature });
  return key;
};

const pageDefinition = {
  data: {
    pageId: 'PAGE-055' as const,
    state: 'loading' as CartState,
    groups: [] as readonly CartGroup[],
    totalAmountLabel: cents(0),
    message: '',
    orderNo: '',
  },

  onLoad(this: CartPageInstance): void {
    this.loadCart();
  },

  loadCart(this: CartPageInstance): void {
    const items = normalizeItems(wx.getStorageSync<unknown>(CART_STORAGE_KEY));
    if (items.length === 0) {
      this.setData({ state: 'empty', groups: [], totalAmountLabel: cents(0), message: '购物车暂无商品' });
      return;
    }
    const grouped = new Map<string, CartGroup>();
    for (const item of items) {
      const displayItem = {
        ...item,
        priceLabel: cents(item.retailSalePrice),
        lineAmountLabel: cents(item.retailSalePrice * item.quantity),
      };
      const group = grouped.get(item.supplierId);
      grouped.set(item.supplierId, {
        supplierId: item.supplierId,
        supplierLabel: item.supplierLabel,
        items: [...(group?.items ?? []), displayItem],
      });
    }
    const total = items.reduce((sum, item) => sum + item.retailSalePrice * item.quantity, 0);
    this.setData({ state: 'ready', groups: [...grouped.values()], totalAmountLabel: cents(total), message: '' });
  },

  async submitOrder(this: CartPageInstance): Promise<void> {
    if (this.data.state !== 'ready' && this.data.state !== 'unknown') return;
    const items = normalizeItems(wx.getStorageSync<unknown>(CART_STORAGE_KEY));
    if (items.length === 0) {
      this.loadCart();
      return;
    }
    this.setData({ state: 'submitting', message: '正在由公司统一创建订单，请勿重复提交' });
    try {
      const application = getApp<UserMiniappApplication>();
      const baseUrl = application.globalData.apiBaseUrl.replace(/\/$/u, '');
      if (!/^https?:\/\//u.test(baseUrl)) throw new Error('API_BASE_URL_INVALID');
      const response = await requestAdapter.execute('orders.createConsumerOrder', {
        method: 'POST',
        url: `${baseUrl}/v1/consumer/orders`,
        headers: { 'Idempotency-Key': idempotencyKey(items) },
        body: { items: items.map(({ skuId, quantity }) => ({ skuId, quantity })) },
      });
      wx.removeStorageSync(COMMAND_STORAGE_KEY);
      this.setData({ state: 'success', orderNo: response.orderNo, message: '订单已由公司统一创建' });
    } catch {
      this.setData({
        state: 'unknown',
        message: '提交结果待确认。请检查网络后使用同一按钮重试，系统会复用原幂等键。',
      });
    }
  },
};

Page(pageDefinition);
