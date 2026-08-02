import { Alert, Space, Tag, Typography } from 'antd';
import { ShellFrame } from '@fulishe/ui';

import { supplierSessionBoundary } from './session-boundary.js';

export function SupplierPortalShell() {
  const currentPath = window.location.pathname;

  return (
    <ShellFrame
      audience="供应商固定职能账号"
      boundary="本供应商、单职能 workspaceRoute 与独立会话"
      shellId="supplier-portal-shell"
      title="供应商管理后台"
    >
      <Space direction="vertical" size="middle" style={{ marginTop: 24, width: '100%' }}>
        <Alert
          message="壳层已就绪"
          description="注册、登录、商品、价格、库存、履约、财务等业务页面尚未实现。"
          showIcon
          type="info"
        />
        <Typography.Text>
          当前路径：<Typography.Text code>{currentPath}</Typography.Text>
        </Typography.Text>
        <Space wrap>
          <Tag color="cyan">{supplierSessionBoundary.registerRoute}</Tag>
          <Tag color="geekblue">{supplierSessionBoundary.loginRoute}</Tag>
          <Tag color="volcano">本供应商单职能会话</Tag>
        </Space>
      </Space>
    </ShellFrame>
  );
}
