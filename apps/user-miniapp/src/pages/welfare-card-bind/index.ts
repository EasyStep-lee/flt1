import { requestAdapter } from '../../request-adapter.js';

type BindingMethod = 'CARD_PASSWORD' | 'REDEMPTION_CODE' | 'SCAN_CODE';
type BindingState = 'ready' | 'loading' | 'empty' | 'error' | 'permission' | 'offline' | 'submitting' | 'success' | 'unknown';

interface BindingPageData {
  readonly pageId: 'PAGE-064';
  readonly state: BindingState;
  readonly method: BindingMethod;
  readonly cardNo: string;
  readonly secret: string;
  readonly redemptionCode: string;
  readonly agreementAccepted: boolean;
  readonly message: string;
  readonly programName: string;
  readonly maskedCardNo: string;
  readonly availableAmountLabel: string;
}

interface BindingPageInstance {
  readonly data: BindingPageData;
  setData(patch: Partial<BindingPageData>): void;
  submitBinding(): Promise<void>;
  scanAndBind(): Promise<void>;
}

interface UserMiniappApplication {
  readonly globalData: { readonly apiBaseUrl: string };
}

const COMMAND_STORAGE_KEY = 'fulishe.pendingWelfareCardBinding';
const parseIssuedCode = (value: string): { cardNo: string; secret: string } | null => {
  const match = /^FULISHE:([^:]{4,191}):([^:]{6,191})$/u.exec(value.trim());
  return match ? { cardNo: match[1]!, secret: match[2]! } : null;
};
const commandKey = (method: BindingMethod, cardNo: string): string => {
  const signature = `${method}:${cardNo}:1`;
  const pending = wx.getStorageSync<unknown>(COMMAND_STORAGE_KEY);
  if (pending && typeof pending === 'object' && !Array.isArray(pending)) {
    const stored = pending as { readonly key?: unknown; readonly signature?: unknown };
    if (stored.signature === signature && typeof stored.key === 'string') return stored.key;
  }
  const key = `welfare-bind-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  wx.setStorageSync(COMMAND_STORAGE_KEY, { key, signature });
  return key;
};
const money = (amount: number): string => `¥${(amount / 100).toFixed(2)}`;

const pageDefinition = {
  data: {
    pageId: 'PAGE-064' as const,
    state: 'ready' as BindingState,
    method: 'CARD_PASSWORD' as BindingMethod,
    cardNo: '',
    secret: '',
    redemptionCode: '',
    agreementAccepted: false,
    message: '',
    programName: '',
    maskedCardNo: '',
    availableAmountLabel: '',
  },

  selectCardPassword(this: BindingPageInstance): void { this.setData({ method: 'CARD_PASSWORD', message: '' }); },
  selectRedemptionCode(this: BindingPageInstance): void { this.setData({ method: 'REDEMPTION_CODE', message: '' }); },
  updateCardNo(this: BindingPageInstance, event: { detail: { value: string } }): void { this.setData({ cardNo: event.detail.value }); },
  updateSecret(this: BindingPageInstance, event: { detail: { value: string } }): void { this.setData({ secret: event.detail.value }); },
  updateRedemptionCode(this: BindingPageInstance, event: { detail: { value: string } }): void { this.setData({ redemptionCode: event.detail.value }); },
  toggleAgreement(this: BindingPageInstance, event: { detail: { value: readonly string[] } }): void {
    this.setData({ agreementAccepted: event.detail.value.includes('accepted') });
  },

  async scanAndBind(this: BindingPageInstance): Promise<void> {
    const scanned = await new Promise<string | null>((resolve) => {
      wx.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode', 'barCode'],
        success: ({ result }) => resolve(result),
        fail: () => resolve(null),
      });
    });
    const parsed = scanned ? parseIssuedCode(scanned) : null;
    if (!parsed) {
      this.setData({ state: 'error', message: '未识别到福礼团发行的有效福利卡码' });
      return;
    }
    this.setData({ method: 'SCAN_CODE', cardNo: parsed.cardNo, secret: parsed.secret, message: '' });
    await this.submitBinding();
  },

  async submitBinding(this: BindingPageInstance): Promise<void> {
    if (this.data.state === 'submitting') return;
    if (!this.data.agreementAccepted) {
      this.setData({ state: 'error', message: '请先阅读并确认福利卡使用协议' });
      return;
    }
    let cardNo = this.data.cardNo.trim();
    let secret = this.data.secret.trim();
    if (this.data.method === 'REDEMPTION_CODE') {
      const parsed = parseIssuedCode(this.data.redemptionCode);
      if (!parsed) {
        this.setData({ state: 'error', message: '兑换码格式无效，请核对后重试' });
        return;
      }
      cardNo = parsed.cardNo;
      secret = parsed.secret;
    }
    if (cardNo.length < 4 || secret.length < 6) {
      this.setData({ state: 'error', message: '卡号或卡密格式无效' });
      return;
    }
    this.setData({ state: 'submitting', message: '正在安全校验并绑定，请勿重复操作' });
    try {
      const application = getApp<UserMiniappApplication>();
      const baseUrl = application.globalData.apiBaseUrl.replace(/\/$/u, '');
      if (!/^https?:\/\//u.test(baseUrl)) throw new Error('API_BASE_URL_INVALID');
      const response = await requestAdapter.execute('consumerWelfareCard.bindAccount', {
        method: 'POST',
        url: `${baseUrl}/v1/consumer/welfare-card-accounts/bind`,
        headers: { 'Idempotency-Key': commandKey(this.data.method, cardNo) },
        body: {
          agreementAccepted: true,
          agreementVersion: 1,
          method: this.data.method,
          cardNo,
          secret,
        },
      });
      wx.removeStorageSync(COMMAND_STORAGE_KEY);
      this.setData({
        state: 'success',
        secret: '',
        redemptionCode: '',
        message: '福利卡已绑定到本人账户',
        programName: response.programName,
        maskedCardNo: response.maskedCardNo,
        availableAmountLabel: money(response.availableAmount),
      });
    } catch {
      this.setData({
        state: 'unknown',
        secret: '',
        redemptionCode: '',
        message: '结果待确认。请保持卡号不变并使用同一按钮重试，系统会复用原幂等键。',
      });
    }
  },
};

Page(pageDefinition);
