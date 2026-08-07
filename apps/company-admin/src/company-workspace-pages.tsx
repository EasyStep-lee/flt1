import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Result,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';

export type CompanyWorkspace = components['schemas']['CompanyWorkspaceResponseDto'];
type CompanyWorkspacePage =
  components['schemas']['CompanyWorkspacePageResponseDto'];
type CompanyWorkspaceModule =
  components['schemas']['CompanyWorkspaceModuleItemDto'];
type CompanyWorkspaceModuleDetail =
  components['schemas']['CompanyWorkspaceModuleDetailDto'];
type WorkspaceAvailability = CompanyWorkspacePage['filters']['availability'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const messageFrom = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

const availabilityMeta = {
  AVAILABLE: { color: 'success', label: '当前可用' },
  DEFERRED: { color: 'default', label: '按阶段交付' },
} as const;

export function CompanyWorkspacePagePanel({
  workspace,
}: {
  readonly workspace: CompanyWorkspace;
}) {
  const [keyword, setKeyword] = useState('');
  const [availability, setAvailability] =
    useState<WorkspaceAvailability>('ALL');
  const [data, setData] = useState<CompanyWorkspacePage>();
  const [selected, setSelected] = useState<CompanyWorkspaceModuleDetail>();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<
    | {
        readonly kind: 'error' | 'offline-or-timeout' | 'permission-denied';
        readonly message: string;
      }
    | undefined
  >();

  const load = useCallback(
    async ({
      availabilityValue,
      keywordValue,
      moduleKey,
    }: {
      readonly availabilityValue: WorkspaceAvailability;
      readonly keywordValue: string;
      readonly moduleKey?: string;
    }) => {
      setLoading(true);
      setState(undefined);
      try {
        const response = await api.GET('/v1/company-auth/workspace/page', {
          params: {
            query: {
              route: workspace.workspaceRoute,
              ...(keywordValue.trim() ? { keyword: keywordValue.trim() } : {}),
              ...(availabilityValue !== 'ALL'
                ? { availability: availabilityValue }
                : {}),
              ...(moduleKey ? { moduleKey } : {}),
            },
          },
        });
        if (!response.data) {
          const permission =
            response.response.status === 401 || response.response.status === 403;
          setState({
            kind: permission ? 'permission-denied' : 'error',
            message: messageFrom(response.error, '职能页面模块暂时无法加载'),
          });
          setData(undefined);
          setSelected(undefined);
          return;
        }
        if (
          response.data.workspaceRoute !== workspace.workspaceRoute ||
          response.data.accountTypeCode !== workspace.accountTypeCode ||
          response.data.pageId !== workspace.pageId
        ) {
          setState({
            kind: 'permission-denied',
            message: '服务端返回的职能页面上下文不一致',
          });
          setData(undefined);
          setSelected(undefined);
          return;
        }
        setData(response.data);
        setSelected(response.data.selectedModule ?? undefined);
      } catch {
        setState({
          kind: 'offline-or-timeout',
          message: '网络离线或请求超时，请恢复后重试',
        });
        setData(undefined);
        setSelected(undefined);
      } finally {
        setLoading(false);
      }
    },
    [workspace.accountTypeCode, workspace.pageId, workspace.workspaceRoute],
  );

  useEffect(() => {
    setKeyword('');
    setAvailability('ALL');
    setData(undefined);
    setSelected(undefined);
    void load({ availabilityValue: 'ALL', keywordValue: '' });
  }, [load]);

  const reload = () =>
    load({ availabilityValue: availability, keywordValue: keyword });

  if (!data && loading) {
    return (
      <Card
        className="workspace-completeness-card"
        data-workspace-completeness
        data-workspace-page-state="loading"
        data-workspace-role={workspace.accountTypeCode}
      >
        <Spin size="large" tip="正在加载当前职能工作台" />
      </Card>
    );
  }

  if (state) {
    return (
      <Card
        className="workspace-completeness-card"
        data-workspace-completeness
        data-workspace-page-state={state.kind}
        data-workspace-role={workspace.accountTypeCode}
      >
        <Result
          extra={<Button onClick={() => void reload()}>重新加载</Button>}
          status={state.kind === 'permission-denied' ? '403' : 'error'}
          subTitle={state.message}
          title={
            state.kind === 'permission-denied'
              ? '无权访问页面模块'
              : state.kind === 'offline-or-timeout'
                ? '网络连接不可用'
                : '职能工作台加载失败'
          }
        />
      </Card>
    );
  }

  if (!data) return null;

  const columns = [
    {
      title: '内部模块',
      dataIndex: 'label',
      key: 'label',
      render: (_value: string, row: CompanyWorkspaceModule) => (
        <div className="workspace-module-name" data-workspace-module={row.moduleKey}>
          <strong>{row.label}</strong>
          <span>{row.description}</span>
        </div>
      ),
    },
    {
      title: '交付阶段',
      dataIndex: 'deliveryStage',
      key: 'deliveryStage',
      render: (value: string) => <Tag color="cyan">{value}</Tag>,
    },
    {
      title: '当前状态',
      dataIndex: 'availability',
      key: 'availability',
      render: (value: CompanyWorkspaceModule['availability']) => (
        <Tag color={availabilityMeta[value].color}>
          {availabilityMeta[value].label}
        </Tag>
      ),
    },
    {
      title: '数据边界',
      dataIndex: 'dataBoundary',
      key: 'dataBoundary',
    },
    {
      title: '详情',
      key: 'detail',
      render: (_value: unknown, row: CompanyWorkspaceModule) => (
        <Button
          onClick={() =>
            void load({
              availabilityValue: availability,
              keywordValue: keyword,
              moduleKey: row.moduleKey,
            })
          }
          type="link"
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <section
      className="workspace-completeness"
      data-workspace-completeness
      data-workspace-page-state={data.items.length === 0 ? 'empty' : 'success'}
      data-workspace-role={workspace.accountTypeCode}
    >
      <div className="workspace-section-heading">
        <div>
          <Typography.Text className="eyebrow">ROLE-SCOPED PAGE CATALOG</Typography.Text>
          <Typography.Title level={2}>职能工作台</Typography.Title>
          <Typography.Paragraph>
            目录由当前单职能会话在服务端确定；后续阶段业务仅标记交付边界，不生成虚假数据。
          </Typography.Paragraph>
        </div>
        <Button onClick={() => void reload()}>刷新工作台</Button>
      </div>

      <div className="workspace-metric-grid">
        <Card bordered={false}>
          <Statistic title="内部模块" value={data.summary.catalogTotal} />
        </Card>
        <Card bordered={false}>
          <Statistic title="当前可用" value={data.summary.availableTotal} />
        </Card>
        <Card bordered={false}>
          <Statistic title="按阶段交付" value={data.summary.deferredTotal} />
        </Card>
        <Card bordered={false}>
          <Statistic title="筛选结果" value={data.summary.filteredTotal} />
        </Card>
      </div>

      <Card className="workspace-module-card" bordered={false}>
        <div className="workspace-module-toolbar">
          <Input.Search
            allowClear
            aria-label="搜索当前职能模块"
            onSearch={(value) => {
              setKeyword(value);
              void load({ availabilityValue: availability, keywordValue: value });
            }}
            placeholder="模块名称或页面能力"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select<WorkspaceAvailability>
            aria-label="模块交付状态"
            onChange={(value) => {
              setAvailability(value);
              void load({ availabilityValue: value, keywordValue: keyword });
            }}
            options={[
              { label: '全部状态', value: 'ALL' },
              { label: '当前可用', value: 'AVAILABLE' },
              { label: '按阶段交付', value: 'DEFERRED' },
            ]}
            value={availability}
          />
        </div>
        <Table<CompanyWorkspaceModule>
          columns={columns}
          dataSource={data.items}
          loading={loading}
          locale={{ emptyText: <Empty description="当前筛选没有职能模块" /> }}
          pagination={false}
          rowKey="moduleKey"
          scroll={{ x: 960 }}
        />
      </Card>

      <Drawer
        aria-label="模块详情与交付时间线"
        onClose={() => setSelected(undefined)}
        open={Boolean(selected)}
        size="large"
        title="模块详情与交付时间线"
      >
        {selected ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions
              bordered
              column={1}
              items={[
                { key: 'name', label: '模块', children: selected.label },
                {
                  key: 'availability',
                  label: '状态',
                  children: availabilityMeta[selected.availability].label,
                },
                { key: 'stage', label: '交付阶段', children: selected.deliveryStage },
                { key: 'boundary', label: '数据边界', children: selected.dataBoundary },
              ]}
            />
            <div>
              <Typography.Title level={4}>内部区块</Typography.Title>
              <Space wrap>
                {selected.sections.map((section) => (
                  <Tag key={section}>{section}</Tag>
                ))}
              </Space>
            </div>
            <div>
              <Typography.Title level={4}>交付时间线</Typography.Title>
              <Timeline
                items={selected.timeline.map((event) => ({
                  children: `${event.stage} · ${event.label}`,
                  color: event.status === 'DONE' ? 'green' : 'gray',
                }))}
              />
            </div>
          </Space>
        ) : null}
      </Drawer>
    </section>
  );
}

function FixedWorkspacePage({ workspace }: { readonly workspace: CompanyWorkspace }) {
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
        <Button href="/company-admin/account-select" ghost>
          切换职能
        </Button>
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
                当前页面只加载本职能模块目录；后续阶段业务能力保持明确的未交付状态。
              </Typography.Paragraph>
            </div>
          </div>
          <CompanyWorkspacePagePanel workspace={workspace} />
        </section>
      </div>
    </main>
  );
}

export function CompanyWorkspaceGate({
  content,
  route,
}: {
  readonly content?: ((workspace: CompanyWorkspace) => ReactNode) | undefined;
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
  return content ? content(workspace) : <FixedWorkspacePage workspace={workspace} />;
}
