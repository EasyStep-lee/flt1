type WelfareCardHomeState = 'loading' | 'empty' | 'error' | 'permission' | 'offline' | 'success' | 'unknown';

interface WelfareCardHomeData {
  readonly pageId: 'PAGE-062';
  readonly state: WelfareCardHomeState;
  readonly message: string;
}

interface WelfareCardHomeInstance {
  setData(patch: Partial<WelfareCardHomeData>): void;
}

Page({
  data: {
    pageId: 'PAGE-062' as const,
    state: 'empty' as WelfareCardHomeState,
    message: '尚未显示福利卡账户。绑定成功后可查看结果；完整账户列表将在账户选择切片接入服务端真源。',
  } satisfies WelfareCardHomeData,
  retry(this: WelfareCardHomeInstance): void {
    this.setData({ state: 'empty', message: '当前没有可显示的福利卡账户' });
  },
});
