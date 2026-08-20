import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';
import { CompanyWorkspacePagePanel, type CompanyWorkspace } from './company-workspace-pages.js';

type Adjustment = components['schemas']['WelfareCardAdjustmentResponseDto'];
type AdjustmentPage = components['schemas']['WelfareCardAdjustmentPageResponseDto'];
type AdjustmentInput = components['schemas']['CreateWelfareCardAdjustmentRequestDto'] & { readonly accountId: string };
type DecisionInput = components['schemas']['DecideWelfareCardAdjustmentRequestDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');
const money = (value: number) => `¥${(value / 100).toFixed(2)}`;
const messageFrom = (value: unknown, fallback: string): string => {
  if (value && typeof value === 'object' && 'message' in value && typeof (value as { message?: unknown }).message === 'string') return (value as { message: string }).message;
  return fallback;
};

export function WelfareCardAdjustmentsPage({ workspace }: { readonly workspace: CompanyWorkspace }) {
  const [data, setData] = useState<AdjustmentPage>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [target, setTarget] = useState<Adjustment>();
  const [createForm] = Form.useForm<AdjustmentInput>();
  const [decisionForm] = Form.useForm<DecisionInput>();
  const businessType = Form.useWatch('businessType', createForm);

  const load = useCallback(async () => {
    setLoading(true); setError(undefined);
    try {
      const response = await api.GET('/v1/company/welfare-card/adjustments');
      if (!response.data) { setData(undefined); setError(messageFrom(response.error, '福利卡财务调整加载失败')); return; }
      setData(response.data);
    } catch { setData(undefined); setError('网络离线或请求超时，请恢复后重试'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const createAdjustment = async () => {
    const values = await createForm.validateFields();
    const { accountId, ...body } = values;
    setSubmitting(true); setError(undefined);
    try {
      const response = await api.POST('/v1/company/welfare-card/accounts/{accountId}/adjustments', {
        params: { path: { accountId }, header: { 'Idempotency-Key': crypto.randomUUID() } },
        body,
      });
      if (!response.data) { setError(messageFrom(response.error, '调整申请创建失败')); return; }
      createForm.resetFields(); await load();
    } catch { setError('调整申请结果未知，请重新加载确认，勿重复提交'); }
    finally { setSubmitting(false); }
  };

  const decide = async () => {
    if (!target) return;
    const body = await decisionForm.validateFields();
    setSubmitting(true); setError(undefined);
    try {
      const response = await api.POST('/v1/company/welfare-card/adjustments/{adjustmentId}/decision', {
        params: { path: { adjustmentId: target.id }, header: { 'Idempotency-Key': crypto.randomUUID() } },
        body: { ...body, version: target.version },
      });
      if (!response.data) { setError(messageFrom(response.error, '独立复核失败')); return; }
      setTarget(undefined); decisionForm.resetFields(); await load();
    } catch { setError('复核结果未知，请重新加载后确认状态'); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="supplier-ops-page" data-page-id="PAGE-009" data-role="COMPANY_FINANCE">
      <header className="admin-topbar"><div className="brand-mark">福</div><div><strong>福礼社 · 公司管理后台</strong><span>江苏福礼团供应链科技有限公司</span></div><Tag color="blue">财务结算</Tag></header>
      <div className="admin-shell">
        <aside className="admin-sidebar"><Typography.Text className="sidebar-label">当前独立页面</Typography.Text><div className="active-menu" data-workspace-menu>财务结算</div><div className="boundary-note"><strong>COMPANY_FINANCE</strong><span>福利卡调整必须由不同自然人复核，超级管理员不得绕过</span></div></aside>
        <section className="admin-content">
          <CompanyWorkspacePagePanel workspace={workspace} />
          <section data-m3-slice="M3-P059">
            <div className="page-title-row"><div><Typography.Text className="eyebrow">MAKER-CHECKER</Typography.Text><Typography.Title level={1}>财务结算</Typography.Title><Typography.Title level={2}>福利卡财务调整与冲正</Typography.Title><Typography.Paragraph>申请只产生待复核记录；通过后才原子追加账本。冲正必须引用原调整流水，禁止直接改余额。</Typography.Paragraph></div><Button onClick={() => void load()}>刷新</Button></div>
            {error ? <Alert action={<Button onClick={() => void load()}>重试</Button>} message={error} showIcon type="error" /> : null}
            <Card bordered={false} title="发起调整申请">
              <Form form={createForm} initialValues={{ businessType: 'ADJUSTMENT', direction: 'CREDIT' }} layout="vertical">
                <Space align="start" wrap>
                  <Form.Item label="福利卡账户编号" name="accountId" rules={[{ required: true }]}><Input aria-label="福利卡账户编号" /></Form.Item>
                  <Form.Item label="业务类型" name="businessType" rules={[{ required: true }]}><Select aria-label="业务类型" style={{ width: 150 }} options={[{ value: 'ADJUSTMENT', label: '财务调整' }, { value: 'REVERSAL', label: '调整冲正' }]} /></Form.Item>
                  {businessType === 'REVERSAL' ? <Form.Item label="原调整流水编号" name="reversalOfLedgerId" rules={[{ required: true }]}><Input aria-label="原调整流水编号" /></Form.Item> : <>
                    <Form.Item label="方向" name="direction" rules={[{ required: true }]}><Select aria-label="调整方向" style={{ width: 120 }} options={[{ value: 'CREDIT', label: '入账' }, { value: 'DEBIT', label: '扣减' }]} /></Form.Item>
                    <Form.Item label="金额（分）" name="amount" rules={[{ required: true }]}><InputNumber aria-label="调整金额（分）" min={1} precision={0} /></Form.Item>
                  </>}
                  <Form.Item label="申请原因" name="reason" rules={[{ required: true, min: 2 }]}><Input aria-label="调整申请原因" maxLength={500} /></Form.Item>
                </Space>
                <Button loading={submitting} onClick={() => void createAdjustment()} type="primary">提交待复核申请</Button>
              </Form>
            </Card>
            <Card bordered={false} className="supplier-table-card" title="待复核与历史记录">
              <Table<Adjustment> dataSource={data?.items ?? []} loading={loading} locale={{ emptyText: <Empty description="暂无调整记录" /> }} pagination={false} rowKey="id" columns={[
                { title: '类型', dataIndex: 'businessType', render: (value: string) => <Tag>{value}</Tag> },
                { title: '账户', dataIndex: 'accountId' },
                { title: '方向/金额', render: (_: unknown, row) => `${row.direction === 'CREDIT' ? '+' : '-'}${money(row.amount)}` },
                { title: '原因', dataIndex: 'reason' },
                { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={value === 'APPROVED' ? 'green' : value === 'REJECTED' ? 'red' : 'gold'}>{value}</Tag> },
                { title: '操作', render: (_: unknown, row) => row.status === 'PENDING' ? <Button onClick={() => { setTarget(row); decisionForm.setFieldsValue({ decision: 'APPROVE', opinion: '', secondVerificationCode: '', version: row.version }); }}>独立复核</Button> : '已留痕' },
              ]} />
            </Card>
          </section>
        </section>
      </div>
      <Modal confirmLoading={submitting} onCancel={() => setTarget(undefined)} onOk={() => void decide()} open={Boolean(target)} title="福利卡调整独立复核">
        <Alert description="同一自然人跨职能账号仍不能自审；二次验证码不会持久化或返回。" message="双人复核" showIcon type="warning" />
        <Form form={decisionForm} layout="vertical">
          <Form.Item label="复核决定" name="decision" rules={[{ required: true }]}><Select aria-label="复核决定" options={[{ value: 'APPROVE', label: '通过' }, { value: 'REJECT', label: '驳回' }]} /></Form.Item>
          <Form.Item label="复核意见" name="opinion" rules={[{ required: true, min: 2 }]}><Input.TextArea aria-label="复核意见" maxLength={1000} /></Form.Item>
          <Form.Item label="二次验证码" name="secondVerificationCode" rules={[{ required: true, min: 6 }]}><Input.Password aria-label="二次验证码" maxLength={64} /></Form.Item>
        </Form>
      </Modal>
    </main>
  );
}
