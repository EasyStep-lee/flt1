import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Card, Result, Spin, Tag, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';

type CompanyWorkspace = components['schemas']['CompanyWorkspaceResponseDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const deferredStage: Record<string, string> = {
  COMPANY_SUPER_ADMIN: '账号与系统配置由后续 M1 页面完整性切片补齐',
  COMPANY_PRODUCT_OPS: '商品与分类业务内容在 M2 实现',
  COMPANY_PRICE_REVIEW: '价格审核业务内容在 M2 实现',
  COMPANY_ORDER_SERVICE: '订单与售后业务内容在 M3/M5 实现',
  COMPANY_WELFARE_CARD: '福利卡业务内容在 M3 实现',
  COMPANY_FINANCE: '财务与供应商结算业务内容在 M5 实现',
  COMPANY_LOGISTICS: '个人跑腿与企业配送业务内容在 M4 实现',
  COMPANY_CONTENT: '门户内容业务内容在 M5 实现',
};

const messageFrom = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

function FixedWorkspacePlaceholder({ workspace }: { readonly workspace: CompanyWorkspace }) {
  const menu = workspace.menuItems[0];
  return (
    <main
      className="supplier-ops-page"
      data-page-id={workspace.pageId}
      data-role={workspace.accountTypeCode}
    >
      <header className="admin-topbar">
        <div className="brand-mark">福</div>
        <div>
          <strong>福礼社 · 公司管理后台</strong>
          <span>江苏福礼团供应链科技有限公司</span>
        </div>
        <Tag color="cyan">{workspace.accountTypeName}</Tag>
      </header>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Typography.Text className="sidebar-label">当前独立页面</Typography.Text>
          <div className="active-menu" data-workspace-menu>
            {menu?.label}
          </div>
          <div className="boundary-note">
            <strong>{workspace.accountTypeCode}</strong>
            <span>会话仅允许当前固定路由，不合并其他职能菜单</span>
          </div>
        </aside>
        <section className="admin-content">
          <div className="page-title-row">
            <div>
              <Typography.Text className="eyebrow">FIXED FUNCTIONAL WORKSPACE</Typography.Text>
              <Typography.Title level={1}>{menu?.label}</Typography.Title>
              <Typography.Paragraph>
                当前职能工作区已隔离。此切片不提前伪造后续阶段的业务数据或操作。
              </Typography.Paragraph>
            </div>
          </div>
          <Card bordered={false}>
            <Alert
              description={
                deferredStage[workspace.accountTypeCode] ??
                '对应业务内容按阶段任务逐项实现'
              }
              message="固定工作区已就绪"
              showIcon
              type="info"
            />
          </Card>
        </section>
      </div>
    </main>
  );
}

export function CompanyWorkspaceGate({
  content,
  route,
}: {
  readonly content?: ReactNode;
  readonly route: string;
}) {
  const [workspace, setWorkspace] = useState<CompanyWorkspace>();
  const [state, setState] = useState<
    | { readonly kind: 'error' | 'offline' | 'permission'; readonly message: string }
    | undefined
  >();

  const load = async () => {
    setState(undefined);
    setWorkspace(undefined);
    try {
      const response = await api.GET('/v1/company-auth/workspace/current', {
        params: { query: { route } },
      });
      if (!response.data) {
        const permission =
          response.response.status === 401 || response.response.status === 403;
        setState({
          kind: permission ? 'permission' : 'error',
          message: messageFrom(response.error, '工作区暂时无法加载'),
        });
        return;
      }
      if (response.data.workspaceRoute !== route) {
        setState({ kind: 'permission', message: '无权访问该职能页面' });
        return;
      }
      setWorkspace(response.data);
    } catch {
      setState({ kind: 'offline', message: '网络离线或请求超时，请恢复后重试' });
    }
  };

  useEffect(() => {
    void load();
  }, [route]);

  if (state?.kind === 'permission') {
    return (
      <main className="company-auth-page" data-workspace-state="permission-denied">
        <Result
          extra={<Button href="/company-admin/account-select">返回职能选择</Button>}
          status="403"
          subTitle={state.message}
          title={<Typography.Title level={1}>无权访问该职能页面</Typography.Title>}
        />
      </main>
    );
  }
  if (state) {
    return (
      <main className="company-auth-page" data-workspace-state={state.kind}>
        <Result
          extra={<Button onClick={() => void load()}>重新加载</Button>}
          status="error"
          subTitle={state.message}
          title={state.kind === 'offline' ? '网络连接不可用' : '工作区加载失败'}
        />
      </main>
    );
  }
  if (!workspace) {
    return (
      <main className="company-auth-page" data-workspace-state="loading">
        <Spin size="large" tip="正在验证固定职能会话" />
      </main>
    );
  }
  return content ?? <FixedWorkspacePlaceholder workspace={workspace} />;
}
