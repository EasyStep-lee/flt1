import type { CompanyAccountTypeCode } from './company-workspace.policy.js';

export type CompanyWorkspaceModuleAvailability = 'AVAILABLE' | 'DEFERRED';
export type CompanyWorkspaceDeliveryStage = 'M1' | 'M2' | 'M3' | 'M4' | 'M5';

export interface CompanyWorkspaceModuleDefinition {
  readonly availability: CompanyWorkspaceModuleAvailability;
  readonly dataBoundary: string;
  readonly deliveryStage: CompanyWorkspaceDeliveryStage;
  readonly description: string;
  readonly label: string;
  readonly moduleKey: string;
  readonly sections: readonly string[];
}

const module = (
  value: CompanyWorkspaceModuleDefinition,
): CompanyWorkspaceModuleDefinition => Object.freeze(value);

export const COMPANY_WORKSPACE_PAGE_MODULES = Object.freeze({
  COMPANY_SUPER_ADMIN: Object.freeze([
    module({
      moduleKey: 'functional-accounts',
      label: '公司职能账号',
      description: '管理固定职能账号邀请、状态与页面归属。',
      deliveryStage: 'M1',
      availability: 'AVAILABLE',
      dataBoundary: '仅唯一公司内的职能账号白名单，不返回凭证或自然人内部标识。',
      sections: ['账号列表与筛选', '账号详情', '状态与操作记录'],
    }),
    module({
      moduleKey: 'session-control',
      label: '公司职能会话',
      description: '查看单职能会话边界与会话撤销能力。',
      deliveryStage: 'M1',
      availability: 'AVAILABLE',
      dataBoundary: '仅展示会话状态摘要，原始 Cookie 和会话摘要永不返回。',
      sections: ['会话状态', '固定页面归属', '撤销记录'],
    }),
    module({
      moduleKey: 'system-parameters',
      label: '系统参数与应急开关',
      description: '高风险参数和限时应急权限按后续安全切片交付。',
      deliveryStage: 'M1',
      availability: 'DEFERRED',
      dataBoundary: '不返回秘密值，不允许用页面目录绕过二次验证或独立复核。',
      sections: ['参数目录', '应急权限', '变更时间线'],
    }),
  ]),
  COMPANY_SUPPLIER_OPS: Object.freeze([
    module({
      moduleKey: 'onboarding-review',
      label: '供应商入驻审核',
      description: '处理申请、补正和通过后的主体启用。',
      deliveryStage: 'M1',
      availability: 'AVAILABLE',
      dataBoundary: '唯一公司下供应商主体与资质摘要，不包含结算明细。',
      sections: ['入驻列表与筛选', '资质详情', '审核时间线'],
    }),
    module({
      moduleKey: 'supplier-profiles',
      label: '供应商档案',
      description: '查看供应商主体、状态和资质摘要。',
      deliveryStage: 'M1',
      availability: 'AVAILABLE',
      dataBoundary: '只返回供应商运营职能允许的主体白名单字段。',
      sections: ['主体概览', '资质摘要', '状态记录'],
    }),
    module({
      moduleKey: 'qualification-alerts',
      label: '资质预警',
      description: '资质到期规则和通知在后续准入完善切片交付。',
      deliveryStage: 'M1',
      availability: 'DEFERRED',
      dataBoundary: '不展示银行账户、供应商应付或其他职能数据。',
      sections: ['预警列表', '资质详情', '提醒记录'],
    }),
  ]),
  COMPANY_PRODUCT_OPS: Object.freeze([
    module({
      moduleKey: 'category-templates',
      label: '分类与模板',
      description: '分类树和版本化模板在 M2 实现。',
      deliveryStage: 'M2',
      availability: 'DEFERRED',
      dataBoundary: '只规划公开展示字段，不加载内部采购数据。',
      sections: ['分类列表', '模板详情', '版本时间线'],
    }),
    module({
      moduleKey: 'product-material-review',
      label: '商品资料审核',
      description: '商品图文、资质和 SKU 属性资料审核在 M2 实现。',
      deliveryStage: 'M2',
      availability: 'DEFERRED',
      dataBoundary: '商品资料页面不请求内部采购价格。',
      sections: ['待审列表', '资料详情', '审核意见时间线'],
    }),
    module({
      moduleKey: 'enterprise-shelf',
      label: '企业采购货架',
      description: '集采标识与企业货架治理在 M2 实现。',
      deliveryStage: 'M2',
      availability: 'DEFERRED',
      dataBoundary: '仅使用统一商品资源和公开销售字段。',
      sections: ['货架列表', '渠道详情', '上下架记录'],
    }),
  ]),
  COMPANY_PRICE_REVIEW: Object.freeze([
    module({
      moduleKey: 'initial-price-review',
      label: '初始价格审核',
      description: '首次上架三类价格的独立审核在 M2 实现。',
      deliveryStage: 'M2',
      availability: 'DEFERRED',
      dataBoundary: 'M1 只返回页面能力目录，不返回任何价格业务数据。',
      sections: ['申请列表', '差异详情', '审核时间线'],
    }),
    module({
      moduleKey: 'supply-price-change-review',
      label: '供货价格变更审核',
      description: '上架后供货价格变更审核在 M2 实现。',
      deliveryStage: 'M2',
      availability: 'DEFERRED',
      dataBoundary: '页面目录不含金额；后续专用 DTO 才能按权限返回价格字段。',
      sections: ['变更申请', '原值与申请值', '生效与意见记录'],
    }),
    module({
      moduleKey: 'price-history',
      label: '价格版本历史',
      description: '三类价格的追加式版本历史在 M2 实现。',
      deliveryStage: 'M2',
      availability: 'DEFERRED',
      dataBoundary: '不允许通过目录接口推算采购成本或内部毛利。',
      sections: ['版本列表', '版本详情', '生效时间线'],
    }),
  ]),
  COMPANY_ORDER_SERVICE: Object.freeze([
    module({
      moduleKey: 'personal-orders',
      label: '个人订单',
      description: '个人主订单和按供应商履约子单在 M3 实现。',
      deliveryStage: 'M3',
      availability: 'DEFERRED',
      dataBoundary: '不返回内部采购成本、供应商应付或毛利。',
      sections: ['订单列表', '订单详情', '履约时间线'],
    }),
    module({
      moduleKey: 'enterprise-orders',
      label: '企业订单',
      description: '跨供应商企业主订单在 M3 实现。',
      deliveryStage: 'M3',
      availability: 'DEFERRED',
      dataBoundary: '只展示公司对客订单字段，企业配送不进入跑腿大厅。',
      sections: ['企业订单列表', '主订单详情', '收货时间线'],
    }),
    module({
      moduleKey: 'refund-initiation',
      label: '退款执行',
      description: '按已批准授权和原支付分配快照发起退款。',
      deliveryStage: 'M3',
      availability: 'AVAILABLE',
      dataBoundary: '只展示退款状态和渠道金额摘要，不返回原福利卡账户、微信交易号、供应价或结算信息。',
      sections: ['已批准退款', '原结构金额摘要', '退款状态时间线'],
    }),
    module({
      moduleKey: 'after-sales-cases',
      label: '售后工单',
      description: '公司统一售后受理与责任协同在 M5 实现。',
      deliveryStage: 'M5',
      availability: 'DEFERRED',
      dataBoundary: '对客备注与内部备注隔离，禁止展示内部采购信息。',
      sections: ['工单列表', '证据详情', '处理时间线'],
    }),
  ]),
  COMPANY_WELFARE_CARD: Object.freeze([
    module({
      moduleKey: 'welfare-plans',
      label: '福利卡计划',
      description: '维护公司福利卡计划、固定资金来源与适用范围。',
      deliveryStage: 'M3',
      availability: 'AVAILABLE',
      dataBoundary: '不创建个人现金充值能力或未来占位。',
      sections: ['计划列表', '计划详情', '版本记录'],
    }),
    module({
      moduleKey: 'card-batches',
      label: '福利卡批次',
      description: '创建金额守恒的草稿批次；真实发放须通过后续合规门禁。',
      deliveryStage: 'M3',
      availability: 'AVAILABLE',
      dataBoundary: '卡密、账户和发放名单不通过页面目录返回。',
      sections: ['批次列表', '批次详情', '发放进度'],
    }),
    module({
      moduleKey: 'account-ledger',
      label: '账户与追加式账本',
      description: '账户选择、余额与只追加账本在 M3 实现。',
      deliveryStage: 'M3',
      availability: 'DEFERRED',
      dataBoundary: '不返回账户余额或账本业务记录，禁止直接改余额。',
      sections: ['账户列表', '账本详情', '冲正时间线'],
    }),
  ]),
  COMPANY_FINANCE: Object.freeze([
    module({
      moduleKey: 'payment-reconciliation',
      label: '收款对账',
      description: '公司微信支付与平台记录核对在 M3/M5 实现。',
      deliveryStage: 'M3',
      availability: 'DEFERRED',
      dataBoundary: 'M1 页面目录不返回支付金额、交易号或凭证。',
      sections: ['对账列表', '差异详情', '处理时间线'],
    }),
    module({
      moduleKey: 'refund-review',
      label: '退款复核',
      description: '按原支付结构退款与独立复核在 M3/M5 实现。',
      deliveryStage: 'M3',
      availability: 'DEFERRED',
      dataBoundary: '不返回资金分配、福利卡余额或外部支付秘密。',
      sections: ['退款列表', '原结构详情', '复核时间线'],
    }),
    module({
      moduleKey: 'supplier-statements',
      label: '供应商账单与线下结算',
      description: '不可覆盖账单、差异申诉和线下结算留痕在 M5 实现。',
      deliveryStage: 'M5',
      availability: 'DEFERRED',
      dataBoundary: '目录不返回账单金额、采购价格、银行账户或付款凭证。',
      sections: ['账单列表', '差异详情', '线下结算记录'],
    }),
  ]),
  COMPANY_LOGISTICS: Object.freeze([
    module({
      moduleKey: 'runner-operations',
      label: '跑腿员运营',
      description: '跑腿员准入、上线与任务监控在 M4 实现。',
      deliveryStage: 'M4',
      availability: 'DEFERRED',
      dataBoundary: '只处理个人配送；地址与联系方式按履约阶段最小化。',
      sections: ['跑腿员列表', '审核详情', '状态时间线'],
    }),
    module({
      moduleKey: 'personal-deliveries',
      label: '个人跑腿任务',
      description: '个人履约子单跑腿任务在 M4 实现。',
      deliveryStage: 'M4',
      availability: 'DEFERRED',
      dataBoundary: '不展示采购价格、供应商应付或企业采购配送。',
      sections: ['任务列表', '取送详情', '节点时间线'],
    }),
    module({
      moduleKey: 'enterprise-deliveries',
      label: '企业统一配送',
      description: '公司汇总、人工派车和签收在 M4 实现。',
      deliveryStage: 'M4',
      availability: 'DEFERRED',
      dataBoundary: '企业配送与个人跑腿大厅严格隔离。',
      sections: ['配送单列表', '派车详情', '签收时间线'],
    }),
  ]),
  COMPANY_CONTENT: Object.freeze([
    module({
      moduleKey: 'content-tree',
      label: '门户内容树',
      description: '门户页面、新闻、案例和帮助内容在 M5 实现。',
      deliveryStage: 'M5',
      availability: 'DEFERRED',
      dataBoundary: '不加载交易、订单、采购价格或供应商账单。',
      sections: ['内容列表', '内容详情', '版本记录'],
    }),
    module({
      moduleKey: 'content-preview',
      label: '内容预览与差异',
      description: '草稿预览、审核差异和 noindex 边界在 M5 实现。',
      deliveryStage: 'M5',
      availability: 'DEFERRED',
      dataBoundary: '未发布和预览内容不得进入公共缓存或搜索索引。',
      sections: ['草稿列表', '差异详情', '审核时间线'],
    }),
    module({
      moduleKey: 'publication-history',
      label: '发布与下线记录',
      description: '版本化发布、下线和回滚在 M5 实现。',
      deliveryStage: 'M5',
      availability: 'DEFERRED',
      dataBoundary: '只记录内容版本和发布状态，不包含交易业务数据。',
      sections: ['发布列表', '版本详情', '操作时间线'],
    }),
  ]),
  COMPANY_AUDIT: Object.freeze([
    module({
      moduleKey: 'audit-events',
      label: '敏感操作审计',
      description: '检索不可变、已脱敏的操作事件。',
      deliveryStage: 'M1',
      availability: 'AVAILABLE',
      dataBoundary: '只返回审计职能白名单字段，不提供业务写操作。',
      sections: ['事件列表与筛选', '脱敏详情', '发生时间线'],
    }),
    module({
      moduleKey: 'login-events',
      label: '登录与账号选择记录',
      description: '登录、失败和职能选择的完整审计视图在 P0-072 交付。',
      deliveryStage: 'M1',
      availability: 'DEFERRED',
      dataBoundary: '不返回登录凭证、会话令牌、完整设备指纹或明文账号。',
      sections: ['登录记录', '风险详情', '会话时间线'],
    }),
    module({
      moduleKey: 'sensitive-exports',
      label: '敏感导出记录',
      description: '受控导出申请、独立复核和下载审计在 M5 实现。',
      deliveryStage: 'M5',
      availability: 'DEFERRED',
      dataBoundary: '目录接口不返回导出内容、下载凭证或敏感原文。',
      sections: ['导出申请', '复核详情', '下载时间线'],
    }),
  ]),
} satisfies Readonly<
  Record<CompanyAccountTypeCode, readonly CompanyWorkspaceModuleDefinition[]>
>);

export const resolveCompanyWorkspaceModules = (
  accountTypeCode: CompanyAccountTypeCode,
): readonly CompanyWorkspaceModuleDefinition[] =>
  COMPANY_WORKSPACE_PAGE_MODULES[accountTypeCode];
