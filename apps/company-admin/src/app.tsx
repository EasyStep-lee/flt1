import { Alert, Space, Tag, Typography } from 'antd';
import { ShellFrame } from '@fulishe/ui';

import { companySessionBoundary } from './session-boundary.js';

export function CompanyAdminShell() {
  const currentPath = window.location.pathname;

  return (
    <ShellFrame
      audience="公司固定职能账号"
      boundary="独立登录、职能账号选择与单一 workspaceRoute 会话"
      shellId="company-admin-shell"
      title="公司管理后台"
    >
      <Space direction="vertical" size="middle" style={{ marginTop: 24, width: '100%' }}>
        <Alert
          message="壳层已就绪"
          description="账号、权限、审核和业务工作台尚未实现，后续任务必须按职能独立建设。"
          showIcon
          type="info"
        />
        <Typography.Text>
          当前路径：<Typography.Text code>{currentPath}</Typography.Text>
        </Typography.Text>
        <Space wrap>
          <Tag color="cyan">{companySessionBoundary.loginRoute}</Tag>
          <Tag color="geekblue">{companySessionBoundary.accountSelectRoute}</Tag>
          <Tag color="volcano">单职能会话</Tag>
        </Space>
      </Space>
    </ShellFrame>
  );
}
