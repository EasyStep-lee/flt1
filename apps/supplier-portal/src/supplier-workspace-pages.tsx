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

import { createSupplierPortalApiClient } from './api-client.js';

export type SupplierWorkspace =
  components['schemas']['SupplierWorkspaceResponseDto'];
type SupplierWorkspacePage =
  components['schemas']['SupplierWorkspacePageResponseDto'];
type SupplierWorkspaceModule =
  components['schemas']['SupplierWorkspaceModuleItemDto'];
type SupplierWorkspaceModuleDetail =
  components['schemas']['SupplierWorkspaceModuleDetailDto'];
type WorkspaceAvailability = SupplierWorkspacePage['filters']['availability'];

const api = createSupplierPortalApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

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

export function SupplierWorkspacePagePanel({
  workspace,
}: {
  readonly workspace: SupplierWorkspace;
}) {
  const [keyword, setKeyword] = useState('');
  const [availability, setAvailability] =
    useState<WorkspaceAvailability>('ALL');
  const [data, setData] = useState<SupplierWorkspacePage>();
  const [selected, setSelected] = useState<SupplierWorkspaceModuleDetail>();
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
        const response = await api.GET('/v1/supplier-auth/workspace/page', {
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
            message: '服务端返回的供应商职能页面上下文不一致',
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
        data-supplier-workspace-page
        data-supplier-workspace-state="loading"
        data-workspace-role={workspace.accountTypeCode}
      >
        <Spin size="large" tip="正在加载当前供应商职能工作台" />
      </Card>
    );
  }

  if (state) {
    return (
      <Card
        data-supplier-workspace-page
        data-supplier-workspace-state={state.kind}
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
      render: (_value: string, row: SupplierWorkspaceModule) => (
        <div data-supplier-workspace-module={row.moduleKey}>
          <strong>{row.label}</strong>
          <div>{row.description}</div>
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
      render: (value: SupplierWorkspaceModule['availability']) => (
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
      render: (_value: unknown, row: SupplierWorkspaceModule) => (
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
      className="supplier-workspace-page"
      data-supplier-workspace-page
      data-supplier-workspace-state={data.items.length === 0 ? 'empty' : 'success'}
      data-workspace-role={workspace.accountTypeCode}
    >
      <div className="supplier-workspace-heading">
        <div>
          <Typography.Text className="eyebrow">ROLE-SCOPED PAGE CATALOG</Typography.Text>
          <Typography.Title level={2}>职能工作台</Typography.Title>
          <Typography.Paragraph>
            目录由当前单职能会话在服务端确定；后续阶段业务明确标记未交付，不生成虚假记录。
          </Typography.Paragraph>
        </div>
        <Button onClick={() => void reload()}>刷新工作台</Button>
      </div>

      <div className="supplier-workspace-metrics">
        <Card bordered={false}><Statistic title="内部模块" value={data.summary.catalogTotal} /></Card>
        <Card bordered={false}><Statistic title="当前可用" value={data.summary.availableTotal} /></Card>
        <Card bordered={false}><Statistic title="按阶段交付" value={data.summary.deferredTotal} /></Card>
        <Card bordered={false}><Statistic title="筛选结果" value={data.summary.filteredTotal} /></Card>
      </div>

      <Card bordered={false} className="supplier-workspace-catalog">
        <div className="supplier-workspace-toolbar">
          <Input.Search
            allowClear
            aria-label="搜索当前供应商职能模块"
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => {
              setKeyword(value);
              void load({ availabilityValue: availability, keywordValue: value });
            }}
            placeholder="模块名称或页面能力"
            value={keyword}
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
        <Table<SupplierWorkspaceModule>
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
        aria-label="供应商职能模块详情与交付时间线"
        onClose={() => setSelected(undefined)}
        open={Boolean(selected)}
        size="large"
        title="供应商职能模块详情与交付时间线"
      >
        {selected ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions
              bordered
              column={1}
              items={[
                { key: 'name', label: '模块', children: selected.label },
                { key: 'availability', label: '状态', children: availabilityMeta[selected.availability].label },
                { key: 'stage', label: '交付阶段', children: selected.deliveryStage },
                { key: 'boundary', label: '数据边界', children: selected.dataBoundary },
              ]}
            />
            <div>
              <Typography.Title level={4}>内部区块</Typography.Title>
              <Space wrap>
                {selected.sections.map((section) => <Tag key={section}>{section}</Tag>)}
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

function FixedSupplierWorkspacePage({
  workspace,
}: {
  readonly workspace: SupplierWorkspace;
}) {
  const menu = workspace.menuItems[0];
  return (
    <main
      className="supplier-fixed-workspace"
      data-page-id={workspace.pageId}
      data-role={workspace.accountTypeCode}
    >
      <header className="brand-header">
        <div className="brand-mark">福</div>
        <div>
          <strong>福礼社 · 供应商后台</strong>
          <span>当前供应商 · 当前单一职能页面</span>
        </div>
        <Button href="/supplier/account-select">切换职能</Button>
        <Tag color="cyan">{workspace.accountTypeName}</Tag>
      </header>
      <div className="supplier-workspace-shell">
        <aside className="supplier-workspace-sidebar">
          <Typography.Text className="eyebrow">当前独立页面</Typography.Text>
          <div className="supplier-active-menu" data-workspace-menu>{menu?.label}</div>
          {workspace.accountTypeCode === 'SUPPLIER_ACCOUNT_ADMIN' ? (
            <Button block href="/supplier/workspaces/account-admin/accounts">
              职能账号管理
            </Button>
          ) : null}
          <div className="supplier-boundary-note">
            <strong>{workspace.accountTypeCode}</strong>
            <span>只请求本职能目录，不合并其他职能菜单或数据</span>
          </div>
        </aside>
        <section className="supplier-workspace-content">
          <Typography.Text className="eyebrow">FIXED FUNCTIONAL WORKSPACE</Typography.Text>
          <Typography.Title level={1}>{menu?.label}</Typography.Title>
          <Typography.Paragraph>
            所有商品由福礼社公司对外销售，供应商不直接向客户收款。
          </Typography.Paragraph>
          <SupplierWorkspacePagePanel workspace={workspace} />
        </section>
      </div>
    </main>
  );
}

export function SupplierWorkspaceGate({
  content,
  route,
}: {
  readonly content?: ((workspace: SupplierWorkspace) => ReactNode) | undefined;
  readonly route: string;
}) {
  const [workspace, setWorkspace] = useState<SupplierWorkspace>();
  const [state, setState] = useState<
    | { readonly kind: 'error' | 'offline' | 'permission'; readonly message: string }
    | undefined
  >();

  const load = async () => {
    setState(undefined);
    setWorkspace(undefined);
    try {
      const response = await api.GET('/v1/supplier-auth/workspace/current', {
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
        setState({ kind: 'permission', message: '无权访问该供应商职能页面' });
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
      <main className="supplier-auth-page" data-supplier-workspace-gate-state="permission-denied">
        <Result
          extra={<Button href="/supplier/account-select">返回职能选择</Button>}
          status="403"
          subTitle={state.message}
          title={<Typography.Title level={1}>无权访问该供应商职能页面</Typography.Title>}
        />
      </main>
    );
  }
  if (state) {
    return (
      <main className="supplier-auth-page" data-supplier-workspace-gate-state={state.kind}>
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
      <main className="supplier-auth-page" data-supplier-workspace-gate-state="loading">
        <Spin size="large" tip="正在验证固定供应商职能会话" />
      </main>
    );
  }
  return content ? content(workspace) : <FixedSupplierWorkspacePage workspace={workspace} />;
}
