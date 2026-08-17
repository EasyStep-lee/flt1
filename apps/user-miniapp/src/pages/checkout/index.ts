import { MiniappTransportError } from '@fulishe/miniapp-kit';

import { requestAdapter } from '../../request-adapter.js';

type CheckoutState = 'loading' | 'empty' | 'error' | 'permission' | 'offline' | 'success' | 'paying' | 'paid' | 'unknown';

interface StoredCartItem {
  readonly skuId: string;
  readonly quantity: number;
}

interface EligibleAccount {
  readonly id: string;
  readonly programName: string;
  readonly maskedCardNo: string;
  readonly balanceAmount: number;
  readonly frozenAmount: number;
  readonly availableAmount: number;
  readonly scopeDescription: string;
  readonly eligibleAmount: number;
  readonly maximumDeductibleAmount: number;
  readonly itemApplicability: readonly {
    readonly skuId: string;
    readonly eligible: boolean;
    readonly eligibleAmount: number;
    readonly reason: WelfareReason;
  }[];
  readonly deliveryFeeApplicability: { readonly eligible: boolean; readonly eligibleAmount: number };
}

type WelfareReason = 'ALL_PRODUCTS' | 'DEFAULT_INCLUDED' | 'CATEGORY_INCLUDED' | 'PRODUCT_INCLUDED' | 'SKU_INCLUDED' | 'CATEGORY_EXCLUDED' | 'PRODUCT_EXCLUDED' | 'SKU_EXCLUDED' | 'OUTSIDE_WHITELIST';

interface DisplayAccount extends Omit<EligibleAccount, 'deliveryFeeApplicability' | 'itemApplicability'> {
  readonly balanceLabel: string;
  readonly availableLabel: string;
  readonly eligibleLabel: string;
  readonly maximumDeductibleLabel: string;
  readonly itemApplicability: readonly (EligibleAccount['itemApplicability'][number] & { readonly eligibilityLabel: string })[];
  readonly deliveryFeeApplicability: EligibleAccount['deliveryFeeApplicability'] & { readonly label: string };
}

interface CheckoutData {
  readonly pageId: 'PAGE-056';
  readonly state: CheckoutState;
  readonly message: string;
  readonly goodsAmountLabel: string;
  readonly totalAmountLabel: string;
  readonly totalAmount: number;
  readonly accounts: readonly DisplayAccount[];
  readonly selectedAccountId: string;
  readonly canPayFully: boolean;
  readonly paymentButtonLabel: string;
}

interface CheckoutInstance {
  readonly data: CheckoutData;
  setData(patch: Partial<CheckoutData>): void;
  loadEligibility(): Promise<void>;
  submitFullWelfarePayment(): Promise<void>;
}

interface UserMiniappApplication {
  readonly globalData: { readonly apiBaseUrl: string };
}

const CART_STORAGE_KEY = 'fulishe.pendingCartItems';
const SELECTION_STORAGE_KEY = 'fulishe.selectedWelfareCardAccountId';
const PENDING_ORDER_STORAGE_KEY = 'fulishe.pendingBuyerOrder';
const PAYMENT_COMMAND_STORAGE_KEY = 'fulishe.pendingWelfareFullPaymentCommand';
interface PendingOrder { readonly orderId: string; readonly totalAmount: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const cents = (value: number): string => `¥${(value / 100).toFixed(2)}`;
const pendingOrder = (): PendingOrder | null => {
  const value = wx.getStorageSync<unknown>(PENDING_ORDER_STORAGE_KEY);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const order = value as Partial<PendingOrder>;
  return typeof order.orderId === 'string' && UUID.test(order.orderId)
    && Number.isSafeInteger(order.totalAmount) && Number(order.totalAmount) > 0
    ? { orderId: order.orderId, totalAmount: Number(order.totalAmount) }
    : null;
};
const paymentKey = (orderId: string, accountId: string): string => {
  const signature = `${orderId}:${accountId}`;
  const current = wx.getStorageSync<unknown>(PAYMENT_COMMAND_STORAGE_KEY);
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    const stored = current as { readonly key?: unknown; readonly signature?: unknown };
    if (stored.signature === signature && typeof stored.key === 'string') return stored.key;
  }
  const key = `welfare-full-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  wx.setStorageSync(PAYMENT_COMMAND_STORAGE_KEY, { key, signature });
  return key;
};
const cartItems = (): readonly StoredCartItem[] => {
  const raw = wx.getStorageSync<unknown>(CART_STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: StoredCartItem[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const item = value as Partial<StoredCartItem>;
    if (typeof item.skuId !== 'string' || seen.has(item.skuId) || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1) return [];
    seen.add(item.skuId);
    items.push({ skuId: item.skuId, quantity: Number(item.quantity) });
  }
  return items;
};
const eligibilityQuery = (items: readonly StoredCartItem[]): string => items
  .flatMap(({ skuId, quantity }) => [`skuId=${encodeURIComponent(skuId)}`, `quantity=${quantity}`])
  .join('&');
const reasonLabel = (reason: WelfareReason, eligible: boolean): string => {
  if (eligible) return '福利卡可用';
  const labels: Record<WelfareReason, string> = {
    ALL_PRODUCTS: '福利卡可用',
    DEFAULT_INCLUDED: '福利卡可用',
    CATEGORY_INCLUDED: '福利卡可用',
    PRODUCT_INCLUDED: '福利卡可用',
    SKU_INCLUDED: '福利卡可用',
    CATEGORY_EXCLUDED: '分类黑名单不可用',
    PRODUCT_EXCLUDED: '商品黑名单不可用',
    SKU_EXCLUDED: '规格黑名单不可用',
    OUTSIDE_WHITELIST: '不在适用白名单',
  };
  return labels[reason];
};
const displayAccount = (account: EligibleAccount): DisplayAccount => ({
  ...account,
  balanceLabel: cents(account.balanceAmount),
  availableLabel: cents(account.availableAmount),
  eligibleLabel: cents(account.eligibleAmount),
  maximumDeductibleLabel: cents(account.maximumDeductibleAmount),
  itemApplicability: account.itemApplicability.map((item) => ({
    ...item,
    eligibilityLabel: reasonLabel(item.reason, item.eligible),
  })),
  deliveryFeeApplicability: {
    ...account.deliveryFeeApplicability,
    label: account.deliveryFeeApplicability.eligible ? '配送费可用福利卡' : '配送费不可用福利卡',
  },
});

const pageDefinition = {
  data: {
    pageId: 'PAGE-056' as const,
    state: 'loading' as CheckoutState,
    message: '',
    goodsAmountLabel: cents(0),
    totalAmountLabel: cents(0),
    totalAmount: 0,
    accounts: [] as readonly DisplayAccount[],
    selectedAccountId: '',
    canPayFully: false,
    paymentButtonLabel: '请选择可全额支付的福利卡',
  },

  async onLoad(this: CheckoutInstance): Promise<void> {
    await this.loadEligibility();
  },

  async loadEligibility(this: CheckoutInstance): Promise<void> {
    const items = cartItems();
    if (items.length === 0) {
      this.setData({ state: 'empty', message: '购物车暂无可结算商品', accounts: [] });
      return;
    }
    this.setData({ state: 'loading', message: '正在按服务端实时价格计算可用福利卡…' });
    try {
      const application = getApp<UserMiniappApplication>();
      const baseUrl = application.globalData.apiBaseUrl.replace(/\/$/u, '');
      if (!/^https?:\/\//u.test(baseUrl)) throw new Error('API_BASE_URL_INVALID');
      const response = await requestAdapter.execute('consumerWelfareCard.listEligibleAccounts', {
        method: 'GET',
        url: `${baseUrl}/v1/consumer/welfare-card-accounts/eligible?${eligibilityQuery(items)}`,
      });
      const accounts = response.accounts.map(displayAccount);
      const selected = wx.getStorageSync<unknown>(SELECTION_STORAGE_KEY);
      const selectedAccountId = typeof selected === 'string' && accounts.some(({ id }) => id === selected) ? selected : '';
      if (!selectedAccountId) wx.removeStorageSync(SELECTION_STORAGE_KEY);
      this.setData({
        state: 'success',
        message: accounts.length === 0 ? '本单没有可用福利卡，可选择不使用福利卡' : '选择一个账户或不使用；抵扣额由系统自动取最大值',
        goodsAmountLabel: cents(response.goodsAmount),
        totalAmountLabel: cents(response.totalAmount),
        totalAmount: response.totalAmount,
        accounts,
        selectedAccountId,
        canPayFully: Boolean(selectedAccountId && accounts.some(({ id, maximumDeductibleAmount }) => id === selectedAccountId && maximumDeductibleAmount === response.totalAmount)),
        paymentButtonLabel: selectedAccountId && accounts.some(({ id, maximumDeductibleAmount }) => id === selectedAccountId && maximumDeductibleAmount === response.totalAmount)
          ? '福利卡全额支付'
          : '请选择可全额支付的福利卡',
      });
    } catch (error) {
      if (error instanceof MiniappTransportError && (error.statusCode === 401 || error.statusCode === 403)) {
        this.setData({ state: 'permission', message: '请先登录本人账号后再选择福利卡', accounts: [] });
        return;
      }
      if (error instanceof MiniappTransportError && error.code === 'MINIAPP_REQUEST_FAILED') {
        this.setData({ state: 'offline', message: '网络不可用，请恢复网络后重试', accounts: [] });
        return;
      }
      this.setData({ state: 'error', message: '福利卡资格计算失败，请刷新购物车后重试', accounts: [] });
    }
  },

  selectAccount(this: CheckoutInstance, event: { readonly currentTarget: { readonly dataset: { readonly accountId?: unknown } } }): void {
    const accountId = event.currentTarget.dataset.accountId;
    if (typeof accountId !== 'string' || !this.data.accounts.some(({ id }) => id === accountId)) return;
    wx.setStorageSync(SELECTION_STORAGE_KEY, accountId);
    const selected = this.data.accounts.find(({ id }) => id === accountId);
    const canPayFully = selected?.maximumDeductibleAmount === this.data.totalAmount;
    this.setData({
      selectedAccountId: accountId,
      canPayFully,
      message: canPayFully ? '本单可由所选福利卡全额支付' : '所选福利卡无法全额支付；混合支付将在后续切片提供',
      paymentButtonLabel: canPayFully ? '福利卡全额支付' : '当前福利卡不可全额支付',
    });
  },

  useNoWelfareCard(this: CheckoutInstance): void {
    wx.removeStorageSync(SELECTION_STORAGE_KEY);
    this.setData({ selectedAccountId: '', canPayFully: false, paymentButtonLabel: '请选择可全额支付的福利卡' });
  },

  async submitFullWelfarePayment(this: CheckoutInstance): Promise<void> {
    if (this.data.state !== 'success' && this.data.state !== 'unknown') return;
    const order = pendingOrder();
    const account = this.data.accounts.find(({ id }) => id === this.data.selectedAccountId);
    if (!order) {
      this.setData({ message: '请先在购物车创建待支付订单' });
      return;
    }
    if (!account || account.maximumDeductibleAmount !== this.data.totalAmount || order.totalAmount !== this.data.totalAmount) {
      this.setData({ message: '所选福利卡无法全额支付；本切片不会发起微信或混合支付' });
      return;
    }
    this.setData({ state: 'paying', message: '正在安全扣款，请勿重复操作', paymentButtonLabel: '支付处理中…' });
    try {
      const application = getApp<UserMiniappApplication>();
      const baseUrl = application.globalData.apiBaseUrl.replace(/\/$/u, '');
      if (!/^https?:\/\//u.test(baseUrl)) throw new Error('API_BASE_URL_INVALID');
      const response = await requestAdapter.execute('consumerWelfareCard.payFullOrder', {
        method: 'POST',
        url: `${baseUrl}/v1/consumer/orders/${order.orderId}/welfare-card-full-payment`,
        headers: { 'Idempotency-Key': paymentKey(order.orderId, account.id) },
        body: { accountId: account.id },
      });
      if (response.paymentStatus !== 'PAID' || response.orderStatus !== 'PAID' || response.cashAmount !== 0) {
        throw new Error('WELFARE_FULL_PAYMENT_RESPONSE_INVALID');
      }
      wx.removeStorageSync(PAYMENT_COMMAND_STORAGE_KEY);
      wx.removeStorageSync(PENDING_ORDER_STORAGE_KEY);
      this.setData({ state: 'paid', message: '福利卡支付成功', paymentButtonLabel: '已支付' });
    } catch {
      this.setData({
        state: 'unknown',
        message: '支付结果待确认。恢复网络后使用同一按钮查询式重试，系统会复用原幂等键。',
        paymentButtonLabel: '确认结果/重试',
      });
    }
  },

  retry(this: CheckoutInstance): Promise<void> {
    return this.loadEligibility();
  },
} satisfies Record<string, unknown> & { data: CheckoutData };

Page(pageDefinition);
