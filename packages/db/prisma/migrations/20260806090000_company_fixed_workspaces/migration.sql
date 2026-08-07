-- M1-P067: immutable allowlist for the ten independent company functional workspaces.
INSERT INTO `functional_account_type`
  (`id`, `owner_type`, `code`, `name`, `workspace_route`, `internal_menu_schema`, `status`, `updated_at`)
VALUES
  ('10000000-0000-4000-8000-000000000009', 'COMPANY', 'COMPANY_SUPER_ADMIN', '超级管理员', '/company-admin/workspaces/system', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000010', 'COMPANY', 'COMPANY_SUPPLIER_OPS', '供应商运营', '/company-admin/workspaces/supplier-ops', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000011', 'COMPANY', 'COMPANY_PRODUCT_OPS', '商品与分类运营', '/company-admin/workspaces/product-ops', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000012', 'COMPANY', 'COMPANY_PRICE_REVIEW', '采购/价格审核', '/company-admin/workspaces/price-review', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000013', 'COMPANY', 'COMPANY_ORDER_SERVICE', '订单客服', '/company-admin/workspaces/order-service', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000014', 'COMPANY', 'COMPANY_WELFARE_CARD', '福利卡运营', '/company-admin/workspaces/welfare-card', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000015', 'COMPANY', 'COMPANY_FINANCE', '财务结算', '/company-admin/workspaces/finance', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000016', 'COMPANY', 'COMPANY_LOGISTICS', '物流运营', '/company-admin/workspaces/logistics', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000017', 'COMPANY', 'COMPANY_CONTENT', '门户内容编辑', '/company-admin/workspaces/content', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000018', 'COMPANY', 'COMPANY_AUDIT', '审计/只读', '/company-admin/workspaces/audit', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('workspace')), 'ACTIVE', CURRENT_TIMESTAMP(3));
