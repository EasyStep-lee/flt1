export const COMPANY_WORKSPACES = Object.freeze([
  {
    accountTypeCode: 'COMPANY_SUPER_ADMIN',
    accountTypeName: '超级管理员',
    menuLabel: '系统与账号',
    pageId: 'PAGE-003',
    workspaceRoute: '/company-admin/workspaces/system',
  },
  {
    accountTypeCode: 'COMPANY_SUPPLIER_OPS',
    accountTypeName: '供应商运营',
    menuLabel: '供应商运营',
    pageId: 'PAGE-004',
    workspaceRoute: '/company-admin/workspaces/supplier-ops',
  },
  {
    accountTypeCode: 'COMPANY_PRODUCT_OPS',
    accountTypeName: '商品与分类运营',
    menuLabel: '商品与分类',
    pageId: 'PAGE-005',
    workspaceRoute: '/company-admin/workspaces/product-ops',
  },
  {
    accountTypeCode: 'COMPANY_PRICE_REVIEW',
    accountTypeName: '采购/价格审核',
    menuLabel: '价格审核',
    pageId: 'PAGE-006',
    workspaceRoute: '/company-admin/workspaces/price-review',
  },
  {
    accountTypeCode: 'COMPANY_ORDER_SERVICE',
    accountTypeName: '订单客服',
    menuLabel: '订单客服',
    pageId: 'PAGE-007',
    workspaceRoute: '/company-admin/workspaces/order-service',
  },
  {
    accountTypeCode: 'COMPANY_WELFARE_CARD',
    accountTypeName: '福利卡运营',
    menuLabel: '福利卡运营',
    pageId: 'PAGE-008',
    workspaceRoute: '/company-admin/workspaces/welfare-card',
  },
  {
    accountTypeCode: 'COMPANY_FINANCE',
    accountTypeName: '财务结算',
    menuLabel: '财务结算',
    pageId: 'PAGE-009',
    workspaceRoute: '/company-admin/workspaces/finance',
  },
  {
    accountTypeCode: 'COMPANY_LOGISTICS',
    accountTypeName: '物流运营',
    menuLabel: '物流中心',
    pageId: 'PAGE-010',
    workspaceRoute: '/company-admin/workspaces/logistics',
  },
  {
    accountTypeCode: 'COMPANY_CONTENT',
    accountTypeName: '门户内容编辑',
    menuLabel: '门户内容',
    pageId: 'PAGE-011',
    workspaceRoute: '/company-admin/workspaces/content',
  },
  {
    accountTypeCode: 'COMPANY_AUDIT',
    accountTypeName: '审计/只读',
    menuLabel: '审计风控',
    pageId: 'PAGE-012',
    workspaceRoute: '/company-admin/workspaces/audit',
  },
] as const);

export type CompanyAccountTypeCode =
  (typeof COMPANY_WORKSPACES)[number]['accountTypeCode'];

export const resolveCompanyWorkspace = (accountTypeCode: string) =>
  COMPANY_WORKSPACES.find(
    (workspace) => workspace.accountTypeCode === accountTypeCode,
  );
