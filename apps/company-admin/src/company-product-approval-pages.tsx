import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';
import { CompanyCategoryTreePanel } from './company-category-tree.js';
import { CompanyCategoryTemplatePanel } from './company-category-templates.js';
import { CompanyRegulatedCategoryControlPanel } from './company-regulated-category-controls.js';
import { CompanyWorkspacePagePanel, type CompanyWorkspace } from './company-workspace-pages.js';
import { CompanySupplyPriceReviewPanel } from './company-supply-price-review-panel.js';

type MaterialReview = components['schemas']['ProductMaterialReviewDto'];
type MaterialPage = components['schemas']['ProductMaterialReviewPageDto'];
type PriceReview = components['schemas']['InitialPriceReviewDto'];
type PricePage = components['schemas']['InitialPriceReviewPageDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const errorMessage = (value: unknown): string => {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '审核列表暂时无法加载';
};

const statusTag = (status: string) => (
  <Tag color={status === 'PENDING' ? 'processing' : status === 'APPROVED' ? 'success' : 'error'}>
    {status === 'PENDING' ? '待审核' : status === 'APPROVED' ? '已通过' : '已驳回'}
  </Tag>
);

function ApprovalShell({
  children,
  pageId,
  role,
  title,
  workspace,
}: {
  readonly children: ReactNode;
  readonly pageId: string;
  readonly role: string;
  readonly title: string;
  readonly workspace: CompanyWorkspace;
}) {
  return (
    <main className="supplier-ops-page product-approval-page" data-page-id={pageId} data-role={role}>
      <header className="admin-topbar">
        <div className="brand-mark">福</div>
        <div>
          <strong>福礼社 · 公司管理后台</strong>
          <span>江苏福礼团供应链科技有限公司</span>
        </div>
        <Button href="/company-admin/account-select" ghost>切换职能</Button>
        <Tag color="cyan">{workspace.accountTypeName}</Tag>
      </header>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Typography.Text className="sidebar-label">当前独立页面</Typography.Text>
          <div className="active-menu" data-workspace-menu>{title}</div>
          <div className="boundary-note">
            <strong>{role}</strong>
            <span>会话只允许本职能队列和决定接口</span>
          </div>
        </aside>
        <section className="admin-content">{children}</section>
      </div>
    </main>
  );
}

export function CompanyProductMaterialReviewPage({ workspace }: { readonly workspace: CompanyWorkspace }) {
  const [data, setData] = useState<MaterialPage>();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ kind: 'error' | 'offline' | 'permission'; message: string }>();
  const [target, setTarget] = useState<MaterialReview>();
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [opinion, setOpinion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(undefined);
    try {
      const response = await api.GET('/v1/company/product-material-reviews');
      if (!response.data) {
        setFailure({
          kind: [401, 403].includes(response.response.status) ? 'permission' : 'error',
          message: errorMessage(response.error),
        });
        setData(undefined);
      } else {
        setData(response.data);
      }
    } catch {
      setFailure({ kind: 'offline', message: '请求超时或网络离线，请恢复后重新加载' });
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!target || opinion.trim().length < 2) return;
    setSubmitting(true);
    setFailure(undefined);
    try {
      const response = await api.POST('/v1/company/product-material-reviews/{taskId}/decision', {
        params: {
          header: { 'Idempotency-Key': crypto.randomUUID() },
          path: { taskId: target.id },
        },
        body: { decision, opinion: opinion.trim(), version: target.version },
      });
      if (!response.data) {
        setFailure({
          kind: [401, 403].includes(response.response.status) ? 'permission' : 'error',
          message: errorMessage(response.error),
        });
        return;
      }
      setTarget(undefined);
      setOpinion('');
      await load();
    } catch {
      setFailure({ kind: 'offline', message: '审核结果未知，请先刷新任务状态，勿重复判断' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ApprovalShell pageId="PAGE-005" role="COMPANY_PRODUCT_OPS" title="商品资料审核" workspace={workspace}>
      <div className="page-title-row">
        <div>
          <Typography.Text className="eyebrow">MATERIAL REVIEW · NO PRICE DATA</Typography.Text>
          <Typography.Title level={1}>商品资料审核</Typography.Title>
          <Typography.Paragraph>仅审核商品资料、资质、渠道和 SKU 描述；本页面及其接口永不返回三类价格。</Typography.Paragraph>
        </div>
        <Button onClick={() => void load()}>刷新队列</Button>
      </div>
      <CompanyWorkspacePagePanel workspace={workspace} />
      <CompanyCategoryTreePanel />
      <CompanyCategoryTemplatePanel />
      <CompanyRegulatedCategoryControlPanel />
      <div className="metric-grid">
        <Card bordered={false}><Statistic title="审核任务" value={data?.total ?? 0} /></Card>
        <Card bordered={false}><Statistic title="待处理" value={data?.items.filter(({ status }) => status === 'PENDING').length ?? 0} /></Card>
        <Card bordered={false}><Statistic title="价格字段" value="不可见" valueStyle={{ color: '#0f766e' }} /></Card>
      </div>
      {failure ? (
        <Alert
          action={<Button onClick={() => void load()}>重新加载</Button>}
          description={failure.message}
          message={failure.kind === 'permission' ? '无权访问商品资料审核' : failure.kind === 'offline' ? '网络离线或超时' : '加载失败'}
          showIcon
          type="error"
        />
      ) : null}
      <Card bordered={false} className="supplier-table-card">
        <Table<MaterialReview>
          dataSource={data?.items ?? []}
          loading={loading}
          locale={{ emptyText: <Empty description="暂无商品资料审核任务" /> }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1100 }}
          columns={[
            { title: '商品', key: 'product', render: (_value, row) => <Space direction="vertical" size={0}><strong>{row.name}</strong><span>{row.brand ?? '无品牌'}</span></Space> },
            { title: '分类/模板', key: 'template', render: (_value, row) => <span>{row.categoryId} · V{row.templateVersion}</span> },
            { title: '资质', dataIndex: 'qualificationReferenceCount', render: (value: number) => `${value} 份引用` },
            { title: '渠道', key: 'channel', render: (_value, row) => <Space><Tag>{row.isRetailEnabled ? '个人零售' : '零售关闭'}</Tag><Tag>{row.isEnterpriseProcurementEnabled ? '企业集采' : '集采关闭'}</Tag></Space> },
            { title: 'SKU', dataIndex: 'skus', render: (skus: MaterialReview['skus']) => skus.map(({ supplierSkuCode }) => supplierSkuCode).join('、') },
            { title: '状态', dataIndex: 'status', render: statusTag },
            { title: '操作', key: 'action', render: (_value, row) => row.status === 'PENDING' ? <Button type="primary" onClick={() => setTarget(row)}>审核</Button> : <Typography.Text type="secondary">已留痕</Typography.Text> },
          ]}
        />
      </Card>
      <Modal
        cancelText="取消"
        confirmLoading={submitting}
        okButtonProps={{ disabled: opinion.trim().length < 2 }}
        okText="提交审核决定"
        onCancel={() => setTarget(undefined)}
        onOk={() => void submit()}
        open={Boolean(target)}
        title="商品资料审核决定"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space><Button type={decision === 'APPROVE' ? 'primary' : 'default'} onClick={() => setDecision('APPROVE')}>通过</Button><Button danger type={decision === 'REJECT' ? 'primary' : 'default'} onClick={() => setDecision('REJECT')}>驳回补正</Button></Space>
          <Input.TextArea aria-label="资料审核意见" maxLength={1000} onChange={(event) => setOpinion(event.target.value)} rows={5} showCount value={opinion} />
        </Space>
      </Modal>
    </ApprovalShell>
  );
}

export function CompanyInitialPriceReviewPage({ workspace }: { readonly workspace: CompanyWorkspace }) {
  const [data, setData] = useState<PricePage>();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ kind: 'error' | 'offline' | 'permission'; message: string }>();
  const [target, setTarget] = useState<PriceReview>();
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [opinion, setOpinion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(undefined);
    try {
      const response = await api.GET('/v1/company/price-reviews');
      if (!response.data) {
        setFailure({ kind: [401, 403].includes(response.response.status) ? 'permission' : 'error', message: errorMessage(response.error) });
        setData(undefined);
      } else setData(response.data);
    } catch {
      setFailure({ kind: 'offline', message: '请求超时或网络离线，请恢复后重新加载' });
      setData(undefined);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!target || opinion.trim().length < 2) return;
    setSubmitting(true);
    setFailure(undefined);
    try {
      const response = await api.POST('/v1/company/price-reviews/{taskId}/decision', {
        params: { header: { 'Idempotency-Key': crypto.randomUUID() }, path: { taskId: target.id } },
        body: { decision, opinion: opinion.trim(), version: target.version },
      });
      if (!response.data) {
        setFailure({ kind: [401, 403].includes(response.response.status) ? 'permission' : 'error', message: errorMessage(response.error) });
        return;
      }
      setTarget(undefined);
      setOpinion('');
      await load();
    } catch {
      setFailure({ kind: 'offline', message: '审核结果未知，请先刷新任务状态，勿重复判断' });
    } finally { setSubmitting(false); }
  };

  return (
    <ApprovalShell pageId="PAGE-006" role="COMPANY_PRICE_REVIEW" title="初始价格审核" workspace={workspace}>
      <div className="page-title-row">
        <div>
          <Typography.Text className="eyebrow">INITIAL THREE-PRICE REVIEW</Typography.Text>
          <Typography.Title level={1}>初始价格审核</Typography.Title>
          <Typography.Paragraph>审核供应商冻结提交的供应价、个人零售价和企业集采价；不能修改商品资料，也不能代供应商改价。</Typography.Paragraph>
        </div>
        <Button onClick={() => void load()}>刷新队列</Button>
      </div>
      <CompanyWorkspacePagePanel workspace={workspace} />
      <div className="metric-grid">
        <Card bordered={false}><Statistic title="审核任务" value={data?.total ?? 0} /></Card>
        <Card bordered={false}><Statistic title="待处理" value={data?.items.filter(({ status }) => status === 'PENDING').length ?? 0} /></Card>
        <Card bordered={false}><Statistic title="金额单位" value="整数分" /></Card>
      </div>
      {failure ? <Alert action={<Button onClick={() => void load()}>重新加载</Button>} description={failure.message} message={failure.kind === 'permission' ? '无权访问价格审核' : failure.kind === 'offline' ? '网络离线或超时' : '加载失败'} showIcon type="error" /> : null}
      <Card bordered={false} className="supplier-table-card">
        <Table<PriceReview>
          dataSource={data?.items ?? []}
          loading={loading}
          locale={{ emptyText: <Empty description="暂无初始价格审核任务" /> }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1100 }}
          columns={[
            { title: '商品', dataIndex: 'name' },
            { title: 'SKU/三类价格', key: 'prices', render: (_value, row) => <Space direction="vertical" size="small">{row.skus.map((sku) => <div className="price-review-row" key={sku.id}><strong>{sku.supplierSkuCode}</strong><span>供应 ¥{(sku.requestedSupplyPrice / 100).toFixed(2)}</span><span>零售 ¥{(sku.requestedRetailSalePrice / 100).toFixed(2)}</span><span>集采 ¥{(sku.requestedEnterpriseSalePrice / 100).toFixed(2)}</span></div>)}</Space> },
            { title: '状态', dataIndex: 'status', render: statusTag },
            { title: '版本', dataIndex: 'version', render: (value: number) => `V${value}` },
            { title: '操作', key: 'action', render: (_value, row) => row.status === 'PENDING' ? <Button type="primary" onClick={() => setTarget(row)}>审核</Button> : <Typography.Text type="secondary">已留痕</Typography.Text> },
          ]}
        />
      </Card>
      <Modal cancelText="取消" confirmLoading={submitting} okButtonProps={{ disabled: opinion.trim().length < 2 }} okText="提交审核决定" onCancel={() => setTarget(undefined)} onOk={() => void submit()} open={Boolean(target)} title="初始价格审核决定">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert message="价格来自冻结申请快照；审核人只能通过或驳回，不能在此编辑。" showIcon type="warning" />
          <Space><Button type={decision === 'APPROVE' ? 'primary' : 'default'} onClick={() => setDecision('APPROVE')}>通过</Button><Button danger type={decision === 'REJECT' ? 'primary' : 'default'} onClick={() => setDecision('REJECT')}>驳回</Button></Space>
          <Input.TextArea aria-label="价格审核意见" maxLength={1000} onChange={(event) => setOpinion(event.target.value)} rows={5} showCount value={opinion} />
        </Space>
      </Modal>
      <CompanySupplyPriceReviewPanel />
    </ApprovalShell>
  );
}
