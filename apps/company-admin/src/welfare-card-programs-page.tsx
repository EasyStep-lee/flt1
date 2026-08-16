import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';
import { CompanyWorkspacePagePanel, type CompanyWorkspace } from './company-workspace-pages.js';

type Program = components['schemas']['WelfareProgramResponseDto'];
type Batch = components['schemas']['WelfareBatchResponseDto'];
type ProgramPage = components['schemas']['WelfareProgramPageResponseDto'];

const labelProgramDialog = (node: HTMLDivElement | null) => node?.setAttribute('aria-label', '新建福利卡计划');
const labelBatchDialog = (node: HTMLDivElement | null) => node?.setAttribute('aria-label', '新建发行批次');
type ProgramInput = components['schemas']['CreateWelfareProgramRequestDto'];
type BatchInput = components['schemas']['CreateWelfareBatchRequestDto'];
type ProgramRow = { readonly key: string; readonly program: Program; readonly batch?: Batch };
const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const fundingLabel: Record<string, string> = {
  ENTERPRISE_GRANT: '企业福利发放', COMPANY_GIFT: '公司活动赠送', PHYSICAL_CARD_OR_CODE: '实体卡或兑换码',
};
const money = (value: number) => `¥${(value / 100).toFixed(2)}`;
const messageFrom = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object' && 'message' in value && typeof (value as { message?: unknown }).message === 'string') return (value as { message: string }).message;
  return fallback;
};

export function WelfareCardProgramsPage({ workspace }: { readonly workspace: CompanyWorkspace }) {
  const [data, setData] = useState<ProgramPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [programOpen, setProgramOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [programForm] = Form.useForm<ProgramInput>();
  const [batchForm] = Form.useForm<BatchInput & { programId: string }>();
  const selectedProgramId = Form.useWatch('programId', batchForm);

  const load = useCallback(async () => {
    setLoading(true); setError(undefined);
    try {
      const response = await api.GET('/v1/company/welfare-card/programs');
      if (!response.data) { setData(undefined); setError(messageFrom(response.error, '福利卡计划与批次加载失败')); return; }
      setData(response.data);
    } catch { setData(undefined); setError('网络离线或请求超时，请恢复后重试'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const createProgram = async () => {
    const values = await programForm.validateFields(); setSubmitting(true); setError(undefined);
    try {
      const response = await api.POST('/v1/company/welfare-card/programs', {
        params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
        body: { ...values, scopeType: 'ALL_PRODUCTS', scopeRules: { schemaVersion: 1, includedIds: [], excludedIds: [] }, canPayDeliveryFee: false },
      });
      if (!response.data) { setError(messageFrom(response.error, '计划创建失败')); return; }
      setProgramOpen(false); programForm.resetFields(); await load();
    } catch { setError('创建结果未知，请重新加载列表确认'); }
    finally { setSubmitting(false); }
  };
  const selectedProgram = useMemo(() => data?.items.find((item) => item.id === selectedProgramId), [data, selectedProgramId]);
  const createBatch = async () => {
    const values = await batchForm.validateFields(); const { programId, ...body } = values; setSubmitting(true); setError(undefined);
    try {
      const response = await api.POST('/v1/company/welfare-card/programs/{programId}/batches', {
        params: { header: { 'Idempotency-Key': crypto.randomUUID() }, path: { programId } }, body,
      });
      if (!response.data) { setError(messageFrom(response.error, '批次创建失败')); return; }
      setBatchOpen(false); batchForm.resetFields(); await load();
    } catch { setError('创建结果未知，请重新加载列表确认'); }
    finally { setSubmitting(false); }
  };

  const rows: ProgramRow[] = (data?.items ?? []).flatMap<ProgramRow>((program) => program.batches.length ? program.batches.map((batch) => ({ key: batch.id, program, batch })) : [{ key: program.id, program }]);
  return (
    <main className="supplier-ops-page" data-page-id="PAGE-008" data-role="COMPANY_WELFARE_CARD">
      <header className="admin-topbar"><div className="brand-mark">福</div><div><strong>福礼社 · 公司管理后台</strong><span>江苏福礼团供应链科技有限公司</span></div><Tag color="cyan">福利卡运营</Tag></header>
      <div className="admin-shell">
        <aside className="admin-sidebar"><Typography.Text className="sidebar-label">当前独立页面</Typography.Text><div className="active-menu" data-workspace-menu>福利卡运营</div><div className="boundary-note"><strong>COMPANY_WELFARE_CARD</strong><span>计划与批次保持草稿，真实发行须完成人工合规门禁</span></div></aside>
        <section className="admin-content">
          <CompanyWorkspacePagePanel workspace={workspace} />
          <section data-m3-slice="M3-P051">
            <div className="page-title-row"><div><Typography.Text className="eyebrow">WELFARE PROGRAMS</Typography.Text><Typography.Title level={1}>福利卡运营</Typography.Title><Typography.Title level={2}>福利卡计划与批次</Typography.Title><Typography.Paragraph>金额以整数分保存；计划和批次创建后保持 DRAFT，并追加创建历史。</Typography.Paragraph></div><Space><Button onClick={() => void load()}>刷新</Button><Button onClick={() => setProgramOpen(true)} type="primary">新建福利卡计划</Button><Button disabled={!data?.items.length} onClick={() => setBatchOpen(true)}>新建发行批次</Button></Space></div>
            {error ? <Alert action={<Button onClick={() => void load()}>重试</Button>} message={error} showIcon type="error" /> : null}
            <Card bordered={false} className="supplier-table-card">
              <Table<ProgramRow> loading={loading} dataSource={rows} rowKey="key" pagination={false} locale={{ emptyText: <Empty description="暂无福利卡计划" /> }} columns={[
                { title: '福利卡计划', render: (_: unknown, row) => <Space direction="vertical" size={0}><strong>{row.program.name}</strong><span>{fundingLabel[row.program.fundingType] ?? row.program.fundingType}</span></Space> },
                { title: '计划状态', render: (_: unknown, row) => <Space><Tag>{row.program.status}</Tag><Tag color="gold">合规 {row.program.complianceStatus}</Tag></Space> },
                { title: '发行批次', render: (_: unknown, row) => row.batch?.batchNo ?? '—' },
                { title: '金额守恒', render: (_: unknown, row) => row.batch ? `${money(row.batch.unitAmount)} × ${row.batch.issueCount} = ${money(row.batch.totalAmount)}` : '—' },
                { title: '批次状态', render: (_: unknown, row) => row.batch ? <Tag>{row.batch.status}</Tag> : '—' },
              ]} />
            </Card>
          </section>
        </section>
      </div>
      <Modal confirmLoading={submitting} onCancel={() => setProgramOpen(false)} onOk={() => void createProgram()} open={programOpen} panelRef={labelProgramDialog} title="新建福利卡计划">
        <Alert description="仅允许企业福利发放、公司活动赠送、实体卡或兑换码" message="资金来源固定白名单" showIcon type="warning" />
        <Form form={programForm} layout="vertical" initialValues={{ fundingType: 'ENTERPRISE_GRANT', refundPolicy: '按原福利卡账户退回，异常进入人工复核' }}>
          <Form.Item label="计划名称" name="name" rules={[{ required: true, min: 2 }]}><Input maxLength={191} /></Form.Item>
          <Form.Item label="资金来源" name="fundingType" rules={[{ required: true }]}><Select options={Object.entries(fundingLabel).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item label="退款规则" name="refundPolicy" rules={[{ required: true, min: 2 }]}><Input.TextArea maxLength={500} /></Form.Item>
        </Form>
      </Modal>
      <Modal confirmLoading={submitting} onCancel={() => setBatchOpen(false)} onOk={() => void createBatch()} open={batchOpen} panelRef={labelBatchDialog} title="新建发行批次">
        <Form form={batchForm} layout="vertical">
          <Form.Item label="福利卡计划" name="programId" rules={[{ required: true }]}><Select options={(data?.items ?? []).map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          {selectedProgram?.fundingType === 'ENTERPRISE_GRANT' ? <Form.Item label="企业客户编号" name="enterpriseCustomerId" rules={[{ required: true }]}><Input /></Form.Item> : null}
          <Form.Item label="批次号" name="batchNo" rules={[{ required: true, min: 2 }]}><Input maxLength={64} /></Form.Item>
          <Space><Form.Item label="单份金额（分）" name="unitAmount" rules={[{ required: true }]}><InputNumber min={1} precision={0} /></Form.Item><Form.Item label="发行数量" name="issueCount" rules={[{ required: true }]}><InputNumber min={1} precision={0} /></Form.Item><Form.Item label="总额（分）" name="totalAmount" rules={[{ required: true }]}><InputNumber min={1} precision={0} /></Form.Item></Space>
          <Form.Item label="领取方式" name="claimMode" rules={[{ required: true }]}><Select options={[{ value: 'ENTERPRISE_ASSIGNED', label: '企业分配' }, { value: 'COMPANY_ASSIGNED', label: '公司分配' }, { value: 'PHYSICAL_CARD_OR_CODE', label: '实体卡或兑换码' }]} /></Form.Item>
          <Form.Item label="协议版本" name="agreementVersion" rules={[{ required: true }]}><InputNumber min={1} precision={0} /></Form.Item>
        </Form>
      </Modal>
    </main>
  );
}
