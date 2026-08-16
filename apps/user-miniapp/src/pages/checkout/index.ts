import { MiniappTransportError } from '@fulishe/miniapp-kit';

import { requestAdapter } from '../../request-adapter.js';

type CheckoutState = 'loading' | 'empty' | 'error' | 'permission' | 'offline' | 'success';

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
}

interface DisplayAccount extends EligibleAccount {
  readonly balanceLabel: string;
  readonly availableLabel: string;
  readonly eligibleLabel: string;
  readonly maximumDeductibleLabel: string;
}

interface CheckoutData {
  readonly pageId: 'PAGE-056';
  readonly state: CheckoutState;
  readonly message: string;
  readonly goodsAmountLabel: string;
  readonly totalAmountLabel: string;
  readonly accounts: readonly DisplayAccount[];
  readonly selectedAccountId: string;
}

interface CheckoutInstance {
  readonly data: CheckoutData;
  setData(patch: Partial<CheckoutData>): void;
  loadEligibility(): Promise<void>;
}

interface UserMiniappApplication {
  readonly globalData: { readonly apiBaseUrl: string };
}

const CART_STORAGE_KEY = 'fulishe.pendingCartItems';
const SELECTION_STORAGE_KEY = 'fulishe.selectedWelfareCardAccountId';
const cents = (value: number): string => `¥${(value / 100).toFixed(2)}`;
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
const displayAccount = (account: EligibleAccount): DisplayAccount => ({
  ...account,
  balanceLabel: cents(account.balanceAmount),
  availableLabel: cents(account.availableAmount),
  eligibleLabel: cents(account.eligibleAmount),
  maximumDeductibleLabel: cents(account.maximumDeductibleAmount),
});

const pageDefinition = {
  data: {
    pageId: 'PAGE-056' as const,
    state: 'loading' as CheckoutState,
    message: '',
    goodsAmountLabel: cents(0),
    totalAmountLabel: cents(0),
    accounts: [] as readonly DisplayAccount[],
    selectedAccountId: '',
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
        accounts,
        selectedAccountId,
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
    this.setData({ selectedAccountId: accountId });
  },

  useNoWelfareCard(this: CheckoutInstance): void {
    wx.removeStorageSync(SELECTION_STORAGE_KEY);
    this.setData({ selectedAccountId: '' });
  },

  retry(this: CheckoutInstance): Promise<void> {
    return this.loadEligibility();
  },
} satisfies Record<string, unknown> & { data: CheckoutData };

Page(pageDefinition);
