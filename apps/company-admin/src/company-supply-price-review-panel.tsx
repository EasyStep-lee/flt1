import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Modal, Space, Statistic, Table, Tag, Timeline, Typography } from 'antd';
import type { components } from '@fulishe/contracts';

import { createCompanyAdminApiClient } from './api-client.js';

type Review = components['schemas']['SupplyPriceChangeDto'];
type Page = components['schemas']['SupplyPriceChangePageDto'];
type HistoryPage = components['schemas']['SupplyPriceReviewHistoryPageDto'];

const api = createCompanyAdminApiClient(import.meta.env.VITE_API_BASE_URL ?? '');

const statusLabel: Record<string, string> = {
  APPROVED: '已审核待生效',
  CANCELLED: '已取消',
  EFFECTIVE: '已生效',
  REJECTED: '已驳回',
  SUBMITTED: '待审核',
};

export function CompanySupplyPriceReviewPanel() {
  const [data, setData] = useState<Page>();
  const [target, setTarget] = useState<Review>();
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [opinion, setOpinion] = useState('');
  const [verification, setVerification] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryPage>();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'ready' | 'error' | 'offline' | 'permission' | 'unknown'>('ready');
  const pending = useRef<{ id: string; key: string } | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.GET('/v1/company/price-reviews/supply-price-changes');
      if (!response.data) {
        setData(undefined);
        setState([401, 403].includes(response.response.status) ? 'permission' : 'error');
        setMessage('供应价变更审核队列暂时无法加载。');
      } else {
        setData(response.data);
        setState('ready');
      }
    } catch {
      setData(undefined);
      setState('offline');
      setMessage('网络离线或请求超时，请恢复后刷新。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openHistory = async (review: Review) => {
    setHistoryLoading(true);
    setMessage('');
    try {
      const response = await api.GET('/v1/company/price-reviews/supply-price-changes/{taskId}/history', {
        params: { path: { taskId: review.id } },
      });
      if (!response.data) {
        setState([401, 403].includes(response.response.status) ? 'permission' : 'error');
        setMessage('历史意见暂时无法加载，请核对当前价格审核职能权限。');
        return;
      }
      setHistory(response.data);
      setState('ready');
    } catch {
      setState('offline');
      setMessage('历史意见请求超时或网络离线，请恢复后重试。');
    } finally {
      setHistoryLoading(false);
    }
  };

  const submit = async () => {
    if (!target || opinion.trim().length < 2 || !verification.trim()) return;
    const idempotencyKey = pending.current?.id === target.id ? pending.current.key : crypto.randomUUID();
    pending.current = { id: target.id, key: idempotencyKey };
    setSubmitting(true);
    try {
      const response = await api.POST('/v1/company/price-reviews/supply-price-changes/{taskId}/decision', {
        params: { header: { 'Idempotency-Key': idempotencyKey }, path: { taskId: target.id } },
        body: { decision, opinion: opinion.trim(), version: target.version, secondVerificationCode: verification },
      });
      if (!response.data) {
        setState([401, 403].includes(response.response.status) ? 'permission' : 'error');
        setMessage('供应价审核决定未提交，请核对状态、版本和二次验证。');
        return;
      }
      pending.current = undefined;
      setTarget(undefined);
      setOpinion('');
      setVerification('');
      setMessage('供应价审核决定已追加留痕；批准项只会在约定生效时间更新当前价。');
      await load();
    } catch {
      setState('unknown');
      setMessage('审核结果未知。请先刷新；若仍待处理，原操作会复用同一幂等键。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section data-m2-slice="M2-P071" data-review-state={state}>
      <div className="page-title-row">
        <div>
          <Typography.Text className="eyebrow">POST-LISTING SUPPLY PRICE REVIEW</Typography.Text>
          <Typography.Title level={2}>上架后供应价变更审核</Typography.Title>
          <Typography.Paragraph>旧供应价在批准且到达生效时间前继续有效；本职能只能审核，不能代供应商编辑价格。</Typography.Paragraph>
        </div>
        <Button onClick={() => void load()}>刷新供应价队列</Button>
      </div>
      <div className="metric-grid">
        <Card bordered={false}><Statistic title="变更记录" value={data?.total ?? 0} /></Card>
        <Card bordered={false}><Statistic title="待审核" value={data?.items.filter(({ status }) => status === 'SUBMITTED').length ?? 0} /></Card>
        <Card bordered={false}><Statistic title="销售价审核" value="不创建" valueStyle={{ color: '#0f766e' }} /></Card>
      </div>
      {message ? <Alert action={<Button onClick={() => void load()}>刷新状态</Button>} description={message} message={state === 'unknown' ? '结果未知' : state === 'permission' ? '无权访问' : '供应价审核提示'} showIcon type={state === 'ready' ? 'success' : state === 'unknown' ? 'warning' : 'error'} /> : null}
      <Card bordered={false} className="supplier-table-card">
        <Table<Review>
          dataSource={data?.items ?? []}
          loading={loading}
          locale={{ emptyText: <Empty description="暂无上架后供应价变更记录" /> }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1300 }}
          columns={[
            { title: '商品 / SKU', key: 'sku', render: (_value, row) => <Space direction="vertical" size={0}><strong>{row.productName}</strong><span>{row.skuCode}</span></Space> },
            { title: '旧供应价', dataIndex: 'oldSupplyPrice', render: (value: number) => `¥${(value / 100).toFixed(2)}` },
            { title: '申请供应价', dataIndex: 'requestedSupplyPrice', render: (value: number, row) => <Space direction="vertical" size={0}><strong>¥{(value / 100).toFixed(2)}</strong><span>{((value - row.oldSupplyPrice) / Math.max(1, row.oldSupplyPrice) * 100).toFixed(2)}%</span></Space> },
            { title: '原因', dataIndex: 'reason' },
            { title: '申请 / 约定生效时间', key: 'time', render: (_value, row) => <Space direction="vertical" size={0}><span>{row.createdAt}</span><span>{row.requestedEffectiveAt}</span></Space> },
            { title: '当前状态', dataIndex: 'status', render: (value: string) => <Tag color={value === 'SUBMITTED' ? 'processing' : value === 'EFFECTIVE' ? 'success' : value === 'REJECTED' ? 'error' : 'warning'}>{statusLabel[value] ?? value}</Tag> },
            { title: '历史版本 / 意见', key: 'history', render: (_value, row) => <Space direction="vertical" size={0}><span>V{row.version}</span><span>{row.reviewOpinion ?? '尚无审核意见'}</span></Space> },
            { title: '操作', key: 'action', render: (_value, row) => <Space direction="vertical"><Button loading={historyLoading} onClick={() => void openHistory(row)}>查看历史意见</Button>{row.status === 'SUBMITTED' ? <Button type="primary" onClick={() => setTarget(row)}>审核变更</Button> : <Typography.Text type="secondary">已追加留痕</Typography.Text>}</Space> },
          ]}
        />
      </Card>
      <Modal cancelText="取消" confirmLoading={submitting} okButtonProps={{ disabled: opinion.trim().length < 2 || !verification.trim() }} okText="提交审核决定" onCancel={() => setTarget(undefined)} onOk={() => void submit()} open={Boolean(target)} title="供应价变更审核决定">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert message="审核人必须与申请人是不同自然人；批准后按约定时间生效，历史订单价格快照不变。" showIcon type="warning" />
          <Space><Button type={decision === 'APPROVE' ? 'primary' : 'default'} onClick={() => setDecision('APPROVE')}>通过</Button><Button danger type={decision === 'REJECT' ? 'primary' : 'default'} onClick={() => setDecision('REJECT')}>驳回</Button></Space>
          <Input.TextArea aria-label="供应价审核意见" maxLength={1000} onChange={(event) => setOpinion(event.target.value)} rows={4} showCount value={opinion} />
          <Input.Password aria-label="价格审核二次验证" placeholder="二次验证口令" value={verification} onChange={(event) => setVerification(event.target.value)} />
        </Space>
      </Modal>
      <Modal
        footer={null}
        onCancel={() => setHistory(undefined)}
        open={Boolean(history)}
        title="供应价审核历史意见"
      >
        <Timeline
          items={(history?.items ?? []).map((item) => ({
            children: (
              <Space direction="vertical" size={0}>
                <strong>{item.event} · V{item.version}</strong>
                <span>{item.fromStatus ?? '创建'} → {item.toStatus}</span>
                <span>{item.opinion ?? '无审核意见'}</span>
                <Typography.Text type="secondary">{item.occurredAt}</Typography.Text>
              </Space>
            ),
          }))}
        />
      </Modal>
    </section>
  );
}
