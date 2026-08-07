import type { SupplierFunctionalAccountTypeCode } from '../supplier-functional-accounts/supplier-functional-account.policy.js';

export type SupplierWorkspaceModuleAvailability = 'AVAILABLE' | 'DEFERRED';
export type SupplierWorkspaceDeliveryStage = 'M1' | 'M2' | 'M3' | 'M5';

export interface SupplierWorkspaceModuleDefinition {
  readonly availability: SupplierWorkspaceModuleAvailability;
  readonly dataBoundary: string;
  readonly deliveryStage: SupplierWorkspaceDeliveryStage;
  readonly description: string;
  readonly label: string;
  readonly moduleKey: string;
  readonly sections: readonly string[];
}

const module = (
  value: SupplierWorkspaceModuleDefinition,
): SupplierWorkspaceModuleDefinition => Object.freeze(value);

const deferred = (
  moduleKey: string,
  label: string,
  description: string,
  deliveryStage: Exclude<SupplierWorkspaceDeliveryStage, 'M1'>,
  dataBoundary: string,
  sections: readonly string[],
) =>
  module({
    availability: 'DEFERRED',
    dataBoundary,
    deliveryStage,
    description,
    label,
    moduleKey,
    sections,
  });

export const SUPPLIER_WORKSPACE_PAGE_MODULES = Object.freeze({
  SUPPLIER_ACCOUNT_ADMIN: Object.freeze([
    module({
      moduleKey: 'profile',
      label: '主体资料',
      description: '查看本供应商主体、资质、地址与联系人摘要。',
      deliveryStage: 'M1',
      availability: 'AVAILABLE',
      dataBoundary: '只返回当前供应商主体白名单，不返回银行账号原文或其他供应商资料。',
      sections: ['主体状态', '资质摘要', '地址与联系人'],
    }),
    module({
      moduleKey: 'functional-accounts',
      label: '职能账号',
      description: '管理八类固定职能账号的邀请、状态和页面归属。',
      deliveryStage: 'M1',
      availability: 'AVAILABLE',
      dataBoundary: '只返回本供应商账号白名单，不返回凭证、自然人内部标识或会话令牌。',
      sections: ['账号列表与筛选', '邀请与停用', '固定页面归属'],
    }),
    module({
      moduleKey: 'login-events',
      label: '登录日志',
      description: '本供应商登录与账号切换审计视图在 P0-072 交付。',
      deliveryStage: 'M1',
      availability: 'DEFERRED',
      dataBoundary: '目录不返回原始 Cookie、会话摘要、完整设备指纹或明文登录凭证。',
      sections: ['登录记录', '账号切换记录', '风险时间线'],
    }),
  ]),
  SUPPLIER_PRODUCT: Object.freeze([
    deferred('product-drafts', '商品草稿', '商品图文、SKU 属性和分类模板在 M2 实现。', 'M2', '商品页面不请求或返回任何三类价格字段。', ['草稿列表', '资料详情', '版本时间线']),
    deferred('material-submissions', '资料上架提交', '资料审核提交、补正和记录在 M2 实现。', 'M2', '只处理本供应商商品资料，不得自行上架或读取价格。', ['待提交列表', '字段补正', '审核记录']),
    deferred('collection-flags', '集采标识', '统一商品资源的集采标识与企业规则在 M2 实现。', 'M2', '不创建供应商店铺，也不加载企业订单或结算数据。', ['标识列表', '起购规则', '变更记录']),
  ]),
  SUPPLIER_PRICING: Object.freeze([
    deferred('initial-prices', '首次上架三类价格', '初始价格提交公司价格审核在 M2 实现。', 'M2', '仅当前供应商价格职能可通过后续专用 DTO 查看本方三类价格。', ['待办列表', 'SKU 价格详情', '审核时间线']),
    deferred('supply-price-changes', '供应价变更申请', '已上架供应价变更审核与旧价保持在 M2 实现。', 'M2', '不能批准自己的供应价申请；目录接口不返回任何金额。', ['申请列表', '变更详情', '审核时间线']),
    deferred('sale-price-history', '销售价版本历史', '零售和集采销售价免审生效及追加留痕在 M2 实现。', 'M2', '销售价修改不改变供应价，也不暴露平台毛利。', ['当前价格', '定时生效', '版本记录']),
  ]),
  SUPPLIER_INVENTORY: Object.freeze([
    deferred('inventory-overview', '库存总览', '每 SKU 唯一库存余额与预警在 M2 实现。', 'M2', '只读取当前供应商库存，不返回供应价、应付或其他供应商数据。', ['SKU 列表', '库存预警', '状态摘要']),
    deferred('inventory-adjustments', '库存调整与盘点', '追加式调整、盘点和导入预检在 M2 实现。', 'M2', '不能覆盖历史或修改已预扣数量。', ['调整列表', '盘点详情', '流水时间线']),
    deferred('batch-expiry', '批次与效期', '批次效期和临期预警在 M2 实现。', 'M2', '仅当前供应商 SKU 数据，不加载价格审批或订单财务。', ['批次列表', '效期详情', '预警记录']),
  ]),
  SUPPLIER_FULFILLMENT: Object.freeze([
    deferred('fulfillment-suborders', '履约子单', '本供应商履约子单和备货节点在 M3 实现。', 'M3', '不返回其他供应商商品、客户完整支付结构、供应价或应付金额。', ['待确认列表', '子单详情', '节点时间线']),
    deferred('handover', '备货与移交', '确认、备货完成和移交在 M3 实现。', 'M3', '操作按状态机和版本校验，不能修改主订单财务。', ['备货列表', '移交详情', '操作记录']),
    deferred('exceptions', '履约异常', '报缺和异常上报在 M3 实现。', 'M3', '只处理本供应商子单，不可查看其他供应商履约。', ['异常列表', '处置详情', '平台反馈']),
  ]),
  SUPPLIER_AFTERSALES: Object.freeze([
    deferred('aftersales-cases', '售后协同', '本供应商责任相关售后协同在 M5 实现。', 'M5', '供应商不直接向用户退款或承诺平台赔付。', ['待响应列表', '工单详情', '处理时间线']),
    deferred('evidence', '凭证与补发安排', '意见、凭证和补发信息提交在 M5 实现。', 'M5', '联系方式按必要范围脱敏，不返回客户完整支付结构。', ['证据列表', '补发详情', '提交记录']),
    deferred('responsibility-appeals', '责任申诉', '供应商责任意见与申诉在 M5 实现。', 'M5', '不能修改公司责任结论或直接触发退款。', ['申诉列表', '责任详情', '复核时间线']),
  ]),
  SUPPLIER_FINANCE: Object.freeze([
    deferred('supplier-statements', '供应商账单', '按账期和供应价快照生成的不可覆盖账单在 M5 实现。', 'M5', '仅本供应商账单，不返回平台销售收入、用户余额、其他供应商或公司毛利。', ['账期列表', '账单详情', '确认时间线']),
    deferred('statement-disputes', '差异申诉', '账单明细差异申诉和公司复核在 M5 实现。', 'M5', '已确认账单不可覆盖，只能追加调整或冲正。', ['差异列表', '关联明细', '复核记录']),
    deferred('settlement-evidence', '线下结算留痕', '线下付款凭证和发票状态在 M5 实现。', 'M5', '不建设供应商钱包、提现或自动打款。', ['凭证列表', '发票状态', '结算时间线']),
  ]),
  SUPPLIER_AUDIT: Object.freeze([
    module({
      moduleKey: 'audit-events',
      label: '操作审计',
      description: '本供应商经授权的脱敏操作事件视图在 P0-072 交付。',
      deliveryStage: 'M1',
      availability: 'DEFERRED',
      dataBoundary: '只读且脱敏，不返回其他供应商、业务秘密或敏感原文。',
      sections: ['事件列表', '脱敏详情', '发生时间线'],
    }),
    module({
      moduleKey: 'login-events',
      label: '登录与账号活动',
      description: '登录、失败和账号选择审计在 P0-072 交付。',
      deliveryStage: 'M1',
      availability: 'DEFERRED',
      dataBoundary: '不返回凭证、原始 Cookie、完整设备指纹或自然人内部标识。',
      sections: ['登录记录', '账号切换记录', '风险时间线'],
    }),
    deferred('download-events', '下载记录', '受控导出和下载审计在 M5 实现。', 'M5', '不能从目录导出敏感字段或获取下载凭证。', ['导出申请', '复核详情', '下载时间线']),
  ]),
} satisfies Readonly<
  Record<SupplierFunctionalAccountTypeCode, readonly SupplierWorkspaceModuleDefinition[]>
>);

export const resolveSupplierWorkspaceModules = (
  accountTypeCode: SupplierFunctionalAccountTypeCode,
): readonly SupplierWorkspaceModuleDefinition[] =>
  SUPPLIER_WORKSPACE_PAGE_MODULES[accountTypeCode];
