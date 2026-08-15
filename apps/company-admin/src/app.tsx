import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ShellFrame } from '@fulishe/ui';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';
import {
  CompanyAccountSelectPage,
  CompanyLoginPage,
} from './company-auth-pages.js';
import {
  CompanyWorkspaceGate,
  CompanyWorkspacePagePanel,
  type CompanyWorkspace,
} from './company-workspace-pages.js';
import { companySessionBoundary } from './session-boundary.js';
import {
  CompanyInitialPriceReviewPage,
  CompanyProductMaterialReviewPage,
} from './company-product-approval-pages.js';
import { CompanyRefundInitiationPage } from './company-refund-initiation-page.js';

type SupplierRow = components['schemas']['SupplierResponseDto'];
type SupplierStatus = SupplierRow['status'];
type SupplierPage = components['schemas']['SupplierPageResponseDto'];
type AuditEvent = components['schemas']['AuditEventResponseDto'];
type AuditEventPage = components['schemas']['AuditEventPageResponseDto'];
type SensitiveApproval = components['schemas']['SensitiveApprovalTaskResponseDto'];
type SensitiveApprovalPage = components['schemas']['SensitiveApprovalPageResponseDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const statusMeta: Record<SupplierStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING_REVIEW: { label: '待审核', color: 'processing' },
  CORRECTION_REQUIRED: { label: '待补正', color: 'warning' },
  ACTIVE: { label: '已启用', color: 'success' },
  SUSPENDED: { label: '已停用', color: 'error' },
  EXITING: { label: '退出处理中', color: 'orange' },
  EXITED: { label: '已退出', color: 'default' },
};

const readErrorMessage = (value: unknown): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '供应商列表暂时无法加载。';
};

function CompanySupplierOpsPage({
  workspace,
}: {
  readonly workspace: CompanyWorkspace;
}) {
  const [status, setStatus] = useState<SupplierStatus | undefined>();
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState<SupplierPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: 'error' | 'offline' | 'permission'; message: string }>();
  const [reviewingId, setReviewingId] = useState<string>();
  const [correctionTarget, setCorrectionTarget] = useState<SupplierRow>();
  const [opinion, setOpinion] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await api.GET('/v1/company/suppliers', {
        params: {
          query: {
            page: 1,
            pageSize: 20,
            ...(status ? { status } : {}),
            ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
          },
        },
      });
      if (!response.data) {
        const kind =
          response.response.status === 401 || response.response.status === 403
            ? 'permission'
            : 'error';
        setError({ kind, message: readErrorMessage(response.error) });
        setData(undefined);
        return;
      }
      setData(response.data);
    } catch {
      setError({ kind: 'offline', message: '网络连接超时或已离线，请恢复网络后重试。' });
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, [keyword, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (
    supplier: SupplierRow,
    decision: 'APPROVE' | 'REQUEST_CORRECTION',
    reviewOpinion: string,
  ) => {
    setReviewingId(supplier.id);
    setError(undefined);
    try {
      const response = await api.POST('/v1/company/suppliers/{supplierId}/review', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { supplierId: supplier.id },
        },
        body: {
          decision,
          version: supplier.version,
          opinion: reviewOpinion,
        },
      });
      if (!response.data) {
        const kind =
          response.response.status === 401 || response.response.status === 403
            ? 'permission'
            : 'error';
        setError({ kind, message: readErrorMessage(response.error) });
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === response.data?.id ? response.data : item,
              ),
            }
          : current,
      );
      setCorrectionTarget(undefined);
      setOpinion('');
    } catch {
      setError({ kind: 'offline', message: '审核请求结果未知，请恢复网络后查询最新状态，勿重复判断。' });
    } finally {
      setReviewingId(undefined);
    }
  };

  const columns = [
    {
      title: '供应商主体',
      dataIndex: 'legalName',
      key: 'legalName',
      render: (_value: string, row: SupplierRow) => (
        <div className="supplier-name">
          <strong>{row.legalName}</strong>
          <span>{row.creditCodeMasked}</span>
        </div>
      ),
    },
    {
      title: '资质摘要',
      key: 'qualification',
      render: (_value: unknown, row: SupplierRow) => (
        <Space>
          <span>{row.qualificationSummary.fileCount} 份文件</span>
          <Tag color={row.qualificationSummary.complete ? 'green' : 'orange'}>
            {row.qualificationSummary.complete ? '资料完整' : '资料待补'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '入驻状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: SupplierStatus) => (
        <Tag color={statusMeta[value].color}>{statusMeta[value].label}</Tag>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (value: number) => <span>V{value}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value: unknown, row: SupplierRow) =>
        row.status === 'PENDING_REVIEW' ? (
          <Space wrap>
            <Button
              loading={reviewingId === row.id}
              onClick={() => void review(row, 'APPROVE', '资料审核通过')}
              type="primary"
            >
              通过并启用
            </Button>
            <Button onClick={() => setCorrectionTarget(row)}>要求补正</Button>
          </Space>
        ) : (
          <Typography.Text type="secondary">等待供应商下一步</Typography.Text>
        ),
    },
  ];

  const stateMessage = error ? (
    <Alert
      action={<Button onClick={() => void load()}>重新加载</Button>}
      description={error.message}
      message={
        error.kind === 'permission'
          ? '无权访问供应商运营页面'
          : error.kind === 'offline'
            ? '网络离线或请求超时'
            : '加载失败'
      }
      showIcon
      type="error"
    />
  ) : null;

  return (
    <main className="supplier-ops-page" data-page-id="PAGE-004" data-role="COMPANY_SUPPLIER_OPS">
      <header className="admin-topbar">
        <div className="brand-mark">福</div>
        <div>
          <strong>福礼社 · 公司管理后台</strong>
          <span>江苏福礼团供应链科技有限公司</span>
        </div>
        <Tag color="cyan">供应商运营职能</Tag>
      </header>

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Typography.Text className="sidebar-label">当前独立页面</Typography.Text>
          <div className="active-menu" data-workspace-menu>供应商入驻审核</div>
          <div className="boundary-note">
            <strong>COMPANY_SUPPLIER_OPS</strong>
            <span>仅处理主体、资质和入驻状态</span>
          </div>
        </aside>

        <section className="admin-content">
          <div className="page-title-row">
            <div>
              <Typography.Text className="eyebrow">SUPPLIER OPERATIONS</Typography.Text>
              <Typography.Title level={1}>供应商入驻审核</Typography.Title>
              <Typography.Paragraph>
                查阅资质摘要，要求补正或批准启用；所有决定按版本推进并保留状态证据。
              </Typography.Paragraph>
            </div>
            <Button onClick={() => void load()}>刷新列表</Button>
          </div>

          <CompanyWorkspacePagePanel workspace={workspace} />

          <div className="metric-grid">
            <Card bordered={false}>
              <Statistic title="当前结果" value={data?.total ?? 0} suffix="家" />
            </Card>
            <Card bordered={false}>
              <Statistic
                title="待审核"
                value={data?.items.filter((item) => item.status === 'PENDING_REVIEW').length ?? 0}
                valueStyle={{ color: '#0b74b5' }}
              />
            </Card>
            <Card bordered={false}>
              <Statistic
                title="待补正"
                value={data?.items.filter((item) => item.status === 'CORRECTION_REQUIRED').length ?? 0}
                valueStyle={{ color: '#e65943' }}
              />
            </Card>
          </div>

          <Card className="supplier-table-card" bordered={false}>
            <div className="table-toolbar">
              <Input.Search
                allowClear
                aria-label="搜索供应商"
                defaultValue={keyword}
                onSearch={setKeyword}
                placeholder="企业名称或统一社会信用代码"
              />
              <Select<SupplierStatus>
                allowClear
                aria-label="入驻状态"
                onChange={setStatus}
                options={Object.entries(statusMeta).map(([value, meta]) => ({
                  label: meta.label,
                  value: value as SupplierStatus,
                }))}
                placeholder="全部状态"
                value={status ?? null}
              />
            </div>

            {stateMessage}
            <Table<SupplierRow>
              columns={columns}
              dataSource={data?.items ?? []}
              loading={loading}
              locale={{ emptyText: <Empty description="暂无符合条件的入驻申请" /> }}
              pagination={false}
              rowKey="id"
              scroll={{ x: 900 }}
            />
          </Card>
        </section>
      </div>

      <Modal
        cancelText="取消"
        confirmLoading={Boolean(correctionTarget && reviewingId === correctionTarget.id)}
        okButtonProps={{ disabled: !opinion.trim() }}
        okText="确认要求补正"
        onCancel={() => {
          setCorrectionTarget(undefined);
          setOpinion('');
        }}
        onOk={() => {
          if (correctionTarget && opinion.trim()) {
            void review(correctionTarget, 'REQUEST_CORRECTION', opinion.trim());
          }
        }}
        open={Boolean(correctionTarget)}
        title="填写补正意见"
      >
        <Typography.Paragraph>
          意见将进入审核证据并展示给对应供应商，请明确说明需补充或修正的内容。
        </Typography.Paragraph>
        <Input.TextArea
          aria-label="补正意见"
          maxLength={1000}
          onChange={(event) => setOpinion(event.target.value)}
          rows={5}
          showCount
          value={opinion}
        />
      </Modal>
    </main>
  );
}

function CompanyAuditPage({ workspace }: { readonly workspace: CompanyWorkspace }) {
  const [action, setAction] = useState('');
  const [objectType, setObjectType] = useState('');
  const [data, setData] = useState<AuditEventPage>();
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<SensitiveApprovalPage>();
  const [approvalLoading, setApprovalLoading] = useState(true);
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [decisionTarget, setDecisionTarget] = useState<SensitiveApproval>();
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decisionOpinion, setDecisionOpinion] = useState('');
  const [secondVerificationCode, setSecondVerificationCode] = useState('');
  const [error, setError] = useState<{
    kind: 'error' | 'offline' | 'permission';
    message: string;
  }>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await api.GET('/v1/audit/events', {
        params: {
          query: {
            page: 1,
            pageSize: 20,
            ...(action.trim() ? { action: action.trim() } : {}),
            ...(objectType.trim() ? { objectType: objectType.trim() } : {}),
          },
        },
      });
      if (!response.data) {
        const kind =
          response.response.status === 401 || response.response.status === 403
            ? 'permission'
            : 'error';
        setError({ kind, message: readErrorMessage(response.error) });
        setData(undefined);
        return;
      }
      setData(response.data);
    } catch {
      setError({ kind: 'offline', message: '网络连接超时或已离线，请恢复网络后重试。' });
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, [action, objectType]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadApprovals = useCallback(async () => {
    setApprovalLoading(true);
    setApprovalMessage('');
    try {
      const response = await api.GET('/v1/audit/sensitive-export-approvals');
      if (!response.data) {
        setApprovalMessage(readErrorMessage(response.error));
        setApprovals(undefined);
        return;
      }
      setApprovals(response.data);
    } catch {
      setApprovalMessage('审批列表请求结果未知，请恢复网络后重新查询。');
      setApprovals(undefined);
    } finally {
      setApprovalLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  const createApproval = async () => {
    if (approvalReason.trim().length < 2) return;
    setApprovalLoading(true);
    setApprovalMessage('');
    try {
      const response = await api.POST('/v1/audit/sensitive-export-approvals', {
        params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
        body: { reason: approvalReason.trim(), resource: 'AUDIT_EVENTS' },
      });
      if (!response.data) {
        setApprovalMessage(readErrorMessage(response.error));
        return;
      }
      setApprovalReason('');
      setApprovalMessage('导出审批申请已创建；本切片不会生成实际导出文件。');
      await loadApprovals();
    } catch {
      setApprovalMessage('申请结果未知，请先查询审批列表，勿重复判断。');
    } finally {
      setApprovalLoading(false);
    }
  };

  const claimApproval = async (task: SensitiveApproval) => {
    setApprovalLoading(true);
    setApprovalMessage('');
    try {
      const response = await api.POST(
        '/v1/audit/sensitive-export-approvals/{taskId}/claim',
        {
          params: {
            header: { 'Idempotency-Key': crypto.randomUUID() },
            path: { taskId: task.id },
          },
          body: { version: task.version },
        },
      );
      if (!response.data) {
        setApprovalMessage(readErrorMessage(response.error));
        return;
      }
      await loadApprovals();
    } catch {
      setApprovalMessage('认领结果未知，请重新加载任务状态。');
    } finally {
      setApprovalLoading(false);
    }
  };

  const submitDecision = async () => {
    if (!decisionTarget || decisionOpinion.trim().length < 2 || !secondVerificationCode.trim()) return;
    setApprovalLoading(true);
    setApprovalMessage('');
    try {
      const response = await api.POST(
        '/v1/audit/sensitive-export-approvals/{taskId}/decision',
        {
          params: {
            header: { 'Idempotency-Key': crypto.randomUUID() },
            path: { taskId: decisionTarget.id },
          },
          body: {
            decision,
            opinion: decisionOpinion.trim(),
            secondVerificationCode: secondVerificationCode.trim(),
            version: decisionTarget.version,
          },
        },
      );
      if (!response.data) {
        setApprovalMessage(readErrorMessage(response.error));
        return;
      }
      setDecisionTarget(undefined);
      setDecisionOpinion('');
      setSecondVerificationCode('');
      await loadApprovals();
    } catch {
      setApprovalMessage('复核结果未知，请重新加载任务状态。');
    } finally {
      setApprovalLoading(false);
    }
  };

  const columns = [
    {
      title: '发生时间',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '操作人',
      key: 'actor',
      render: (_value: unknown, row: AuditEvent) => (
        <Space direction="vertical" size={0}>
          <Tag color="cyan">{row.actorType}</Tag>
          <Typography.Text copyable>{row.actorId}</Typography.Text>
        </Space>
      ),
    },
    { title: '动作', dataIndex: 'action', key: 'action' },
    {
      title: '对象',
      key: 'object',
      render: (_value: unknown, row: AuditEvent) => (
        <Space direction="vertical" size={0}>
          <strong>{row.objectType}</strong>
          <Typography.Text copyable>{row.objectId}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '脱敏变更快照',
      key: 'snapshot',
      render: (_value: unknown, row: AuditEvent) => (
        <Typography.Text code>
          {JSON.stringify({ before: row.beforeSnapshot, after: row.afterSnapshot })}
        </Typography.Text>
      ),
    },
    {
      title: '请求编号',
      dataIndex: 'requestId',
      key: 'requestId',
      render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>,
    },
  ];

  return (
    <main className="supplier-ops-page" data-page-id="PAGE-012" data-role="COMPANY_AUDIT">
      <header className="admin-topbar">
        <div className="brand-mark">福</div>
        <div>
          <strong>福礼社 · 公司管理后台</strong>
          <span>江苏福礼团供应链科技有限公司</span>
        </div>
        <Tag color="cyan">审计职能</Tag>
      </header>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Typography.Text className="sidebar-label">当前独立页面</Typography.Text>
          <div className="active-menu" data-workspace-menu>敏感操作审计</div>
          <div className="boundary-note">
            <strong>COMPANY_AUDIT</strong>
            <span>只读查询脱敏事件，不可修改业务或审计记录</span>
          </div>
        </aside>
        <section className="admin-content">
          <div className="page-title-row">
            <div>
              <Typography.Text className="eyebrow">IMMUTABLE AUDIT</Typography.Text>
              <Typography.Title level={1}>敏感操作审计</Typography.Title>
              <Typography.Paragraph>
                按动作和对象查询不可变事件；页面仅展示最小必要字段与脱敏前后快照。
              </Typography.Paragraph>
            </div>
            <Button onClick={() => void load()}>刷新记录</Button>
          </div>
          <CompanyWorkspacePagePanel workspace={workspace} />
          <Card className="supplier-table-card" bordered={false}>
            <div className="table-toolbar">
              <Input
                aria-label="审计动作"
                onChange={(event) => setAction(event.target.value)}
                placeholder="动作，例如 functional_account.invited"
                value={action}
              />
              <Input
                aria-label="对象类型"
                onChange={(event) => setObjectType(event.target.value)}
                placeholder="对象类型"
                value={objectType}
              />
            </div>
            {error ? (
              <Alert
                action={<Button onClick={() => void load()}>重新加载</Button>}
                description={error.message}
                message={
                  error.kind === 'permission'
                    ? '无权访问审计页面'
                    : error.kind === 'offline'
                      ? '网络离线或请求超时'
                      : '加载失败'
                }
                showIcon
                type="error"
              />
            ) : null}
            <Table<AuditEvent>
              columns={columns}
              dataSource={data?.items ?? []}
              loading={loading}
              locale={{ emptyText: <Empty description="暂无符合条件的审计记录" /> }}
              pagination={false}
              rowKey="id"
              scroll={{ x: 1180 }}
            />
          </Card>
          <Card
            className="supplier-table-card"
            bordered={false}
            data-sensitive-approval-state={
              approvalLoading ? 'loading' : approvals?.items.length ? 'success' : 'empty'
            }
            title="敏感导出审批（不生成文件）"
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                description="申请、认领和复核只授权后续操作；实际导出能力不在 M1 范围。"
                message="双人复核按自然人身份隔离，超级管理员不能绕过"
                showIcon
                type="warning"
              />
              <Space.Compact block>
                <Input
                  aria-label="敏感导出申请理由"
                  maxLength={500}
                  onChange={(event) => setApprovalReason(event.target.value)}
                  placeholder="填写申请理由"
                  value={approvalReason}
                />
                <Button
                  disabled={approvalReason.trim().length < 2}
                  loading={approvalLoading}
                  onClick={() => void createApproval()}
                  type="primary"
                >
                  发起审批
                </Button>
              </Space.Compact>
              {approvalMessage ? <Alert message={approvalMessage} showIcon type="info" /> : null}
              <Table<SensitiveApproval>
                dataSource={approvals?.items ?? []}
                loading={approvalLoading}
                locale={{ emptyText: <Empty description="暂无敏感操作审批" /> }}
                pagination={false}
                rowKey="id"
                columns={[
                  { title: '资源', dataIndex: 'resource' },
                  { title: '状态', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
                  { title: '版本', dataIndex: 'version', render: (value: number) => `V${value}` },
                  { title: '复核意见', dataIndex: 'reviewOpinion', render: (value: string | null) => value ?? '—' },
                  {
                    title: '操作',
                    key: 'operation',
                    render: (_value: unknown, row: SensitiveApproval) =>
                      row.status === 'PENDING' ? (
                        <Button onClick={() => void claimApproval(row)}>独立认领</Button>
                      ) : row.status === 'IN_REVIEW' ? (
                        <Button onClick={() => setDecisionTarget(row)} type="primary">复核决定</Button>
                      ) : (
                        <Typography.Text type="secondary">已完成</Typography.Text>
                      ),
                  },
                ]}
              />
            </Space>
          </Card>
        </section>
      </div>
      <Modal
        cancelText="取消"
        okButtonProps={{
          disabled: decisionOpinion.trim().length < 2 || !secondVerificationCode.trim(),
        }}
        okText="提交复核决定"
        onCancel={() => setDecisionTarget(undefined)}
        onOk={() => void submitDecision()}
        open={Boolean(decisionTarget)}
        title="独立复核与二次验证"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Select
            aria-label="复核决定"
            onChange={setDecision}
            options={[
              { label: '通过', value: 'APPROVE' },
              { label: '驳回', value: 'REJECT' },
            ]}
            value={decision}
          />
          <Input.TextArea
            aria-label="复核意见"
            maxLength={1000}
            onChange={(event) => setDecisionOpinion(event.target.value)}
            value={decisionOpinion}
          />
          <Input.Password
            aria-label="二次验证码"
            maxLength={64}
            onChange={(event) => setSecondVerificationCode(event.target.value)}
            value={secondVerificationCode}
          />
        </Space>
      </Modal>
    </main>
  );
}

export function CompanyAdminShell() {
  const currentPath = window.location.pathname;
  if (currentPath === '/company-admin/login') {
    return <CompanyLoginPage />;
  }
  if (currentPath === '/company-admin/account-select') {
    return <CompanyAccountSelectPage />;
  }
  if (currentPath.startsWith(companySessionBoundary.workspaceRoutePrefix)) {
    return (
      <CompanyWorkspaceGate
        content={
          currentPath === '/company-admin/workspaces/supplier-ops' ? (
            (workspace) => <CompanySupplierOpsPage workspace={workspace} />
          ) : currentPath === '/company-admin/workspaces/audit' ? (
            (workspace) => <CompanyAuditPage workspace={workspace} />
          ) : currentPath === '/company-admin/workspaces/product-ops' ? (
            (workspace) => <CompanyProductMaterialReviewPage workspace={workspace} />
          ) : currentPath === '/company-admin/workspaces/price-review' ? (
            (workspace) => <CompanyInitialPriceReviewPage workspace={workspace} />
          ) : currentPath === '/company-admin/workspaces/order-service' ? (
            (workspace) => <CompanyRefundInitiationPage workspace={workspace} />
          ) : undefined
        }
        route={currentPath}
      />
    );
  }

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
          description="账号、权限和其他业务工作台按后续任务逐项实现。"
          showIcon
          type="info"
        />
        <Typography.Text>
          当前路径：<Typography.Text code>{currentPath}</Typography.Text>
        </Typography.Text>
        <Tag color="cyan">{companySessionBoundary.workspaceRoutePrefix}</Tag>
      </Space>
    </ShellFrame>
  );
}
