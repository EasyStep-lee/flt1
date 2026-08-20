import { requestAdapter } from '../../request-adapter.js';

type LedgerState = 'loading' | 'empty' | 'error' | 'permission' | 'offline' | 'success';
interface LedgerItem {
  readonly sequence: number;
  readonly businessType: string;
  readonly direction: string;
  readonly amountLabel: string;
  readonly balanceLabel: string;
  readonly occurredAt: string;
}
interface WelfareCardDetailData {
  readonly pageId: 'PAGE-063';
  readonly state: LedgerState;
  readonly accountId: string;
  readonly programName: string;
  readonly maskedCardNo: string;
  readonly balanceLabel: string;
  readonly frozenLabel: string;
  readonly availableLabel: string;
  readonly items: readonly LedgerItem[];
  readonly message: string;
}
interface WelfareCardDetailInstance {
  readonly data: WelfareCardDetailData;
  setData(patch: Partial<WelfareCardDetailData>): void;
  loadLedger(): Promise<void>;
}
interface UserMiniappApplication { readonly globalData: { readonly apiBaseUrl: string } }

const money = (amount: number): string => `¥${(amount / 100).toFixed(2)}`;
const typeLabel: Record<string, string> = {
  CLAIM: '实体卡/兑换码领取', GRANT: '企业福利发放', GIFT: '公司活动赠送',
  FREEZE: '订单冻结', RELEASE: '订单解冻', CAPTURE: '订单实扣', REFUND: '原路退款',
  ADJUSTMENT: '财务调整', REVERSAL: '调整冲正',
};

Page({
  data: {
    pageId: 'PAGE-063' as const,
    state: 'loading' as LedgerState,
    accountId: '', programName: '', maskedCardNo: '', balanceLabel: '', frozenLabel: '', availableLabel: '',
    items: [] as readonly LedgerItem[], message: '',
  } satisfies WelfareCardDetailData,
  onLoad(this: WelfareCardDetailInstance, options: Record<string, string | undefined>): void {
    const accountId = typeof options.accountId === 'string' ? options.accountId : '';
    this.setData({ accountId });
    void this.loadLedger();
  },
  async loadLedger(this: WelfareCardDetailInstance): Promise<void> {
    if (!/^[0-9a-f-]{36}$/iu.test(this.data.accountId)) {
      this.setData({ state: 'empty', message: '未选择可查看的福利卡账户' });
      return;
    }
    this.setData({ state: 'loading', message: '' });
    try {
      const baseUrl = getApp<UserMiniappApplication>().globalData.apiBaseUrl.replace(/\/$/u, '');
      if (!/^https?:\/\//u.test(baseUrl)) throw new Error('API_BASE_URL_INVALID');
      const response = await requestAdapter.execute('consumerWelfareCard.getLedger', {
        method: 'GET',
        url: `${baseUrl}/v1/consumer/welfare-card-accounts/${this.data.accountId}/ledger`,
      });
      this.setData({
        state: response.items.length ? 'success' : 'empty',
        programName: response.account.programName,
        maskedCardNo: response.account.maskedCardNo,
        balanceLabel: money(response.account.balanceAmount),
        frozenLabel: money(response.account.frozenAmount),
        availableLabel: money(response.account.availableAmount),
        items: response.items.map((item) => ({
          sequence: item.sequence,
          businessType: typeLabel[item.businessType] ?? item.businessType,
          direction: item.direction,
          amountLabel: `${item.direction === 'CREDIT' ? '+' : '-'}${money(item.amount)}`,
          balanceLabel: money(item.afterBalance),
          occurredAt: item.occurredAt.replace('T', ' ').slice(0, 19),
        })),
        message: response.items.length ? '' : '当前账户尚无可显示流水',
      });
    } catch (error) {
      const text = String(error);
      const statusCode = error && typeof error === 'object' && 'statusCode' in error
        ? (error as { readonly statusCode?: unknown }).statusCode
        : undefined;
      const permission = statusCode === 401 || statusCode === 403 || statusCode === 404
        || /AUTHENTICATION|SCOPE/iu.test(text);
      const offline = /timeout|network|offline|fail/iu.test(text);
      this.setData({
        state: permission ? 'permission' : offline ? 'offline' : 'error',
        message: permission ? '请使用本人账号重新登录后查看' : offline ? '网络不可用，请恢复后重试' : '账本读取失败，请稍后重试',
      });
    }
  },
  retry(this: WelfareCardDetailInstance): void { void this.loadLedger(); },
});
